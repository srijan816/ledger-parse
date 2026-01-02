const pdf = require('pdf-parse') // eslint-disable-line @typescript-eslint/no-require-imports

export async function extractTextFromPDF(buffer: Buffer): Promise<{ text: string, numpages: number }> {
    try {
        const data = await pdf(buffer)
        return {
            text: data.text,
            numpages: data.numpages
        }
    } catch (error) {
        console.error('PDF Text Extraction Error:', error)
        throw new Error('Failed to extract text from PDF')
    }
}
