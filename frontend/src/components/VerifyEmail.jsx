import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import AuthFrame from './AuthFrame';

const RESEND_COOLDOWN = 60;

const VerifyEmail = () => {
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [emailLocked, setEmailLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const verifyEmail = useAuthStore((state) => state.verifyEmail);
  const resendVerification = useAuthStore((state) => state.resendVerification);
  const redirectTimerRef = useRef(null);
  const countdownRef = useRef(null);

  useEffect(() => {
    // Prefer location state, fall back to sessionStorage (survives refresh)
    const stateEmail = location.state?.email || sessionStorage.getItem('pendingVerifyEmail') || '';
    const stateMessage = location.state?.infoMessage || '';

    if (stateEmail) {
      setEmail(stateEmail);
      setEmailLocked(true);
    }
    if (stateMessage) setSuccess(stateMessage);

    return () => {
      clearTimeout(redirectTimerRef.current);
      clearInterval(countdownRef.current);
    };
  }, [location.state]);

  const startCountdown = () => {
    setCountdown(RESEND_COOLDOWN);
    clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(countdownRef.current); return 0; }
        return c - 1;
      });
    }, 1000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const result = await verifyEmail(email, token);
    setLoading(false);

    if (result.success) {
      setSuccess(result.message || 'Email verified! Redirecting to login…');
      sessionStorage.removeItem('pendingVerifyEmail');
      redirectTimerRef.current = setTimeout(() => navigate('/login'), 2500);
    } else {
      setError(result.error);
    }
  };

  const handleResend = async () => {
    if (!email) { setError('Enter your email first'); return; }
    if (countdown > 0) return;

    setResending(true);
    setError('');
    const result = await resendVerification(email);
    setResending(false);

    if (result.success) {
      setSuccess(result.message || 'Verification code resent. Check your inbox.');
      startCountdown();
    } else {
      setError(result.error);
    }
  };

  return (
    <AuthFrame
      title="Verify Your Email"
      subtitle={email ? `Enter the 6-digit code sent to ${email}.` : 'Enter the 6-digit code sent to your email.'}
      altText="Need to register first?"
      altLink="/register"
      altLinkLabel="Back to register"
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        {/* Email */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2" htmlFor="ve-email">
            Email Address
          </label>
          {emailLocked ? (
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <span className="text-sm text-slate-700">{email}</span>
              <button
                type="button"
                onClick={() => { setEmailLocked(false); }}
                className="text-xs text-emerald-600 font-medium hover:text-emerald-800 transition ml-3"
              >
                Change
              </button>
            </div>
          ) : (
            <input
              id="ve-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          )}
        </div>

        {/* OTP Code */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2" htmlFor="ve-token">
            Verification Code
          </label>
          <input
            id="ve-token"
            name="token"
            type="text"
            required
            maxLength={6}
            inputMode="numeric"
            pattern="[0-9]{6}"
            autoComplete="one-time-code"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 text-center text-xl tracking-[0.5em] font-bold outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            placeholder="● ● ● ● ● ●"
            value={token}
            onChange={(e) => setToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
          />
          <p className="mt-1.5 text-xs text-slate-400">6-digit code from your email</p>
        </div>

        {/* Feedback */}
        <div aria-live="polite" aria-atomic="true" className="space-y-2">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
          )}
          {success && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>
          )}
        </div>

        {/* Verify button */}
        <button
          type="submit"
          disabled={loading || token.length !== 6}
          className="flex items-center justify-center gap-2 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && <Loader2 size={15} className="animate-spin" />}
          {loading ? 'Verifying…' : 'Verify Email'}
        </button>

        {/* Resend button with cooldown */}
        <button
          type="button"
          onClick={handleResend}
          disabled={resending || countdown > 0}
          className="flex items-center justify-center gap-2 w-full rounded-xl border border-emerald-700/20 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {resending && <Loader2 size={14} className="animate-spin" />}
          {countdown > 0
            ? `Resend available in ${countdown}s`
            : resending
            ? 'Resending…'
            : 'Resend Verification Code'}
        </button>
      </form>
    </AuthFrame>
  );
};

export default VerifyEmail;