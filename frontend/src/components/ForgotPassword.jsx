import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import AuthFrame from './AuthFrame';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const forgotPassword = useAuthStore((state) => state.forgotPassword);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const result = await forgotPassword(email);
    setLoading(false);

    if (result.success) {
      setSuccess(result.message || 'If the email is registered, a reset code has been sent.');
      // Persist email so ResetPassword page survives refresh
      sessionStorage.setItem('pendingResetEmail', email);
      // Let user manually click a link or button if they want to navigate right away,
      // or they can follow the link in their email.
    } else {
      setError(result.error);
    }
  };

  return (
    <AuthFrame
      title="Recover Your Password"
      subtitle="Request a reset code and use it to create a new password."
      altText="Remember your password?"
      altLink="/login"
      altLinkLabel="Sign in"
    >
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2" htmlFor="email">
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if(error) setError(''); }}
          />
        </div>

        <div aria-live="polite" aria-atomic="true" className="space-y-2">
          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
          {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}
        </div>

        {success ? (
          <a
            href="/reset-password"
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-slate-700"
          >
            Enter Reset Code
          </a>
        ) : (
          <button
            type="submit"
            disabled={loading || !email.trim()}
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && <Loader2 size={15} className="animate-spin" />}
            {loading ? 'Sending Code…' : 'Send Reset Code'}
          </button>
        )}
      </form>
    </AuthFrame>
  );
};

export default ForgotPassword;