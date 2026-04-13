import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Mail, Send, Loader2, CheckCircle2, Menu, X } from 'lucide-react';

export default function ContactPage() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);

    const mailtoLink = `mailto:accounts@mentora-ai.app?subject=${encodeURIComponent(form.subject)}&body=${encodeURIComponent(
      `${form.message}\n\nFrom: ${form.name} <${form.email}>`
    )}`;

    window.location.href = mailtoLink;

    await new Promise((resolve) => setTimeout(resolve, 600));
    setLoading(false);
    setSent(true);
  };

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
          <Link to="/about" className="text-sm font-semibold text-slate-800 transition hover:text-emerald-700">About Us</Link>
          <Link to="/contact" className="text-sm font-semibold text-emerald-700">Contact</Link>
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
            <Link to="/about" className="block rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-emerald-50" onClick={() => setMenuOpen(false)}>About Us</Link>
            <Link to="/contact" className="block rounded-lg px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50" onClick={() => setMenuOpen(false)}>Contact</Link>
            <Link to="/login" className="mt-1 block rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-emerald-50" onClick={() => setMenuOpen(false)}>Sign in</Link>
          </div>
        )}
      </header>

      <main className="relative z-10 mx-auto w-[min(980px,calc(100%-30px))] py-14 sm:py-20">
        <section className="text-center">
          <span className="inline-flex items-center rounded-full border border-emerald-700/20 bg-white/80 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-800">
            Contact Mentora
          </span>
          <h1 className="mx-auto mt-5 max-w-3xl font-['Sora'] text-4xl font-extrabold leading-[1.08] tracking-[-0.04em] text-slate-900 sm:text-6xl">
            We would love to hear from you
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
            Ask a question, share feedback, or send a feature request. We usually reply quickly.
          </p>
        </section>

        <section className="mx-auto mt-10 max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-xl border border-white/40 bg-white/20 px-4 py-2 text-sm text-slate-600 backdrop-blur-lg">
            <Mail size={14} className="text-emerald-700" />
            <span>
              Or email directly at{' '}
              <a href="mailto:accounts@mentora-ai.app" className="font-semibold text-emerald-700 hover:text-emerald-900">
                accounts@mentora-ai.app
              </a>
            </span>
          </div>

          <div className="rounded-3xl border border-white/40 bg-white/20 p-6 shadow-[0_12px_28px_rgba(15,23,42,0.08)] backdrop-blur-lg sm:p-8">
            {sent ? (
              <div className="py-6 text-center">
                <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 size={24} />
                </div>
                <h2 className="font-['Sora'] text-2xl font-semibold text-slate-900">Message sent</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-slate-600">
                  Thanks for reaching out. We will get back to you as soon as possible.
                </p>
                <button
                  onClick={() => {
                    setSent(false);
                    setForm({ name: '', email: '', subject: '', message: '' });
                  }}
                  className="mt-4 rounded-full border border-slate-900/15 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    Name
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      required
                      value={form.name}
                      onChange={(event) => setForm({ ...form, name: event.target.value })}
                      placeholder="Your name"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-semibold text-slate-700">
                    Email
                    <input
                      type="email"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                      required
                      value={form.email}
                      onChange={(event) => setForm({ ...form, email: event.target.value })}
                      placeholder="you@email.com"
                    />
                  </label>
                </div>

                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Subject
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    required
                    value={form.subject}
                    onChange={(event) => setForm({ ...form, subject: event.target.value })}
                    placeholder="What is this about?"
                  />
                </label>

                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Message
                  <textarea
                    rows={5}
                    className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
                    required
                    value={form.message}
                    onChange={(event) => setForm({ ...form, message: event.target.value })}
                    placeholder="Tell us more..."
                  />
                </label>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-br from-green-900 via-green-800 to-green-700 px-7 py-3.5 text-sm font-bold text-emerald-50 shadow-[0_8px_22px_rgba(21,128,61,0.28)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  {loading ? 'Sending...' : 'Send message'}
                </button>
              </form>
            )}
          </div>
        </section>
      </main>

      <footer className="relative z-10 mx-auto w-[min(980px,calc(100%-30px))] pb-10 text-center text-sm text-slate-500">
        Mentora © {new Date().getFullYear()} · Built for focused learning
      </footer>
    </div>
  );
}
