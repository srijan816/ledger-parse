'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface ConversionPollerProps {
    conversionId: string;
    initialStatus: string;
    children: React.ReactNode;
}

const MAX_POLL_DURATION_MS = 120000; // 2 minutes max polling
const POLL_INTERVAL_MS = 3000; // Poll every 3 seconds

/**
 * Polls for conversion status and refreshes the page when processing completes.
 * Has a timeout to prevent infinite polling.
 */
export function ConversionPoller({ conversionId, initialStatus, children }: ConversionPollerProps) {
    const router = useRouter();
    const [status, setStatus] = useState(initialStatus);
    const [isPolling, setIsPolling] = useState(
        initialStatus === 'processing' || initialStatus === 'pending'
    );
    const [pollStartTime] = useState(Date.now());
    const [timedOut, setTimedOut] = useState(false);
    const [pollCount, setPollCount] = useState(0);

    const handleRetry = useCallback(async () => {
        setTimedOut(false);
        setIsPolling(false);
        // Refresh to get latest data
        router.refresh();
    }, [router]);

    const handleReprocess = useCallback(async () => {
        setTimedOut(false);
        try {
            // Trigger reprocessing
            await fetch(`/api/process`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ conversionId }),
            });
            setIsPolling(true);
        } catch (error) {
            console.error('Reprocess failed:', error);
        }
    }, [conversionId]);

    useEffect(() => {
        if (!isPolling) return;

        const pollInterval = setInterval(async () => {
            // Check timeout
            const elapsed = Date.now() - pollStartTime;
            if (elapsed > MAX_POLL_DURATION_MS) {
                console.log('Polling timed out after 2 minutes');
                setIsPolling(false);
                setTimedOut(true);
                clearInterval(pollInterval);
                return;
            }

            setPollCount(prev => prev + 1);

            try {
                const response = await fetch(`/api/conversions/${conversionId}`);
                if (response.ok) {
                    const data = await response.json();
                    setStatus(data.status);

                    if (data.status === 'completed' || data.status === 'failed') {
                        console.log(`Processing ${data.status}, refreshing page...`);
                        setIsPolling(false);
                        clearInterval(pollInterval);
                        // Refresh the page to get updated data
                        router.refresh();
                    }
                }
            } catch (error) {
                console.error('Polling error:', error);
            }
        }, POLL_INTERVAL_MS);

        return () => clearInterval(pollInterval);
    }, [conversionId, isPolling, pollStartTime, router]);

    // Show timeout UI
    if (timedOut) {
        return (
            <div className="flex flex-col h-full">
                <div className="absolute inset-0 bg-black/30 z-50 flex items-center justify-center">
                    <div className="bg-white rounded-lg p-8 shadow-xl text-center max-w-md">
                        <div className="text-yellow-500 text-5xl mb-4">⏰</div>
                        <h3 className="text-lg font-semibold mb-2">Processing Taking Longer Than Expected</h3>
                        <p className="text-gray-600 mb-4">
                            The document may still be processing, or there may have been an issue.
                        </p>
                        <div className="flex gap-2 justify-center">
                            <Button onClick={handleRetry} variant="outline">
                                Check Again
                            </Button>
                            <Button onClick={handleReprocess}>
                                Reprocess Document
                            </Button>
                        </div>
                    </div>
                </div>
                {children}
            </div>
        );
    }

    // Show loading UI while polling
    if (isPolling) {
        return (
            <div className="flex flex-col h-full">
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
                            Status: {status} (poll #{pollCount})
                        </div>
                        <div className="mt-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setIsPolling(false);
                                    router.refresh();
                                }}
                            >
                                Check Now
                            </Button>
                        </div>
                    </div>
                </div>
                {children}
            </div>
        );
    }

    return <>{children}</>;
}
