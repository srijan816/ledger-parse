/**
 * Detects whether a PDF is native (text-based) or scanned (image-based)
 * Uses pdftotext CLI (poppler) for reliable text extraction
 */

import { extractTextFromPDF } from './pdftotext-extractor';

export interface PDFTypeResult {
    type: 'native' | 'scanned';
    scanQuality?: 'good' | 'poor';
    pageCount: number;
    hasText: boolean;
    textDensity: number; // characters per page
    confidence: number;
}

export async function detectPDFType(buffer: Buffer): Promise<PDFTypeResult> {
    try {
        const result = extractTextFromPDF(buffer);

        if (!result.success) {
            console.error('PDF type detection failed:', result.error);
            return {
                type: 'native',
                pageCount: 0,
                hasText: false,
                textDensity: 0,
                confidence: 0.3
            };
        }

        const pageCount = result.pageCount;
        const totalChars = result.text.length;
        const avgCharsPerPage = totalChars / pageCount;

        console.log(`PDF Type: pageCount=${pageCount}, totalChars=${totalChars}, avgCharsPerPage=${avgCharsPerPage.toFixed(0)}`);

        // Native PDFs typically have 500+ chars per page
        // Scanned PDFs with embedded OCR might have some text but often garbled or sparse
        const hasSubstantialText = avgCharsPerPage > 500;

        if (hasSubstantialText) {
            return {
                type: 'native',
                pageCount,
                hasText: true,
                textDensity: avgCharsPerPage,
                confidence: 0.95
            };
        }

        // It's likely scanned - need to assess quality
        return {
            type: 'scanned',
            scanQuality: avgCharsPerPage > 200 ? 'good' : 'poor',
            pageCount,
            hasText: avgCharsPerPage > 50,
            textDensity: avgCharsPerPage,
            confidence: 0.8
        };
    } catch (error) {
        console.error('PDF type detection failed:', error);
        return {
            type: 'native',
            pageCount: 0,
            hasText: false,
            textDensity: 0,
            confidence: 0.3
        };
    }
}
