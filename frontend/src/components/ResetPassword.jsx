import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import AuthFrame from './AuthFrame';
import { getPasswordValidation } from '../utils/passwordValidation';

const ResetPassword = () => {
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [emailLocked, setEmailLocked] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const resetPassword = useAuthStore((state) => state.resetPassword);
  const passwordValidation = getPasswordValidation(newPassword);
  const redirectTimerRef = useRef(null);

  const passwordsMatch = confirmPassword === '' || newPassword === confirmPassword;

  useEffect(() => {
    const stateEmail = location.state?.email || sessionStorage.getItem('pendingResetEmail') || '';
    if (stateEmail) {
      setEmail(stateEmail);
      setEmailLocked(true);
    }
    
    return () => clearTimeout(redirectTimerRef.current);
  }, [location.state]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (!passwordValidation.isValid) {
      setError('Please choose a stronger password that matches all security rules.');
      setLoading(false);
      return;
    }

    const result = await resetPassword(email, token, newPassword);
    setLoading(false);

    if (result.success) {
      setSuccess(result.message || 'Password changed successfully. Redirecting…');
      sessionStorage.removeItem('pendingResetEmail');
      redirectTimerRef.current = setTimeout(() => navigate('/login'), 2500);
    } else {
      setError(result.error);
    }
  };

  return (
    <AuthFrame
      title="Set New Password"
      subtitle="Use your reset code and choose a strong new password."
      altText="Didn't receive a code?"
      altLink="/forgot-password"
      altLinkLabel="Request again"
    >
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        {/* Email */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2" htmlFor="rp-email">
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
              id="rp-email"
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

        {/* OTP Token */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2" htmlFor="rp-token">
            Reset Token
          </label>
          <input
            id="rp-token"
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
        </div>

        {/* New Password */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2" htmlFor="newPassword">
            New Password
          </label>
          <div className="relative">
            <input
              id="newPassword"
              name="newPassword"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              maxLength={64}
              autoComplete="new-password"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              placeholder="Create a strong password"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); setPasswordTouched(true); }}
            />
            <button
              type="button"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* Password Rules */}
        {passwordTouched && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 mb-3">Password security rules</p>
            <ul className="space-y-1.5">
              {passwordValidation.rules.map((rule) => (
                <li key={rule.id} className={`flex items-center gap-2 text-sm ${rule.passed ? 'text-emerald-700' : 'text-slate-500'}`}>
                   {rule.passed
                     ? <CheckCircle2 size={14} className="flex-shrink-0 text-emerald-500" />
                     : <XCircle size={14} className="flex-shrink-0 text-slate-300" />}
                   {rule.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Confirm Password */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2" htmlFor="confirmPassword">
            Confirm Password
          </label>
          <div className="relative">
             <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirm ? 'text' : 'password'}
              required
              autoComplete="new-password"
              className={`w-full rounded-xl border bg-white px-4 py-3 pr-12 text-slate-900 outline-none transition focus:ring-4 ${
                confirmPassword && !passwordsMatch
                  ? 'border-rose-300 focus:border-rose-400 focus:ring-rose-100'
                  : confirmPassword && passwordsMatch
                  ? 'border-emerald-400 focus:border-emerald-500 focus:ring-emerald-100'
                  : 'border-slate-200 focus:border-emerald-500 focus:ring-emerald-100'
              }`}
              placeholder="Repeat your new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <button
              type="button"
              aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
              onClick={() => setShowConfirm((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
            >
              {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {confirmPassword && (
             <p className={`mt-1.5 text-xs font-medium ${passwordsMatch ? 'text-emerald-600' : 'text-rose-600'}`}>
               {passwordsMatch ? '✓ Passwords match' : '✗ Passwords do not match'}
             </p>
          )}
        </div>

        <div aria-live="polite" aria-atomic="true" className="space-y-2">
           {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
           {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}
        </div>

        <button
          type="submit"
          disabled={loading || token.length !== 6 || !passwordValidation.isValid || !passwordsMatch}
          className="flex items-center justify-center gap-2 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && <Loader2 size={15} className="animate-spin" />}
          {loading ? 'Updating Password…' : 'Reset Password'}
        </button>
      </form>
    </AuthFrame>
  );
};

export default ResetPassword;