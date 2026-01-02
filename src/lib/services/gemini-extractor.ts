/**
 * Gemini 3 Flash Extractor for Bank Statements
 * Handles multi-account consolidated statements with advanced reasoning
 */

import { GoogleGenAI } from '@google/genai';
import { Buffer } from 'buffer';

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
            description: "List of accounts. Single-account statements will have one item."
        },
        // Legacy fields for backward compatibility (populated from first/primary account)
        openingBalance: { type: SchemaType.NUMBER, nullable: true },
        closingBalance: { type: SchemaType.NUMBER, nullable: true },
        transactions: {
            type: SchemaType.ARRAY,
            items: transactionSchema,
            description: "All transactions combined (for backward compatibility)"
        },
    },
    required: ["accounts", "transactions"],
};

export interface GeminiExtractionResult {
    success: boolean;
    data?: any;
    error?: string;
    usage?: any;
}

const EXTRACTION_PROMPT = `You are an expert financial document analyst. Analyze this bank statement PDF with careful attention to detail.

## Your Task
Extract ALL transaction details and account information from this bank statement into structured JSON.

## Critical Analysis Steps
1. **Identify if this is a CONSOLIDATED/MULTI-ACCOUNT statement** - Look for:
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

    try {
        const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

        // Convert buffer to base64
        const base64Data = pdfBuffer.toString('base64');

        const model = 'gemini-3-flash-preview';

        const contents = [
            {
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
            },
        ];

        // Enable HIGH thinking level for better analysis
        const config = {
            thinkingConfig: {
                thinkingLevel: 'HIGH',
            },
            responseMimeType: 'application/json',
            responseSchema: extractionSchema,
        };

        console.log('Calling Gemini 3 Flash with HIGH thinking level...');
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
    }
}
