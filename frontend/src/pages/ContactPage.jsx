import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Mail, Send, Loader2, CheckCircle2 } from 'lucide-react';

export default function ContactPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await new Promise(r => setTimeout(r, 1200));
    setSent(true);
    setLoading(false);
  };

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: '#ffffff', color: '#0f172a', minHeight: '100vh' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        * { box-sizing: border-box; }

        .page-nav-link {
          background: none; border: none; color: #64748b; font-size: 14px;
          font-weight: 500; cursor: pointer; padding: 7px 12px; border-radius: 8px;
          transition: color .15s, background .15s; font-family: inherit;
          display: inline-flex; align-items: center; gap: 6px;
        }
        .page-nav-link:hover { color: #0f172a; background: #f1f5f9; }

        .btn-dark {
          display: inline-flex; align-items: center; gap: 7px;
          background: #0f172a; color: #fff; border: none;
          font-size: 15px; font-weight: 700; padding: 13px 28px;
          border-radius: 10px; cursor: pointer; font-family: inherit;
          transition: background .15s, transform .15s;
          width: 100%; justify-content: center;
        }
        .btn-dark:hover:not(:disabled) { background: #1e293b; transform: translateY(-1px); }
        .btn-dark:disabled { opacity: 0.55; cursor: not-allowed; }

        .contact-label {
          display: block; font-size: 13px; font-weight: 600;
          color: #374151; margin-bottom: 7px;
        }
        .contact-input {
          width: 100%; background: #fff; border: 1px solid #e2e8f0;
          border-radius: 10px; padding: 11px 14px; font-size: 14px;
          color: #0f172a; outline: none;
          transition: border-color .15s, box-shadow .15s; font-family: inherit;
        }
        .contact-input::placeholder { color: #cbd5e1; }
        .contact-input:focus { border-color: #10b981; box-shadow: 0 0 0 3px rgba(16,185,129,.1); }

        /* Hero bg */
        .contact-hero-bg {
          position: absolute; inset: 0; pointer-events: none; z-index: 0;
          background:
            radial-gradient(ellipse 60% 60% at 50% -5%, rgba(139,92,246,0.06) 0%, transparent 70%),
            radial-gradient(ellipse 30% 40% at 10% 60%, rgba(16,185,129,0.04) 0%, transparent 60%);
        }
        .contact-hero-grid {
          position: absolute; inset: 0; pointer-events: none; z-index: 0;
          background-image:
            linear-gradient(rgba(15,23,42,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(15,23,42,0.03) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: linear-gradient(to bottom, transparent 0%, black 20%, black 60%, transparent 100%);
          -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 20%, black 60%, transparent 100%);
        }

        /* Mobile */
        @media (max-width: 640px) {
          .nav-links-desktop { display: none !important; }
          #contact-back-mobile { display: inline-flex !important; }
          .contact-hero { padding: 56px 20px 52px !important; }
          .contact-content { padding: 40px 20px 64px !important; }
          .contact-two-col { grid-template-columns: 1fr !important; }
        }

        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(18px)', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 24px', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }} onClick={() => navigate('/')} role="button" tabIndex={0}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
              </svg>
            </div>
            <span style={{ fontWeight: 800, fontSize: 15.5, color: '#0f172a', letterSpacing: '-0.3px' }}>Mentora</span>
          </div>
          {/* Desktop right */}
          <div className="nav-links-desktop" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button className="page-nav-link" onClick={() => navigate('/about')}>About</button>
            <button className="page-nav-link" onClick={() => navigate('/login')}>Sign in</button>
          </div>
          {/* Mobile back */}
          <button className="page-nav-link" style={{ display: 'none' }} id="contact-back-mobile" onClick={() => navigate(-1)}>
            <ArrowLeft size={14} /> Back
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="contact-hero" style={{ position: 'relative', overflow: 'hidden', padding: '80px 24px 64px', textAlign: 'center' }}>
        <div className="contact-hero-bg" />
        <div className="contact-hero-grid" />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 520, margin: '0 auto' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', fontSize: 11.5, fontWeight: 600, padding: '4px 12px', borderRadius: 100, marginBottom: 24 }}>
            Get in touch
          </span>
          <h1 style={{ fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 900, lineHeight: 1.1, letterSpacing: '-1.8px', margin: '0 0 16px', color: '#0f172a' }}>
            We'd love to<br />
            <span style={{ color: '#8b5cf6' }}>hear from you</span>
          </h1>
          <p style={{ fontSize: 16, color: '#64748b', lineHeight: 1.75, margin: 0 }}>
            A question, feedback, or feature idea? Drop us a message and we'll get back to you.
          </p>
        </div>
      </section>

      {/* ── FORM ── */}
      <section className="contact-content" style={{ background: '#f8fafc', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', padding: '56px 24px 72px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>

          {/* Email chip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 10, padding: '11px 16px', marginBottom: 28 }}>
            <Mail size={14} color="#10b981" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 13.5, color: '#475569' }}>
              Or email us at{' '}
              <a href="mailto:accounts@mentora-ai.app" style={{ color: '#059669', fontWeight: 600, textDecoration: 'none' }}>
                accounts@mentora-ai.app
              </a>
            </span>
          </div>

          {/* Form card */}
          <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 16, padding: '32px', boxShadow: '0 2px 12px rgba(15,23,42,.04)' }}>
            {sent ? (
              <div style={{ textAlign: 'center', padding: '28px 0' }}>
                <div style={{ width: 50, height: 50, borderRadius: '50%', background: '#ecfdf5', border: '1px solid #a7f3d0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                  <CheckCircle2 size={24} color="#10b981" />
                </div>
                <h3 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700, color: '#0f172a' }}>Message sent!</h3>
                <p style={{ color: '#64748b', margin: '0 0 24px', fontSize: 14, lineHeight: 1.6 }}>
                  Thanks for reaching out. We'll get back to you as soon as possible.
                </p>
                <button
                  onClick={() => { setSent(false); setForm({ name: '', email: '', subject: '', message: '' }); }}
                  style={{ background: 'none', border: '1px solid #e2e8f0', color: '#475569', fontSize: 13.5, fontWeight: 600, padding: '9px 20px', borderRadius: 9, cursor: 'pointer', transition: 'border-color .15s', fontFamily: 'inherit' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = '#10b981'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div className="contact-two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label className="contact-label" htmlFor="c-name">Name</label>
                    <input id="c-name" className="contact-input" type="text" required placeholder="Your name"
                      value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="contact-label" htmlFor="c-email">Email</label>
                    <input id="c-email" className="contact-input" type="email" required placeholder="you@email.com"
                      value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="contact-label" htmlFor="c-subject">Subject</label>
                  <input id="c-subject" className="contact-input" type="text" required placeholder="What is your message about?"
                    value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} />
                </div>
                <div>
                  <label className="contact-label" htmlFor="c-message">Message</label>
                  <textarea id="c-message" className="contact-input" rows={5} required
                    placeholder="Tell us more…" style={{ resize: 'none' }}
                    value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
                </div>
                <button type="submit" className="btn-dark" disabled={loading}>
                  {loading
                    ? <Loader2 size={15} style={{ animation: 'spin .8s linear infinite' }} />
                    : <Send size={15} />}
                  {loading ? 'Sending…' : 'Send Message'}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: '1px solid #f1f5f9', padding: '22px 24px', background: '#fff' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => navigate('/')} role="button">
            <div style={{ width: 22, height: 22, borderRadius: 6, background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
              </svg>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Mentora</span>
          </div>
          <p style={{ fontSize: 12, color: '#cbd5e1', margin: 0 }}>© {new Date().getFullYear()} Mentora. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
