import OpenAI from 'openai'

// Initialize OpenAI client
// Note: In a real environment, ensure OPENAI_API_KEY is set.
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'stub-key',
    dangerouslyAllowBrowser: true // Only for client-side if needed, but this is server-side
})

export async function extractDataWithOCR(imageBase64: string): Promise<string> {
    // Check for valid key to avoid errors if not set
    if (!process.env.OPENAI_API_KEY) {
        console.warn('OPENAI_API_KEY not set. Returning stub OCR data.')
        return "Stubbed OCR Data: No API Key provided."
    }

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Extract all financial transactions from this bank statement image. Return them in a structured JSON format with date, description, debit, credit, and balance." },
                        {
                            type: "image_url",
                            image_url: {
                                "url": `data:image/jpeg;base64,${imageBase64}`,
                            },
                        },
                    ],
                },
            ],
            max_tokens: 4000,
        })

        return response.choices[0].message.content || ''
    } catch (error) {
        console.error('OCR Extraction Error:', error)
        throw new Error('Failed to extract data via OCR')
    }
}
