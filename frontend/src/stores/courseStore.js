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

const extractSemesterNumber = (semester) => {
  const text = `${semester?.term || ''} ${semester?.name || ''}`.toLowerCase();
  const match = text.match(/\b([1-8])(?:st|nd|rd|th)?\b/);
  if (!match) return Number.MAX_SAFE_INTEGER;
  const value = Number(match[1]);
  return Number.isFinite(value) && value >= 1 && value <= 8 ? value : Number.MAX_SAFE_INTEGER;
};

const sortSemesters = (items = []) => {
  return [...items].sort((a, b) => {
    const aNumber = extractSemesterNumber(a);
    const bNumber = extractSemesterNumber(b);
    if (aNumber !== bNumber) return aNumber - bNumber;

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
    // Optimistic: add a placeholder immediately
    const tempId = `temp-sem-${Date.now()}`;
    const optimistic = { id: tempId, _optimistic: true, ...payload };
    set((s) => ({ semesters: sortSemesters(dedupeById([...s.semesters, optimistic])) }));
    try {
      const data = await apiClient.post('/semesters', payload);
      // Replace placeholder with real server row
      set((s) => ({
        semesters: sortSemesters(dedupeById(s.semesters.map((sem) => sem.id === tempId ? data : sem))),
      }));
      return { success: true, data };
    } catch (err) {
      // Rollback
      set((s) => ({ semesters: s.semesters.filter((sem) => sem.id !== tempId) }));
      return { success: false, error: err.message };
    }
  },

  updateSemester: async (semesterId, payload) => {
    // Optimistic: merge payload immediately
    const prev = get().semesters.find((s) => s.id === semesterId);
    set((s) => ({
      semesters: sortSemesters(
        dedupeById(s.semesters.map((sem) => sem.id === semesterId ? { ...sem, ...payload } : sem))
      ),
    }));
    try {
      const data = await apiClient.put(`/semesters/${semesterId}`, payload);
      // Sync any server-computed fields
      set((s) => ({
        semesters: sortSemesters(
          dedupeById(s.semesters.map((sem) => sem.id === semesterId ? { ...sem, ...data } : sem))
        ),
      }));
      return { success: true, data };
    } catch (err) {
      // Rollback
      if (prev) set((s) => ({
        semesters: sortSemesters(dedupeById(s.semesters.map((sem) => sem.id === semesterId ? prev : sem))),
      }));
      return { success: false, error: err.message || 'Failed to update semester' };
    }
  },

  deleteSemester: async (id) => {
    // Optimistic: remove immediately
    const prev = get().semesters.find((s) => s.id === id);
    set((s) => ({ semesters: s.semesters.filter((sem) => sem.id !== id) }));
    try {
      await apiClient.delete(`/semesters/${id}`);
      return { success: true };
    } catch (err) {
      // Rollback
      if (prev) set((s) => ({ semesters: sortSemesters(dedupeById([...s.semesters, prev])) }));
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
    // Optimistic: add placeholder immediately
    const tempId = `temp-course-${Date.now()}`;
    const optimistic = { id: tempId, _optimistic: true, ...payload };
    set((s) => {
      const existing = s.courses[payload.semester_id] || [];
      return {
        courses: {
          ...s.courses,
          [payload.semester_id]: sortCourses(dedupeCourses(dedupeById([...existing, optimistic]))),
        },
      };
    });
    try {
      const data = await apiClient.post('/courses', payload);
      set((s) => {
        const existing = s.courses[payload.semester_id] || [];
        return {
          courses: {
            ...s.courses,
            [payload.semester_id]: sortCourses(dedupeCourses(dedupeById(existing.map((c) => c.id === tempId ? data : c)))),
          },
        };
      });
      return { success: true, data };
    } catch (err) {
      // Rollback
      set((s) => ({
        courses: {
          ...s.courses,
          [payload.semester_id]: (s.courses[payload.semester_id] || []).filter((c) => c.id !== tempId),
        },
      }));
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

  updateCourse: async (courseId, payload, semesterId) => {
    // Optimistic: merge payload immediately
    const prev = (get().courses[semesterId] || []).find((c) => c.id === courseId);
    set((s) => {
      const existing = s.courses[semesterId] || [];
      return {
        courses: {
          ...s.courses,
          [semesterId]: sortCourses(dedupeCourses(existing.map((c) => c.id === courseId ? { ...c, ...payload } : c))),
        },
      };
    });
    try {
      const data = await apiClient.put(`/courses/${courseId}`, payload);
      set((s) => {
        const existing = s.courses[semesterId] || [];
        return {
          courses: {
            ...s.courses,
            [semesterId]: sortCourses(dedupeCourses(existing.map((c) => c.id === courseId ? { ...c, ...data } : c))),
          },
        };
      });
      return { success: true, data };
    } catch (err) {
      // Rollback
      if (prev) set((s) => ({
        courses: {
          ...s.courses,
          [semesterId]: sortCourses(dedupeCourses((s.courses[semesterId] || []).map((c) => c.id === courseId ? prev : c))),
        },
      }));
      return { success: false, error: err.message || 'Failed to update course' };
    }
  },

  deleteCourse: async (courseId, semesterId) => {
    // Optimistic: remove immediately
    const prev = (get().courses[semesterId] || []).find((c) => c.id === courseId);
    set((s) => ({
      courses: {
        ...s.courses,
        [semesterId]: (s.courses[semesterId] || []).filter((c) => c.id !== courseId),
      },
    }));
    try {
      await apiClient.delete(`/courses/${courseId}`);
      return { success: true };
    } catch (err) {
      // Rollback
      if (prev) set((s) => ({
        courses: {
          ...s.courses,
          [semesterId]: sortCourses(dedupeCourses(dedupeById([...(s.courses[semesterId] || []), prev]))),
        },
      }));
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
