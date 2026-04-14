import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Menu, X } from 'lucide-react';
import BrandLogo from '../branding/BrandLogo';

const baseLinks = [
  { label: 'Home', to: '/' },
  { label: 'Study Guides', to: '/guides' },
  { label: 'About Us', to: '/about' },
  { label: 'Contact', to: '/contact' },
];

const PublicNavbar = ({
  extraLinks = [],
  showAuthButtons = true,
  compact = false,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const links = [...extraLinks, ...baseLinks];

  const isActive = (to) => {
    if (!to) return false;
    if (to === '/') return location.pathname === '/';
    return location.pathname.startsWith(to);
  };

  return (
    <header className={`sticky z-20 mx-auto flex w-[min(1260px,calc(100%-20px))] items-center justify-between rounded-2xl border border-slate-900/10 bg-white/75 px-4 py-3 shadow-[0_14px_38px_rgba(15,23,42,0.08)] backdrop-blur-xl sm:px-5 ${compact ? 'top-2 mt-2' : 'top-4 mt-4'}`}>
      <BrandLogo onClick={() => setMenuOpen(false)} />

      <nav className="hidden items-center gap-6 md:flex">
        {links.map((item) => (
          item.href ? (
            <a
              key={item.label}
              href={item.href}
              className="text-sm font-semibold text-slate-800 transition hover:text-emerald-700"
            >
              {item.label}
            </a>
          ) : (
            <Link
              key={item.label}
              to={item.to}
              className={`text-sm font-semibold transition hover:text-emerald-700 ${isActive(item.to) ? 'text-emerald-700' : 'text-slate-800'}`}
            >
              {item.label}
            </Link>
          )
        ))}
      </nav>

      {showAuthButtons && (
        <div className="hidden items-center gap-2 md:flex">
          <button
            onClick={() => navigate('/login')}
            className="rounded-full border border-slate-900/15 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-white"
          >
            Sign in
          </button>
          <button
            onClick={() => navigate('/register')}
            className="inline-flex items-center gap-2 rounded-full bg-linear-to-br from-green-900 via-green-800 to-green-700 px-5 py-2.5 text-sm font-semibold text-emerald-50 shadow-[0_8px_22px_rgba(21,128,61,0.28)] transition hover:-translate-y-0.5"
          >
            Start for free <ArrowRight size={14} />
          </button>
        </div>
      )}

      <button
        className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-900/15 bg-white/85 md:hidden"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="Toggle menu"
      >
        {menuOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {menuOpen && (
        <div className="absolute left-2 right-2 top-16 rounded-2xl border border-slate-900/10 bg-white/95 p-3 shadow-xl md:hidden">
          {links.map((item) => (
            item.href ? (
              <a
                key={item.label}
                href={item.href}
                className="block rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-emerald-50"
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.label}
                to={item.to}
                className={`block rounded-lg px-3 py-2 text-sm font-semibold hover:bg-emerald-50 ${isActive(item.to) ? 'text-emerald-700' : 'text-slate-800'}`}
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            )
          ))}

          {showAuthButtons && (
            <>
              <Link
                to="/login"
                className="mt-1 block rounded-lg px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-emerald-50"
                onClick={() => setMenuOpen(false)}
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="mt-1 block rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-600"
                onClick={() => setMenuOpen(false)}
              >
                Start for free
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
};

export default PublicNavbar;
