import { Link } from 'react-router-dom';

const AuthFrame = ({
  title,
  subtitle,
  children,
  altText,
  altLink,
  altLinkLabel,
}) => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_8%_10%,rgba(190,242,100,0.35)_0%,rgba(236,253,245,0.55)_28%,transparent_50%),radial-gradient(circle_at_90%_9%,rgba(110,231,183,0.28)_0%,rgba(209,250,229,0.5)_26%,transparent_52%),linear-gradient(180deg,#f7faf7_0%,#f5f7fb_100%)] px-4 py-8 sm:px-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(15,23,42,0.08)_0.8px,transparent_0.9px)] bg-size-[22px_22px]" />

      <header className="relative z-10 mx-auto mb-8 flex w-full max-w-6xl items-center justify-between rounded-2xl border border-slate-900/10 bg-white/75 px-4 py-3 shadow-[0_14px_38px_rgba(15,23,42,0.08)] backdrop-blur-xl">
        <Link to="/" className="inline-flex items-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-green-900 to-green-500 text-white">
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
          <Link to="/contact" className="text-sm font-semibold text-slate-800 transition hover:text-emerald-700">Contact</Link>
        </nav>
      </header>

      <div className="relative z-10 mx-auto w-full max-w-xl">
        <div className="mb-6 text-center">
          <span className="inline-block rounded-full border border-emerald-700/20 bg-white/80 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800">
            Mentora Secure Access
          </span>
          <h1 className="mt-4 font-['Sora'] text-4xl font-bold leading-tight tracking-[-0.03em] text-slate-900 sm:text-5xl">{title}</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm text-slate-700 sm:text-base">{subtitle}</p>
        </div>

        <div className="rounded-3xl border border-white/40 bg-white/20 p-6 shadow-[0_25px_70px_-30px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:p-8">
          {children}

          {(altText && altLink && altLinkLabel) && (
             <p className="mt-6 text-center text-sm text-slate-600">
               {altText}{' '}
               <Link to={altLink} className="font-semibold text-emerald-700 transition hover:text-emerald-900">
                 {altLinkLabel}
               </Link>
             </p>
           )}
        </div>
      </div>
    </div>
  );
};

export default AuthFrame;
