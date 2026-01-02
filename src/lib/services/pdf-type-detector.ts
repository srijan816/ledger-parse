/**
 * Detects whether a PDF is native (text-based) or scanned (image-based)
 * Uses Python worker with pdfplumber for reliable detection
 * 
 * NOTE: This file no longer uses pdf-parse to avoid DOMMatrix errors in Node.js
 */

const PYTHON_WORKER_URL = process.env.PYTHON_WORKER_URL || 'http://localhost:8000';

export interface PDFTypeResult {
    type: 'native' | 'scanned';
    scanQuality?: 'good' | 'poor';
    pageCount: number;
    hasText: boolean;
    textDensity: number; // characters per page
    confidence: number;
}

export async function detectPDFType(buffer: Buffer): Promise<PDFTypeResult> {
    // Try to detect PDF type via Python worker first
    try {
        const formData = new FormData();
        const blob = new Blob([new Uint8Array(buffer)], { type: 'application/pdf' });
        formData.append('file', blob, 'document.pdf');

        const response = await fetch(`${PYTHON_WORKER_URL}/detect-type`, {
            method: 'POST',
            body: formData,
            signal: AbortSignal.timeout(10000), // 10s timeout
        });

        if (response.ok) {
            const result = await response.json();
            return {
                type: result.type || 'native',
                scanQuality: result.scan_quality,
                pageCount: result.page_count || 1,
                hasText: result.has_text || false,
                textDensity: result.text_density || 0,
                confidence: result.confidence || 0.8,
            };
        }
    } catch (error) {
        console.log('Python worker unavailable for type detection, using heuristics');
    }

    // Fallback: Use simple heuristics based on buffer analysis
    // Check PDF header and estimate based on buffer size
    const bufferStr = buffer.toString('utf-8', 0, Math.min(buffer.length, 5000));

    // Look for text stream indicators in PDF
    const hasTextIndicators = /BT\s/.test(bufferStr) || /\/Type\s*\/Page/.test(bufferStr);
    const hasImageIndicators = /\/XObject/.test(bufferStr) && /\/Image/.test(bufferStr);

    // Estimate page count from PDF structure
    const pageMatches = bufferStr.match(/\/Type\s*\/Page[^s]/g);
    const estimatedPages = pageMatches ? Math.max(1, pageMatches.length) : 1;

    // Heuristic: if file is large but few text indicators, likely scanned
    const bytesPerPage = buffer.length / estimatedPages;
    const likelyScanned = bytesPerPage > 500000 && !hasTextIndicators;

    return {
        type: likelyScanned ? 'scanned' : 'native',
        scanQuality: likelyScanned ? 'good' : undefined,
        pageCount: estimatedPages,
        hasText: hasTextIndicators,
        textDensity: hasTextIndicators ? 1000 : 100, // Rough estimate
        confidence: 0.6, // Lower confidence for heuristics
    };
}
