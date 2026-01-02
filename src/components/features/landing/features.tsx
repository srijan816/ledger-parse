import { Zap, Shield, FileSpreadsheet, CheckCircle, BarChart3, Lock } from 'lucide-react'

const features = [
    {
        name: 'Instant Conversion',
        description: 'Turn 100-page PDF statements into Excel files in seconds. No more manual data entry.',
        icon: Zap,
    },
    {
        name: 'Forensic Accuracy',
        description: 'Automatically detects running balance errors and flagging missing transactions.',
        icon: Shield,
    },
    {
        name: 'Smart Reconciliation',
        description: 'We verify the opening and closing balances to ensure 100% data integrity.',
        icon: CheckCircle,
    },
    {
        name: 'Universal Export',
        description: 'Export to Excel (.xlsx), CSV, or directly to QuickBooks Online and Xero.',
        icon: FileSpreadsheet,
    },
    {
        name: 'Bank Detection',
        description: 'Automatically identifies layouts from over 10,000 banks worldwide.',
        icon: BarChart3,
    },
    {
        name: 'Enterprise Security',
        description: 'Bank-grade encryption for all your data. Your files are private and secure.',
        icon: Lock,
    },
]

export function LandingFeatures() {
    return (
        <div className="py-24 sm:py-32">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
                <div className="mx-auto max-w-2xl lg:text-center">
                    <h2 className="text-base font-semibold leading-7 text-brand-600">Faster Workflow</h2>
                    <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                        Everything you need to reconcile faster
                    </p>
                    <p className="mt-6 text-lg leading-8 text-gray-600">
                        Stop wasting hours on manual data entry and date formatting. LedgerParse handles the messy parts of accounting so you can focus on the analysis.
                    </p>
                </div>
                <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-4xl">
                    <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none lg:grid-cols-2 lg:gap-y-16">
                        {features.map((feature) => (
                            <div key={feature.name} className="relative pl-16">
                                <dt className="text-base font-semibold leading-7 text-gray-900">
                                    <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600">
                                        <feature.icon className="h-6 w-6 text-white" aria-hidden="true" />
                                    </div>
                                    {feature.name}
                                </dt>
                                <dd className="mt-2 text-base leading-7 text-gray-600">{feature.description}</dd>
                            </div>
                        ))}
                    </dl>
                </div>
            </div>
        </div>
    )
}
