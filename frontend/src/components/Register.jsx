import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import AuthFrame from './AuthFrame';
import { getPasswordValidation } from '../utils/passwordValidation';

const Register = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [university, setUniversity] = useState('');
  const [department, setDepartment] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const register = useAuthStore((state) => state.register);
  const navigate = useNavigate();
  const passwordValidation = getPasswordValidation(password);

  const passwordsMatch = confirmPassword === '' || password === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!passwordValidation.isValid) {
      setError('Please choose a stronger password that matches all security rules.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const result = await register({ email, password, fullName, university, department });
    setLoading(false);

    if (result.success) {
      // Persist email so VerifyEmail page survives refresh
      sessionStorage.setItem('pendingVerifyEmail', email);
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
      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        {/* Name + Email */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2" htmlFor="fullName">
              Full Name
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              required
              autoComplete="name"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              placeholder="Your full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2" htmlFor="email">
              Email
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
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        {/* University + Department */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2" htmlFor="university">
              University <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              id="university"
              name="university"
              type="text"
              autoComplete="organization"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              placeholder="Your university"
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2" htmlFor="department">
              Department <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              id="department"
              name="department"
              type="text"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              placeholder="CSE, EEE, …"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-2" htmlFor="password">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              maxLength={64}
              autoComplete="new-password"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              placeholder="Create a strong password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setPasswordTouched(true); }}
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

        {/* Password strength rules — only shown after first keystroke */}
        {passwordTouched && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 mb-3">
              Password security rules
            </p>
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
              placeholder="Repeat your password"
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

        {/* Error */}
        <div aria-live="polite" aria-atomic="true">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="mt-2 flex items-center justify-center gap-2 w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && <Loader2 size={15} className="animate-spin" />}
          {loading ? 'Creating Account…' : 'Create Account'}
        </button>
      </form>
    </AuthFrame>
  );
};

export default Register;