import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header' // Optional: if you want header in dashboard too, or valid independent

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="flex min-h-screen">
            <Sidebar />
            <div className="flex-1 flex flex-col">
                {/* <Header />  If we want header here too, otherwise standalone */}
                <main className="flex-1 p-8 overflow-y-auto">
                    {children}
                </main>
            </div>
        </div>
    )
}
