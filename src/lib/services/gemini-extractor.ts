/**
 * Gemini 3 Flash Extractor for Bank Statements
 * Uses @google/genai package with gemini-3-flash-preview model
 * Handles multi-account consolidated statements with advanced reasoning
 */

import { GoogleGenAI } from '@google/genai';
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
Return a JSON object with this exact structure:
{
  "bankName": "string or null",
  "statementPeriod": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" },
  "isMultiAccount": boolean,
  "accounts": [
    {
      "accountNumber": "string or null",
      "accountType": "string or null",
      "currency": "string or null",
      "openingBalance": number or null,
      "closingBalance": number or null,
      "transactions": []
    }
  ],
  "openingBalance": number or null,
  "closingBalance": number or null,
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": "string",
      "amount": number (absolute value),
      "type": "debit" or "credit",
      "balance": number or null
    }
  ]
}

Be thorough and precise. Missing transactions will cause reconciliation failures.`;

export async function extractWithGemini(pdfBuffer: Buffer): Promise<GeminiExtractionResult> {
    if (!GEMINI_API_KEY) {
        return { success: false, error: "Missing GEMINI_API_KEY" };
    }

    const tempFile = join(tmpdir(), `gemini-${randomUUID()}.pdf`);

    try {
        // Initialize with @google/genai
        const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

        // Check file size
        const fileSizeMB = pdfBuffer.length / (1024 * 1024);
        console.log(`PDF size: ${fileSizeMB.toFixed(2)} MB`);

        let parts: any[];

        if (fileSizeMB > 4) {
            // LARGE FILE: Use File Manager to upload directly to Google
            console.log('Using Google AI File Manager for large PDF...');

            // Write buffer to temp file
            await writeFile(tempFile, pdfBuffer);

            // Upload file using @google/genai
            const uploadResult = await ai.files.upload({
                file: tempFile,
                config: {
                    mimeType: "application/pdf",
                    displayName: "Bank Statement",
                }
            });

            if (!uploadResult?.uri) {
                throw new Error('File upload failed - no URI returned');
            }

            console.log(`File uploaded: ${uploadResult.uri}`);

            // Wait for file to be ready
            let file = uploadResult;
            while (file.state === 'PROCESSING') {
                console.log('Waiting for file processing...');
                await new Promise(resolve => setTimeout(resolve, 2000));
                const fileStatus = await ai.files.get({ name: file.name! });
                file = fileStatus;
            }

            if (file.state === 'FAILED') {
                throw new Error('File processing failed on Google servers');
            }

            // Use file URI
            parts = [
                { text: EXTRACTION_PROMPT },
                {
                    fileData: {
                        mimeType: file.mimeType || "application/pdf",
                        fileUri: file.uri!
                    }
                }
            ];
        } else {
            // SMALL FILE: Use inline base64
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

        // Config with HIGH thinking level
        const config = {
            thinkingConfig: {
                thinkingLevel: 'HIGH',
            },
            responseMimeType: 'application/json',
        };

        // Use gemini-3-flash-preview model
        const model = 'gemini-3-flash-preview';

        console.log(`Calling ${model} with HIGH thinking level...`);

        const result = await ai.models.generateContent({
            model,
            config,
            contents: [{ role: 'user', parts }],
        });

        // Get response text
        let responseText: string | undefined;

        if (result?.response?.text) {
            responseText = typeof result.response.text === 'function'
                ? result.response.text()
                : result.response.text;
        } else if (result?.text) {
            responseText = typeof result.text === 'function' ? result.text() : result.text;
        } else if (result?.candidates?.[0]?.content?.parts?.[0]?.text) {
            responseText = result.candidates[0].content.parts[0].text;
        }

        if (!responseText) {
            console.error('Gemini API Response:', JSON.stringify(result, null, 2));
            throw new Error("Empty or unexpected response structure from Gemini");
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
            usage: result?.response?.usageMetadata || result?.usageMetadata
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
            // Ignore cleanup errors
        }
    }
}
