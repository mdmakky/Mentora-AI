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
  generationRuns: [],
  generationsLoading: false,
  selectedGenerationId: null,

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
        selectedGenerationId: data.generation_id || null,
        generateState: 'done',
      });

      // Refresh from DB using generation cluster so cross-browser state is consistent.
      await get().loadPracticeGenerations(courseId, questionType);
      await get().loadSavedPractice(courseId, {
        questionType,
        generationId: data.generation_id || null,
      });

      return { success: true };
    } catch (err) {
      const msg = err.message || 'Generation failed';
      set({ generateState: 'error', generateError: msg });
      return { success: false, error: msg };
    }
  },

  loadSavedPractice: async (courseId, { questionType = null, generationId = null, includeAll = false } = {}) => {
    try {
      const params = new URLSearchParams();
      if (questionType) params.set('question_type', questionType);
      if (generationId) params.set('generation_id', generationId);
      if (includeAll) params.set('include_all', 'true');

      const suffix = params.toString() ? `?${params.toString()}` : '';
      const data = await apiClient.get(`/ai/practice-questions/${courseId}${suffix}`);
      const sets = Array.isArray(data) ? data : [];
      const savedCount = sets.reduce((sum, setItem) => {
        const partCount = Array.isArray(setItem?.parts) ? setItem.parts.length : 0;
        return sum + partCount;
      }, 0);

      const inferredGenerationId = generationId
        || (sets.length > 0 ? (sets[0]?.generation_id || sets[0]?.generation_run_id || null) : null);

      set({
        practiceQuestions: sets,
        savedCount,
        selectedGenerationId: inferredGenerationId,
        generateState: sets.length ? 'done' : 'idle',
        generateError: null,
      });
      return { success: true };
    } catch (err) {
      const msg = err.message || 'Failed to load saved practice questions';
      set({ generateError: msg });
      return { success: false, error: msg };
    }
  },

  loadPracticeGenerations: async (courseId, questionType = null) => {
    set({ generationsLoading: true });
    try {
      const params = new URLSearchParams();
      if (questionType) params.set('question_type', questionType);
      const suffix = params.toString() ? `?${params.toString()}` : '';
      const data = await apiClient.get(`/ai/practice-generations/${courseId}${suffix}`);
      const runsRaw = Array.isArray(data) ? data : [];
      const runs = runsRaw.filter((r) => (r?.saved_rows_count || 0) > 0);
      const preferredRunId =
        runs.find((r) => (r?.saved_rows_count || 0) > 0)?.id
        || runs[0]?.id
        || null;

      set((s) => ({
        generationRuns: runs,
        selectedGenerationId: s.selectedGenerationId || preferredRunId,
        generationsLoading: false,
      }));
      return { success: true, data: runs };
    } catch (err) {
      set({ generationRuns: [], generationsLoading: false });
      return { success: false, error: err.message || 'Failed to load generation history' };
    }
  },

  setSelectedGeneration: (generationId) => set({ selectedGenerationId: generationId || null }),

  renameGeneration: async (generationId, label) => {
    try {
      const payload = { generation_label: label };
      const data = await apiClient.post(`/ai/practice-generations/${generationId}/rename`, payload);
      set((s) => ({
        generationRuns: s.generationRuns.map((r) => (r.id === generationId ? { ...r, ...data } : r)),
      }));
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message || 'Failed to rename generation' };
    }
  },

  deleteGeneration: async (generationId) => {
    try {
      await apiClient.delete(`/ai/practice-generations/${generationId}`);
      set((s) => ({
        generationRuns: s.generationRuns.filter((r) => r.id !== generationId),
        // If the deleted run was active, reset questions display
        selectedGenerationId: s.selectedGenerationId === generationId ? null : s.selectedGenerationId,
        practiceQuestions: s.selectedGenerationId === generationId ? [] : s.practiceQuestions,
        savedCount: s.selectedGenerationId === generationId ? 0 : s.savedCount,
        generateState: s.selectedGenerationId === generationId ? 'idle' : s.generateState,
      }));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message || 'Failed to delete generation' };
    }
  },

  backfillLegacyGenerations: async (courseId, questionType = null) => {
    try {
      const payload = { question_type: questionType || null };
      const data = await apiClient.post(`/ai/practice-generations/${courseId}/backfill-legacy`, payload);
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message || 'Failed to backfill legacy generations' };
    }
  },

  deleteLegacyPractice: async (courseId, questionType = null) => {
    try {
      const suffix = questionType ? `?question_type=${encodeURIComponent(questionType)}` : '';
      const data = await apiClient.delete(`/ai/practice-questions/${courseId}/legacy${suffix}`);

      // Clear currently shown sets immediately; caller can reload runs/questions.
      set({ practiceQuestions: [], savedCount: 0, selectedGenerationId: null, generateState: 'idle' });
      return { success: true, deletedCount: data?.deleted_count || 0 };
    } catch (err) {
      return { success: false, error: err.message || 'Failed to delete legacy practice questions' };
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
    generationRuns: [],
    generationsLoading: false,
    selectedGenerationId: null,
    paperCount: 0,
  }),
}));

export default useQuestionLabStore;
