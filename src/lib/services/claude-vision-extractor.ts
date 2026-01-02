/**
 * Claude 3.5 Sonnet Vision fallback for complex/failed extractions
 * Used when confidence is <70% or reconciliation fails
 */

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || 'dummy', // Prevent crash if env missing during build
});

interface Transaction {
    date: string | null;
    description: string;
    amount: number;
    type: 'debit' | 'credit';
    balance: number | null;
}

interface ClaudeExtractionResult {
    success: boolean;
    transactions: Transaction[];
    openingBalance: number | null;
    closingBalance: number | null;
    bankDetected: string | null;
    confidence: number;
    tokensUsed: number;
    cost: number;
}

export async function extractWithClaudeVision(
    imageBase64: string,
    mimeType: 'image/png' | 'image/jpeg' | 'image/webp' = 'image/png',
    pageNumber: number = 1,
    context?: { bankHint?: string; previousBalance?: number }
): Promise<ClaudeExtractionResult> {

    const systemPrompt = `You are a forensic accountant expert in high-precision data extraction from bank statements.

Your task is to extract ALL transactions from the bank statement image provided.

RULES:
1. Extract EVERY transaction row - do not skip any
2. Dates should be in YYYY-MM-DD format
3. Amounts should be positive numbers
4. Type is 'debit' for money going out (withdrawals, payments, fees)
5. Type is 'credit' for money coming in (deposits, refunds, interest)
6. If a balance column exists, include it
7. Clean up descriptions - remove excessive whitespace and special characters
8. Do NOT include headers, footers, page numbers, or marketing text
9. Do NOT include subtotals or summary rows (just individual transactions)

OUTPUT FORMAT:
Return ONLY valid JSON in this exact structure:
{
  "bank_name": "Wells Fargo" | "Chase" | "Bank of America" | etc,
  "opening_balance": 1234.56,
  "closing_balance": 1234.56,
  "transactions": [
    {
      "date": "2025-01-15",
      "description": "AMAZON.COM PURCHASE",
      "amount": 45.99,
      "type": "debit",
      "balance": 1188.57
    }
  ]
}`;

    const userPrompt = context?.bankHint
        ? `This is page ${pageNumber} of a ${context.bankHint} bank statement.${context.previousBalance ? ` The balance from the previous page was $${context.previousBalance}.` : ''} Extract all transactions.`
        : `This is page ${pageNumber} of a bank statement. Extract all transactions.`;

    try {
        if (!process.env.ANTHROPIC_API_KEY) {
            console.warn('Missing ANTHROPIC_API_KEY');
            return {
                success: false,
                transactions: [],
                openingBalance: null,
                closingBalance: null,
                bankDetected: null,
                confidence: 0,
                tokensUsed: 0,
                cost: 0,
            };
        }

        const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 4096,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: mimeType,
                                data: imageBase64,
                            },
                        },
                        {
                            type: 'text',
                            text: userPrompt,
                        },
                    ],
                },
            ],
            system: systemPrompt,
        });

        // Extract text content
        const textContent = response.content.find(c => c.type === 'text');
        if (!textContent || textContent.type !== 'text') {
            throw new Error('No text response from Claude');
        }

        // Parse JSON from response
        const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No valid JSON in response');
        }

        const parsed = JSON.parse(jsonMatch[0]);

        // Calculate cost (approximate)
        const inputTokens = response.usage.input_tokens;
        const outputTokens = response.usage.output_tokens;
        const cost = (inputTokens * 0.003 + outputTokens * 0.015) / 1000;

        return {
            success: true,
            transactions: parsed.transactions.map((t: any) => ({
                date: t.date,
                description: t.description,
                amount: typeof t.amount === 'number' ? t.amount : parseFloat(t.amount),
                type: t.type,
                balance: t.balance ? parseFloat(t.balance) : null,
            })),
            openingBalance: parsed.opening_balance ? parseFloat(parsed.opening_balance) : null,
            closingBalance: parsed.closing_balance ? parseFloat(parsed.closing_balance) : null,
            bankDetected: parsed.bank_name || null,
            confidence: 0.95, // Claude is highly reliable
            tokensUsed: inputTokens + outputTokens,
            cost,
        };

    } catch (error) {
        console.error('Claude extraction failed:', error);
        return {
            success: false,
            transactions: [],
            openingBalance: null,
            closingBalance: null,
            bankDetected: null,
            confidence: 0,
            tokensUsed: 0,
            cost: 0,
        };
    }
}


/**
 * Process multiple pages with Claude (for full document)
 */
export async function extractDocumentWithClaude(
    pagesBase64: string[],
    mimeType: 'image/png' | 'image/jpeg' | 'image/webp' = 'image/png'
): Promise<ClaudeExtractionResult> {

    const allTransactions: Transaction[] = [];
    let totalTokens = 0;
    let totalCost = 0;
    let bankDetected: string | null = null;
    let openingBalance: number | null = null;
    let closingBalance: number | null = null;
    let previousBalance: number | null = null;

    for (let i = 0; i < pagesBase64.length; i++) {
        const result = await extractWithClaudeVision(
            pagesBase64[i],
            mimeType,
            i + 1,
            { bankHint: bankDetected || undefined, previousBalance: previousBalance || undefined }
        );

        if (result.success) {
            allTransactions.push(...result.transactions);
            totalTokens += result.tokensUsed;
            totalCost += result.cost;

            if (!bankDetected && result.bankDetected) {
                bankDetected = result.bankDetected;
            }
            if (i === 0 && result.openingBalance) {
                openingBalance = result.openingBalance;
            }
            if (result.closingBalance) {
                closingBalance = result.closingBalance;
                previousBalance = result.closingBalance;
            }
        }

        // Rate limiting - Claude has limits
        if (i < pagesBase64.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    return {
        success: allTransactions.length > 0,
        transactions: allTransactions,
        openingBalance,
        closingBalance,
        bankDetected,
        confidence: 0.95,
        tokensUsed: totalTokens,
        cost: totalCost,
    };
}
