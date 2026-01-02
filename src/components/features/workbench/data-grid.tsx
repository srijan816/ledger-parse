'use client'

import React, { useState } from 'react'
import {
    ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
    getSortedRowModel,
    SortingState,
    getFilteredRowModel,
    ColumnFiltersState,
} from '@tanstack/react-table'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MoreHorizontal, ArrowUpDown } from 'lucide-react'
import { Transaction } from '@/types/transaction'
import { cn } from '@/lib/utils'
import { ConfidenceCell } from './confidence-cell'

interface DataGridProps {
    data: Transaction[]
    onRowClick?: (transaction: Transaction) => void
    onRowExclude?: (transaction: Transaction) => void
    onCellEdit?: (id: string, field: string, value: any) => void
    className?: string
}

export function DataGrid({ initialData, onRowClick, onRowExclude, onCellEdit, className }: {
    initialData: Transaction[],
    onRowClick?: (transaction: Transaction) => void,
    onRowExclude?: (transaction: Transaction) => void,
    onCellEdit?: (id: string, field: string, value: any) => void
    className?: string
}) {
    const [data, setData] = useState(initialData)

    // Sync if initialData updates (optional)
    React.useEffect(() => {
        setData(initialData)
    }, [initialData])

    const [sorting, setSorting] = useState<SortingState>([])
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
    const [rowSelection, setRowSelection] = useState({})

    // --- Editable Cell Component ---
    const EditableCell = ({
        value: initialValue,
        row,
        column,
        table,
    }: {
        value: any
        row: any
        column: any
        table: any
    }) => {
        const [value, setValue] = useState(initialValue)

        const onBlur = () => {
            if (value !== initialValue) {
                onCellEdit?.(row.original.id, column.id, value)
            }
        }

        return (
            <input
                value={(value as string) ?? ''}
                onChange={e => setValue(e.target.value)}
                onBlur={onBlur}
                className="w-full bg-transparent border-none p-0 h-8 focus:ring-1 focus:ring-brand-500 rounded px-1"
            />
        )
    }

    const columns: ColumnDef<Transaction>[] = [
        {
            accessorKey: 'rowIndex',
            header: '#',
            cell: ({ row }) => <div className="text-center text-xs text-slate-400 w-8">{row.getValue('rowIndex')}</div>,
            size: 40,
        },
        {
            accessorKey: 'date',
            header: ({ column }) => {
                return (
                    <Button
                        variant="ghost"
                        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
                        className="-ml-4"
                    >
                        Date
                        <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                )
            },
            cell: ({ getValue, row, column, table }) =>
                <EditableCell value={getValue()} row={row} column={column} table={table} />,
            size: 100,
        },
        {
            accessorKey: 'description',
            header: 'Description',
            cell: ({ getValue, row, column, table }) =>
                <EditableCell value={getValue()} row={row} column={column} table={table} />,
        },
        {
            accessorKey: 'debit',
            header: () => <div className="text-right">Debit</div>,
            cell: ({ getValue, row, column, table }) => {
                // For number fields, we might want type="number" but simplified for text here
                return <div className="text-right"><EditableCell value={getValue()} row={row} column={column} table={table} /></div>
            },
            size: 100,
        },
        {
            accessorKey: 'credit',
            header: () => <div className="text-right">Credit</div>,
            cell: ({ getValue, row, column, table }) => {
                return <div className="text-right"><EditableCell value={getValue()} row={row} column={column} table={table} /></div>
            },
            size: 100,
        },
        {
            accessorKey: 'balance',
            header: () => <div className="text-right">Balance</div>,
            cell: ({ row }) => {
                const amount = parseFloat(row.getValue('balance') || '0')
                return <div className="text-right font-mono text-sm font-semibold">{amount ? amount.toFixed(2) : '-'}</div>
            },
            size: 100,
        },
        {
            accessorKey: 'confidenceScore',
            header: 'Conf.',
            cell: ({ row }) => <ConfidenceCell score={row.getValue('confidenceScore')} />,
            size: 60,
        },
        {
            id: 'actions',
            cell: ({ row }) => {
                const transaction = row.original
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => navigator.clipboard.writeText(transaction.description)}>
                                Copy Description
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => onRowExclude?.(transaction)}>
                                {transaction.isExcluded ? 'Include Row' : 'Exclude Row'}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                )
            },
            size: 50,
        },
    ]

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        onColumnFiltersChange: setColumnFilters,
        getFilteredRowModel: getFilteredRowModel(),
        onRowSelectionChange: setRowSelection,
        state: {
            sorting,
            columnFilters,
            rowSelection,
        },
    })

    return (
        <div className={cn("space-y-4", className)}>
            <div className="flex items-center py-2">
                <Input
                    placeholder="Filter description..."
                    value={(table.getColumn('description')?.getFilterValue() as string) ?? ''}
                    onChange={(event) =>
                        table.getColumn('description')?.setFilterValue(event.target.value)
                    }
                    className="max-w-sm"
                />
            </div>
            <div className="rounded-md border bg-white shadow-sm overflow-hidden">
                <div className="max-h-[calc(100vh-350px)] overflow-y-auto relative">
                    <Table>
                        <TableHeader className="sticky top-0 bg-slate-50 z-10 shadow-sm">
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => {
                                        return (
                                            <TableHead key={header.id} style={{ width: header.getSize() }}>
                                                {header.isPlaceholder
                                                    ? null
                                                    : flexRender(
                                                        header.column.columnDef.header,
                                                        header.getContext()
                                                    )}
                                            </TableHead>
                                        )
                                    })}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {table.getRowModel().rows?.length ? (
                                table.getRowModel().rows.map((row) => (
                                    <TableRow
                                        key={row.id}
                                        data-state={row.getIsSelected() && "selected"}
                                        className={cn(
                                            "cursor-pointer transition-colors hover:bg-slate-50",
                                            row.original.isExcluded && "opacity-50 grayscale bg-slate-50/50"
                                        )}
                                        onClick={() => onRowClick?.(row.original)}
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell key={cell.id} className="py-2">
                                                {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={columns.length} className="h-24 text-center">
                                        No results.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
            <div className="flex-1 text-sm text-muted-foreground">
                {table.getFilteredSelectedRowModel().rows.length} of{" "}
                {table.getFilteredRowModel().rows.length} row(s) selected.
            </div>
        </div>
    )
}
