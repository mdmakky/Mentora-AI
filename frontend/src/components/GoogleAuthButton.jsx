import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import useAuthStore from '../stores/authStore';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_SCRIPT_ID = 'google-identity-services-sdk';

const loadGoogleScript = () => {
  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existingScript = document.getElementById(GOOGLE_SCRIPT_ID);
    if (existingScript) {
      existingScript.addEventListener('load', resolve, { once: true });
      existingScript.addEventListener('error', reject, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.id = GOOGLE_SCRIPT_ID;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

const GoogleAuthButton = ({ mode = 'signin' }) => {
  const loginWithGoogle = useAuthStore((state) => state.loginWithGoogle);
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [configured, setConfigured] = useState(Boolean(GOOGLE_CLIENT_ID));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) {
      setConfigured(false);
      return undefined;
    }

    return undefined;
  }, []);

  const handleGoogleClick = async () => {
    if (!GOOGLE_CLIENT_ID) {
      setConfigured(false);
      return;
    }

    try {
      setLoading(true);
      setError('');
      await loadGoogleScript();

      if (!window.google?.accounts?.oauth2?.initTokenClient) {
        throw new Error('Google auth client unavailable');
      }

      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: 'openid email profile',
        callback: async (response) => {
          if (!response?.access_token) {
            setLoading(false);
            setError('Google sign-in did not return an access token.');
            return;
          }

          const result = await loginWithGoogle(response.access_token);
          setLoading(false);

          if (result.success) {
            navigate(result.user?.is_admin ? '/admin/dashboard' : '/dashboard');
            return;
          }

          setError(result.error || 'Google sign-in failed.');
        },
      });

      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch {
      setLoading(false);
      setError('Unable to load Google sign-in right now.');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-slate-200/80" />
        <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Or continue with</span>
        <span className="h-px flex-1 bg-slate-200/80" />
      </div>

      <div className="flex justify-center">
        {configured ? (
          <button
            type="button"
            onClick={handleGoogleClick}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-full border border-white/70 bg-white/85 px-4 py-3.5 text-sm font-semibold text-slate-700 shadow-[0_12px_28px_rgba(15,23,42,0.08)] ring-1 ring-white/60 transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_16px_32px_rgba(15,23,42,0.1)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70 sm:px-5"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-200">
              <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.2 0 6 1.1 8.2 3.2l6.1-6.1C34.5 3.1 29.7 1 24 1 14.8 1 6.9 6.3 3.1 14.1l7.1 5.5C12.1 13.8 17.6 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.2 24.5c0-1.5-.1-2.5-.4-3.7H24v7.1h12.5c-.2 1.8-1.4 4.6-4.1 6.4l6.8 5.3c4-3.7 6.3-9.1 6.3-15.1z" />
                <path fill="#FBBC05" d="M10.2 28.2c-.5-1.5-.8-3.1-.8-4.8s.3-3.3.8-4.8l-7.1-5.5C1.8 16.1 1 19.1 1 23.4s.8 7.3 2.1 10.3l7.1-5.5z" />
                <path fill="#34A853" d="M24 47c5.7 0 10.5-1.9 14.1-5.2l-6.8-5.3c-1.8 1.2-4.2 2-7.3 2-6.4 0-11.9-4.3-13.8-10.2l-7.1 5.5C6.9 41.7 14.8 47 24 47z" />
              </svg>
            </span>
            <span>{mode === 'register' ? 'Continue with Google' : 'Sign in with Google'}</span>
            {loading && <Loader2 size={16} className="animate-spin text-slate-500" />}
          </button>
        ) : (
          <button
            type="button"
            disabled
            className="flex w-full items-center justify-center gap-3 rounded-full border border-slate-200 bg-white/80 px-4 py-3.5 text-sm font-semibold text-slate-400 shadow-[0_10px_24px_rgba(15,23,42,0.04)]"
          >
            Google sign-in unavailable
          </button>
        )}
      </div>

      {error && <p className="text-center text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
};

export default GoogleAuthButton;