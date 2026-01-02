'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { UploadCloud, File as FileIcon, X, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Progress } from '@/components/ui/progress'

interface DropZoneProps {
    onFileSelect: (file: File) => void
    maxSizeMB?: number
    acceptedTypes?: string[]
    disabled?: boolean
    className?: string
}

export function DropZone({
    onFileSelect,
    maxSizeMB = 50,
    acceptedTypes = ['application/pdf'],
    disabled = false,
    className,
}: DropZoneProps) {
    const [uploadProgress, setUploadProgress] = useState(0)

    const onDrop = useCallback(
        (acceptedFiles: File[], rejectedFiles: any[]) => {
            if (disabled) return

            // Handle rejected files
            if (rejectedFiles.length > 0) {
                rejectedFiles.forEach(({ file, errors }) => {
                    errors.forEach((err: any) => {
                        if (err.code === 'file-too-large') {
                            toast.error(`File ${file.name} is too large. Max size is ${maxSizeMB}MB.`)
                        } else if (err.code === 'file-invalid-type') {
                            toast.error(`File ${file.name} has an invalid type. Only PDF allowed.`)
                        } else {
                            toast.error(`Error with file ${file.name}: ${err.message}`)
                        }
                    })
                })
            }

            if (acceptedFiles.length > 0) {
                // Simulate upload progress for better UX
                setUploadProgress(0)
                const interval = setInterval(() => {
                    setUploadProgress((prev) => {
                        if (prev >= 100) {
                            clearInterval(interval)
                            return 100
                        }
                        return prev + 10
                    })
                }, 100)

                // In a real scenario, progress would be driven by the actual upload
                // passing files up immediately, parent handles the async upload
                onFileSelect(acceptedFiles[0])
            }
        },
        [disabled, maxSizeMB, onFileSelect]
    )

    const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
        onDrop,
        accept: acceptedTypes.reduce((acc, type) => ({ ...acc, [type]: [] }), {}),
        maxSize: maxSizeMB * 1024 * 1024,
        disabled,
        multiple: false, // MVP P0: Single file only
    })

    return (
        <div
            {...getRootProps()}
            className={cn(
                'relative flex flex-col items-center justify-center w-full min-h-[300px] rounded-xl border-2 border-dashed transition-all duration-200 ease-in-out cursor-pointer overflow-hidden group',
                // States
                disabled ? 'opacity-50 cursor-not-allowed bg-slate-50 border-slate-200' : 'bg-slate-50 border-slate-300 hover:bg-slate-100 hover:border-slate-400',
                isDragActive && !isDragReject && 'bg-brand-50 border-brand-500 scale-[1.01] shadow-lg',
                isDragReject && 'bg-red-50 border-red-500',
                className
            )}
        >
            <input {...getInputProps()} />

            <div className="flex flex-col items-center justify-center p-8 text-center space-y-4">
                {isDragActive ? (
                    <>
                        <div className={cn(
                            "p-4 rounded-full animate-bounce",
                            isDragReject ? "bg-red-100 text-red-600" : "bg-brand-100 text-brand-600"
                        )}>
                            <UploadCloud className="w-10 h-10" />
                        </div>
                        <p className={cn("text-lg font-medium", isDragReject ? "text-red-700" : "text-brand-700")}>
                            {isDragReject ? "Only PDF files accepted" : "Drop your statement here"}
                        </p>
                    </>
                ) : (
                    <>
                        <div className="p-4 rounded-full bg-white shadow-sm ring-1 ring-slate-200 group-hover:scale-110 transition-transform duration-200 text-slate-500 group-hover:text-brand-600">
                            <UploadCloud className="w-10 h-10" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-lg font-semibold text-slate-900">
                                Click to upload or drag and drop
                            </p>
                            <p className="text-sm text-slate-500">
                                PDF Bank Statements (max {maxSizeMB}MB)
                            </p>
                        </div>
                        <div className="flex gap-4 pt-4">
                            {/* Decorative mini bank icons/logos could go here */}
                            <div className="text-xs text-slate-400 font-medium px-3 py-1 bg-slate-100 rounded-full">Wells Fargo</div>
                            <div className="text-xs text-slate-400 font-medium px-3 py-1 bg-slate-100 rounded-full">Chase</div>
                            <div className="text-xs text-slate-400 font-medium px-3 py-1 bg-slate-100 rounded-full">BofA</div>
                        </div>
                    </>
                )}
            </div>

            {/* Absolute overlay for "Uploading" state if we wanted to handle it inside component, 
          but usually handled by parent swapping this component out or showing a progress bar below. 
          For MVP, we'll keep it simple. */}
        </div>
    )
}
