import { Link, useNavigate } from 'react-router-dom';
import { Target, Zap, ShieldCheck } from 'lucide-react';
import SeoHead from '../components/seo/SeoHead';
import PublicNavbar from '../components/layout/PublicNavbar';

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
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: 'About Mentora',
    url: 'https://mentora-ai.app/about',
    description: 'Learn about Mentora, an AI-powered study assistant for university students.',
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_8%_10%,rgba(190,242,100,0.35)_0%,rgba(236,253,245,0.55)_28%,transparent_50%),radial-gradient(circle_at_90%_9%,rgba(110,231,183,0.28)_0%,rgba(209,250,229,0.5)_26%,transparent_52%),linear-gradient(180deg,#f7faf7_0%,#f5f7fb_100%)]">
      <SeoHead
        title="About Mentora"
        description="Mentora is built to help students learn from their own notes and lecture documents with reliable, source-grounded AI assistance."
        path="/about"
        keywords="about Mentora, AI education platform, student productivity app"
        structuredData={structuredData}
      />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(15,23,42,0.08)_0.8px,transparent_0.9px)] bg-size-[22px_22px]" />

      <PublicNavbar />

      <main className="relative z-10 mx-auto w-[min(1040px,calc(100%-30px))] py-14 sm:py-20">
        <section className="text-center">
          {/* <span className="inline-flex items-center rounded-full border border-emerald-700/20 bg-white/80 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-800">
            About Mentora
          </span> */}
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
