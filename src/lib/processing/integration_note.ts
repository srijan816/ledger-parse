// This file is a placeholder to show where the switch would happen in the API route.
// Currently src/app/api/process/route.ts uses a mock function.
// To enable the real engine, we would import processPDF from '@/lib/processing/orchestrator'
// and replace the mock call.

/*
// In src/app/api/process/route.ts:

import { processPDF } from '@/lib/processing/orchestrator'

// ... inside POST ...
const buffer = Buffer.from(await file.arrayBuffer()) // Need to fetch file from storage first
const result = await processPDF(buffer)
*/
