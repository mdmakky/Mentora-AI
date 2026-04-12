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
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_10%_20%,#d9f99d_0%,#ecfccb_20%,transparent_45%),radial-gradient(circle_at_90%_10%,#a7f3d0_0%,#d1fae5_20%,transparent_45%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] px-4 py-10 sm:px-8">
      <div className="pointer-events-none absolute -left-16 top-24 h-56 w-56 rounded-full bg-emerald-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-12 h-64 w-64 rounded-full bg-amber-300/30 blur-3xl" />

      <div className="mx-auto w-full max-w-xl">
        <div className="mb-6 text-center">
          <Link to="/" className="inline-block rounded-full border border-emerald-700/20 bg-white/60 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800 hover:bg-emerald-50 transition">
            Mentora Secure Access
          </Link>
          <h1 className="mt-4 text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">{title}</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm text-slate-700 sm:text-base">{subtitle}</p>
        </div>

        <div className="rounded-3xl border border-white/70 bg-white/70 p-6 shadow-[0_25px_70px_-30px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:p-8">
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
