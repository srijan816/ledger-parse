# Bank Statement Converter - Core Pipeline Review

## Scope: core program paths
- Upload: `src/app/api/upload/route.ts`
- Processing: `src/app/api/process/route.ts`
- Core extraction orchestrator: `src/lib/services/pdf-processor.ts`
- Native PDF text extraction: `src/lib/services/pdftotext-extractor.ts`, `src/lib/services/native-pdf-extractor.ts`
- Scanned/OCR extraction: `python-worker/main.py`
- Export: `src/app/api/export/route.ts`
- Note: `src/lib/processing/*` and `src/lib/services/ai-extraction.ts` appear unused in the current pipeline.

## Highest-impact correctness and accuracy issues
1) Extraction errors are silently dropped
- Where: `src/lib/services/pdf-processor.ts`
- Issue: the orchestrator overwrites `result.errors` with a local `errors` array that never receives extraction errors. OCR/native failures are hidden, and the API often returns only "No transactions detected".
- Impact: users get misleading failures and debugging is blocked; fallback logic is blind to real root causes.

2) Confidence is inflated to 100 for zero-confidence transactions
- Where: `src/app/api/process/route.ts`
- Issue: `confidence_score: (tx.confidence * 100) || 100` converts `0` to `100`.
- Impact: low-confidence results are recorded as perfect, corrupting UI and downstream decisions.

3) Preprocessing never affects OCR output (and dependency missing)
- Where: `src/lib/services/pdf-processor.ts` + `python-worker/main.py`
- Issue: `/preprocess` returns an enhanced file path, but the Next.js pipeline never uses it. `ocrmypdf` is called but not listed in `python-worker/requirements.txt`.
- Impact: poor-quality scans are not actually improved; preprocessing will fail in most environments.

4) Native parsing often uses the *balance* as the transaction amount
- Where: `src/lib/services/native-pdf-extractor.ts`
- Issue: when multiple amounts exist on a line, it selects the last amount as the transaction amount and marks type as `unknown`.
- Impact: common layouts (date | description | debit | credit | balance) are mis-parsed; balances get stored as transaction amounts and then exported.

5) Date parsing is brittle and can shift dates
- Where: `src/lib/services/native-pdf-extractor.ts`, `src/app/api/process/route.ts`, `python-worker/main.py`
- Issues:
  - Only formats with an explicit year are recognized; statements that show MM/DD without year are dropped.
  - `new Date(dateStr)` is locale-dependent and can shift dates by timezone (UTC conversion).
- Impact: missing or off-by-one dates, lower reconciliation accuracy.

6) Missing dependency for core processing
- Where: `src/lib/services/pdftotext-extractor.ts`
- Issue: `pdftotext` and `pdfinfo` (poppler) are required but not enforced. If missing, the system returns `type: native` with pageCount 0 and fails downstream.
- Impact: a missing system package makes both detection and native extraction fail with no OCR fallback.

7) Balance extraction is unreliable for multi-account or negative balances
- Where: `src/lib/services/native-pdf-extractor.ts`, `python-worker/main.py`
- Issue: the native extractor selects the max detected closing balance. This is wrong for negative balances or multi-account statements.
- Impact: reconciliation is wrong; false Claude fallbacks are triggered.

8) Parsing is line-based and ignores layout
- Where: `src/lib/services/native-pdf-extractor.ts`, `python-worker/main.py`
- Issue: parsing does not use column positions, line wrap logic, or multi-line descriptions.
- Impact: frequent misses, mis-ordered descriptions, and wrong amount/type mapping in real statements.

9) Unreachable "not found" paths due to thrown errors
- Where: `src/app/api/process/route.ts`, `src/app/api/export/route.ts`
- Issue: `getConversionById` throws on missing rows. The code checks `if (!conversion)` afterwards, but that never runs.
- Impact: missing conversions return 500 instead of 404.

10) PII leakage via logging
- Where: `src/lib/services/native-pdf-extractor.ts`
- Issue: logs the first 1000 characters of raw statement text and bank/balance data.
- Impact: production logs may leak sensitive customer data.

## Additional robustness gaps
- OCR date pattern only accepts MM/DD/YY(YY); non-US formats and "15 Jan 2025" are dropped (`python-worker/main.py`).
- No timeout or retry policy for worker calls; a slow worker can stall a request until platform timeout.
- Reconciliation uses floating math on amounts that may not be rounded to cents; error thresholds can be noisy.
- `exportSchema` exposes `dateFormat` but it is never used (`src/app/api/export/route.ts`).
- QBO output uses placeholder bank/account identifiers and the same start/end date; many consumers will reject it.
- Guest conversion export is blocked: conversions are assigned to a shared guest user, but `export` requires a logged-in user and only treats `user_id IS NULL` as guest.
- Multiple unused or divergent pipelines (`src/lib/processing/*`, `src/lib/services/ai-extraction.ts`, `src/lib/processing/extractors/ocr-extractor.ts`) increase maintenance risk and make it unclear which logic is authoritative.

## Recommendations to improve accuracy and reliability
1) Make the core parser layout-aware
- Use word-level coordinates (PDF text + x/y positions) to detect columns and multi-line descriptions.
- For native PDFs, use `pdfplumber`/`pdfminer.six` or `pdfjs` text items with positions.
- For scanned PDFs, run a table detector first (GMFT or DocTR), then map columns by position.

2) Replace amount inference with column-based mapping
- Detect debit/credit/balance columns by x-position or header labels.
- If multiple amount columns exist, map them explicitly instead of selecting the last number.

3) Improve date handling
- Parse with explicit formats (bank-specific or inferred from statement period).
- Add logic to infer missing year from statement period.
- Avoid `new Date()` for parsing raw strings; use `date-fns`/`luxon` with fixed formats.

4) Fix OCR preprocessing pipeline
- Add `ocrmypdf` to worker dependencies and return the enhanced PDF bytes (not just a temp path).
- Pass the enhanced PDF to OCR/GMFT so preprocessing actually affects extraction.

5) Preserve and surface extraction errors
- Merge extractor errors into `result.errors` and return them to the API so failures are diagnosable.

6) Strengthen reconciliation
- Use decimal math for currency.
- Separate "unknown" transaction type and require column inference before reconciliation.

7) Add bank-specific parsing strategies
- For known banks, maintain per-bank templates: date format, column order, header tokens, statement period format.
- Use these to drive parsing and reduce false positives.

8) Add validation + test corpus
- Create a small dataset of real statements (redacted) with expected outputs.
- Unit test parsing and reconciliation so regressions are visible.

## Suggested immediate fixes (smallest changes with high impact)
- Preserve extractor errors in `processDocument`.
- Fix confidence score coercion to keep `0` as `0`.
- Use the preprocessing output (or remove the call until it works).
- Remove or gate raw text logging in production.
- Return 404 correctly when conversions are missing.

