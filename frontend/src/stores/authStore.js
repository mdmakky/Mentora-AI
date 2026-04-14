import { create } from 'zustand';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_AUTH_API_BASE || '/api/v1/auth';

const getErrorMessage = (error, fallback) => {
  const detail = error?.response?.data?.detail;
  if (!detail) return fallback;
  return typeof detail === 'string' ? detail : fallback;
};

const sanitizeUser = (user) => {
  if (!user) return null;
  const {
    password_hash,
    verification_code,
    verification_code_expires_at,
    reset_code,
    reset_code_expires_at,
    ...safeUser
  } = user;
  return safeUser;
};

const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('token') || null,
  isAuthenticated: !!localStorage.getItem('token'),

  setSession: ({ access_token, refresh_token, user }) => {
    localStorage.setItem('token', access_token);
    localStorage.setItem('refreshToken', refresh_token);
    set({ user: sanitizeUser(user), token: access_token, isAuthenticated: true });
    return { success: true, user: sanitizeUser(user) };
  },

  login: async (email, password) => {
    try {
      const response = await axios.post(`${API_BASE}/login`, { email, password });
      const { access_token, refresh_token, user } = response.data;
      return get().setSession({ access_token, refresh_token, user });
    } catch (error) {
      return { success: false, error: getErrorMessage(error, 'Login failed') };
    }
  },

  loginWithGoogle: async (credential) => {
    try {
      const response = await axios.post(`${API_BASE}/google-login`, { access_token: credential });
      const { access_token, refresh_token, user } = response.data;
      return get().setSession({ access_token, refresh_token, user });
    } catch (error) {
      return { success: false, error: getErrorMessage(error, 'Google sign-in failed') };
    }
  },

  register: async ({ email, password, fullName, university, department }) => {
    try {
      const response = await axios.post(`${API_BASE}/register`, {
        email,
        password,
        full_name: fullName,
        university: university || null,
        department: department || null,
      });
      return { success: true, ...response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error, 'Registration failed') };
    }
  },

  verifyEmail: async (email, token) => {
    try {
      const response = await axios.post(`${API_BASE}/verify-email`, { email, token });
      return { success: true, ...response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error, 'Verification failed') };
    }
  },

  resendVerification: async (email) => {
    try {
      const response = await axios.post(`${API_BASE}/resend-verification`, { email });
      return { success: true, ...response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error, 'Failed to resend verification code') };
    }
  },

  forgotPassword: async (email) => {
    try {
      const response = await axios.post(`${API_BASE}/forgot-password`, { email });
      return { success: true, ...response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error, 'Failed to send reset code') };
    }
  },

  resetPassword: async (email, token, newPassword) => {
    try {
      const response = await axios.post(`${API_BASE}/reset-password`, {
        email,
        token,
        new_password: newPassword,
      });
      return { success: true, ...response.data };
    } catch (error) {
      return { success: false, error: getErrorMessage(error, 'Password reset failed') };
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('mentora-course-store');
    localStorage.removeItem('mentora-document-store');
    localStorage.removeItem('mentora-study-store');
    sessionStorage.removeItem('mentora-course-store');
    sessionStorage.removeItem('mentora-document-store');
    sessionStorage.removeItem('mentora-study-store');
    set({ user: null, token: null, isAuthenticated: false });
  },

  updateProfile: async (data) => {
    const token = localStorage.getItem('token');
    try {
      const response = await axios.put(`${API_BASE}/profile`, data, {
        headers: { Authorization: `Bearer ${token}` },
      });
      set({ user: sanitizeUser(response.data) });
      return { success: true };
    } catch (error) {
      return { success: false, error: getErrorMessage(error, 'Failed to update profile') };
    }
  },

  refreshToken: async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return false;

    try {
      const response = await axios.post(`${API_BASE}/refresh`, { refresh_token: refreshToken });
      const { access_token, user } = response.data;
      localStorage.setItem('token', access_token);
      set({ token: access_token, user: sanitizeUser(user), isAuthenticated: true });
      return true;
    } catch (error) {
      get().logout();
      return false;
    }
  },

  getProfile: async () => {
    const token = get().token;
    if (!token) return;

    try {
      const response = await axios.get(`${API_BASE}/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      set({ user: sanitizeUser(response.data) });
    } catch (error) {
      if (error.response?.status === 401) {
        const refreshed = await get().refreshToken();
        if (refreshed) {
          const nextToken = get().token;
          const retry = await axios.get(`${API_BASE}/me`, {
            headers: { Authorization: `Bearer ${nextToken}` },
          });
          set({ user: sanitizeUser(retry.data) });
        }
      }
    }
  }
}));

export default useAuthStore;