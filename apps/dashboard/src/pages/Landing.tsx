import { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import type { Lang } from '../i18n/translations';

function LanguageSwitcher() {
  const { lang, setLang } = useLanguage();
  const options: Lang[] = ['en', 'es'];
  return (
    <div className="flex items-center gap-1 rounded-full border border-gray-200 bg-white/80 backdrop-blur px-1 py-0.5">
      {options.map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`px-2.5 py-1 text-xs font-semibold rounded-full uppercase tracking-wider transition-colors ${
            lang === l
              ? 'bg-gray-900 text-white'
              : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function Nav() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);

  const scrollTo = (id: string) => {
    setOpen(false);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <span className="text-lg font-bold text-gray-900 tracking-tight">
          Hotel Voice Agent
        </span>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-8">
          <button onClick={() => scrollTo('benefits')} className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
            {t.nav.features}
          </button>
          <button onClick={() => scrollTo('how-it-works')} className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
            {t.nav.howItWorks}
          </button>
          <button onClick={() => scrollTo('pricing')} className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
            {t.nav.pricing}
          </button>
          <button onClick={() => scrollTo('faq')} className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
            {t.nav.faq}
          </button>
          <LanguageSwitcher />
          <button
            onClick={() => scrollTo('final-cta')}
            className="px-5 py-2 text-sm font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            {t.nav.cta}
          </button>
        </div>

        {/* Mobile toggle */}
        <div className="flex items-center gap-3 md:hidden">
          <LanguageSwitcher />
          <button onClick={() => setOpen(!open)} className="p-2 text-gray-700" aria-label="Menu">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {open ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-white border-b border-gray-100 px-6 pb-4 space-y-3">
          <button onClick={() => scrollTo('benefits')} className="block text-sm text-gray-600">{t.nav.features}</button>
          <button onClick={() => scrollTo('how-it-works')} className="block text-sm text-gray-600">{t.nav.howItWorks}</button>
          <button onClick={() => scrollTo('pricing')} className="block text-sm text-gray-600">{t.nav.pricing}</button>
          <button onClick={() => scrollTo('faq')} className="block text-sm text-gray-600">{t.nav.faq}</button>
          <button
            onClick={() => scrollTo('final-cta')}
            className="block w-full text-center px-5 py-2.5 text-sm font-semibold bg-gray-900 text-white rounded-lg"
          >
            {t.nav.cta}
          </button>
        </div>
      )}
    </nav>
  );
}

function Hero() {
  const { t } = useLanguage();

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="pt-32 pb-20 md:pt-40 md:pb-28 bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight tracking-tight whitespace-pre-line">
          {t.hero.headline}
        </h1>
        <p className="mt-6 text-lg md:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
          {t.hero.subheadline}
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => scrollTo('final-cta')}
            className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors shadow-lg shadow-gray-900/10"
          >
            {t.hero.cta}
          </button>
          <button
            onClick={() => scrollTo('how-it-works')}
            className="w-full sm:w-auto px-8 py-3.5 text-base font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:border-gray-300 hover:bg-gray-50 transition-colors"
          >
            {t.hero.ctaSecondary}
          </button>
        </div>
      </div>
    </section>
  );
}

function Positioning() {
  const { t } = useLanguage();
  return (
    <section className="py-16 md:py-20 bg-white">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 tracking-tight">
          {t.positioning.title}
        </h2>
        <p className="mt-6 text-base md:text-lg text-gray-600 leading-relaxed">
          {t.positioning.text}
        </p>
      </div>
    </section>
  );
}

function Benefits() {
  const { t } = useLanguage();
  return (
    <section id="benefits" className="py-16 md:py-24 bg-gray-50">
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 text-center tracking-tight">
          {t.benefits.title}
        </h2>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {t.benefits.items.map((item, i) => (
            <div key={i} className="bg-white rounded-xl p-7 shadow-sm border border-gray-100">
              <div className="w-10 h-10 rounded-lg bg-gray-900 text-white flex items-center justify-center text-sm font-bold mb-5">
                {String(i + 1).padStart(2, '0')}
              </div>
              <h3 className="text-lg font-semibold text-gray-900">{item.title}</h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const { t } = useLanguage();
  return (
    <section id="how-it-works" className="py-16 md:py-24 bg-white">
      <div className="max-w-4xl mx-auto px-6">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 text-center tracking-tight">
          {t.howItWorks.title}
        </h2>
        <div className="mt-14 space-y-0">
          {t.howItWorks.steps.map((step, i) => (
            <div key={i} className="flex gap-6 md:gap-8">
              {/* Vertical line + number */}
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-bold shrink-0">
                  {step.number}
                </div>
                {i < t.howItWorks.steps.length - 1 && (
                  <div className="w-px flex-1 bg-gray-200 my-2" />
                )}
              </div>
              <div className={`pb-12 ${i === t.howItWorks.steps.length - 1 ? 'pb-0' : ''}`}>
                <h3 className="text-lg font-semibold text-gray-900 mt-2.5">{step.title}</h3>
                <p className="mt-2 text-sm text-gray-600 leading-relaxed max-w-xl">{step.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  const { t } = useLanguage();

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section id="pricing" className="py-16 md:py-24 bg-gray-50">
      <div className="max-w-3xl mx-auto px-6">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 text-center tracking-tight">
          {t.pricing.title}
        </h2>

        <div className="mt-12 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="p-8 md:p-10">
            {/* Two big numbers */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-8 sm:gap-16">
              <div className="text-center">
                <p className="text-5xl md:text-6xl font-bold text-gray-900">{t.pricing.setup}</p>
                <p className="mt-2 text-sm font-medium text-gray-500 uppercase tracking-wider">{t.pricing.setupLabel}</p>
              </div>
              <div className="hidden sm:block w-px h-20 bg-gray-200" />
              <div className="text-center">
                <p className="text-5xl md:text-6xl font-bold text-gray-900">{t.pricing.fee}</p>
                <p className="mt-2 text-sm font-medium text-gray-500 uppercase tracking-wider">{t.pricing.feeLabel}</p>
              </div>
            </div>

            <p className="mt-4 text-center text-sm text-gray-500">{t.pricing.feeSublabel}</p>

            {/* Highlights */}
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              {t.pricing.highlights.map((h, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-50 rounded-full text-sm text-gray-700 font-medium"
                >
                  <svg className="w-4 h-4 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {h}
                </span>
              ))}
            </div>

            {/* CTA */}
            <div className="mt-10 text-center">
              <button
                onClick={() => scrollTo('final-cta')}
                className="px-10 py-3.5 text-base font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors shadow-lg shadow-gray-900/10"
              >
                {t.pricing.cta}
              </button>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="px-8 md:px-10 py-5 bg-gray-50 border-t border-gray-100">
            <p className="text-xs text-gray-400 leading-relaxed">{t.pricing.disclaimer}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function FAQ() {
  const { t } = useLanguage();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="py-16 md:py-24 bg-white">
      <div className="max-w-3xl mx-auto px-6">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 text-center tracking-tight">
          {t.faq.title}
        </h2>
        <div className="mt-12 space-y-0 divide-y divide-gray-200 border-t border-b border-gray-200">
          {t.faq.items.map((item, i) => (
            <div key={i}>
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between py-5 text-left group"
              >
                <span className="text-base font-medium text-gray-900 pr-4 group-hover:text-gray-700 transition-colors">
                  {item.q}
                </span>
                <svg
                  className={`w-5 h-5 text-gray-400 shrink-0 transition-transform duration-200 ${
                    openIndex === i ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div
                className={`overflow-hidden transition-all duration-200 ${
                  openIndex === i ? 'max-h-96 pb-5' : 'max-h-0'
                }`}
              >
                <p className="text-sm text-gray-600 leading-relaxed">{item.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  const { t } = useLanguage();
  return (
    <section id="final-cta" className="py-20 md:py-28 bg-gray-900">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
          {t.finalCta.headline}
        </h2>
        <p className="mt-4 text-lg text-gray-400 max-w-xl mx-auto">
          {t.finalCta.text}
        </p>
        <div className="mt-10">
          <a
            href="mailto:hello@hotelvoiceagent.com"
            className="inline-block px-10 py-4 text-base font-semibold bg-white text-gray-900 rounded-lg hover:bg-gray-100 transition-colors shadow-lg"
          >
            {t.finalCta.cta}
          </a>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const { t } = useLanguage();
  return (
    <footer className="py-8 bg-gray-950">
      <div className="max-w-6xl mx-auto px-6 text-center">
        <p className="text-sm text-gray-500">{t.footer.copy}</p>
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <Nav />
      <Hero />
      <Positioning />
      <Benefits />
      <HowItWorks />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}
