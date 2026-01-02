"""
LedgerParse Python Processing Worker
Handles OCR, preprocessing, and table detection for scanned PDFs
"""

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import tempfile
import os
import json
import subprocess
import base64
from io import BytesIO
# OCR imports
import pytesseract
from PIL import Image
import pdf2image

# Lazy loaded libraries
easyocr = None
GMFT_AVAILABLE = False

try:
    # Check if we can import torch without crashing
    import torch
except ImportError:
    pass

app = FastAPI(title="LedgerParse PDF Worker")

# CORS for Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize EasyOCR (lazy load)
easyocr_reader = None

def get_easyocr():
    global easyocr_reader, easyocr
    if easyocr is None:
        try:
            import easyocr as ez
            easyocr = ez
        except Exception as e:
            print(f"EasyOCR import failed: {e}")
            return None
            
    if easyocr_reader is None and easyocr:
        easyocr_reader = easyocr.Reader(['en'], gpu=False)
    return easyocr_reader


class Transaction(BaseModel):
    date: Optional[str]
    description: str
    amount: Optional[float]
    type: str  # 'debit', 'credit', 'unknown'
    balance: Optional[float]
    confidence: float
    bbox: Optional[dict]
    raw_text: str


class ExtractionResult(BaseModel):
    success: bool
    method: str  # 'tesseract', 'easyocr', 'gmft'
    transactions: List[Transaction]
    opening_balance: Optional[float]
    closing_balance: Optional[float]
    page_count: int
    confidence: float
    errors: List[str]


class PreprocessResult(BaseModel):
    success: bool
    enhanced_path: str
    quality_score: float
    was_deskewed: bool
    was_enhanced: bool


@app.get("/health")
async def health_check():
    return {"status": "healthy", "gmft_available": GMFT_AVAILABLE}

@app.post("/pdf-to-images")
async def pdf_to_images(file: UploadFile = File(...)):
    """
    Convert PDF to base64 images for Claude Vision
    """
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        # Convert to images
        images = pdf2image.convert_from_path(tmp_path, dpi=200, fmt='png')
        images_b64 = []
        
        for img in images:
            buffered = BytesIO()
            img.save(buffered, format="PNG")
            img_b64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
            images_b64.append(img_b64)
            
        return {"success": True, "images": images_b64}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if 'tmp_path' in locals() and os.path.exists(tmp_path):
            os.unlink(tmp_path)


@app.post("/preprocess", response_model=PreprocessResult)
async def preprocess_pdf(file: UploadFile = File(...)):
    """
    Preprocess scanned PDF: deskew, enhance contrast, clean noise
    Uses ocrmypdf for preprocessing
    """
    errors = []
    
    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp_input:
        content = await file.read()
        tmp_input.write(content)
        tmp_input_path = tmp_input.name
    
    tmp_output_path = tmp_input_path.replace('.pdf', '_enhanced.pdf')
    
    try:
        # Run ocrmypdf for preprocessing (deskew, clean, but skip OCR layer)
        result = subprocess.run([
            'ocrmypdf',
            '--deskew',
            '--clean',
            '--remove-background',
            '--skip-text',  # Don't add OCR layer, we'll do that separately
            '--output-type', 'pdf',
            tmp_input_path,
            tmp_output_path
        ], capture_output=True, text=True, timeout=120)
        
        if result.returncode != 0:
            errors.append(f"ocrmypdf warning: {result.stderr}")
        
        # Check if output was created
        if os.path.exists(tmp_output_path):
            return PreprocessResult(
                success=True,
                enhanced_path=tmp_output_path,
                quality_score=0.8,
                was_deskewed=True,
                was_enhanced=True
            )
        else:
            # Fallback: use original
            return PreprocessResult(
                success=True,
                enhanced_path=tmp_input_path,
                quality_score=0.5,
                was_deskewed=False,
                was_enhanced=False
            )
            
    except Exception as e:
        return PreprocessResult(
            success=False,
            enhanced_path=tmp_input_path,
            quality_score=0.3,
            was_deskewed=False,
            was_enhanced=False
        )


@app.post("/extract/tesseract", response_model=ExtractionResult)
async def extract_with_tesseract(file: UploadFile = File(...)):
    """
    Extract text using Tesseract OCR
    Best for good quality scans (300 DPI+)
    """
    errors = []
    transactions = []
    
    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        # Convert PDF to images
        images = pdf2image.convert_from_path(tmp_path, dpi=300)
        page_count = len(images)
        
        all_text = []
        for i, image in enumerate(images):
            # Get text with bounding boxes
            data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
            
            # Also get plain text for balance extraction
            text = pytesseract.image_to_string(image)
            all_text.append(text)
            
            # Parse the OCR data into transactions
            page_transactions = parse_tesseract_output(data, i + 1)
            transactions.extend(page_transactions)
        
        full_text = '\n'.join(all_text)
        opening_balance, closing_balance = extract_balances_from_text(full_text)
        
        avg_confidence = sum(t.confidence for t in transactions) / len(transactions) if transactions else 0.5
        
        return ExtractionResult(
            success=True,
            method='tesseract',
            transactions=transactions,
            opening_balance=opening_balance,
            closing_balance=closing_balance,
            page_count=page_count,
            confidence=avg_confidence,
            errors=errors
        )
        
    except Exception as e:
        errors.append(str(e))
        return ExtractionResult(
            success=False,
            method='tesseract',
            transactions=[],
            opening_balance=None,
            closing_balance=None,
            page_count=0,
            confidence=0,
            errors=errors
        )
    finally:
        os.unlink(tmp_path)


@app.post("/extract/easyocr", response_model=ExtractionResult)
async def extract_with_easyocr(file: UploadFile = File(...)):
    """
    Extract text using EasyOCR
    Better for poor quality scans, handwriting, or degraded images
    """
    errors = []
    transactions = []
    reader = get_easyocr()
    
    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        # Convert PDF to images
        images = pdf2image.convert_from_path(tmp_path, dpi=300)
        page_count = len(images)
        
        all_text = []
        for i, image in enumerate(images):
            # Save image temporarily for EasyOCR
            with tempfile.NamedTemporaryFile(delete=False, suffix='.png') as img_tmp:
                image.save(img_tmp.name)
                
                # EasyOCR extraction with bounding boxes
                results = reader.readtext(img_tmp.name)
                
                page_text = ' '.join([r[1] for r in results])
                all_text.append(page_text)
                
                # Parse results into transactions
                page_transactions = parse_easyocr_output(results, i + 1)
                transactions.extend(page_transactions)
                
                os.unlink(img_tmp.name)
        
        full_text = '\n'.join(all_text)
        opening_balance, closing_balance = extract_balances_from_text(full_text)
        
        avg_confidence = sum(t.confidence for t in transactions) / len(transactions) if transactions else 0.5
        
        return ExtractionResult(
            success=True,
            method='easyocr',
            transactions=transactions,
            opening_balance=opening_balance,
            closing_balance=closing_balance,
            page_count=page_count,
            confidence=avg_confidence,
            errors=errors
        )
        
    except Exception as e:
        errors.append(str(e))
        return ExtractionResult(
            success=False,
            method='easyocr',
            transactions=[],
            opening_balance=None,
            closing_balance=None,
            page_count=0,
            confidence=0,
            errors=errors
        )
    finally:
        os.unlink(tmp_path)


@app.post("/extract/gmft", response_model=ExtractionResult)
async def extract_with_gmft(file: UploadFile = File(...)):
    """
    Extract tables using GMFT (General Multi-Format Table) detector
    SOTA for table structure recognition
    """
    # Try importing GMFT here
    try:
        from gmft import AutoTableDetector, AutoTableFormatter
        from gmft.pdf_bindings import PyPDFium2Document
        GMFT_AVAILABLE = True
    except:
        GMFT_AVAILABLE = False
        
    if not GMFT_AVAILABLE:
        raise HTTPException(status_code=501, detail="GMFT not available on this worker")
    
    errors = []
    transactions = []
    
    with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name
    
    try:
        # Initialize GMFT
        detector = AutoTableDetector()
        formatter = AutoTableFormatter()
        
        # Load document
        doc = PyPDFium2Document(tmp_path)
        page_count = len(doc)
        
        all_tables = []
        for page_idx, page in enumerate(doc):
            # Detect tables on page
            tables = detector.extract(page)
            
            for table in tables:
                # Format table into structured data
                formatted = formatter.extract(table)
                df = formatted.df()  # Get as pandas DataFrame
                
                # Convert DataFrame rows to transactions
                for _, row in df.iterrows():
                    transaction = dataframe_row_to_transaction(row, page_idx + 1)
                    if transaction:
                        transactions.append(transaction)
        
        doc.close()
        
        # Extract balances from first/last detected values
        opening_balance = None
        closing_balance = None
        if transactions:
            # Try to identify balance column
            for t in transactions:
                if t.balance is not None:
                    if opening_balance is None:
                        opening_balance = t.balance
                    closing_balance = t.balance
        
        avg_confidence = sum(t.confidence for t in transactions) / len(transactions) if transactions else 0.7
        
        return ExtractionResult(
            success=True,
            method='gmft',
            transactions=transactions,
            opening_balance=opening_balance,
            closing_balance=closing_balance,
            page_count=page_count,
            confidence=avg_confidence,
            errors=errors
        )
        
    except Exception as e:
        errors.append(str(e))
        return ExtractionResult(
            success=False,
            method='gmft',
            transactions=[],
            opening_balance=None,
            closing_balance=None,
            page_count=0,
            confidence=0,
            errors=errors
        )
    finally:
        os.unlink(tmp_path)


# Helper functions

def parse_tesseract_output(data: dict, page_number: int) -> List[Transaction]:
    """Parse Tesseract output dictionary into transactions"""
    transactions = []
    
    # Group by line number
    lines = {}
    for i, word in enumerate(data['text']):
        if not word.strip():
            continue
        line_num = data['line_num'][i]
        if line_num not in lines:
            lines[line_num] = {
                'text': [],
                'confidences': [],
                'bboxes': []
            }
        lines[line_num]['text'].append(word)
        lines[line_num]['confidences'].append(data['conf'][i])
        lines[line_num]['bboxes'].append({
            'x': data['left'][i],
            'y': data['top'][i],
            'w': data['width'][i],
            'h': data['height'][i]
        })
    
    # Parse each line
    for line_num, line_data in lines.items():
        line_text = ' '.join(line_data['text'])
        avg_conf = sum(c for c in line_data['confidences'] if c > 0) / max(len([c for c in line_data['confidences'] if c > 0]), 1)
        
        transaction = parse_line_to_transaction(line_text, avg_conf / 100, page_number, line_data['bboxes'])
        if transaction:
            transactions.append(transaction)
    
    return transactions


def parse_easyocr_output(results: list, page_number: int) -> List[Transaction]:
    """Parse EasyOCR results into transactions"""
    transactions = []
    
    # Group by approximate Y coordinate (same line)
    sorted_results = sorted(results, key=lambda x: (x[0][0][1], x[0][0][0]))
    
    lines = []
    current_line = []
    current_y = None
    
    for bbox, text, conf in sorted_results:
        y = bbox[0][1]
        if current_y is None or abs(y - current_y) < 20:
            current_line.append((bbox, text, conf))
            current_y = y
        else:
            if current_line:
                lines.append(current_line)
            current_line = [(bbox, text, conf)]
            current_y = y
    if current_line:
        lines.append(current_line)
    
    # Parse each line
    for line in lines:
        line_text = ' '.join([item[1] for item in line])
        avg_conf = sum(item[2] for item in line) / len(line)
        
        # Get bounding box for whole line
        all_x = [coord for item in line for coord in [item[0][0][0], item[0][2][0]]]
        all_y = [coord for item in line for coord in [item[0][0][1], item[0][2][1]]]
        bbox = {
            'x1': min(all_x),
            'y1': min(all_y),
            'x2': max(all_x),
            'y2': max(all_y),
            'page': page_number
        }
        
        transaction = parse_line_to_transaction(line_text, avg_conf, page_number, [bbox])
        if transaction:
            transactions.append(transaction)
    
    return transactions


def parse_line_to_transaction(text: str, confidence: float, page: int, bboxes: list) -> Optional[Transaction]:
    """Parse a single line of text into a transaction if it matches"""
    import re
    
    # Skip obvious non-transaction lines
    skip_patterns = [
        r'^page\s*\d+',
        r'^\s*$',
        r'customer\s*service',
        r'www\.',
        r'statement\s*period',
    ]
    for pattern in skip_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            return None
    
    # Look for date
    date_match = re.search(r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})', text)
    date = date_match.group(1) if date_match else None
    
    # Look for amounts
    amount_matches = re.findall(r'\$?\s*-?\(?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\)?', text)
    if not amount_matches:
        return None
    
    # Parse primary amount
    amount_str = amount_matches[-1]
    is_negative = '(' in amount_str or '-' in amount_str
    try:
        amount = float(re.sub(r'[$,()]', '', amount_str).replace('-', ''))
        if is_negative:
            amount = -amount
    except:
        return None
    
    # Get description
    description = text
    if date:
        description = description.replace(date, '')
    for amt in amount_matches:
        description = description.replace(amt, '')
    description = ' '.join(description.split()).strip()[:200]
    
    # Determine type
    tx_type = 'debit' if amount < 0 else 'credit' if amount > 0 else 'unknown'
    
    # Build bbox
    bbox = None
    if bboxes:
        if 'x1' in bboxes[0]:
            bbox = bboxes[0]
        else:
            bbox = {
                'x1': min(b['x'] for b in bboxes),
                'y1': min(b['y'] for b in bboxes),
                'x2': max(b['x'] + b['w'] for b in bboxes),
                'y2': max(b['y'] + b['h'] for b in bboxes),
                'page': page
            }
    
    return Transaction(
        date=date,
        description=description,
        amount=abs(amount),
        type=tx_type,
        balance=None,  # Would need column analysis
        confidence=confidence,
        bbox=bbox,
        raw_text=text
    )


def dataframe_row_to_transaction(row, page_number: int) -> Optional[Transaction]:
    """Convert a pandas DataFrame row from GMFT to a Transaction"""
    # This depends on the detected column headers
    # GMFT preserves column names, so we look for common patterns
    
    date = None
    description = ''
    amount = None
    balance = None
    tx_type = 'unknown'
    
    for col, value in row.items():
        col_lower = str(col).lower()
        val_str = str(value).strip()
        
        if not val_str or val_str == 'nan':
            continue
        
        if 'date' in col_lower:
            date = val_str
        elif 'description' in col_lower or 'memo' in col_lower or 'detail' in col_lower:
            description = val_str
        elif 'debit' in col_lower or 'withdrawal' in col_lower:
            try:
                amount = -abs(float(val_str.replace('$', '').replace(',', '')))
                tx_type = 'debit'
            except:
                pass
        elif 'credit' in col_lower or 'deposit' in col_lower:
            try:
                amount = abs(float(val_str.replace('$', '').replace(',', '')))
                tx_type = 'credit'
            except:
                pass
        elif 'balance' in col_lower:
            try:
                balance = float(val_str.replace('$', '').replace(',', ''))
            except:
                pass
        elif 'amount' in col_lower and amount is None:
            try:
                amount = float(val_str.replace('$', '').replace(',', '').replace('(', '-').replace(')', ''))
                tx_type = 'debit' if amount < 0 else 'credit'
            except:
                pass
    
    if amount is None and not description:
        return None
    
    return Transaction(
        date=date,
        description=description[:200] if description else '',
        amount=abs(amount) if amount else 0,
        type=tx_type,
        balance=balance,
        confidence=0.85,  # GMFT is generally reliable
        bbox=None,  # GMFT can provide this with more work
        raw_text=str(row.to_dict())
    )


def extract_balances_from_text(text: str) -> tuple:
    """Extract opening and closing balances from full text"""
    import re
    
    opening_balance = None
    closing_balance = None
    
    opening_patterns = [
        r'(?:opening|beginning|starting|previous)\s*balance[:\s]*\$?\s*([\d,]+\.?\d*)',
        r'balance\s*(?:forward|brought\s*forward)[:\s]*\$?\s*([\d,]+\.?\d*)',
    ]
    
    closing_patterns = [
        r'(?:closing|ending|new|current)\s*balance[:\s]*\$?\s*([\d,]+\.?\d*)',
    ]
    
    for pattern in opening_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            try:
                opening_balance = float(match.group(1).replace(',', ''))
                break
            except:
                pass
    
    for pattern in closing_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            try:
                closing_balance = float(match.group(1).replace(',', ''))
                break
            except:
                pass
    
    return opening_balance, closing_balance


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
