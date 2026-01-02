/**
 * Gemini Extractor for Bank Statements
 * Uses Google AI File API for memory-safe large PDF handling
 * Handles multi-account consolidated statements with advanced reasoning
 * 
 * IMPORTANT: Uses @google/generative-ai for File API (GoogleAIFileManager)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

interface GeminiExtractionResult {
    success: boolean;
    data?: any;
    error?: string;
    usage?: any;
}

const EXTRACTION_PROMPT = `You are analyzing a bank statement PDF. Extract ALL financial transactions with high precision.

## CRITICAL INSTRUCTIONS

1. **Identify Account Structure**: Look for signs of consolidated/multi-account statements:
   - Multiple account numbers or account sections
   - Different account types (Savings, Current, Credit Card, etc.)
   - Different currencies
   - Separate transaction tables per account

2. **For EACH account found**, extract:
   - Account number (may be partially masked)
   - Account type
   - Currency
   - Opening balance (look for "Balance from previous statement", "Opening Balance", "Balance B/F")
   - Closing balance (look for "Closing Balance", "Balance C/F", end-of-period balance)
   - ALL transactions in that account

3. **For EACH transaction**, determine:
   - Date: Convert to YYYY-MM-DD format. Infer year from statement period if not explicit.
   - Description: Combine multi-line descriptions. Remove extra whitespace.
   - Amount: Extract as absolute number (no signs, no currency symbols)
   - Type: 
     * "credit" = deposits, income, money IN (usually shown in "Credit"/"Deposit" column or with + sign)
     * "debit" = withdrawals, payments, money OUT (usually in "Debit"/"Withdrawal" column, parentheses, or - sign)
   - Balance: Running balance after this transaction if shown

4. **Column Detection**: Bank statements typically have columns. Identify column headers to correctly categorize amounts as debit vs credit.

5. **Handle edge cases**:
   - Interest earned = credit
   - Bank charges/fees = debit
   - Transfers between own accounts appear in both
   - Foreign currency transactions

## Output Requirements
Return a JSON object with:
- bankName: string (detected bank name)
- statementPeriod: { start: "YYYY-MM-DD", end: "YYYY-MM-DD" }
- isMultiAccount: boolean
- accounts: array of account objects with their own transactions
- openingBalance: number (overall/primary)
- closingBalance: number (overall/primary)
- transactions: array of ALL transactions combined

Be thorough and precise. Missing transactions will cause reconciliation failures.`;

export async function extractWithGemini(pdfBuffer: Buffer): Promise<GeminiExtractionResult> {
    if (!GEMINI_API_KEY) {
        return { success: false, error: "Missing GEMINI_API_KEY" };
    }

    const tempFile = join(tmpdir(), `gemini-${randomUUID()}.pdf`);

    try {
        // Check file size
        const fileSizeMB = pdfBuffer.length / (1024 * 1024);
        console.log(`PDF size: ${fileSizeMB.toFixed(2)} MB`);

        // Initialize clients
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        let parts: any[];

        if (fileSizeMB > 4) {
            // LARGE FILE: Use File Manager to upload directly to Google
            console.log('Using Google AI File Manager for large PDF...');

            // Write buffer to temp file
            await writeFile(tempFile, pdfBuffer);

            // Initialize file manager
            const fileManager = new GoogleAIFileManager(GEMINI_API_KEY);

            // Upload file
            const uploadResult = await fileManager.uploadFile(tempFile, {
                mimeType: "application/pdf",
                displayName: "Bank Statement",
            });

            console.log(`File uploaded: ${uploadResult.file.uri}`);

            // Wait for file to be ready (ACTIVE state)
            let file = await fileManager.getFile(uploadResult.file.name);
            while (file.state === 'PROCESSING') {
                console.log('Waiting for file processing...');
                await new Promise(resolve => setTimeout(resolve, 2000));
                file = await fileManager.getFile(uploadResult.file.name);
            }

            if (file.state === 'FAILED') {
                throw new Error('File processing failed on Google servers');
            }

            // Use file URI instead of inline data
            parts = [
                { text: EXTRACTION_PROMPT },
                {
                    fileData: {
                        mimeType: file.mimeType,
                        fileUri: file.uri
                    }
                }
            ];
        } else {
            // SMALL FILE: Use inline base64 (faster for small files)
            console.log('Using inline base64 for small PDF...');
            const base64Data = pdfBuffer.toString('base64');

            parts = [
                { text: EXTRACTION_PROMPT },
                {
                    inlineData: {
                        mimeType: "application/pdf",
                        data: base64Data
                    }
                }
            ];
        }

        console.log('Calling Gemini...');
        const result = await model.generateContent({
            contents: [{ role: 'user', parts }],
            generationConfig: {
                responseMimeType: 'application/json',
            },
        });

        const response = result.response;
        const responseText = response.text();

        if (!responseText) {
            throw new Error("Empty response from Gemini");
        }

        const data = JSON.parse(responseText);

        // Log summary for debugging
        console.log('Gemini Extraction Summary:', {
            bankName: data.bankName,
            isMultiAccount: data.isMultiAccount,
            accountCount: data.accounts?.length || 0,
            totalTransactions: data.transactions?.length || 0,
            openingBalance: data.openingBalance,
            closingBalance: data.closingBalance,
        });

        return {
            success: true,
            data,
            usage: response.usageMetadata
        };

    } catch (error: any) {
        console.error("Gemini Extraction Error:", error);
        return {
            success: false,
            error: error.message || "Unknown error during Gemini extraction"
        };
    } finally {
        // Cleanup temp file
        try {
            await unlink(tempFile);
        } catch {
            // Ignore cleanup errors - file may not exist if we used inline
        }
    }
}
