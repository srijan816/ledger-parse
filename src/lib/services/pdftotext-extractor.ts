/**
 * PDF Text Extraction using pdftotext CLI (poppler)
 * ASYNC VERSION - Does not block the event loop
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

const execAsync = promisify(exec);

export interface PDFTextResult {
    text: string;
    pageCount: number;
    success: boolean;
    error?: string;
}

/**
 * Extract text from PDF using pdftotext CLI (async, non-blocking)
 * Falls back to returning empty result if pdftotext is not available
 */
export async function extractTextFromPDFAsync(buffer: Buffer): Promise<PDFTextResult> {
    const tempFile = join(tmpdir(), `pdf-${randomUUID()}.pdf`);

    try {
        // Write buffer to temp file (async)
        await writeFile(tempFile, buffer);

        // Run pdftotext with layout preservation (async - non-blocking!)
        const { stdout: text } = await execAsync(`pdftotext -layout "${tempFile}" -`, {
            encoding: 'utf-8',
            maxBuffer: 50 * 1024 * 1024, // 50MB
        });

        // Count pages using pdfinfo (async)
        let pageCount = 1;
        try {
            const { stdout: info } = await execAsync(`pdfinfo "${tempFile}"`, { encoding: 'utf-8' });
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
        // Clean up temp file (async)
        try {
            await unlink(tempFile);
        } catch {
            // Ignore cleanup errors
        }
    }
}

/**
 * DEPRECATED: Synchronous version - blocks event loop!
 * Kept for backward compatibility but should be migrated to extractTextFromPDFAsync
 */
export function extractTextFromPDF(buffer: Buffer): PDFTextResult {
    console.warn('WARNING: extractTextFromPDF is synchronous and blocks the event loop. Use extractTextFromPDFAsync instead.');

    // This is a stop-gap: we can't make sync code async without changing callers
    // For now, return a stub that indicates the caller should upgrade
    const { execSync } = require('child_process');
    const { writeFileSync, unlinkSync } = require('fs');

    const tempFile = join(tmpdir(), `pdf-${randomUUID()}.pdf`);

    try {
        writeFileSync(tempFile, buffer);

        const text = execSync(`pdftotext -layout "${tempFile}" -`, {
            encoding: 'utf-8',
            maxBuffer: 50 * 1024 * 1024,
        });

        let pageCount = 1;
        try {
            const info = execSync(`pdfinfo "${tempFile}"`, { encoding: 'utf-8' });
            const pagesMatch = info.match(/Pages:\s+(\d+)/);
            if (pagesMatch) {
                pageCount = parseInt(pagesMatch[1], 10);
            }
        } catch {
            pageCount = Math.max(1, Math.ceil(text.length / 3000));
        }

        return { text, pageCount, success: true };
    } catch (error) {
        console.error('pdftotext extraction failed:', error);
        return {
            text: '',
            pageCount: 0,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        };
    } finally {
        try {
            unlinkSync(tempFile);
        } catch {
            // Ignore
        }
    }
}
