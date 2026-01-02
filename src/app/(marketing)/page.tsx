import { LandingHero } from '@/components/features/landing/hero'
import { LandingFeatures } from '@/components/features/landing/features'
import { LandingFAQ } from '@/components/features/landing/faq'
import { PricingCards } from '@/components/features/pricing/pricing-cards'

export default function LandingPage() {
    return (
        <div className="flex flex-col">
            <LandingHero />

            {/* Social Proof */}
            <section className="py-10 border-y border-slate-100 bg-white">
                <div className="container mx-auto px-4 text-center">
                    <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-6">Trusted by 500+ accounting teams</p>
                    <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-40 grayscale transition-opacity hover:opacity-100 duration-500">
                        {/* Placeholders for logos (using text for now to avoid needing assets) */}
                        <span className="text-xl font-bold font-serif text-slate-800">Acme Corp</span>
                        <span className="text-xl font-bold font-sans text-slate-800">Globex</span>
                        <span className="text-xl font-bold font-mono text-slate-800">Soylent</span>
                        <span className="text-xl font-bold font-serif text-slate-800">Initech</span>
                        <span className="text-xl font-bold font-sans text-slate-800">Umbrella</span>
                    </div>
                </div>
            </section>

            <LandingFeatures />

            {/* Pricing Section */}
            <section id="pricing" className="bg-slate-50 py-24 sm:py-32">
                <div className="container mx-auto px-4">
                    <div className="mx-auto max-w-2xl sm:text-center mb-16">
                        <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Simple, transparent pricing</h2>
                        <p className="mt-6 text-lg leading-8 text-gray-600">
                            Start for free, upgrade when you calculate the hours you save.
                        </p>
                    </div>
                    <PricingCards />
                </div>
            </section>

            <LandingFAQ />

            {/* CTA Section */}
            <section className="bg-brand-600 py-24 sm:py-32">
                <div className="container mx-auto px-4 text-center">
                    <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
                        Ready to speed up your workflow?
                    </h2>
                    <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-brand-100">
                        Create an account today and get 50 pages of conversion for free. No credit card required.
                    </p>
                    <div className="mt-10 flex items-center justify-center gap-x-6">
                        <a
                            href="/signup"
                            className="rounded-md bg-white px-3.5 py-2.5 text-sm font-semibold text-brand-600 shadow-sm hover:bg-brand-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                        >
                            Get started for free
                        </a>
                        <a href="#features" className="text-sm font-semibold leading-6 text-white">
                            Learn more <span aria-hidden="true">→</span>
                        </a>
                    </div>
                </div>
            </section>
        </div>
    )
}
