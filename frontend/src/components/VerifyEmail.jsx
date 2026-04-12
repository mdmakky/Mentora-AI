import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import AuthFrame from './AuthFrame';

const VerifyEmail = () => {
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const verifyEmail = useAuthStore((state) => state.verifyEmail);
  const resendVerification = useAuthStore((state) => state.resendVerification);

  useEffect(() => {
    const stateEmail = location.state?.email || '';
    const stateMessage = location.state?.infoMessage || '';

    if (stateEmail) {
      setEmail(stateEmail);
    }
    if (stateMessage) {
      setSuccess(stateMessage);
    }
  }, [location.state]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const result = await verifyEmail(email, token);
    setLoading(false);

    if (result.success) {
      setSuccess(result.message || 'Email verified successfully');
      setTimeout(() => navigate('/login'), 2000);
    } else {
      setError(result.error);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setError('Enter your email first');
      return;
    }

    setResending(true);
    setError('');
    const result = await resendVerification(email);
    setResending(false);

    if (result.success) {
      setSuccess(result.message || 'Verification code resent');
    } else {
      setError(result.error);
    }
  };

  return (
    <AuthFrame
      title="Verify Email"
      subtitle="Enter the 6-digit code sent to your email to activate your account."
      altText="Need to register first?"
      altLink="/register"
      altLinkLabel="Back to register"
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block text-sm font-semibold text-slate-700" htmlFor="email">
          Email
          <input
            id="email"
            name="email"
            type="email"
            required
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="block text-sm font-semibold text-slate-700" htmlFor="token">
          Verification Code
          <input
            id="token"
            name="token"
            type="text"
            required
            maxLength={6}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            placeholder="6-digit token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </label>

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
        {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Verifying...' : 'Verify Email'}
        </button>

        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="w-full rounded-xl border border-emerald-700/20 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {resending ? 'Resending...' : 'Resend Verification Code'}
        </button>
      </form>
    </AuthFrame>
  );
};

export default VerifyEmail;