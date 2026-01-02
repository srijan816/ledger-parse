import Anthropic from '@anthropic-ai/sdk';

// Initialize client (assumes ANTHROPIC_API_KEY is allowed in env)
// Note: In a real app, you might want to instantiate this inside the function or handle missing keys gracefully.
const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || 'dummy_key_for_build',
});

export interface AIExtractionResult {
    success: boolean;
    transactions: any[];
    rawText: string;
    confidence: number;
}

export async function extractWithAI(buffer: Buffer): Promise<AIExtractionResult> {
    try {
        if (!process.env.ANTHROPIC_API_KEY) {
            console.warn('ANTHROPIC_API_KEY missing, skipping AI extraction');
            return { success: false, transactions: [], rawText: '', confidence: 0 };
        }

        const base64Data = buffer.toString('base64');

        const response = await anthropic.messages.create({
            model: 'claude-3-5-sonnet-20240620',
            max_tokens: 4096,
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "document",
                            source: {
                                type: "base64",
                                media_type: "application/pdf",
                                data: base64Data
                            }
                        },
                        {
                            type: "text",
                            text: `You are a forensic accountant. Extract all bank transactions from this statement.
              
              Return ONLY a valid JSON object with this structure:
              {
                "transactions": [
                  {
                    "date": "YYYY-MM-DD",
                    "description": "string",
                    "debit": number | null,
                    "credit": number | null,
                    "balance": number | null
                  }
                ],
                "opening_balance": number | null,
                "closing_balance": number | null
              }
              
              Rules:
              1. If date is missing year, infer from context or use current year placeholder.
              2. Ensure amounts are numbers (no currency symbols).
              3. Ignore headers/footers.
              `
                        }
                    ]
                }
            ]
        });

        const contentBlock = response.content[0];

        if (contentBlock.type !== 'text') {
            throw new Error('Unexpected response type from Claude');
        }

        const jsonStr = contentBlock.text.match(/\{[\s\S]*\}/)?.[0];
        if (!jsonStr) {
            throw new Error('No JSON found in AI response');
        }

        const data = JSON.parse(jsonStr);

        return {
            success: true,
            transactions: data.transactions || [],
            rawText: contentBlock.text, // Keep full explanation if needed
            confidence: 0.95 // AI is usually high confidence if it parses
        };

    } catch (error) {
        console.error('AI Extraction Error:', error);
        return {
            success: false,
            transactions: [],
            rawText: '',
            confidence: 0
        };
    }
}
