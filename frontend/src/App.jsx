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
import CoursesPage from './pages/CoursesPage';
import CourseView from './pages/CourseView';
import DocumentView from './pages/DocumentView';
import ChatPage from './pages/ChatPage';
import AnalyticsPage from './pages/AnalyticsPage';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminDocuments from './pages/admin/AdminDocuments';
import AdminLogs from './pages/admin/AdminLogs';

const AdminRoute = ({ children }) => {
  const { user, isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user?.is_admin) return <Navigate to="/dashboard" replace />;
  return children;
};

function App() {
  const { isAuthenticated, getProfile, user } = useAuthStore();

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
          <Route path="/courses" element={<CoursesPage />} />
          <Route path="/course/:courseId" element={<CourseView />} />
          <Route path="/document/:docId" element={<DocumentView />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          
          {/* Admin Routes */}
          <Route path="/admin/dashboard" element={
            <AdminRoute><AdminDashboard /></AdminRoute>
          } />
          <Route path="/admin/users" element={
            <AdminRoute><AdminUsers /></AdminRoute>
          } />
          <Route path="/admin/documents" element={
            <AdminRoute><AdminDocuments /></AdminRoute>
          } />
          <Route path="/admin/logs" element={
            <AdminRoute><AdminLogs /></AdminRoute>
          } />
        </Route>

        {/* Redirect root */}
        <Route path="/" element={
          isAuthenticated 
            ? <Navigate to={user?.is_admin ? '/admin/dashboard' : '/dashboard'} replace /> 
            : <Navigate to="/login" replace />
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
