import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import AuthFrame from './AuthFrame';
import { getPasswordValidation } from '../utils/passwordValidation';

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [university, setUniversity] = useState('');
  const [department, setDepartment] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const register = useAuthStore((state) => state.register);
  const navigate = useNavigate();
  const passwordValidation = getPasswordValidation(password);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!passwordValidation.isValid) {
      setLoading(false);
      setError('Please choose a stronger password that matches all security rules.');
      return;
    }

    const result = await register({
      email,
      password,
      fullName,
      university,
      department,
    });
    setLoading(false);

    if (result.success) {
      navigate('/verify-email', {
        state: {
          email,
          infoMessage: result.message || 'Registration complete. Verify your email to continue.',
        },
      });
    } else {
      setError(result.error);
    }
  };

  return (
    <AuthFrame
      title="Create Your Mentora Account"
      subtitle="Create your account, then verify your email before signing in."
      altText="Already registered?"
      altLink="/login"
      altLinkLabel="Go to sign in"
    >
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-700" htmlFor="fullName">
            Full Name
            <input
              id="fullName"
              name="fullName"
              type="text"
              required
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              placeholder="Md Makky"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </label>

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
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-700" htmlFor="university">
            University (optional)
            <input
              id="university"
              name="university"
              type="text"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              placeholder="Your university"
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
            />
          </label>

          <label className="block text-sm font-semibold text-slate-700" htmlFor="department">
            Department (optional)
            <input
              id="department"
              name="department"
              type="text"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              placeholder="CSE, EEE, ..."
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
          </label>
        </div>

        <label className="block text-sm font-semibold text-slate-700" htmlFor="password">
          Password
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            maxLength={64}
            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            placeholder="Create a strong password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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

        <button
          type="submit"
          disabled={loading}
          className="mt-2 w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? 'Creating Account...' : 'Register'}
        </button>
      </form>
    </AuthFrame>
  );
};

export default Register;