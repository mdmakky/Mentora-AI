import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Target, Zap, ShieldCheck, Menu, X } from 'lucide-react';
import { useState } from 'react';

const sections = [
  {
    icon: Target,
    title: 'Our Mission',
    body: 'Mentora was built for students who are tired of digging through lecture files with no clear learning flow. We combine AI document understanding with study tracking so students can focus on mastery, not manual searching.',
  },
  {
    icon: Zap,
    title: 'What Mentora Does',
    list: [
      'Upload PDFs, DOCX, and lecture slides with fast indexing.',
      'Ask in plain language and get source-backed answers.',
      'Track consistency, weak areas, and revision confidence.',
      'Organize by semester and course in one clean workspace.',
    ],
  },
  {
    icon: ShieldCheck,
    title: 'Privacy & Security',
    body: 'Your files stay private to your account. Mentora processes your content to serve your learning queries and keeps data ownership with you.',
  },
];

export default function AboutPage() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_8%_10%,rgba(190,242,100,0.35)_0%,rgba(236,253,245,0.55)_28%,transparent_50%),radial-gradient(circle_at_90%_9%,rgba(110,231,183,0.28)_0%,rgba(209,250,229,0.5)_26%,transparent_52%),linear-gradient(180deg,#f7faf7_0%,#f5f7fb_100%)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(15,23,42,0.08)_0.8px,transparent_0.9px)] bg-size-[22px_22px]" />

      <header className="sticky top-4 z-20 mx-auto mt-4 flex w-[min(1260px,calc(100%-20px))] items-center justify-between rounded-2xl border border-slate-900/10 bg-white/75 px-4 py-3 shadow-[0_14px_38px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:px-5">
        <Link to="/" className="inline-flex items-center gap-2.5" onClick={() => setMenuOpen(false)}>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-green-900 to-green-500 text-white">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
          </span>
          <span className="font-['Sora'] text-base font-bold tracking-[-0.02em] text-slate-900">Mentora</span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          <Link to="/" className="text-sm font-semibold text-slate-800 transition hover:text-emerald-700">Home</Link>
          <Link to="/about" className="text-sm font-semibold text-emerald-700">About Us</Link>
          <Link to="/contact" className="text-sm font-semibold text-slate-800 transition hover:text-emerald-700">Contact</Link>
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <button onClick={() => navigate('/login')} className="rounded-full border border-slate-900/15 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white">Sign in</button>
          <button onClick={() => navigate('/register')} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-green-900 via-green-800 to-green-700 px-5 py-2.5 text-sm font-semibold text-emerald-50 shadow-[0_8px_22px_rgba(21,128,61,0.28)] transition hover:-translate-y-0.5">Start for free <ArrowRight size={14} /></button>
        </div>

        <button className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-900/15 bg-white/85 md:hidden" onClick={() => setMenuOpen((v) => !v)} aria-label="Toggle menu">
          {menuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>

        {menuOpen && (
          <div className="absolute left-2 right-2 top-16 rounded-2xl border border-slate-900/10 bg-white/95 p-3 shadow-xl md:hidden">
            <Link to="/" className="block rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-emerald-50" onClick={() => setMenuOpen(false)}>Home</Link>
            <Link to="/about" className="block rounded-lg px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50" onClick={() => setMenuOpen(false)}>About Us</Link>
            <Link to="/contact" className="block rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-emerald-50" onClick={() => setMenuOpen(false)}>Contact</Link>
            <Link to="/login" className="mt-1 block rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-emerald-50" onClick={() => setMenuOpen(false)}>Sign in</Link>
          </div>
        )}
      </header>

      <main className="relative z-10 mx-auto w-[min(1040px,calc(100%-30px))] py-14 sm:py-20">
        <section className="text-center">
          <span className="inline-flex items-center rounded-full border border-emerald-700/20 bg-white/80 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-800">
            About Mentora
          </span>
          <h1 className="mx-auto mt-5 max-w-3xl font-['Sora'] text-4xl font-extrabold leading-[1.08] tracking-[-0.04em] text-slate-900 sm:text-6xl">
            Built for students who want better tools
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
            We built the product we wished we had: one place to understand your material, ask smarter questions, and improve outcomes faster.
          </p>
        </section>

        <section className="mt-10 grid gap-4">
          {sections.map(({ icon: Icon, title, body, list }) => (
            <article key={title} className="rounded-2xl border border-white/40 bg-white/20 p-6 shadow-[0_12px_28px_rgba(15,23,42,0.08)] backdrop-blur-lg transition hover:-translate-y-0.5 hover:bg-white/25 hover:shadow-[0_18px_36px_rgba(15,23,42,0.12)]">
              <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-linear-to-br from-green-900 to-green-500 text-white shadow-lg">
                <Icon size={20} />
              </div>
              <h2 className="font-['Sora'] text-lg font-semibold text-slate-900">{title}</h2>
              {body ? (
                <p className="mt-2 text-sm leading-7 text-slate-600">{body}</p>
              ) : (
                <ul className="mt-3 grid gap-2">
                  {list.map((item) => (
                    <li key={item} className="text-sm leading-7 text-slate-600">• {item}</li>
                  ))}
                </ul>
              )}
            </article>
          ))}
        </section>
      </main>

      <footer className="relative z-10 mx-auto w-[min(1040px,calc(100%-30px))] pb-10 text-center text-sm text-slate-500">
        Mentora © {new Date().getFullYear()} · Built for focused learning
      </footer>
    </div>
  );
}
