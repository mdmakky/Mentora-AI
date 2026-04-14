import { Link } from 'react-router-dom';
import PublicNavbar from './layout/PublicNavbar';

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

      <PublicNavbar />

      <div className="relative z-10 mx-auto w-full max-w-xl">
        <div className="mb-6 text-center">
          {/* <span className="inline-block rounded-full border border-emerald-700/20 bg-white/80 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800">
            Mentora Secure Access
          </span> */}
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
