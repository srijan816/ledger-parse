/**
 * Gemini 3 Flash Extractor via OpenRouter
 * Uses OpenRouter API to access google/gemini-3-flash-preview with reasoning enabled
 * Handles multi-account consolidated statements with advanced reasoning
 */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

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
Return ONLY a valid JSON object with this exact structure (no markdown, no code blocks):
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
    if (!OPENROUTER_API_KEY) {
        return { success: false, error: "Missing OPENROUTER_API_KEY" };
    }

    try {
        // Convert PDF to base64 for multimodal input
        const base64Data = pdfBuffer.toString('base64');
        const fileSizeMB = pdfBuffer.length / (1024 * 1024);
        console.log(`PDF size: ${fileSizeMB.toFixed(2)} MB`);

        // Create message with PDF as base64 image/file
        const messages = [
            {
                role: 'user',
                content: [
                    {
                        type: 'text',
                        text: EXTRACTION_PROMPT
                    },
                    {
                        type: 'file',
                        file: {
                            filename: 'bank_statement.pdf',
                            file_data: `data:application/pdf;base64,${base64Data}`
                        }
                    }
                ]
            }
        ];

        console.log('Calling Gemini 3 Flash via OpenRouter with reasoning enabled...');

        const response = await fetch(OPENROUTER_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
                'X-Title': 'LedgerParse Bank Statement Converter'
            },
            body: JSON.stringify({
                model: 'google/gemini-3-flash-preview',
                messages,
                reasoning: { enabled: true },
                temperature: 0.1, // Low temperature for consistent extraction
                max_tokens: 16000,
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`OpenRouter API error ${response.status}: ${JSON.stringify(errorData)}`);
        }

        const result = await response.json();

        // Extract the response content
        const assistantMessage = result.choices?.[0]?.message;
        if (!assistantMessage?.content) {
            throw new Error('No content in OpenRouter response');
        }

        let responseText = assistantMessage.content;

        // Clean up response - remove markdown code blocks if present
        responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        // Parse JSON
        const data = JSON.parse(responseText);

        // Log summary for debugging
        console.log('Gemini 3 Flash Extraction Summary:', {
            bankName: data.bankName,
            isMultiAccount: data.isMultiAccount,
            accountCount: data.accounts?.length || 0,
            totalTransactions: data.transactions?.length || 0,
            openingBalance: data.openingBalance,
            closingBalance: data.closingBalance,
            reasoningUsed: !!assistantMessage.reasoning_details,
        });

        return {
            success: true,
            data,
            usage: result.usage
        };

    } catch (error: any) {
        console.error("Gemini Extraction Error:", error);
        return {
            success: false,
            error: error.message || "Unknown error during Gemini extraction"
        };
    }
}
