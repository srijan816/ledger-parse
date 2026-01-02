'use client'

import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'

// Dynamically import the PDF viewer to avoid SSR issues with pdfjs-dist
// DOMMatrix and other browser APIs are not available on server
const PDFViewerCore = dynamic(
    () => import('./pdf-viewer-core').then(mod => ({ default: mod.PDFViewer })),
    {
        ssr: false,
        loading: () => (
            <div className="flex items-center justify-center h-full bg-slate-900/50 rounded-lg">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-8 w-8 animate-spin text-brand-400" />
                    <p className="text-sm text-slate-400">Loading PDF viewer...</p>
                </div>
            </div>
        ),
    }
)

interface BoundingBox {
    x1: number
    y1: number
    x2: number
    y2: number
}

interface PDFViewerProps {
    url: string
    highlightedBbox?: BoundingBox
    highlightedPage?: number
    className?: string
}

export function PDFViewer(props: PDFViewerProps) {
    return <PDFViewerCore {...props} />
}
