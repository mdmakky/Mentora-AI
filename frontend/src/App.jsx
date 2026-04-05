import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import useAuthStore from './stores/authStore';

// Auth pages
import Login from './components/Login';
import Register from './components/Register';
import VerifyEmail from './components/VerifyEmail';
import ForgotPassword from './components/ForgotPassword';
import ResetPassword from './components/ResetPassword';

// App layout + pages
import AppLayout from './components/layout/AppLayout';
import Dashboard from './components/Dashboard';
import CourseView from './pages/CourseView';
import DocumentView from './pages/DocumentView';

function App() {
  const { isAuthenticated, getProfile } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated) {
      getProfile();
    }
  }, [isAuthenticated, getProfile]);

  return (
    <Router>
      <Routes>
        {/* Public auth routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Protected routes inside AppLayout */}
        <Route
          element={
            isAuthenticated ? <AppLayout /> : <Navigate to="/login" replace />
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/courses" element={<Dashboard />} />
          <Route path="/course/:courseId" element={<CourseView />} />
          <Route path="/document/:docId" element={<DocumentView />} />
          <Route path="/chat" element={<Dashboard />} />
          <Route path="/analytics" element={<Dashboard />} />
        </Route>

        {/* Redirect root */}
        <Route path="/" element={<Navigate to={isAuthenticated ? '/dashboard' : '/login'} replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
