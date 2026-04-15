import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '../lib/apiClient';
import { getSmartStorage } from '../lib/customStorage';

const TERM_PRIORITY = {
  spring: 1,
  '1st': 1,
  summer: 2,
  fall: 3,
  autumn: 3,
  '2nd': 2,
  '3rd': 3,
  '4th': 4,
  '5th': 5,
  '6th': 6,
  '7th': 7,
  '8th': 8,
};

const dedupeById = (items = []) => {
  const map = new Map();
  for (const item of items) {
    if (!item || !item.id) continue;
    map.set(item.id, item);
  }
  return Array.from(map.values());
};

const dedupeCourses = (items = []) => {
  const map = new Map();
  for (const item of items) {
    if (!item) continue;
    const key = [
      String(item?.semester_id || ''),
      String(item?.course_code || '').trim().toLowerCase(),
      String(item?.course_name || '').trim().toLowerCase(),
    ].join('|');
    if (!map.has(key)) {
      map.set(key, item);
    }
  }
  return Array.from(map.values());
};

const sortSemesters = (items = []) => {
  return [...items].sort((a, b) => {
    if (Boolean(a?.is_current) !== Boolean(b?.is_current)) {
      return a?.is_current ? -1 : 1;
    }

    const aSort = Number.isFinite(a?.sort_order) ? a.sort_order : Number.MAX_SAFE_INTEGER;
    const bSort = Number.isFinite(b?.sort_order) ? b.sort_order : Number.MAX_SAFE_INTEGER;
    if (aSort !== bSort) return aSort - bSort;

    const aYear = Number(a?.year) || 0;
    const bYear = Number(b?.year) || 0;
    if (aYear !== bYear) return bYear - aYear;

    const aTerm = TERM_PRIORITY[String(a?.term || '').toLowerCase()] ?? 999;
    const bTerm = TERM_PRIORITY[String(b?.term || '').toLowerCase()] ?? 999;
    if (aTerm !== bTerm) return aTerm - bTerm;

    return String(a?.name || '').localeCompare(String(b?.name || ''));
  });
};

const sortCourses = (items = []) => {
  return [...items].sort((a, b) => {
    const aSort = Number.isFinite(a?.sort_order) ? a.sort_order : Number.MAX_SAFE_INTEGER;
    const bSort = Number.isFinite(b?.sort_order) ? b.sort_order : Number.MAX_SAFE_INTEGER;
    if (aSort !== bSort) return aSort - bSort;

    const codeCmp = String(a?.course_code || '').localeCompare(String(b?.course_code || ''));
    if (codeCmp !== 0) return codeCmp;

    return String(a?.course_name || '').localeCompare(String(b?.course_name || ''));
  });
};

const useCourseStore = create(
  persist(
    (set, get) => ({
  semesters: [],
  courses: {},       // keyed by semester_id
  loading: false,
  error: null,

  // ─── Semesters ────────────────────────────────
  fetchSemesters: async () => {
    set({ loading: true, error: null });
    try {
      const data = await apiClient.get('/semesters');
      const normalized = sortSemesters(dedupeById(data || []));
      set({ semesters: normalized, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  createSemester: async (payload) => {
    try {
      const data = await apiClient.post('/semesters', payload);
      set((s) => ({ semesters: sortSemesters(dedupeById([...s.semesters, data])) }));
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
      const normalized = sortCourses(dedupeCourses(dedupeById(data || [])));
      set((s) => ({
        courses: { ...s.courses, [semesterId]: normalized },
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
        const normalized = sortCourses(dedupeCourses(dedupeById([...existing, data])));
        return {
          courses: {
            ...s.courses,
            [payload.semester_id]: normalized,
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
}),
    {
      name: 'mentora-course-store',
      storage: getSmartStorage(),
    }
  )
);

export default useCourseStore;
