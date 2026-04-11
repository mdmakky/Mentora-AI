import { useNavigate } from 'react-router-dom';
import { GraduationCap, Brain, Target, Heart, ArrowLeft } from 'lucide-react';

const AboutPage = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center">
              <GraduationCap size={18} color="white" />
            </div>
            <span className="text-lg font-bold text-slate-900">Mentora</span>
          </button>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition"
          >
            <ArrowLeft size={16} /> Back
          </button>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 pt-28 pb-20">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="w-16 h-16 rounded-2xl bg-emerald-600 flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-200">
            <Brain size={28} color="white" />
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 mb-4">About Mentora</h1>
          <p className="text-lg text-slate-500 leading-relaxed">
            We're on a mission to make university-level learning smarter, more effective, and accessible to every student.
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-10">
          <div className="bg-slate-50 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-4">
              <Target size={20} className="text-emerald-600" />
              <h2 className="text-xl font-bold text-slate-900">Our Mission</h2>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Mentora was built for university students who are tired of drowning in lecture slides and textbooks.
              By combining AI-powered document understanding with smart study tracking, we help students
              study more effectively and retain knowledge longer.
            </p>
          </div>

          <div className="bg-slate-50 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-4">
              <Brain size={20} className="text-violet-600" />
              <h2 className="text-xl font-bold text-slate-900">What We Do</h2>
            </div>
            <ul className="space-y-3 text-slate-600">
              {[
                'Process your PDFs, DOCX, and PPTX files with AI-powered document understanding',
                'Enable natural language Q&A with your own study materials using RAG (Retrieval-Augmented Generation)',
                'Track study sessions, streaks, and daily goals to build consistent habits',
                'Organize courses and documents by semester just like your real university structure',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-slate-50 rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-4">
              <Heart size={20} className="text-rose-500" />
              <h2 className="text-xl font-bold text-slate-900">Technology</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {['FastAPI', 'React + Vite', 'Supabase', 'Google Gemini', 'Cloudinary', 'Brevo'].map((tech) => (
                <div key={tech} className="bg-white rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 text-center">
                  {tech}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <button
            onClick={() => navigate('/register')}
            className="inline-flex items-center gap-2 px-7 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-2xl transition shadow-lg shadow-emerald-200"
          >
            Start studying smarter today
          </button>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;
