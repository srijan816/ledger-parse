'use client'

import { useState } from 'react'
import { FileDown, CheckCircle2 } from 'lucide-react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'

interface ExportDialogProps {
    conversionId: string
    fileName: string
    onExport?: (format: string, dateOption: string, includeExcluded: boolean) => Promise<void>
}

export function ExportDialog({ conversionId, fileName, onExport }: ExportDialogProps) {
    const [open, setOpen] = useState(false)
    const [format, setFormat] = useState('xlsx')
    const [dateOption, setDateOption] = useState('MM/DD/YYYY')
    const [includeExcluded, setIncludeExcluded] = useState(false)
    const [loading, setLoading] = useState(false)

    const handleExport = async () => {
        setLoading(true)
        try {
            if (onExport) {
                await onExport(format, dateOption, includeExcluded)
            } else {
                const response = await fetch('/api/export', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ conversionId, format, dateOption, includeExcluded })
                })

                if (!response.ok) throw new Error('Export failed')

                // Trigger download
                const blob = await response.blob()
                const url = window.URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `${fileName.replace('.pdf', '')}.${format}`
                document.body.appendChild(a)
                a.click()
                window.URL.revokeObjectURL(url)
            }
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
            setOpen(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-brand-600 hover:bg-brand-700">
                    <FileDown className="mr-2 h-4 w-4" />
                    Export Data
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Export Transactions</DialogTitle>
                    <DialogDescription>
                        Choose your preferred format and settings for the export.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 py-4">

                    {/* Format Selection based on User Stories */}
                    <div className="space-y-3">
                        <Label>File Format</Label>
                        <RadioGroup defaultValue="xlsx" value={format} onValueChange={setFormat} className="grid grid-cols-1 gap-2">
                            <div className="flex items-center space-x-2 border p-3 rounded-md hover:bg-slate-50 cursor-pointer transition-colors">
                                <RadioGroupItem value="xlsx" id="xlsx" />
                                <Label htmlFor="xlsx" className="flex-1 cursor-pointer font-medium">Excel (.xlsx)</Label>
                            </div>
                            <div className="flex items-center space-x-2 border p-3 rounded-md hover:bg-slate-50 cursor-pointer transition-colors">
                                <RadioGroupItem value="csv" id="csv" />
                                <Label htmlFor="csv" className="flex-1 cursor-pointer font-medium">CSV (Comma Separated)</Label>
                            </div>
                            <div className="flex items-center space-x-2 border p-3 rounded-md hover:bg-slate-50 cursor-pointer transition-colors">
                                <RadioGroupItem value="qbo" id="qbo" />
                                <Label htmlFor="qbo" className="flex-1 cursor-pointer font-medium">QuickBooks Online (.qbo)</Label>
                                <span className="text-xs text-brand-600 font-medium bg-brand-50 px-2 py-0.5 rounded">Pro</span>
                            </div>
                        </RadioGroup>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Date Format</Label>
                            <Select value={dateOption} onValueChange={setDateOption}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select format" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                                    <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                                    <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2">
                        <Checkbox
                            id="include-excluded"
                            checked={includeExcluded}
                            onCheckedChange={(checked) => setIncludeExcluded(checked as boolean)}
                        />
                        <Label htmlFor="include-excluded" className="font-normal text-slate-600">
                            Include excluded rows (ghost rows)
                        </Label>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleExport} disabled={loading} className="bg-brand-600 hover:bg-brand-700">
                        {loading ? 'Generating...' : 'Download File'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
