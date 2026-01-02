export type BankName = 'Wells Fargo' | 'Chase' | 'Bank of America' | 'Citibank' | 'Unknown'

interface BankProfile {
    name: BankName
    keywords: string[]
    dateFormat: string
}

const banks: BankProfile[] = [
    {
        name: 'Wells Fargo',
        keywords: ['Wells Fargo', 'wells fargo'],
        dateFormat: 'MM/DD/YYYY'
    },
    {
        name: 'Chase',
        keywords: ['Chase Bank', 'JPMorgan Chase'],
        dateFormat: 'MM/DD/YYYY'
    },
    {
        name: 'Bank of America',
        keywords: ['Bank of America', 'BofA'],
        dateFormat: 'MM/DD/YYYY'
    },
    {
        name: 'Citibank',
        keywords: ['Citibank', 'Citi'],
        dateFormat: 'MM/DD/YYYY'
    }
]

export function detectBank(text: string): BankName {
    const normalizedText = text.toLowerCase()

    for (const bank of banks) {
        if (bank.keywords.some(keyword => normalizedText.includes(keyword.toLowerCase()))) {
            return bank.name
        }
    }

    return 'Unknown'
}
