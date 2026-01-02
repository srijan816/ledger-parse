'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface ConversionPollerProps {
    conversionId: string;
    initialStatus: string;
    children: React.ReactNode;
}

/**
 * Polls for conversion status and refreshes the page when processing completes.
 * Shows a loading indicator while processing is in progress.
 */
export function ConversionPoller({ conversionId, initialStatus, children }: ConversionPollerProps) {
    const router = useRouter();
    const [status, setStatus] = useState(initialStatus);
    const [isPolling, setIsPolling] = useState(initialStatus === 'processing' || initialStatus === 'pending');

    useEffect(() => {
        if (!isPolling) return;

        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`/api/conversions/${conversionId}`);
                if (response.ok) {
                    const data = await response.json();
                    setStatus(data.status);

                    if (data.status === 'completed' || data.status === 'failed') {
                        setIsPolling(false);
                        clearInterval(pollInterval);
                        // Refresh the page to get updated data
                        router.refresh();
                    }
                }
            } catch (error) {
                console.error('Polling error:', error);
            }
        }, 2000); // Poll every 2 seconds

        return () => clearInterval(pollInterval);
    }, [conversionId, isPolling, router]);

    if (isPolling) {
        return (
            <div className="flex flex-col h-full">
                {/* Processing Overlay */}
                <div className="absolute inset-0 bg-black/30 z-50 flex items-center justify-center">
                    <div className="bg-white rounded-lg p-8 shadow-xl text-center max-w-md">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <h3 className="text-lg font-semibold mb-2">Processing Your Document</h3>
                        <p className="text-gray-600 mb-2">
                            Gemini 3 Flash is analyzing your bank statement with advanced reasoning...
                        </p>
                        <p className="text-sm text-gray-500">
                            This usually takes 30-60 seconds
                        </p>
                        <div className="mt-4 text-xs text-gray-400">
                            Status: {status}
                        </div>
                    </div>
                </div>
                {children}
            </div>
        );
    }

    return <>{children}</>;
}
