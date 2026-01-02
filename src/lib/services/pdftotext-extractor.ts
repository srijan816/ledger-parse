/**
 * PDF Text Extraction using pdftotext CLI (poppler)
 * This is more reliable than JavaScript PDF libraries for server-side extraction
 */

import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

export interface PDFTextResult {
    text: string;
    pageCount: number;
    success: boolean;
    error?: string;
}

/**
 * Extract text from PDF using pdftotext CLI
 * Falls back to returning empty result if pdftotext is not available
 */
export function extractTextFromPDF(buffer: Buffer): PDFTextResult {
    const tempFile = join(tmpdir(), `pdf-${randomUUID()}.pdf`);

    try {
        // Write buffer to temp file
        writeFileSync(tempFile, buffer);

        // Run pdftotext with layout preservation
        const text = execSync(`pdftotext -layout "${tempFile}" -`, {
            encoding: 'utf-8',
            maxBuffer: 50 * 1024 * 1024, // 50MB
        });

        // Count pages using pdfinfo
        let pageCount = 1;
        try {
            const info = execSync(`pdfinfo "${tempFile}"`, { encoding: 'utf-8' });
            const pagesMatch = info.match(/Pages:\s+(\d+)/);
            if (pagesMatch) {
                pageCount = parseInt(pagesMatch[1], 10);
            }
        } catch {
            // pdfinfo not available, estimate from text
            pageCount = Math.max(1, Math.ceil(text.length / 3000));
        }

        return {
            text,
            pageCount,
            success: true,
        };
    } catch (error) {
        console.error('pdftotext extraction failed:', error);
        return {
            text: '',
            pageCount: 0,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    } finally {
        // Clean up temp file
        try {
            unlinkSync(tempFile);
        } catch {
            // Ignore cleanup errors
        }
    }
}
