import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Sparkles,
  FileText,
  MessageSquare,
  TrendingUp,
  ShieldCheck,
} from 'lucide-react';
import SeoHead from '../components/seo/SeoHead';
import PublicNavbar from '../components/layout/PublicNavbar';

const featureCards = [
  {
    icon: FileText,
    title: 'Document Intelligence',
    desc: 'Upload PDFs, DOCX, and notes. Mentora maps concepts, summaries, and key citations in seconds.',
  },
  {
    icon: MessageSquare,
    title: 'Contextual AI Chat',
    desc: 'Ask any question and get responses tied directly to your own study materials, not generic web output.',
  },
  {
    icon: TrendingUp,
    title: 'Study Analytics',
    desc: 'Track weak topics, revision frequency, and confidence scores to focus where it matters most.',
  },
  {
    icon: ShieldCheck,
    title: 'Private By Design',
    desc: 'Your academic content stays scoped to your account with secure storage and role-based access.',
  },
];

export default function LandingPage() {
  const navigate = useNavigate();

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Mentora',
    applicationCategory: 'EducationalApplication',
    operatingSystem: 'Web',
    url: 'https://mentora-ai.app/',
    description: 'AI study assistant for university students with document chat, citation-based answers, and progress tracking.',
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_8%_10%,rgba(190,242,100,0.35)_0%,rgba(236,253,245,0.55)_28%,transparent_50%),radial-gradient(circle_at_90%_9%,rgba(110,231,183,0.28)_0%,rgba(209,250,229,0.5)_26%,transparent_52%),radial-gradient(circle_at_82%_86%,rgba(253,230,138,0.3)_0%,rgba(254,243,199,0.45)_18%,transparent_40%),linear-gradient(180deg,#f7faf7_0%,#f5f7fb_100%)]">
      <SeoHead
        title="AI Study Assistant for University Students"
        description="Mentora helps students study faster with source-based AI chat over PDFs and lecture notes, plus analytics for exam preparation."
        path="/"
        keywords="AI study assistant, university learning platform, PDF chat AI, lecture notes chatbot, study analytics, exam preparation"
        structuredData={structuredData}
      />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(15,23,42,0.08)_0.8px,transparent_0.9px)] bg-size-[22px_22px]" />

      <PublicNavbar />

      <main className="relative z-10 mx-auto w-[min(1160px,calc(100%-30px))]">
        <section className="flex min-h-[calc(100vh-96px)] items-center py-10 sm:py-14">
          <div className="mx-auto max-w-4xl text-center">
            {/* <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-700/20 bg-white/80 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-800">
              <Sparkles size={12} /> Welcome to Mentora
            </span> */}

            <h1 className="font-['Sora'] text-4xl font-extrabold leading-[1.06] tracking-[-0.045em] text-slate-900 sm:text-6xl">
              AI-Powered <span className="bg-linear-to-r from-green-900 via-lime-700 to-green-500 bg-clip-text text-transparent">Study</span> Assistant
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-base leading-8 text-slate-600 sm:text-lg">
              Built for students of Jashore University of Science and Technology, Mentora helps you study from your own materials with source-grounded AI answers and measurable progress.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => navigate('/register')}
                className="inline-flex items-center gap-2 rounded-full bg-linear-to-br from-green-900 via-green-800 to-green-700 px-7 py-3.5 text-sm font-bold text-emerald-50 shadow-[0_8px_22px_rgba(21,128,61,0.28)] transition hover:-translate-y-0.5"
              >
                Start for free <ArrowRight size={16} />
              </button>
              <button
                onClick={() => navigate('/login')}
                className="rounded-full border border-slate-900/15 bg-white/85 px-7 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-white"
              >
                Sign in
              </button>
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1.5"><Check size={14} color="#16a34a" /> No credit card needed</span>
              <span className="inline-flex items-center gap-1.5"><Check size={14} color="#16a34a" /> PDF and DOCX support</span>
              <span className="inline-flex items-center gap-1.5"><Check size={14} color="#16a34a" /> AI answers with citations</span>
            </div>
          </div>
        </section>

        <section id="features" className="py-10 sm:py-14">
          <div className="text-center">
            <h2 className="font-['Sora'] text-3xl font-bold tracking-[-0.03em] text-slate-900 sm:text-4xl">Everything Needed For Smarter Study Sessions</h2>
            <p className="mx-auto mt-3 max-w-2xl text-slate-600 leading-8">
              Mentora combines document understanding, context-aware chat, and actionable study metrics in one focused workspace.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {featureCards.map(({ icon: Icon, title, desc }) => (
              <article key={title} className="rounded-2xl border border-white/40 bg-white/20 p-6 shadow-[0_12px_28px_rgba(15,23,42,0.08)] backdrop-blur-lg transition hover:-translate-y-1 hover:shadow-[0_22px_36px_rgba(15,23,42,0.12)] hover:bg-white/25">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-linear-to-br from-green-900 to-green-500 text-white shadow-lg">
                  <Icon size={20} />
                </div>
                <h3 className="font-['Sora'] text-lg font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-sm leading-7 text-slate-600">{desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="py-12 sm:py-16">
          <div className="rounded-3xl border border-white/40 bg-white/20 p-8 shadow-[0_22px_42px_rgba(15,23,42,0.12)] backdrop-blur-lg">
            <div className="text-center">
              <h3 className="font-['Sora'] text-3xl font-bold tracking-[-0.03em] text-slate-900 sm:text-4xl">
                Useful Workflows For Students
              </h3>
              <p className="mx-auto mt-3 max-w-3xl text-slate-600 leading-8">
                Do not just upload files. Use Mentora to prepare for quizzes, build revision notes per course,
                and get source-backed answers from your own class materials.
              </p>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <article className="rounded-2xl border border-white/40 bg-white/30 p-5 backdrop-blur-md">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">Before Class Test</p>
                <h4 className="mt-2 font-['Sora'] text-lg font-semibold text-slate-900">Quick Quiz Prep</h4>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Upload lecture slides, ask for likely short questions, and get concise answers for fast review.
                </p>
              </article>

              <article className="rounded-2xl border border-white/40 bg-white/30 p-5 backdrop-blur-md">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">During Semester</p>
                <h4 className="mt-2 font-['Sora'] text-lg font-semibold text-slate-900">Course-Wise Revision</h4>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Organize by course and semester, then generate summaries and key concepts for each topic.
                </p>
              </article>

              <article className="rounded-2xl border border-white/40 bg-white/30 p-5 backdrop-blur-md">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">Final Exam Time</p>
                <h4 className="mt-2 font-['Sora'] text-lg font-semibold text-slate-900">Source-Backed Answers</h4>
                <p className="mt-2 text-sm leading-7 text-slate-600">
                  Ask difficult questions and verify every answer using citations directly linked to your documents.
                </p>
              </article>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => navigate('/register')}
                className="inline-flex items-center gap-2 rounded-full bg-linear-to-br from-green-900 via-green-800 to-green-700 px-6 py-3 text-sm font-semibold text-emerald-50 shadow-[0_8px_22px_rgba(21,128,61,0.28)] transition hover:-translate-y-0.5"
              >
                Start Using Mentora <ArrowRight size={15} />
              </button>
              <Link
                to="/contact"
                className="rounded-full border border-slate-900/15 bg-white/75 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white"
              >
                Suggest a Feature
              </Link>
            </div>
          </div>
        </section>

        <section className="py-10 sm:py-14">
          <div className="rounded-3xl border border-white/40 bg-white/20 p-8 shadow-[0_22px_42px_rgba(15,23,42,0.12)] backdrop-blur-lg">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-700">SEO Resources</p>
                <h3 className="mt-2 font-['Sora'] text-2xl font-bold tracking-[-0.03em] text-slate-900 sm:text-3xl">
                  Read Student-Focused Study Guides
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">
                  Find practical guides on exam preparation, lecture-slide revision, and AI-supported study workflows designed for university students.
                </p>
              </div>
              <Link
                to="/guides"
                className="inline-flex items-center gap-2 self-start rounded-full bg-linear-to-br from-green-900 via-green-800 to-green-700 px-5 py-2.5 text-sm font-semibold text-emerald-50 shadow-[0_8px_22px_rgba(21,128,61,0.28)] transition hover:-translate-y-0.5"
              >
                Explore all guides <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 mx-auto w-[min(1160px,calc(100%-30px))] py-10 text-center text-sm text-slate-500">
        Mentora © {new Date().getFullYear()} · AI Study Platform
      </footer>
    </div>
  );
}
