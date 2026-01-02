/**
 * PDF Text Extraction - PURE JAVASCRIPT (No System Dependencies!)
 * Uses pdf-parse library - works on Vercel, Lambda, any Node environment
 */

// @ts-ignore - pdf-parse is a CommonJS module
const pdfParse = require('pdf-parse');

export interface PDFTextResult {
    text: string;
    pageCount: number;
    success: boolean;
    error?: string;
}

/**
 * Extract text from PDF using pdf-parse (pure JavaScript, browserless)
 * This works in ALL Node.js environments without system dependencies
 */
export async function extractTextFromPDFAsync(buffer: Buffer): Promise<PDFTextResult> {
    try {
        const data = await pdfParse(buffer, {
            // Increase max pages for large statements
            max: 50,
        });

        return {
            text: data.text || '',
            pageCount: data.numpages || 1,
            success: true,
        };
    } catch (error) {
        console.error('PDF text extraction failed:', error);
        return {
            text: '',
            pageCount: 0,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    }
}

/**
 * DEPRECATED - Kept for backward compatibility
 * Prefer extractTextFromPDFAsync for non-blocking execution
 */
export function extractTextFromPDF(buffer: Buffer): PDFTextResult {
    console.warn('DEPRECATED: Use extractTextFromPDFAsync instead');
    // Since pdf-parse is async-only, we can't provide true sync
    // Return a stub pointing to async version
    return {
        text: '',
        pageCount: 0,
        success: false,
        error: 'Sync extraction not supported. Use extractTextFromPDFAsync.',
    };
}
