import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '../lib/apiClient';
import { getSmartStorage } from '../lib/customStorage';

const useStudyStore = create(
  persist(
    (set, get) => ({
  dashboardData: null,
  weeklyData: [],
  courseStats: [],
  streak: null,
  todayStats: null,
  loading: false,
  error: null,

  // Fetch full study dashboard
  fetchDashboard: async () => {
    set({ loading: true, error: null });
    try {
      const data = await apiClient.get('/study/dashboard');
      set({
        dashboardData: data,
        weeklyData: data?.weekly_data || [],
        courseStats: data?.course_stats || [],
        streak: data?.streak || { current_streak: 0, longest_streak: 0 },
        todayStats: {
          total_minutes: data?.today_minutes || 0,
          goal_minutes: data?.goal_minutes || 120,
        },
        loading: false,
        error: null,
      });
      return data;
    } catch (err) {
      console.error('Failed to fetch study dashboard:', err);
      set({ loading: false, error: err.message || 'Failed to load analytics' });
      return null;
    }
  },

  // Fetch today stats only
  fetchTodayStats: async () => {
    try {
      const data = await apiClient.get('/study/stats/today');
      set({ todayStats: data });
      return data;
    } catch (err) {
      console.error('Failed to fetch today stats:', err);
      return null;
    }
  },

  // Fetch streak info
  fetchStreak: async () => {
    try {
      const data = await apiClient.get('/study/streak');
      set({ streak: data });
      return data;
    } catch (err) {
      console.error('Failed to fetch streak:', err);
      return null;
    }
  },

  // Fetch weekly stats
  fetchWeeklyStats: async () => {
    try {
      const data = await apiClient.get('/study/stats/weekly');
      set({ weeklyData: data || [] });
      return data;
    } catch (err) {
      console.error('Failed to fetch weekly stats:', err);
      return null;
    }
  },

  // Fetch per-course stats
  fetchCourseStats: async () => {
    try {
      const data = await apiClient.get('/study/stats/by-course');
      set({ courseStats: data || [] });
      return data;
    } catch (err) {
      console.error('Failed to fetch course stats:', err);
      return null;
    }
  },

  // Start a study session
  startSession: async (courseId, documentId, sessionType = 'reading') => {
    try {
      const data = await apiClient.post('/study/session/start', {
        course_id: courseId,
        document_id: documentId,
        session_type: sessionType,
      });
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // End a study session
  endSession: async (sessionId) => {
    try {
      const data = await apiClient.put(`/study/session/${sessionId}/end`);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
}),
    {
      name: 'mentora-study-store',
      storage: getSmartStorage(),
      // Never persist transient UI state — prevents infinite skeleton on reload
      partialize: (state) => ({
        dashboardData: state.dashboardData,
        weeklyData: state.weeklyData,
        courseStats: state.courseStats,
        streak: state.streak,
        todayStats: state.todayStats,
      }),
    }
  )
);

export default useStudyStore;
