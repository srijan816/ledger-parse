/**
 * Main PDF Processing Orchestrator
 * Routes PDFs through the appropriate extraction pipeline based on type and quality
 */

import { detectPDFType } from './pdf-type-detector';
import { extractFromNativePDF } from './native-pdf-extractor';
import { extractWithGemini } from './gemini-extractor';

// Python worker URL (configure based on deployment)
const PYTHON_WORKER_URL = process.env.PYTHON_WORKER_URL || 'http://localhost:8000';

interface Transaction {
    date: string | null;
    description: string;
    amount: number | null;
    type: 'debit' | 'credit' | 'unknown';
    balance: number | null;
    confidence: number;
    bbox: { x1: number; y1: number; x2: number; y2: number; page: number } | null;
    rawText: string;
}

interface ProcessingResult {
    success: boolean;
    method: 'native' | 'tesseract' | 'easyocr' | 'gmft' | 'claude' | 'gemini' | 'hybrid';
    bankDetected: string | null;
    transactions: Transaction[];
    openingBalance: number | null;
    closingBalance: number | null;
    calculatedClosing: number | null;
    isReconciled: boolean;
    reconciliationDifference: number | null;
    pageCount: number;
    confidence: number;
    processingTimeMs: number;
    cost: number;
    errors: string[];
    warnings: string[];
}

interface ReconciliationResult {
    isReconciled: boolean;
    calculatedClosing: number | null;
    difference: number | null;
    totalCredits: number;
    totalDebits: number;
}

export async function processDocument(
    buffer: Buffer,
    options?: {
        forceMethod?: 'native' | 'ocr' | 'gemini';
        confidenceThreshold?: number;
        enableReconciliation?: boolean;
    }
): Promise<ProcessingResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    const warnings: string[] = [];
    const confidenceThreshold = options?.confidenceThreshold ?? 0.7;

    let result: ProcessingResult = {
        success: false,
        method: 'native',
        bankDetected: null,
        transactions: [],
        openingBalance: null,
        closingBalance: null,
        calculatedClosing: null,
        isReconciled: false,
        reconciliationDifference: null,
        pageCount: 0,
        confidence: 0,
        processingTimeMs: 0,
        cost: 0,
        errors: [],
        warnings: [],
    };

    try {
        // Step 1: Detect PDF type
        const pdfType = await detectPDFType(buffer);
        result.pageCount = pdfType.pageCount;

        console.log(`PDF Type: ${pdfType.type}, Quality: ${pdfType.scanQuality || 'n/a'}, Text Density: ${pdfType.textDensity}`);

        // Step 2: Route to appropriate extractor
        // PRIORITY: Use Gemini for ALL PDFs when available (best accuracy for complex statements)
        if (process.env.GEMINI_API_KEY && options?.forceMethod !== 'native') {
            console.log('Using Gemini 3 Flash as primary extractor...');
            result = await processWithGemini(buffer, result);
        } else if (pdfType.type === 'native') {
            // Fallback to native extraction if no Gemini API key or explicitly forced
            result = await processNativePDF(buffer, result);
        } else {
            // For scanned docs without Gemini, use Python worker
            result = await processScannedPDF(buffer, pdfType.scanQuality || 'good', result);
        }

        // Step 3: Check confidence and potentially fallback to Gemini
        if (result.confidence < confidenceThreshold && result.method !== 'gemini') {
            warnings.push(`Low confidence (${(result.confidence * 100).toFixed(1)}%), attempting Gemini fallback`);

            if (process.env.GEMINI_API_KEY) {
                const aiResult = await processWithGemini(buffer, result);
                if (aiResult.confidence > result.confidence) {
                    result = aiResult;
                    result.method = 'hybrid';
                }
            }
        }

        // Step 4: Run reconciliation check
        if (options?.enableReconciliation !== false) {
            const reconciliation = runReconciliation(
                result.transactions,
                result.openingBalance,
                result.closingBalance
            );

            result.calculatedClosing = reconciliation.calculatedClosing;
            result.isReconciled = reconciliation.isReconciled;
            result.reconciliationDifference = reconciliation.difference;

            if (!reconciliation.isReconciled && reconciliation.difference !== null) {
                warnings.push(`Reconciliation mismatch: $${Math.abs(reconciliation.difference).toFixed(2)}`);

                // If not reconciled and we haven't tried Gemini yet, try it
                if (result.method !== 'gemini' && result.method !== 'hybrid' &&
                    Math.abs(reconciliation.difference) > 0.01 && process.env.GEMINI_API_KEY) {
                    warnings.push('Attempting Gemini re-extraction due to reconciliation failure');
                    const aiResult = await processWithGemini(buffer, result);

                    const aiRecon = runReconciliation(
                        aiResult.transactions,
                        aiResult.openingBalance,
                        aiResult.closingBalance
                    );

                    if (aiRecon.isReconciled ||
                        (aiRecon.difference !== null && reconciliation.difference !== null &&
                            Math.abs(aiRecon.difference) < Math.abs(reconciliation.difference))) {
                        result = {
                            ...aiResult,
                            calculatedClosing: aiRecon.calculatedClosing,
                            isReconciled: aiRecon.isReconciled,
                            reconciliationDifference: aiRecon.difference,
                            method: 'hybrid',
                        };
                    }
                }
            }
        }

        result.success = result.transactions.length > 0;
        if (!result.success && errors.length === 0) {
            errors.push('No transactions detected. The document format might not be supported or the quality is too low.');
        }
        result.errors = errors;
        result.warnings = warnings;

    } catch (error) {
        errors.push(`Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        result.errors = [...(result.errors || []), ...errors];
    }

    result.processingTimeMs = Date.now() - startTime;
    return result;
}


async function processNativePDF(buffer: Buffer, current: ProcessingResult): Promise<ProcessingResult> {
    const extraction = await extractFromNativePDF(buffer);

    return {
        ...current,
        method: 'native',
        bankDetected: extraction.bankDetected,
        transactions: extraction.transactions,
        openingBalance: extraction.openingBalance,
        closingBalance: extraction.closingBalance,
        pageCount: extraction.pageCount,
        confidence: extraction.confidence,
        cost: 0,
        errors: extraction.errors,
        warnings: [],
    };
}


async function processScannedPDF(
    buffer: Buffer,
    quality: 'good' | 'poor',
    current: ProcessingResult
): Promise<ProcessingResult> {

    const formData = new FormData();
    const blob = new Blob([new Uint8Array(buffer)], { type: 'application/pdf' });
    formData.append('file', blob, 'document.pdf');

    const endpoint = quality === 'good'
        ? `${PYTHON_WORKER_URL}/extract/tesseract`
        : `${PYTHON_WORKER_URL}/extract/easyocr`;

    try {
        // First, try GMFT for table extraction (best accuracy)
        const gmftResponse = await fetch(`${PYTHON_WORKER_URL}/extract/gmft`, {
            method: 'POST',
            body: formData,
        });

        if (gmftResponse.ok) {
            const gmftResult = await gmftResponse.json();
            if (gmftResult.success && gmftResult.transactions.length > 0) {
                return {
                    ...current,
                    method: 'gmft' as any,
                    bankDetected: null,
                    transactions: gmftResult.transactions,
                    openingBalance: gmftResult.opening_balance,
                    closingBalance: gmftResult.closing_balance,
                    pageCount: gmftResult.page_count,
                    confidence: gmftResult.confidence,
                    cost: 0,
                    errors: gmftResult.errors,
                    warnings: [],
                };
            }
        }
    } catch (e) {
        console.log('GMFT not available, falling back to OCR');
    }

    // Fallback to OCR
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`Python worker returned ${response.status}`);
        }

        const result = await response.json();
        const combinedErrors = [...(result.errors || [])];

        return {
            ...current,
            method: quality === 'good' ? 'tesseract' : 'easyocr',
            transactions: result.transactions,
            openingBalance: result.opening_balance,
            closingBalance: result.closing_balance,
            pageCount: result.page_count,
            confidence: result.confidence,
            cost: 0,
            errors: combinedErrors,
            warnings: [],
        };

    } catch (error) {
        console.error('Python worker error:', error);
        return {
            ...current,
            errors: [`OCR extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        };
    }
}


async function processWithGemini(buffer: Buffer, current: ProcessingResult): Promise<ProcessingResult> {
    try {
        const extraction = await extractWithGemini(buffer);

        if (!extraction.success || !extraction.data) {
            throw new Error(extraction.error || 'Gemini extraction failed');
        }

        const data = extraction.data;

        // Handle multi-account statements
        const isMultiAccount = data.isMultiAccount === true;
        const accounts = data.accounts || [];

        console.log('Gemini Extraction:', {
            isMultiAccount,
            accountCount: accounts.length,
            transactionCount: data.transactions?.length || 0,
        });

        // Get transactions - prefer the aggregated transactions array
        const rawTransactions = data.transactions || [];

        // If no aggregated transactions but we have accounts, flatten from accounts
        let allTransactions = rawTransactions;
        if (allTransactions.length === 0 && accounts.length > 0) {
            allTransactions = accounts.flatMap((acc: any) =>
                (acc.transactions || []).map((t: any) => ({
                    ...t,
                    accountNumber: acc.accountNumber,
                    accountType: acc.accountType,
                    currency: acc.currency,
                }))
            );
        }

        const transactions = allTransactions.map((t: any) => ({
            date: t.date,
            description: t.description,
            amount: typeof t.amount === 'number' ? Math.abs(t.amount) : null,
            type: t.type,
            balance: typeof t.balance === 'number' ? t.balance : null,
            confidence: 0.95,
            bbox: null,
            rawText: `${t.accountNumber ? `[${t.accountNumber}] ` : ''}${t.description}`,
        }));

        // Calculate balances
        // For multi-account: sum opening balances and closing balances across all accounts
        // For single account: use direct values
        let openingBalance: number | null = null;
        let closingBalance: number | null = null;

        if (isMultiAccount && accounts.length > 0) {
            // Sum balances from all accounts
            let totalOpening = 0;
            let totalClosing = 0;
            let hasOpening = false;
            let hasClosing = false;

            for (const acc of accounts) {
                if (typeof acc.openingBalance === 'number') {
                    totalOpening += acc.openingBalance;
                    hasOpening = true;
                }
                if (typeof acc.closingBalance === 'number') {
                    totalClosing += acc.closingBalance;
                    hasClosing = true;
                }
            }

            openingBalance = hasOpening ? totalOpening : null;
            closingBalance = hasClosing ? totalClosing : null;

            console.log('Multi-account balances:', {
                openingBalance,
                closingBalance,
                accountBalances: accounts.map((a: any) => ({
                    account: a.accountNumber,
                    opening: a.openingBalance,
                    closing: a.closingBalance
                }))
            });
        } else {
            // Single account or use root-level balances
            openingBalance = typeof data.openingBalance === 'number' ? data.openingBalance : null;
            closingBalance = typeof data.closingBalance === 'number' ? data.closingBalance : null;
        }

        return {
            ...current,
            method: 'gemini',
            bankDetected: data.bankName || current.bankDetected,
            transactions,
            openingBalance,
            closingBalance,
            pageCount: current.pageCount || 1,
            confidence: 0.95,
            cost: 0,
            errors: [],
            warnings: isMultiAccount ? [`Multi-account statement with ${accounts.length} accounts detected`] : [],
        };

    } catch (error) {
        console.error('Gemini processing error:', error);
        return {
            ...current,
            errors: [...(current.errors || []), `Gemini extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        };
    }
}


function runReconciliation(
    transactions: Transaction[],
    openingBalance: number | null,
    closingBalance: number | null
): ReconciliationResult {

    if (openingBalance === null || closingBalance === null) {
        return {
            isReconciled: false,
            calculatedClosing: null,
            difference: null,
            totalCredits: 0,
            totalDebits: 0,
        };
    }

    let totalCredits = 0;
    let totalDebits = 0;

    for (const tx of transactions) {
        if (tx.amount === null) continue;

        if (tx.type === 'credit') {
            totalCredits += Math.abs(tx.amount);
        } else if (tx.type === 'debit') {
            totalDebits += Math.abs(tx.amount);
        } else {
            // Unknown type - use sign
            if (tx.amount > 0) {
                totalCredits += tx.amount;
            } else {
                totalDebits += Math.abs(tx.amount);
            }
        }
    }

    const calculatedClosing = openingBalance + totalCredits - totalDebits;
    const difference = Math.abs(calculatedClosing - closingBalance);
    const isReconciled = difference < 0.01;

    return {
        isReconciled,
        calculatedClosing: Math.round(calculatedClosing * 100) / 100,
        difference: Math.round(difference * 100) / 100,
        totalCredits: Math.round(totalCredits * 100) / 100,
        totalDebits: Math.round(totalDebits * 100) / 100,
    };
}
