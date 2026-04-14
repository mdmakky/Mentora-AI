import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import useAuthStore from '../stores/authStore';
import AuthFrame from './AuthFrame';
import SeoHead from './seo/SeoHead';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const login = useAuthStore((state) => state.login);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await login(email, password);
    setLoading(false);

    if (result.success) {
      const userState = useAuthStore.getState().user;
      if (userState?.is_admin) {
        navigate('/admin/dashboard');
      } else {
        navigate('/dashboard');
      }
    } else {
      setError(result.error);
    }
  };

  return (
    <>
      <SeoHead
        title="Login"
        description="Sign in to Mentora to access your personalized study workspace."
        path="/login"
        robots="noindex, nofollow"
      />

      <AuthFrame
        title="Welcome Back"
        subtitle="Sign in to continue your AI-powered study workflow."
        altText="Need an account?"
        altLink="/register"
        altLinkLabel="Create one"
      >
        <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        {/* Email */}
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
            className="w-full rounded-2xl border border-white/40 bg-white/20 px-4 py-3 text-slate-900 outline-none transition backdrop-blur-lg focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => { setEmail(e.target.value); if (error) setError(''); }}
          />
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
              autoComplete="current-password"
              className="w-full rounded-2xl border border-white/40 bg-white/20 px-4 py-3 pr-12 text-slate-900 outline-none transition backdrop-blur-lg focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
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

        {/* Forgot password — between password and submit is the right place */}
        <div className="text-right -mt-2">
          <Link
            to="/forgot-password"
            className="text-sm font-medium text-emerald-700 transition hover:text-emerald-900"
          >
            Forgot your password?
          </Link>
        </div>

        {/* Error */}
        <div aria-live="polite" aria-atomic="true">
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-linear-to-br from-green-900 via-green-800 to-green-700 px-4 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-emerald-50 shadow-[0_8px_22px_rgba(21,128,61,0.28)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading && <Loader2 size={15} className="animate-spin" />}
          {loading ? 'Signing In…' : 'Sign In'}
        </button>
        </form>
      </AuthFrame>
    </>
  );
};

export default Login;