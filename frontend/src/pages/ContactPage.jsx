import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, Mail, MessageSquare, Send, Loader2, CheckCircle, ArrowLeft } from 'lucide-react';

const ContactPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    // Simulate sending (backend endpoint can be wired later)
    await new Promise((r) => setTimeout(r, 1200));
    setSent(true);
    setLoading(false);
  };

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

      <div className="max-w-xl mx-auto px-4 pt-28 pb-20">
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-200">
            <MessageSquare size={24} color="white" />
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 mb-3">Contact Us</h1>
          <p className="text-slate-500">Have a question, feedback, or feature request? We'd love to hear from you.</p>
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-600 bg-slate-50 rounded-xl px-4 py-3 mb-8">
          <Mail size={15} className="text-emerald-600 flex-shrink-0" />
          <span>You can also email us directly at <span className="font-semibold text-slate-900">accounts@mentora-ai.app</span></span>
        </div>

        {sent ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
              <CheckCircle size={30} className="text-emerald-600" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Message Sent!</h3>
            <p className="text-slate-500 mb-6">We'll get back to you as soon as possible.</p>
            <button
              onClick={() => { setSent(false); setForm({ name: '', email: '', subject: '', message: '' }); }}
              className="text-sm font-semibold text-emerald-600 hover:text-emerald-700"
            >
              Send another message
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Name</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition"
                  placeholder="you@email.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Subject</label>
              <input
                type="text"
                required
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition"
                placeholder="What is your message about?"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Message</label>
              <textarea
                rows={5}
                required
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 transition resize-none"
                placeholder="Tell us more..."
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-2xl transition shadow-lg shadow-emerald-200 disabled:opacity-60"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
              {loading ? 'Sending...' : 'Send Message'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ContactPage;
