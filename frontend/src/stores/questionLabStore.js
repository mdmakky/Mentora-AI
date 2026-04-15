import { create } from 'zustand';
import { apiClient } from '../lib/apiClient';

/**
 * questionLabStore
 * Manages state for the Question Lab feature:
 *  - Hot topics (fetched from server, add/delete)
 *  - Paper analysis (pattern data from past papers)
 *  - Generated practice questions
 */
const useQuestionLabStore = create((set, get) => ({
  // ─── State ────────────────────────────────────────
  hotTopics: [],          // [{ id, topic, course_id }]
  hotTopicsLoading: false,

  patternData: null,      // merged paper analysis object
  analyzedAt: null,
  analyzeState: 'idle',   // 'idle' | 'loading' | 'done' | 'error'
  analyzeError: null,

  practiceQuestions: [],  // [{set_number, probability, topic, parts:[]}]
  generateState: 'idle',  // 'idle' | 'loading' | 'done' | 'error'
  generateError: null,
  savedCount: 0,

  // How many past question papers are in this course
  paperCount: 0,

  // ─── Hot Topics ───────────────────────────────────
  fetchHotTopics: async (courseId) => {
    set({ hotTopicsLoading: true });
    try {
      const data = await apiClient.get(`/courses/${courseId}/hot-topics`);
      set({ hotTopics: data || [], hotTopicsLoading: false });
    } catch (err) {
      console.error('Failed to fetch hot topics:', err);
      set({ hotTopicsLoading: false });
    }
  },

  addHotTopic: async (courseId, topic) => {
    try {
      const data = await apiClient.post(`/courses/${courseId}/hot-topics`, { topic });
      set((s) => ({ hotTopics: [...s.hotTopics, data] }));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  deleteHotTopic: async (courseId, topicId) => {
    try {
      await apiClient.delete(`/courses/${courseId}/hot-topics/${topicId}`);
      set((s) => ({ hotTopics: s.hotTopics.filter((t) => t.id !== topicId) }));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // ─── Paper Analysis ───────────────────────────────
  loadCachedAnalysis: async (courseId) => {
    try {
      const data = await apiClient.get(`/ai/analyze-papers/${courseId}`);
      if (data?.pattern) {
        set({ patternData: data.pattern, analyzedAt: data.analyzed_at, analyzeState: 'done' });
      } else {
        set({ patternData: null, analyzeState: 'idle' });
      }
    } catch {
      set({ patternData: null, analyzeState: 'idle' });
    }
  },

  analyzePapers: async (courseId) => {
    set({ analyzeState: 'loading', analyzeError: null, patternData: null });
    try {
      const data = await apiClient.post(`/ai/analyze-papers/${courseId}`, {});
      set({
        patternData: data.pattern,
        analyzedAt: new Date().toISOString(),
        analyzeState: 'done',
      });
      return { success: true };
    } catch (err) {
      const msg = err.message || 'Analysis failed';
      set({ analyzeState: 'error', analyzeError: msg });
      return { success: false, error: msg };
    }
  },

  // ─── Practice Generation ──────────────────────────
  generatePractice: async (courseId, { count = 8, questionType = 'broad' } = {}) => {
    set({ generateState: 'loading', generateError: null, practiceQuestions: [] });
    const hotTopics = get().hotTopics.map((t) => t.topic);
    try {
      const data = await apiClient.post(`/ai/generate-practice/${courseId}`, {
        hot_topics: hotTopics,
        count,
        question_type: questionType,
      });
      set({
        practiceQuestions: data.questions || [],
        savedCount: data.saved_count || 0,
        generateState: 'done',
      });
      return { success: true };
    } catch (err) {
      const msg = err.message || 'Generation failed';
      set({ generateState: 'error', generateError: msg });
      return { success: false, error: msg };
    }
  },

  // ─── Paper count helper ───────────────────────────
  setPaperCount: (n) => set({ paperCount: n }),

  // ─── Reset ────────────────────────────────────────
  resetSession: () => set({
    hotTopics: [],
    hotTopicsLoading: false,
    patternData: null,
    analyzedAt: null,
    analyzeState: 'idle',
    analyzeError: null,
    practiceQuestions: [],
    generateState: 'idle',
    generateError: null,
    savedCount: 0,
    paperCount: 0,
  }),
}));

export default useQuestionLabStore;
