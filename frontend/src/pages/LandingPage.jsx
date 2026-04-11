import { useNavigate } from 'react-router-dom';
import {
  GraduationCap, MessageSquare, BarChart3, BookOpen, FileText,
  Zap, Shield, ChevronRight, Star, Brain, Upload, ArrowRight
} from 'lucide-react';

const features = [
  {
    icon: Upload,
    title: 'Upload Any Document',
    desc: 'PDF, DOCX, PPTX — Mentora extracts and indexes your study material automatically.',
    color: 'emerald',
  },
  {
    icon: Brain,
    title: 'AI-Powered Chat',
    desc: 'Ask anything about your notes. Get precise, context-aware answers from Gemini AI.',
    color: 'violet',
  },
  {
    icon: BarChart3,
    title: 'Study Analytics',
    desc: 'Track streaks, daily goals, and time spent per course to optimize your habits.',
    color: 'blue',
  },
  {
    icon: Shield,
    title: 'Private & Secure',
    desc: 'Your documents stay yours. Enterprise-grade security backed by Supabase.',
    color: 'amber',
  },
];

const colorMap = {
  emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', border: 'border-emerald-100' },
  violet: { bg: 'bg-violet-50', icon: 'text-violet-600', border: 'border-violet-100' },
  blue: { bg: 'bg-blue-50', icon: 'text-blue-600', border: 'border-blue-100' },
  amber: { bg: 'bg-amber-50', icon: 'text-amber-600', border: 'border-amber-100' },
};

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center">
              <GraduationCap size={18} color="white" />
            </div>
            <span className="text-lg font-bold text-slate-900 tracking-tight">Mentora</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/about')}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition hidden sm:block"
            >
              About
            </button>
            <button
              onClick={() => navigate('/contact')}
              className="text-sm font-medium text-slate-600 hover:text-slate-900 transition hidden sm:block"
            >
              Contact
            </button>
            <button
              onClick={() => navigate('/login')}
              className="text-sm font-medium text-slate-700 px-4 py-2 rounded-xl hover:bg-slate-50 transition"
            >
              Sign in
            </button>
            <button
              onClick={() => navigate('/register')}
              className="text-sm font-semibold text-white px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 transition"
            >
              Get Started Free
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-24 px-4 sm:px-6 text-center relative overflow-hidden">
        {/* Background blobs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-gradient-to-b from-emerald-50 to-transparent rounded-full blur-3xl opacity-60 pointer-events-none" />

        <div className="relative max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 text-xs font-semibold px-3.5 py-1.5 rounded-full mb-6 border border-emerald-100">
            <Zap size={12} /> Powered by Gemini AI
          </div>

          <h1 className="text-5xl sm:text-6xl font-extrabold text-slate-900 leading-tight tracking-tight mb-6">
            Study Smarter<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-500">
              Not Harder
            </span>
          </h1>

          <p className="text-lg text-slate-500 max-w-xl mx-auto mb-10 leading-relaxed">
            Mentora is your AI study assistant. Upload lecture notes and PDFs, chat with AI to understand concepts, and track your progress — all in one place.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => navigate('/register')}
              className="flex items-center gap-2 px-7 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-2xl text-sm transition-all shadow-lg shadow-emerald-200 hover:shadow-xl hover:shadow-emerald-200"
            >
              Start for free <ArrowRight size={16} />
            </button>
            <button
              onClick={() => navigate('/login')}
              className="flex items-center gap-2 px-7 py-3.5 border border-slate-200 text-slate-700 font-semibold rounded-2xl text-sm hover:bg-slate-50 transition"
            >
              Sign in <ChevronRight size={16} />
            </button>
          </div>

          {/* Social proof */}
          <div className="mt-10 flex items-center justify-center gap-1.5 text-amber-400">
            {Array(5).fill(0).map((_, i) => <Star key={i} size={14} fill="currentColor" />)}
            <span className="text-sm text-slate-600 ml-2 font-medium">Loved by university students</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-4 sm:px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900 mb-3">Everything you need to ace your exams</h2>
            <p className="text-slate-500 max-w-xl mx-auto">From uploading notes to getting AI explanations — Mentora covers your entire study workflow.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {features.map((f) => {
              const c = colorMap[f.color];
              return (
                <div key={f.title} className={`bg-white rounded-2xl p-6 border ${c.border} hover:shadow-lg transition-shadow`}>
                  <div className={`w-11 h-11 rounded-xl ${c.bg} flex items-center justify-center mb-4`}>
                    <f.icon size={20} className={c.icon} />
                  </div>
                  <h3 className="font-bold text-slate-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-3">How it works</h2>
          <p className="text-slate-500 mb-14">Up and running in minutes.</p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {[
              { step: '01', icon: BookOpen, title: 'Create a course', desc: 'Organize your study material by course and semester.' },
              { step: '02', icon: FileText, title: 'Upload your notes', desc: 'Upload PDFs, slides, or docs. AI indexes everything.' },
              { step: '03', icon: MessageSquare, title: 'Chat with AI', desc: 'Ask questions, get explanations, generate quizzes.' },
            ].map((s) => (
              <div key={s.step} className="flex flex-col items-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white mb-4 shadow-lg shadow-emerald-200">
                  <s.icon size={20} />
                </div>
                <span className="text-xs font-bold text-emerald-600 mb-1">{s.step}</span>
                <h3 className="font-bold text-slate-900 mb-2">{s.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 bg-gradient-to-br from-emerald-600 to-teal-600">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to study smarter?</h2>
          <p className="text-emerald-100 mb-8">Join Mentora today and take control of your academic journey.</p>
          <button
            onClick={() => navigate('/register')}
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-emerald-700 font-bold rounded-2xl hover:bg-emerald-50 transition shadow-lg"
          >
            Get started for free <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-10 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center">
              <GraduationCap size={15} color="white" />
            </div>
            <span className="text-sm font-bold text-white">Mentora</span>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <button onClick={() => navigate('/about')} className="hover:text-white transition">About</button>
            <button onClick={() => navigate('/contact')} className="hover:text-white transition">Contact</button>
            <button onClick={() => navigate('/login')} className="hover:text-white transition">Login</button>
            <button onClick={() => navigate('/register')} className="hover:text-white transition">Register</button>
          </div>
          <p className="text-xs">© {new Date().getFullYear()} Mentora. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
