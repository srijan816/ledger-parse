'use client'

import { useState, useEffect, useRef } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'

// Configure worker - crucial for Next.js
// In production, you might want to host this worker file yourself
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
).toString();

interface BoundingBox {
    x1: number
    y1: number
    x2: number
    y2: number
}

interface PDFViewerProps {
    url: string
    highlightedBbox?: BoundingBox // { x1, y1, x2, y2 } normalized 0-1 or points? Usually points from PDF
    highlightedPage?: number
    className?: string
}

export function PDFViewer({ url, highlightedBbox, highlightedPage, className }: PDFViewerProps) {
    const [numPages, setNumPages] = useState<number | null>(null)
    const [pageNumber, setPageNumber] = useState(1)
    const [scale, setScale] = useState(1.0)
    const [loading, setLoading] = useState(true)
    const containerRef = useRef<HTMLDivElement>(null)

    function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
        setNumPages(numPages)
        setLoading(false)
    }

    // Auto-navigate to highlighted page
    useEffect(() => {
        if (highlightedPage && highlightedPage !== pageNumber) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setPageNumber(highlightedPage)
        }
    }, [highlightedPage]) // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-scroll to highlight if on current page
    // Note: This is tricky with react-pdf as it renders canvas.
    // We'll rely on the overlay div being positioned correctly.

    const changePage = (offset: number) => {
        setPageNumber(prevPageNumber => {
            const newPage = prevPageNumber + offset
            return Math.min(Math.max(newPage, 1), numPages || 1)
        })
    }

    const changeScale = (delta: number) => {
        setScale(prevScale => Math.min(Math.max(prevScale + delta, 0.5), 2.0))
    }

    return (
        <Card className={cn("flex flex-col h-full overflow-hidden bg-slate-100", className)}>
            {/* Toolbar */}
            <div className="flex items-center justify-between p-2 bg-white border-b shadow-sm z-10 shrink-0">
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        disabled={pageNumber <= 1}
                        onClick={() => changePage(-1)}
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium w-16 text-center">
                        {pageNumber} / {numPages || '-'}
                    </span>
                    <Button
                        variant="ghost"
                        size="icon"
                        disabled={pageNumber >= (numPages || 1)}
                        onClick={() => changePage(1)}
                    >
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" onClick={() => changeScale(-0.1)}>
                        <ZoomOut className="h-4 w-4" />
                    </Button>
                    <span className="text-sm font-medium w-12 text-center">
                        {Math.round(scale * 100)}%
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => changeScale(0.1)}>
                        <ZoomIn className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Viewer Container */}
            <div
                ref={containerRef}
                className="flex-1 overflow-auto flex justify-center p-4 relative"
            >
                <Document
                    file={url}
                    onLoadSuccess={onDocumentLoadSuccess}
                    loading={
                        <div className="flex items-center justify-center p-10">
                            <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
                        </div>
                    }
                    error={
                        <div className="flex items-center justify-center p-10 text-red-500">
                            Failed to load PDF.
                        </div>
                    }
                    className="shadow-lg"
                >
                    <Page
                        pageNumber={pageNumber}
                        scale={scale}
                        renderTextLayer={true}
                        renderAnnotationLayer={true}
                        canvasBackground="#ffffff"
                        className="bg-white"
                    >
                        {/* Highlight Overlay */}
                        {highlightedPage === pageNumber && highlightedBbox && (
                            <div
                                className="absolute bg-yellow-300/40 border-2 border-yellow-500 rounded-sm mix-blend-multiply transition-all duration-300"
                                style={{
                                    left: highlightedBbox.x1 * scale,
                                    top: highlightedBbox.y1 * scale,
                                    width: (highlightedBbox.x2 - highlightedBbox.x1) * scale,
                                    height: (highlightedBbox.y2 - highlightedBbox.y1) * scale,
                                }}
                            />
                        )}
                    </Page>
                </Document>
            </div>
        </Card>
    )
}
