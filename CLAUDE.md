# LedgerParse - Bank Statement Converter

## Project Overview
LedgerParse is a forensic-grade PDF bank statement to Excel/CSV converter targeting accountants, bookkeepers, and mortgage brokers.

## Tech Stack
- Next.js 15 (App Router, TypeScript, strict mode)
- Tailwind CSS + Shadcn/ui
- TanStack Table for data grid
- react-pdf for PDF viewing
- PostgreSQL via Supabase
- Supabase Auth
- Stripe for payments
- OpenAI GPT-4o Vision for OCR fallback

## Key Features
1. Split-screen forensic workbench (PDF left, data grid right)
2. Click-to-highlight source verification
3. Automatic reconciliation checking
4. Confidence scoring on extracted data
5. Export to Excel, CSV, QuickBooks format

## Architecture Decisions
- Server Components by default, Client Components only for interactivity
- All database queries through /lib/db functions
- PDF processing happens server-side via API routes
- TanStack Table with virtualization for large datasets (5000+ rows)

## Coding Standards
- TypeScript strict mode - no `any` types
- Zod for all validation
- Error boundaries on all pages
- Loading and error states for all async operations
- Monospace font (Geist Mono) for financial data
- Trust Blue (#2563EB) as primary color

## File Structure
- /src/app/(marketing) - Landing, pricing pages
- /src/app/(auth) - Login, signup, etc.
- /src/app/(dashboard) - Protected app pages
- /src/components/ui - Shadcn base components
- /src/components/features - Feature-specific components
- /src/lib/services - Business logic (PDF parsing, export)
- /src/lib/db - Database query functions

## Testing Commands
- npm run dev (development)
- npm run build (production build)
- npm run lint (linting)
