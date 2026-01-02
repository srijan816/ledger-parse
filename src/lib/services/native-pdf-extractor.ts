/**
 * Extracts transactions from native (text-based) PDFs
 * Uses pdftotext CLI (poppler) for reliable text extraction
 */

import { extractTextFromPDF } from './pdftotext-extractor';

interface RawTransaction {
    date: string | null;
    description: string;
    amount: number | null;
    type: 'debit' | 'credit' | 'unknown';
    balance: number | null;
    confidence: number;
    bbox: { x1: number; y1: number; x2: number; y2: number; page: number } | null;
    rawText: string;
}

interface ExtractionResult {
    success: boolean;
    bankDetected: string | null;
    transactions: RawTransaction[];
    openingBalance: number | null;
    closingBalance: number | null;
    statementPeriod: { start: string; end: string } | null;
    pageCount: number;
    confidence: number;
    errors: string[];
}

// Bank detection patterns
const BANK_PATTERNS: Record<string, RegExp[]> = {
    'Wells Fargo': [/wells\s*fargo/i, /wf\s*bank/i],
    'Chase': [/chase/i, /jpmorgan\s*chase/i],
    'Bank of America': [/bank\s*of\s*america/i, /bofa/i],
    'Citibank': [/citibank/i, /citi\s*bank/i],
    'Capital One': [/capital\s*one/i],
    'US Bank': [/u\.?s\.?\s*bank/i],
    'PNC': [/pnc\s*bank/i, /pnc/i],
    'TD Bank': [/td\s*bank/i],
    'Standard Chartered': [/standard\s*chartered/i, /渣打/i],
    'HSBC': [/hsbc/i, /hongkong.*shanghai/i],
    'DBS': [/dbs\s*bank/i],
    'OCBC': [/ocbc/i],
    'Hang Seng': [/hang\s*seng/i, /恒生/i],
};

// Date patterns (US formats, ISO, etc)
const DATE_PATTERNS = [
    /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/,  // MM/DD/YYYY or M/D/YY
    /(\d{1,2})-(\d{1,2})-(\d{2,4})/,    // MM-DD-YYYY
    /(\d{1,2})\s+(\w{3})\s+(\d{4})/,    // 15 Jan 2025
    /(\w{3})\s+(\d{1,2}),?\s+(\d{4})/,  // Jan 15, 2025
    /(\d{4})-(\d{1,2})-(\d{1,2})/,      // YYYY-MM-DD
];

// Amount patterns - matches numbers with optional currency/decimals
const AMOUNT_PATTERN = /[\$¥€£]?\s*-?\(?\d{1,3}(?:,\d{3})*(?:\.\d{2})?\)?/g;

export async function extractFromNativePDF(buffer: Buffer | Uint8Array): Promise<ExtractionResult> {
    const errors: string[] = [];

    try {
        // Use pdftotext CLI for reliable text extraction
        const result = extractTextFromPDF(Buffer.from(buffer));

        if (!result.success) {
            throw new Error(result.error || 'PDF text extraction failed');
        }

        const fullText = result.text;
        const pageCount = result.pageCount;

        // console.log('--- DEBUG: Extracted Text Start ---');
        // console.log(fullText.substring(0, 1000));
        // console.log('--- DEBUG: Extracted Text End ---');
        // console.log(`Total pages: ${pageCount}, Total characters: ${fullText.length}`);

        // Detect bank
        const bankDetected = detectBank(fullText);
        console.log('Bank detected:', bankDetected);

        // Extract balances from header/footer
        const { openingBalance, closingBalance } = extractBalances(fullText);
        console.log('Balances:', { openingBalance, closingBalance });

        // Extract statement period
        const statementPeriod = extractStatementPeriod(fullText);

        // Infer year from statement period or today
        let currentYear = new Date().getFullYear();
        if (statementPeriod) {
            // Try to extract year from end date
            const yearMatch = statementPeriod.end.match(/\d{4}/);
            if (yearMatch) {
                currentYear = parseInt(yearMatch[0]);
            }
        }

        // Split text into lines and parse transactions
        const lines = fullText.split('\n').filter((line: string) => line.trim());
        const transactions = parseTransactionsFromLines(lines, bankDetected, currentYear);

        console.log(`Parsed ${transactions.length} transactions`);

        // Calculate overall confidence
        const avgConfidence = transactions.length > 0
            ? transactions.reduce((sum, t) => sum + t.confidence, 0) / transactions.length
            : 0;

        return {
            success: true,
            bankDetected,
            transactions,
            openingBalance,
            closingBalance,
            statementPeriod,
            pageCount,
            confidence: avgConfidence,
            errors
        };

    } catch (error) {
        // ... err handling
        console.error('PDF extraction error:', error);
        errors.push(`Extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return {
            success: false,
            bankDetected: null,
            transactions: [],
            openingBalance: null,
            closingBalance: null,
            statementPeriod: null,
            pageCount: 0,
            confidence: 0,
            errors
        };
    }
}

function detectBank(text: string): string | null {
    for (const [bank, patterns] of Object.entries(BANK_PATTERNS)) {
        for (const pattern of patterns) {
            if (pattern.test(text)) return bank;
        }
    }
    return null;
}

function extractBalances(text: string): { openingBalance: number | null; closingBalance: number | null } {
    const openingPatterns = [
        /(?:opening|beginning|starting|previous)\s*balance[:\s]*[\$]?\s*([\d,]+\.?\d*)/i,
        /balance\s*(?:forward|brought\s*forward)[:\s]*[\$]?\s*([\d,]+\.?\d*)/i,
        /balance\s*from\s*previous\s*statement.*?([\d,]+\.?\d{2})/i,
    ];

    const explicitClosingPattern = /closing\s*balance(?:.*?)[:\s]+([\d,]+\.?\d{2})/gi;
    const genericClosingPatterns = [
        /(?:ending|new|current)\s*balance[:\s]*[\$]?\s*([\d,]+\.?\d*)/i,
        /net\s*position[:\s]*[\$]?\s*([\d,]+\.?\d*)/i,
        /(?:total|balance)[:\s]*[\$]?\s*([\d,]+\.?\d*)\s*$/im,
    ];

    let openingBalance: number | null = null;
    let closingBalance: number | null = null;

    for (const pattern of openingPatterns) {
        const match = text.match(pattern);
        if (match) {
            openingBalance = parseFloat(match[1].replace(/,/g, ''));
            break;
        }
    }

    const closingBalances: number[] = [];
    let match;
    while ((match = explicitClosingPattern.exec(text)) !== null) {
        const val = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(val)) closingBalances.push(val);
    }

    if (closingBalances.length === 0) {
        for (const pattern of genericClosingPatterns) {
            const match = text.match(pattern);
            if (match) {
                const val = parseFloat(match[1].replace(/,/g, ''));
                if (!isNaN(val)) closingBalances.push(val);
            }
        }
    }

    if (closingBalances.length > 0) {
        closingBalance = Math.max(...closingBalances);
    }

    return { openingBalance, closingBalance };
}

function extractStatementPeriod(text: string): { start: string; end: string } | null {
    const periodPattern = /(?:statement\s*period|for\s*period)[:\s]*(.+?)\s*(?:to|-|through)\s*(.+?)(?:\n|$)/i;
    const match = text.match(periodPattern);
    if (match) {
        return { start: match[1].trim(), end: match[2].trim() };
    }
    return null;
}

function isHeaderOrFooter(text: string): boolean {
    const skipPatterns = [
        /page\s*\d+/i,
        /continued/i,
        /^date\s+description/i,
        /^transaction\s+detail/i,
        /customer\s*service/i,
        /www\./i,
        /privacy\s*notice/i,
        /statement\s*date/i,
        /account\s*number/i,
        /your\s*financial\s*status/i,
        /consolidated\s*statement/i,
    ];
    return skipPatterns.some(p => p.test(text));
}

function parseTransactionsFromLines(lines: string[], bankDetected: string | null, defaultYear: number): RawTransaction[] {
    const transactions: RawTransaction[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip header/footer rows
        if (isHeaderOrFooter(line)) continue;

        // Try to parse as transaction
        const transaction = parseTransactionLine(line, i, defaultYear);
        if (transaction) {
            transactions.push(transaction);
        }
    }

    return transactions;
}

// Enhanced Date Patterns
const DATE_PATTERNS_WITH_OPTIONAL_YEAR = [
    /(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/,  // MM/DD or MM/DD/YYYY
    /(\d{1,2})-(\d{1,2})(?:-(\d{2,4}))?/,    // MM-DD or MM-DD-YYYY
    /(\d{1,2})\s+(\w{3})(?:\s+(\d{4}))?/,    // 15 Jan or 15 Jan 2025
    /(\w{3})\s+(\d{1,2}),?(?:\s+(\d{4}))?/,  // Jan 15 or Jan 15, 2025
];

function parseTransactionLine(line: string, lineIndex: number, defaultYear: number): RawTransaction | null {
    // Look for date
    let date: string | null = null;
    let textWithoutDate = line;
    let foundYear: string | undefined;

    for (const pattern of DATE_PATTERNS_WITH_OPTIONAL_YEAR) {
        const match = line.match(pattern);
        if (!match) continue;

        // Helper to reconstruct date with year
        // We need to identify which group is what.

        // This regex logic is tricky to generalize without named groups or strict ordering.
        // Let's refine the specific patterns to be more predictable or process them case-by-case.

        // For standard partial dates, let's assume valid match.
        const fullMatch = match[0];

        // Check if extracted string contains a year (4 digits)
        const hasYear = /\d{4}/.test(fullMatch);

        if (hasYear) {
            date = fullMatch;
        } else {
            // Append default year
            // Determine separator
            if (fullMatch.includes('-')) date = `${fullMatch}-${defaultYear}`;
            else if (fullMatch.includes('/')) date = `${fullMatch}/${defaultYear}`;
            else date = `${fullMatch} ${defaultYear}`;
        }

        textWithoutDate = line.replace(fullMatch, '').trim();
        break;
    }

    if (!date) return null; // Date is mandatory for a transaction line

    // Look for amount(s) in the remaining text
    const amounts = textWithoutDate.match(AMOUNT_PATTERN) || [];

    // Filter out small numbers that are likely page numbers or dates
    const validAmounts = amounts.filter(amt => {
        const num = parseFloat(amt.replace(/[$,()¥€£]/g, '').replace('-', ''));
        return num >= 0.01 && num < 100000000; // Reasonable transaction range
    });

    if (validAmounts.length === 0) return null;

    // Parse the primary amount (usually the last significant one)
    const amountStr = validAmounts[validAmounts.length - 1];
    const isNegative = amountStr.includes('(') || amountStr.includes('-');
    const amountValue = parseFloat(amountStr.replace(/[$,()¥€£]/g, '').replace('-', ''));

    if (isNaN(amountValue) || amountValue === 0) return null;

    // Determine type based on sign
    let type: 'debit' | 'credit' | 'unknown' = 'unknown';
    if (isNegative) {
        type = 'debit';
    } else if (validAmounts.length >= 2) {
        type = 'unknown';
    }

    // Extract description
    let description = textWithoutDate;
    for (const amt of validAmounts) {
        description = description.replace(amt, '').trim();
    }

    // Clean up description
    description = description.replace(/\s+/g, ' ').trim();

    // Skip if description is too short or looks like noise
    if (description.length < 3) return null;

    // Calculate confidence
    let confidence = 0.5;
    if (date) confidence += 0.2;
    if (amountValue > 0) confidence += 0.2;
    if (description.length > 10) confidence += 0.1;

    return {
        date,
        description: description.substring(0, 200),
        amount: type === 'debit' ? -amountValue : amountValue,
        type,
        balance: validAmounts.length > 1 ? parseFloat(validAmounts[0].replace(/[$,()¥€£]/g, '')) : null,
        confidence,
        bbox: null,
        rawText: line
    };
}
