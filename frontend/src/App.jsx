import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import useAuthStore from './stores/authStore';
import Login from './components/Login';
import Register from './components/Register';
import VerifyEmail from './components/VerifyEmail';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';

function App() {
  const { isAuthenticated, user, getProfile, logout } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      getProfile();
    }
  }, [isAuthenticated, getProfile]);

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/dashboard"
            element={
              isAuthenticated ? (
                <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#ecfeff_100%)] px-4 py-10 sm:px-8">
                  <div className="mx-auto max-w-3xl rounded-3xl border border-emerald-200 bg-white/80 p-8 shadow-[0_30px_80px_-35px_rgba(15,23,42,0.45)] backdrop-blur-xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Mentora</p>
                    <h1 className="mt-3 text-4xl font-bold text-slate-900">Welcome, {user?.full_name || 'Learner'}!</h1>
                    <p className="mt-3 text-slate-700">
                      Your authentication flow is connected with backend JWT, email verification, resend verification, and reset password routes.
                    </p>

                    <div className="mt-8 grid gap-4 sm:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Email</p>
                        <p className="mt-2 text-slate-900">{user?.email || 'Unavailable'}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Verification</p>
                        <p className="mt-2 text-slate-900">{user?.email_verified ? 'Verified' : 'Not verified'}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={logout}
                      className="mt-8 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold uppercase tracking-[0.08em] text-white transition hover:bg-slate-700"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              ) : (
                <Navigate to="/login" replace />
              )
            }
          />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
