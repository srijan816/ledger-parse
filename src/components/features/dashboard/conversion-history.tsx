'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FileText, MoreHorizontal, ArrowRight, Clock } from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Conversion } from '@/types/conversion'

interface ConversionHistoryProps {
    conversions: Conversion[]
}

const statusStyles = {
    pending: "bg-slate-100 text-slate-600 hover:bg-slate-100/80",
    processing: "bg-blue-100 text-blue-700 hover:bg-blue-100/80 animate-pulse",
    completed: "bg-green-100 text-green-700 hover:bg-green-100/80",
    failed: "bg-red-100 text-red-700 hover:bg-red-100/80",
}

export function ConversionHistory({ conversions }: ConversionHistoryProps) {
    return (
        <div className="rounded-md border bg-white">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>File Name</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Pages</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {conversions.length > 0 ? (
                        conversions.map((item) => (
                            <TableRow key={item.id} className="group">
                                <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                        <FileText className="h-4 w-4 text-slate-400" />
                                        {item.fileName}
                                    </div>
                                </TableCell>
                                <TableCell className="text-slate-500">
                                    {new Date(item.createdAt).toLocaleDateString()}
                                </TableCell>
                                <TableCell>{item.pageCount || '-'}</TableCell>
                                <TableCell>
                                    <Badge variant="secondary" className={cn("capitalize font-normal", statusStyles[item.status])}>
                                        {item.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        {item.status === 'completed' && (
                                            <Button asChild size="sm" variant="outline" className="h-8">
                                                <Link href={`/convert/${item.id}`}>
                                                    Result <ArrowRight className="ml-2 h-3 w-3" />
                                                </Link>
                                            </Button>
                                        )}
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <span className="sr-only">Open menu</span>
                                                    <MoreHorizontal className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem>Download Original PDF</DropdownMenuItem>
                                                <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                <div className="flex flex-col items-center gap-2">
                                    <Clock className="w-8 h-8 text-slate-200" />
                                    <p>No conversion history yet.</p>
                                </div>
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    )
}
