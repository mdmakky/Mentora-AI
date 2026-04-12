import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Target, Zap, ShieldCheck } from 'lucide-react';

const sections = [
  {
    icon: Target,
    color: '#10b981',
    bg: '#ecfdf5',
    title: 'Our Mission',
    body: 'Mentora was built for university students who are tired of drowning in lecture slides with no efficient way to learn from them. We combine AI-powered document understanding with study tracking so students can focus on understanding — not searching.',
  },
  {
    icon: Zap,
    color: '#8b5cf6',
    bg: '#f5f3ff',
    title: 'What Mentora Does',
    list: [
      'Upload PDFs, DOCX, and lecture slides — AI indexes them instantly.',
      'Ask questions in plain English, get answers from your own materials.',
      'Track study sessions, streaks, and daily goals.',
      'Organize everything by semester and course, just like your university.',
    ],
  },
  {
    icon: ShieldCheck,
    color: '#3b82f6',
    bg: '#eff6ff',
    title: 'Privacy & Security',
    body: 'Your files are encrypted and completely private. We never use your documents for anything beyond serving your own queries. You own your data — always.',
  },
];

export default function AboutPage() {
  const navigate = useNavigate();

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: '#ffffff', color: '#0f172a', minHeight: '100vh' }}>
      <style>{`
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
          font-size: 14px; font-weight: 700; padding: 12px 22px;
          border-radius: 10px; cursor: pointer; font-family: inherit;
          transition: background .15s, transform .15s;
        }
        .btn-dark:hover { background: #1e293b; transform: translateY(-1px); }

        .about-card {
          background: #fff; border: 1px solid #e2e8f0;
          border-radius: 14px; padding: 24px 26px;
          transition: box-shadow .2s;
        }
        .about-card:hover { box-shadow: 0 6px 20px rgba(15,23,42,.06); }

        /* Hero bg */
        .about-hero-bg {
          position: absolute; inset: 0; pointer-events: none; z-index: 0;
          background:
            radial-gradient(ellipse 60% 60% at 50% -5%, rgba(16,185,129,0.07) 0%, transparent 70%),
            radial-gradient(ellipse 30% 40% at 90% 60%, rgba(139,92,246,0.04) 0%, transparent 60%);
        }
        .about-hero-grid {
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
          #about-back-mobile { display: inline-flex !important; }
          .about-hero { padding: 56px 20px 52px !important; }
          .about-content { padding: 48px 20px 64px !important; }
        }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, background: 'rgba(255,255,255,0.88)', backdropFilter: 'blur(18px)', borderBottom: '1px solid #f1f5f9' }}>
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
          {/* Desktop right */}
          <div className="nav-links-desktop" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button className="page-nav-link" onClick={() => navigate('/contact')}>Contact</button>
            <button className="page-nav-link" onClick={() => navigate('/login')}>Sign in</button>
          </div>
          {/* Mobile back */}
          <button className="page-nav-link" style={{ display: 'none' }} id="about-back-mobile" onClick={() => navigate(-1)}>
            <ArrowLeft size={14} /> Back
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="about-hero" style={{ position: 'relative', overflow: 'hidden', padding: '80px 24px 72px', textAlign: 'center' }}>
        <div className="about-hero-bg" />
        <div className="about-hero-grid" />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 600, margin: '0 auto' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', fontSize: 11.5, fontWeight: 600, padding: '4px 12px', borderRadius: 100, marginBottom: 24 }}>
            About Mentora
          </span>
          <h1 style={{ fontSize: 'clamp(30px, 5vw, 52px)', fontWeight: 900, lineHeight: 1.1, letterSpacing: '-2px', margin: '0 0 18px', color: '#0f172a' }}>
            Built for students<br />
            <span style={{ color: '#10b981' }}>who want better tools</span>
          </h1>
          <p style={{ fontSize: 16, color: '#64748b', lineHeight: 1.75, margin: 0, maxWidth: 440, marginLeft: 'auto', marginRight: 'auto' }}>
            We built the tool we always wished we had — a smarter way to learn from your own study materials.
          </p>
        </div>
      </section>

      {/* ── CONTENT ── */}
      <section className="about-content" style={{ background: '#f8fafc', borderTop: '1px solid #f1f5f9', borderBottom: '1px solid #f1f5f9', padding: '64px 24px' }}>
        <div style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {sections.map(({ icon: Icon, color, bg, title, body, list }) => (
            <div key={title} className="about-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 14 }}>
                <div style={{ width: 36, height: 36, borderRadius: 9, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={17} color={color} />
                </div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#0f172a' }}>{title}</h2>
              </div>
              {body && <p style={{ margin: 0, fontSize: 14.5, color: '#475569', lineHeight: 1.8 }}>{body}</p>}
              {list && (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {list.map((item, i) => (
                    <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <span style={{ width: 20, height: 20, borderRadius: 6, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color, flexShrink: 0, marginTop: 2 }}>{i + 1}</span>
                      <span style={{ fontSize: 14, color: '#475569', lineHeight: 1.7 }}>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: '72px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 800, margin: '0 0 12px', letterSpacing: '-0.6px', color: '#0f172a' }}>
          Ready to study smarter?
        </h2>
        <p style={{ color: '#64748b', fontSize: 15, margin: '0 0 28px' }}>
          Free to use. No credit card required.
        </p>
        <button className="btn-dark" style={{ padding: '13px 28px', fontSize: 15 }} onClick={() => navigate('/register')}>
          Create free account <ArrowRight size={16} />
        </button>
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
