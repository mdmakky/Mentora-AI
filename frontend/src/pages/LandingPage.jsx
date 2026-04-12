import { useNavigate } from 'react-router-dom';
import { ArrowRight, FileText, MessageSquare, TrendingUp, Lock, Zap, BookOpen, Check } from 'lucide-react';

const features = [
  { icon: FileText,      label: 'Document Hub',      desc: 'Upload PDFs, lecture slides, and DOCX files. Organized by course and semester.',      color: '#10b981', bg: '#ecfdf5' },
  { icon: MessageSquare, label: 'AI Chat',            desc: 'Ask questions in plain English. Get answers sourced directly from your own materials.', color: '#8b5cf6', bg: '#f5f3ff' },
  { icon: TrendingUp,    label: 'Study Analytics',    desc: 'Track study hours and streaks. See which courses need more attention.',                 color: '#3b82f6', bg: '#eff6ff' },
  { icon: Zap,           label: 'Auto Indexing',      desc: 'Every uploaded document is indexed instantly — ready to chat within seconds.',          color: '#f59e0b', bg: '#fffbeb' },
  { icon: Lock,          label: 'Private & Secure',   desc: 'Your files are encrypted and private. Nothing is shared unless you choose.',            color: '#ec4899', bg: '#fdf2f8' },
  { icon: BookOpen,      label: 'Course Structure',   desc: 'Organize by semester, course, and instructor — just like your actual university.',      color: '#06b6d4', bg: '#ecfeff' },
];

const steps = [
  { n: '1', title: 'Create a course',  desc: 'Add your university courses with semester and instructor details.' },
  { n: '2', title: 'Upload materials', desc: 'Drop in PDFs or lecture slides. AI indexes them automatically.' },
  { n: '3', title: 'Ask anything',     desc: 'Chat with AI using your own documents as the knowledge base.' },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: '#ffffff', color: '#0f172a', minHeight: '100vh', overflowX: 'hidden' }}>
      <style>{`
        * { box-sizing: border-box; }

        /* Nav */
        .lp-nav-link {
          background: none; border: none; color: #64748b;
          font-size: 14px; font-weight: 500; cursor: pointer;
          padding: 7px 14px; border-radius: 8px;
          transition: color .15s, background .15s; font-family: inherit;
        }
        .lp-nav-link:hover { color: #0f172a; background: #f1f5f9; }

        /* Mobile */
        @media (max-width: 640px) {
          .nav-links-desktop { display: none !important; }
          .nav-mobile { display: flex !important; }
          .hero-section { padding: 64px 20px 60px !important; }
          .feature-grid { grid-template-columns: 1fr !important; }
          .steps-grid { grid-template-columns: 1fr !important; }
          .section-pad { padding: 56px 20px !important; }
          .cta-section { padding: 56px 20px !important; }
          .footer-inner { flex-direction: column; align-items: flex-start !important; gap: 16px !important; }
          .perk-row { gap: 10px !important; justify-content: flex-start !important; }
        }
        @media (max-width: 900px) {
          .steps-grid { grid-template-columns: 1fr !important; }
        }

        /* Buttons */
        .btn-dark {
          display: inline-flex; align-items: center; gap: 7px;
          background: #0f172a; color: #fff; border: none;
          font-size: 14px; font-weight: 700; padding: 12px 22px;
          border-radius: 10px; cursor: pointer; font-family: inherit;
          transition: background .15s, transform .15s;
        }
        .btn-dark:hover { background: #1e293b; transform: translateY(-1px); }

        .btn-outline {
          display: inline-flex; align-items: center; gap: 7px;
          background: transparent; color: #475569;
          border: 1px solid #e2e8f0;
          font-size: 14px; font-weight: 600; padding: 12px 22px;
          border-radius: 10px; cursor: pointer; font-family: inherit;
          transition: border-color .15s, background .15s;
        }
        .btn-outline:hover { background: #f8fafc; border-color: #cbd5e1; color: #0f172a; }

        .btn-green {
          display: inline-flex; align-items: center; gap: 7px;
          background: #10b981; color: #fff; border: none;
          font-size: 14px; font-weight: 700; padding: 8px 18px;
          border-radius: 9px; cursor: pointer; font-family: inherit;
          transition: background .15s;
        }
        .btn-green:hover { background: #059669; }

        /* Feature cards */
        .feat-card {
          background: #fff; border: 1px solid #e2e8f0;
          border-radius: 14px; padding: 22px 24px;
          transition: box-shadow .2s, transform .2s;
        }
        .feat-card:hover {
          box-shadow: 0 8px 24px rgba(15,23,42,.07);
          transform: translateY(-2px);
        }

        /* Step */
        .step-card {
          background: #f8fafc; border: 1px solid #e2e8f0;
          border-radius: 14px; padding: 24px;
        }

        /* Footer link */
        .ft-link {
          background: none; border: none; color: #94a3b8;
          font-size: 13px; cursor: pointer; padding: 0;
          transition: color .15s; font-family: inherit;
        }
        .ft-link:hover { color: #475569; }

        /* Mesh gradient for hero */
        .hero-bg {
          position: absolute; inset: 0; pointer-events: none; z-index: 0;
          background:
            radial-gradient(ellipse 60% 50% at 50% -10%, rgba(16,185,129,0.08) 0%, transparent 70%),
            radial-gradient(ellipse 40% 40% at 80% 60%, rgba(139,92,246,0.05) 0%, transparent 60%),
            radial-gradient(ellipse 40% 40% at 20% 70%, rgba(59,130,246,0.04) 0%, transparent 60%);
        }

        /* Subtle grid */
        .hero-grid {
          position: absolute; inset: 0; pointer-events: none; z-index: 0;
          background-image:
            linear-gradient(rgba(15,23,42,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(15,23,42,0.03) 1px, transparent 1px);
          background-size: 48px 48px;
          mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 70%, transparent 100%);
          -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 70%, transparent 100%);
        }

        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        .cursor-em { display: inline-block; width: 3px; height: .85em; background: #10b981; vertical-align: middle; border-radius: 2px; margin-left: 2px; animation: blink 1s step-end infinite; }
      `}</style>

      {/* ── NAVBAR ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(18px)',
        borderBottom: '1px solid #f1f5f9',
      }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 24px', height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo */}
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}
            onClick={() => navigate('/')}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && navigate('/')}
            role="button"
            tabIndex={0}
          >
            <div style={{ width: 30, height: 30, borderRadius: 8, background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>
              </svg>
            </div>
            <span style={{ fontWeight: 800, fontSize: 15.5, color: '#0f172a', letterSpacing: '-0.3px' }}>Mentora</span>
          </div>
          {/* Links */}
          <div className="nav-links-desktop" style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button className="lp-nav-link" onClick={() => navigate('/about')}>About</button>
            <button className="lp-nav-link" onClick={() => navigate('/contact')}>Contact</button>
            <div style={{ width: 1, height: 18, background: '#e2e8f0', margin: '0 6px' }} />
            <button className="btn-outline" style={{ padding: '7px 16px', fontSize: 13 }} onClick={() => navigate('/login')}>Sign in</button>
            <button className="btn-green" style={{ marginLeft: 6 }} onClick={() => navigate('/register')}>
              Get started <ArrowRight size={13} />
            </button>
          </div>
          {/* Mobile: only show get started */}
          <div style={{ display: 'none' }} className="nav-mobile">
            <button className="btn-green" style={{ padding: '7px 14px', fontSize: 13 }} onClick={() => navigate('/register')}>
              Get started <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="hero-section" style={{ position: 'relative', overflow: 'hidden', padding: '96px 24px 88px', textAlign: 'center' }}>
        <div className="hero-bg" />
        <div className="hero-grid" />

        <div style={{ position: 'relative', zIndex: 1, maxWidth: 680, margin: '0 auto' }}>
          {/* Badge */}
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0',
            fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 100, marginBottom: 28,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
            AI Study Assistant · Powered by Gemini
          </span>

          {/* Headline */}
          <h1 style={{
            fontSize: 'clamp(38px, 6vw, 68px)', fontWeight: 900, lineHeight: 1.08,
            letterSpacing: '-2.5px', margin: '0 0 20px', color: '#0f172a',
          }}>
            Your personal AI<br />
            <span style={{ color: '#10b981' }}>study assistant</span>
            <span className="cursor-em" />
          </h1>

          {/* Sub */}
          <p style={{ fontSize: 17, color: '#64748b', lineHeight: 1.75, margin: '0 0 36px', maxWidth: 460, marginLeft: 'auto', marginRight: 'auto' }}>
            Upload lecture slides and PDFs. Chat with Gemini AI using your own materials.
            Track your study progress — all in one place.
          </p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button id="hero-start" className="btn-dark" style={{ padding: '13px 28px', fontSize: 15 }} onClick={() => navigate('/register')}>
              Start for free <ArrowRight size={16} />
            </button>
            <button id="hero-signin" className="btn-outline" style={{ padding: '13px 28px', fontSize: 15 }} onClick={() => navigate('/login')}>
              Sign in
            </button>
          </div>

          {/* Perks */}
          <div className="perk-row" style={{ display: 'flex', justifyContent: 'center', gap: 22, marginTop: 32, flexWrap: 'wrap' }}>
            {['Free to get started', 'No credit card needed', 'PDF & DOCX support'].map(p => (
              <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748b' }}>
                <Check size={13} color="#10b981" />
                {p}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="features" className="section-pad" style={{ background: '#f8fafc', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', padding: '80px 24px' }}>
        <div style={{ maxWidth: 1060, margin: '0 auto' }}>
          <div style={{ marginBottom: 44 }}>
            <p style={{ fontSize: 11.5, fontWeight: 700, color: '#10b981', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 10px' }}>What you get</p>
            <h2 style={{ fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 800, margin: 0, letterSpacing: '-0.8px', color: '#0f172a' }}>
              Everything you need to study better
            </h2>
          </div>
          <div className="feature-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 14 }}>
            {features.map(f => (
              <div key={f.label} className="feat-card">
                <div style={{ width: 38, height: 38, borderRadius: 9, background: f.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <f.icon size={17} color={f.color} />
                </div>
                <h3 style={{ margin: '0 0 7px', fontSize: 14.5, fontWeight: 700, color: '#0f172a' }}>{f.label}</h3>
                <p style={{ margin: 0, fontSize: 13.5, color: '#64748b', lineHeight: 1.7 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="section-pad" style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          <div style={{ marginBottom: 44 }}>
            <p style={{ fontSize: 11.5, fontWeight: 700, color: '#8b5cf6', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 10px' }}>How it works</p>
            <h2 style={{ fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 800, margin: 0, letterSpacing: '-0.8px', color: '#0f172a' }}>
              Up and running in 3 steps
            </h2>
          </div>
          <div className="steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {steps.map((s, i) => (
              <div key={i} className="step-card">
                <div style={{ fontSize: 12, fontWeight: 800, color: '#10b981', letterSpacing: '0.1em', marginBottom: 12 }}>{s.n}</div>
                <h3 style={{ margin: '0 0 8px', fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{s.title}</h3>
                <p style={{ margin: 0, fontSize: 13.5, color: '#64748b', lineHeight: 1.7 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="cta-section" style={{ background: '#f8fafc', borderTop: '1px solid #f1f5f9', padding: '80px 24px' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 'clamp(22px, 3.5vw, 34px)', fontWeight: 800, margin: '0 0 12px', letterSpacing: '-0.8px', color: '#0f172a' }}>
            Start studying smarter today
          </h2>
          <p style={{ color: '#64748b', fontSize: 15, margin: '0 0 30px', lineHeight: 1.65 }}>
            Free to use. Upload your first document and start chatting with AI in minutes.
          </p>
          <button id="cta-register" className="btn-dark" style={{ padding: '13px 28px', fontSize: 15 }} onClick={() => navigate('/register')}>
            Create free account <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: '1px solid #f1f5f9', padding: '24px', background: '#fff' }}>
        <div className="footer-inner" style={{ maxWidth: 1060, margin: '0 auto', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => navigate('/')} role="button">
            <div style={{ width: 22, height: 22, borderRadius: 6, background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
              </svg>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>Mentora</span>
          </div>
          <div style={{ display: 'flex', gap: 20 }}>
            {[
              { l: 'About',   fn: () => navigate('/about') },
              { l: 'Contact', fn: () => navigate('/contact') },
              { l: 'Sign in', fn: () => navigate('/login') },
            ].map(({ l, fn }) => (
              <button key={l} className="ft-link" onClick={fn}>{l}</button>
            ))}
          </div>
          <p style={{ fontSize: 12, color: '#cbd5e1', margin: 0 }}>© {new Date().getFullYear()} Mentora</p>
        </div>
      </footer>
    </div>
  );
}
