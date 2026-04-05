import { create } from 'zustand';
import { apiClient } from '../lib/apiClient';

const useCourseStore = create((set, get) => ({
  semesters: [],
  courses: {},       // keyed by semester_id
  loading: false,
  error: null,

  // ─── Semesters ────────────────────────────────
  fetchSemesters: async () => {
    set({ loading: true, error: null });
    try {
      const data = await apiClient.get('/semesters');
      set({ semesters: data || [], loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  createSemester: async (payload) => {
    try {
      const data = await apiClient.post('/semesters', payload);
      set((s) => ({ semesters: [...s.semesters, data] }));
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  deleteSemester: async (id) => {
    try {
      await apiClient.delete(`/semesters/${id}`);
      set((s) => ({
        semesters: s.semesters.filter((sem) => sem.id !== id),
      }));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // ─── Courses ────────────────────────────────
  fetchCourses: async (semesterId) => {
    try {
      const data = await apiClient.get(`/semesters/${semesterId}/courses`);
      set((s) => ({
        courses: { ...s.courses, [semesterId]: data || [] },
      }));
    } catch (err) {
      console.error('Failed to fetch courses:', err);
    }
  },

  createCourse: async (payload) => {
    try {
      const data = await apiClient.post('/courses', payload);
      set((s) => {
        const existing = s.courses[payload.semester_id] || [];
        return {
          courses: {
            ...s.courses,
            [payload.semester_id]: [...existing, data],
          },
        };
      });
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  getCourse: async (courseId) => {
    try {
      return await apiClient.get(`/courses/${courseId}`);
    } catch (err) {
      return null;
    }
  },

  deleteCourse: async (courseId, semesterId) => {
    try {
      await apiClient.delete(`/courses/${courseId}`);
      set((s) => {
        const existing = s.courses[semesterId] || [];
        return {
          courses: {
            ...s.courses,
            [semesterId]: existing.filter((c) => c.id !== courseId),
          },
        };
      });
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },
}));

export default useCourseStore;
