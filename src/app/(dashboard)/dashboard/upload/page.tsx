'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DropZone } from '@/components/features/upload/drop-zone'
import { ProcessingProgress } from '@/components/features/upload/processing-progress'
import { toast } from 'sonner'

export default function UploadPage() {
    const router = useRouter()
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [processingStage, setProcessingStage] = useState<'uploading' | 'extracting' | 'analyzing' | 'reconciling' | 'completed'>('uploading')
    const [fileId, setFileId] = useState<string | null>(null)

    const handleFileSelect = async (file: File) => {
        setIsUploading(true)
        setUploadProgress(0)
        setProcessingStage('uploading')

        try {
            // 1. Upload File
            const formData = new FormData()
            formData.append('file', file)

            // Simulate upload progress
            const progressInterval = setInterval(() => {
                setUploadProgress(prev => Math.min(prev + 10, 90))
            }, 200)

            const uploadRes = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
            })

            clearInterval(progressInterval)
            setUploadProgress(100)

            if (!uploadRes.ok) {
                const errorData = await uploadRes.json()
                throw new Error(errorData.error || 'Upload failed')
            }

            const uploadData = await uploadRes.json()
            const conversionId = uploadData.conversionId
            setFileId(conversionId)

            // 2. Start Processing
            setProcessingStage('extracting')
            // Artificial delay for visual cues (remove in prod if instant)
            await new Promise(r => setTimeout(r, 800))

            // Call Process API
            const processRes = await fetch('/api/process', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ conversionId })
            })

            if (!processRes.ok) {
                throw new Error('Processing failed')
            }

            setProcessingStage('analyzing')
            await new Promise(r => setTimeout(r, 800))

            setProcessingStage('reconciling')
            await new Promise(r => setTimeout(r, 800))

            setProcessingStage('completed')
            toast.success('Conversion successful!')

            // Redirect to Workbench
            setTimeout(() => {
                router.push(`/dashboard/conversions/${conversionId}`)
            }, 500)

        } catch (error: any) {
            console.error(error)
            toast.error(error.message || 'Something went wrong')
            setIsUploading(false)
            setProcessingStage('uploading') // Reset
        }
    }

    return (
        <div className="container max-w-3xl mx-auto py-12">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-bold tracking-tight mb-2">Upload Bank Statement</h1>
                <p className="text-muted-foreground">
                    Upload your PDF bank statement to automatically extract and reconcile transactions.
                </p>
            </div>

            <Card className="border-2 border-dashed">
                <CardHeader>
                    <CardTitle>File Upload</CardTitle>
                    <CardDescription>
                        Supports PDF files up to 50MB. Scanned documents supported on Pro plan.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {!isUploading ? (
                        <DropZone onFileSelect={handleFileSelect} />
                    ) : (
                        <div className="py-10">
                            <ProcessingProgress currentStage={processingStage} progress={uploadProgress} />
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
