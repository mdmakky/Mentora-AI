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
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_8%_10%,rgba(190,242,100,0.35)_0%,rgba(236,253,245,0.55)_28%,transparent_50%),radial-gradient(circle_at_90%_9%,rgba(110,231,183,0.28)_0%,rgba(209,250,229,0.5)_26%,transparent_52%),linear-gradient(180deg,#f7faf7_0%,#f5f7fb_100%)] px-4 pb-8 pt-2 sm:px-8 sm:pt-3">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle,rgba(15,23,42,0.08)_0.8px,transparent_0.9px)] bg-size-[22px_22px]" />

      <PublicNavbar compact />

      <div className="relative z-10 mx-auto w-full max-w-xl pt-4 sm:pt-6">
        <div className="mb-5 text-center sm:mb-6">
          {/* <div className="mx-auto mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-700/20 bg-white/75 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-800 shadow-[0_10px_24px_rgba(15,23,42,0.06)] backdrop-blur-md">
            Mentora Secure Access
          </div> */}
          <h1 className="font-['Sora'] text-4xl font-bold leading-tight tracking-[-0.04em] text-slate-900 sm:text-5xl">{title}</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-slate-700 sm:text-base">{subtitle}</p>
        </div>

        <div className="rounded-[28px] border border-white/50 bg-white/30 p-5 shadow-[0_26px_70px_-34px_rgba(15,23,42,0.38)] backdrop-blur-2xl sm:p-8">
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
