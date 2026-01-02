import { cn } from '@/lib/utils'

interface ConfidenceCellProps {
    score: number
    className?: string
}

export function ConfidenceCell({ score, className }: ConfidenceCellProps) {
    let bgColor = 'bg-transparent'
    let textColor = 'text-slate-400'

    if (score < 80) {
        bgColor = 'bg-red-100'
        textColor = 'text-red-700'
    } else if (score < 95) {
        bgColor = 'bg-amber-100'
        textColor = 'text-amber-700'
    }

    return (
        <div className={cn("flex items-center justify-center h-full w-full", bgColor, className)}>
            <span className={cn("text-xs font-medium", textColor)}>
                {score === 100 ? '' : `${score}%`}
            </span>
        </div>
    )
}
