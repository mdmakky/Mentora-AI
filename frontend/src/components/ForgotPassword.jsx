import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import AuthFrame from './AuthFrame';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const forgotPassword = useAuthStore((state) => state.forgotPassword);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const result = await forgotPassword(email);
    setLoading(false);

    if (result.success) {
      setSuccess(result.message || 'If the email is registered, a reset code has been sent.');
      navigate('/reset-password', {
        state: {
          email,
        },
      });
    } else {
      setError(result.error);
    }
  };

  return (
    <AuthFrame
      title="Recover Your Password"
      subtitle="This calls POST /auth/forgot-password and then routes you to reset with email + token."
      altText="Remember your password?"
      altLink="/login"
      altLinkLabel="Sign in"
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <label className="block text-sm font-semibold text-slate-700" htmlFor="email">
          Email Address
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

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
        {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-amber-600 px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Sending Code...' : 'Send Reset Code'}
        </button>

        <Link
          to="/login"
          className="block text-center text-sm font-medium text-emerald-700 transition hover:text-emerald-900"
        >
          Back to sign in
        </Link>
      </form>
    </AuthFrame>
  );
};

export default ForgotPassword;