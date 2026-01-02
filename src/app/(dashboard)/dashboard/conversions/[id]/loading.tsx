import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
    return (
        <div className="flex flex-col h-[calc(100vh-4rem)]">
            {/* Toolbar */}
            <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-6">
                <Skeleton className="h-9 w-9 rounded-md" />
                <Skeleton className="h-6 w-48 flex-1" />
                <Skeleton className="h-9 w-32" />
            </header>

            {/* Main Content - Split View */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: PDF Viewer Skeleton */}
                <div className="w-1/2 border-r bg-slate-100 p-4 flex items-center justify-center">
                    <Skeleton className="h-[80%] w-[70%] shadow-lg" />
                </div>

                {/* Right: Data Grid Skeleton */}
                <div className="w-1/2 flex flex-col bg-white p-4 space-y-4">
                    <div className="space-y-2">
                        {Array.from({ length: 15 }).map((_, i) => (
                            <div key={i} className="flex gap-4">
                                <Skeleton className="h-8 w-24" />
                                <Skeleton className="h-8 flex-1" />
                                <Skeleton className="h-8 w-24" />
                                <Skeleton className="h-8 w-24" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer: Reconciliation */}
            <div className="h-24 border-t border-slate-200 bg-white p-4">
                <div className="container mx-auto flex items-center justify-between">
                    <div className="flex gap-8">
                        <Skeleton className="h-10 w-24" />
                        <Skeleton className="h-10 w-24" />
                        <Skeleton className="h-10 w-24" />
                        <Skeleton className="h-10 w-32" />
                    </div>
                    <Skeleton className="h-10 w-48" />
                </div>
            </div>
        </div>
    )
}
