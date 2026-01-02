import sys
import json
import base64
import os
from io import BytesIO
from pdf2image import convert_from_bytes
import pytesseract
import easyocr

# Initialize EasyOCR reader once (it loads models into memory)
# Using CPU by default to avoid CUDA deps, unless GPU is available
reader = easyocr.Reader(['en'], gpu=False)

def process_pdf(pdf_bytes, strategy='auto'):
    """
    Process PDF based on strategy: 'tesseract', 'easyocr', or 'hybrid'
    """
    images = convert_from_bytes(pdf_bytes)
    results = []

    for i, image in enumerate(images):
        page_text = ""
        
        # Strategy 1: Tesseract (Faster, good for clean scans)
        if strategy in ['auto', 'tesseract']:
            page_text = pytesseract.image_to_string(image)
        
        # Strategy 2: EasyOCR (Slower, better for noisy/tilted text)
        # If strategy is 'auto' and Tesseract output is sparse/poor, fall back to EasyOCR
        if strategy == 'easyocr' or (strategy == 'auto' and len(page_text.strip()) < 50):
             # EasyOCR returns list of (bbox, text, prob)
             details = reader.readtext(image) 
             page_text = "\n".join([item[1] for item in details])
        
        results.append({
            "page": i + 1,
            "text": page_text
        })

    return results

if __name__ == "__main__":
    try:
        # Read input from stdin (JSON string with base64 encoded PDF)
        input_data = sys.stdin.read()
        if not input_data:
            raise ValueError("No input data received")

        data = json.loads(input_data)
        pdf_b64 = data.get('pdf_base64')
        strategy = data.get('strategy', 'auto')
        
        if not pdf_b64:
             raise ValueError("Missing pdf_base64 field")

        pdf_bytes = base64.b64decode(pdf_b64)
        
        output = process_pdf(pdf_bytes, strategy)
        
        # Print result as JSON to stdout
        print(json.dumps({"success": True, "data": output}))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)
