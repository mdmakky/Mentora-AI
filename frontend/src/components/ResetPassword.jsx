import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import AuthFrame from './AuthFrame';
import { getPasswordValidation } from '../utils/passwordValidation';

const ResetPassword = () => {
  const [token, setToken] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const resetPassword = useAuthStore((state) => state.resetPassword);
  const passwordValidation = getPasswordValidation(newPassword);

  useEffect(() => {
    const stateEmail = location.state?.email || '';
    if (stateEmail) {
      setEmail(stateEmail);
    }
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
      setSuccess(result.message || 'Password changed successfully');
      setTimeout(() => navigate('/login'), 2000);
    } else {
      setError(result.error);
    }
  };

  return (
    <AuthFrame
      title="Set New Password"
      subtitle="Use your reset code and choose a strong new password."
      altText="Need a new token?"
      altLink="/forgot-password"
      altLinkLabel="Request again"
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
          Reset Token
          <input
            id="token"
            name="token"
            type="text"
            required
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            placeholder="6-digit token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
          />
        </label>

        <label className="block text-sm font-semibold text-slate-700" htmlFor="newPassword">
          New Password
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            required
            minLength={8}
            maxLength={64}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            placeholder="Create a strong password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </label>

        <label className="block text-sm font-semibold text-slate-700" htmlFor="confirmPassword">
          Confirm Password
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            maxLength={64}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            placeholder="Repeat your new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </label>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Password security rules</p>
          <ul className="mt-3 space-y-2 text-sm">
            {passwordValidation.rules.map((rule) => (
              <li
                key={rule.id}
                className={rule.passed ? 'text-emerald-700' : 'text-slate-600'}
              >
                {rule.passed ? 'PASS' : 'PENDING'} - {rule.label}
              </li>
            ))}
          </ul>
        </div>

        {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
        {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Updating Password...' : 'Reset Password'}
        </button>
      </form>
    </AuthFrame>
  );
};

export default ResetPassword;