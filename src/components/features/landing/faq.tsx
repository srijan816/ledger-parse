import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion"

const faqs = [
    {
        question: "Do you support scanned PDFs?",
        answer: "Yes! Our Pro and Enterprise plans include OCR (Optical Character Recognition) which can extract data from scanned images and flattened PDFs."
    },
    {
        question: "Is my financial data secure?",
        answer: "Absolutely. We use AES-256 encryption for all files at rest and TLS 1.3 for data in transit. We delete processed files automatically after 30 days (or sooner if configured)."
    },
    {
        question: "Can I export to QuickBooks Desktop?",
        answer: "Yes, you can export as a .IIF file or standard CSV which can be imported into QuickBooks Desktop versions."
    },
    {
        question: "What if the conversion fails?",
        answer: "If a statement fails to convert, you aren't charged for those pages. Our team is notified to improve our parsers for that specific bank layout."
    },
    {
        question: "Do you offer a free trial?",
        answer: "Yes, the Starter plan includes a 7-day free trial. You can also use the Free tier forever for small volume needs."
    }
]

export function LandingFAQ() {
    return (
        <div className="bg-slate-50 py-24 sm:py-32">
            <div className="mx-auto max-w-4xl px-6 lg:px-8">
                <h2 className="text-2xl font-bold leading-10 tracking-tight text-gray-900 text-center mb-10">
                    Frequently asked questions
                </h2>
                <Accordion type="single" collapsible className="w-full">
                    {faqs.map((faq, index) => (
                        <AccordionItem key={index} value={`item-${index}`}>
                            <AccordionTrigger className="text-left text-lg">{faq.question}</AccordionTrigger>
                            <AccordionContent className="text-gray-600 text-base">
                                {faq.answer}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </div>
        </div>
    )
}
