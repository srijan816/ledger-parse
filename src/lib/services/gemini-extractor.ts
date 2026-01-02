/**
 * Gemini 3 Flash Extractor for Bank Statements
 * Uses Google AI File API for memory-safe large PDF handling
 * Handles multi-account consolidated statements with advanced reasoning
 */

import { GoogleGenAI } from '@google/genai';
import { writeFile, unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Define SchemaType locally
const SchemaType = {
    STRING: "STRING",
    NUMBER: "NUMBER",
    INTEGER: "INTEGER",
    BOOLEAN: "BOOLEAN",
    ARRAY: "ARRAY",
    OBJECT: "OBJECT"
} as const;

// Transaction schema
const transactionSchema = {
    type: SchemaType.OBJECT,
    properties: {
        date: { type: SchemaType.STRING, description: "Transaction date in YYYY-MM-DD format" },
        description: { type: SchemaType.STRING, description: "Full transaction description (combine multi-line if needed)" },
        amount: { type: SchemaType.NUMBER, description: "Absolute transaction amount as a number" },
        type: { type: SchemaType.STRING, enum: ["debit", "credit"], description: "debit for withdrawals/payments, credit for deposits/income" },
        balance: { type: SchemaType.NUMBER, nullable: true, description: "Running balance after this transaction" },
        category: { type: SchemaType.STRING, nullable: true, description: "Transaction category if identifiable" },
    },
    required: ["date", "description", "amount", "type"],
};

// Account schema for multi-account support
const accountSchema = {
    type: SchemaType.OBJECT,
    properties: {
        accountNumber: { type: SchemaType.STRING, nullable: true, description: "Account number (masked or full)" },
        accountType: { type: SchemaType.STRING, nullable: true, description: "e.g. Savings, Checking, Current, Credit Card" },
        currency: { type: SchemaType.STRING, nullable: true, description: "Currency code (HKD, USD, etc.)" },
        openingBalance: { type: SchemaType.NUMBER, nullable: true },
        closingBalance: { type: SchemaType.NUMBER, nullable: true },
        transactions: {
            type: SchemaType.ARRAY,
            items: transactionSchema,
            description: "All transactions for this specific account"
        },
    },
    required: ["transactions"],
};

// Full extraction schema with multi-account support
const extractionSchema = {
    type: SchemaType.OBJECT,
    properties: {
        bankName: { type: SchemaType.STRING, nullable: true },
        statementDate: { type: SchemaType.STRING, nullable: true, description: "Statement date in YYYY-MM-DD" },
        statementPeriod: {
            type: SchemaType.OBJECT,
            properties: {
                start: { type: SchemaType.STRING, nullable: true },
                end: { type: SchemaType.STRING, nullable: true },
            },
            nullable: true,
        },
        customerName: { type: SchemaType.STRING, nullable: true },
        isMultiAccount: { type: SchemaType.BOOLEAN, description: "True if this is a consolidated statement with multiple accounts" },
        accounts: {
            type: SchemaType.ARRAY,
            items: accountSchema,
            description: "Array of accounts found in the statement"
        },
        openingBalance: { type: SchemaType.NUMBER, nullable: true, description: "Overall opening balance (sum if multi-account)" },
        closingBalance: { type: SchemaType.NUMBER, nullable: true, description: "Overall closing balance (sum if multi-account)" },
        transactions: {
            type: SchemaType.ARRAY,
            items: transactionSchema,
            description: "ALL transactions from all accounts combined"
        },
    },
    required: ["transactions"],
};

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
- Return valid JSON matching the provided schema
- Include ALL transactions - do not skip any
- The "transactions" array at root level should contain ALL transactions from ALL accounts combined
- The "accounts" array should contain per-account breakdowns
- Set "isMultiAccount" to true if multiple accounts are detected

Be thorough and precise. Missing transactions will cause reconciliation failures.`;

export async function extractWithGemini(pdfBuffer: Buffer): Promise<GeminiExtractionResult> {
    if (!GEMINI_API_KEY) {
        return { success: false, error: "Missing GEMINI_API_KEY" };
    }

    // Write buffer to temp file for File API upload
    const tempFile = join(tmpdir(), `gemini-${randomUUID()}.pdf`);

    try {
        const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

        // Check file size - use File API for large files, inline for small
        const fileSizeMB = pdfBuffer.length / (1024 * 1024);
        console.log(`PDF size: ${fileSizeMB.toFixed(2)} MB`);

        let contents: any[];

        if (fileSizeMB > 4) {
            // LARGE FILE: Use File API to avoid memory issues
            console.log('Using Gemini File API for large PDF...');

            await writeFile(tempFile, pdfBuffer);

            // Upload file to Google AI
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

            // Wait for file to be processed
            let file = uploadResult;
            while (file.state === 'PROCESSING') {
                await new Promise(resolve => setTimeout(resolve, 1000));
                const fileStatus = await ai.files.get({ name: file.name! });
                file = fileStatus;
            }

            if (file.state === 'FAILED') {
                throw new Error('File processing failed on Google servers');
            }

            contents = [{
                role: 'user',
                parts: [
                    { text: EXTRACTION_PROMPT },
                    {
                        fileData: {
                            mimeType: file.mimeType || "application/pdf",
                            fileUri: file.uri!
                        }
                    }
                ],
            }];
        } else {
            // SMALL FILE: Use inline base64 (faster for small files)
            console.log('Using inline base64 for small PDF...');
            const base64Data = pdfBuffer.toString('base64');

            contents = [{
                role: 'user',
                parts: [
                    { text: EXTRACTION_PROMPT },
                    {
                        inlineData: {
                            mimeType: "application/pdf",
                            data: base64Data
                        }
                    }
                ],
            }];
        }

        const model = 'gemini-2.5-flash-preview-05-20';

        // Enable HIGH thinking level for better analysis
        const config = {
            thinkingConfig: {
                thinkingBudget: 10000,
            },
            responseMimeType: 'application/json',
            responseSchema: extractionSchema,
        };

        console.log('Calling Gemini with thinking budget...');
        const result = await ai.models.generateContent({
            model,
            contents,
            config
        });

        // Handle different possible response structures
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
