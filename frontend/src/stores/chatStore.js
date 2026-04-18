import { create } from 'zustand';
import toast from 'react-hot-toast';
import { apiClient } from '../lib/apiClient';

const preserveDocumentPrefix = (existingTitle, nextTitle) => {
  if (typeof existingTitle !== 'string' || !existingTitle.startsWith('DOC::')) {
    return nextTitle;
  }

  const parts = existingTitle.split('::', 3);
  if (parts.length < 3) return nextTitle;
  return `DOC::${parts[1]}::${nextTitle}`;
};

const useChatStore = create((set, get) => ({
  sessions: [],
  activeSessionId: null,
  messages: [],
  sending: false,
  loadingSessions: false,
  loadingMessages: false,

  // ─── Sessions ────────────────────────────────
  fetchSessions: async (courseId = null) => {
    set({ loadingSessions: true });
    try {
      let url = '/chat/sessions';
      if (courseId) url += `?course_id=${courseId}`;
      const data = await apiClient.get(url);
      set({ sessions: data || [], loadingSessions: false });
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
      set({ loadingSessions: false });
    }
  },

  createSession: async (courseId, title = 'New Chat') => {
    try {
      const data = await apiClient.post('/chat/sessions', {
        course_id: courseId,
        title,
      });
      set((s) => ({
        sessions: [data, ...s.sessions],
        activeSessionId: data.id,
        messages: [],
      }));
      return { success: true, data };
    } catch (err) {
      toast.error(err.message || 'Failed to create chat session');
      return { success: false, error: err.message };
    }
  },

  selectSession: async (sessionId) => {
    set({ activeSessionId: sessionId, loadingMessages: true });
    try {
      const data = await apiClient.get(`/chat/sessions/${sessionId}`);
      set({
        messages: data?.messages || [],
        loadingMessages: false,
      });
    } catch (err) {
      console.error('Failed to load session:', err);
      toast.error(err.message || 'Failed to load chat session');
      set({ loadingMessages: false });
    }
  },

  deleteSession: async (sessionId) => {
    try {
      await apiClient.delete(`/chat/sessions/${sessionId}`);
      const state = get();
      const newSessions = state.sessions.filter((s) => s.id !== sessionId);
      set({
        sessions: newSessions,
        activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId,
        messages: state.activeSessionId === sessionId ? [] : state.messages,
      });
      return { success: true };
    } catch (err) {
      toast.error(err.message || 'Failed to delete chat session');
      return { success: false, error: err.message };
    }
  },

  // ─── Messages ────────────────────────────────
  sendMessage: async (content, documentIds = null, options = {}) => {
    const { activeSessionId } = get();
    if (!activeSessionId) return { success: false, error: 'No active session' };

    // Optimistically add user message
    const userMsg = {
      id: `temp-${Date.now()}`,
      session_id: activeSessionId,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };

    set((s) => ({
      messages: [...s.messages, userMsg],
      sending: true,
    }));

    try {
      const payload = {
        content,
        language: options.language || 'en',
        response_mode: options.responseMode || 'learn',
        explanation_level: options.explanationLevel || 'balanced',
        retrieval_scope: options.retrievalScope || 'whole_document',
        current_page: options.currentPage || null,
        selected_pages: options.selectedPages || null,
        section_anchor_page: options.sectionAnchorPage || null,
      };
      if (documentIds) payload.document_ids = documentIds;

      const aiMsg = await apiClient.post(
        `/chat/${activeSessionId}/message`,
        payload
      );

      set((s) => ({
        messages: [...s.messages, aiMsg],
        sending: false,
      }));

      // Update session title if first message
      if (get().messages.length <= 2) {
        const title = content.length > 50 ? content.slice(0, 50) + '...' : content;
        set((s) => ({
          sessions: s.sessions.map((ses) =>
            ses.id === activeSessionId
              ? { ...ses, title: preserveDocumentPrefix(ses.title, title) }
              : ses
          ),
        }));
      }

      return { success: true, data: aiMsg };
    } catch (err) {
      const errorMessage = err.message || 'Failed to get AI response';
      set((s) => ({
        messages: [
          ...s.messages,
          {
            id: `local-error-${Date.now()}`,
            session_id: activeSessionId,
            role: 'assistant',
            content: documentIds
              ? "I couldn't answer from this document right now. Try a narrower question, switch to Summary mode, or retry in a moment."
              : "I couldn't generate a useful answer right now. Try again, simplify the prompt, or switch to Summary mode.",
            response_meta: {
              no_evidence: Boolean(documentIds),
              follow_up_questions: [
                'Search across whole course',
                'Answer from general knowledge',
                'Ask a narrower question',
              ],
              suggested_actions: [
                'Search across whole course',
                'Answer from general knowledge',
                'Ask a narrower question',
              ],
            },
            created_at: new Date().toISOString(),
          },
        ],
        sending: false,
      }));
      toast.error(errorMessage);
      return { success: false, error: err.message };
    }
  },

  renameSession: async (sessionId, newTitle) => {
    const coachTitle = typeof newTitle === 'string' && !newTitle.startsWith('COACH::')
      ? `COACH::${newTitle.trim()}`
      : newTitle.trim();
    try {
      await apiClient.put(`/chat/sessions/${sessionId}`, { title: coachTitle });
      set((s) => ({
        sessions: s.sessions.map((sess) =>
          sess.id === sessionId ? { ...sess, title: coachTitle } : sess
        ),
      }));
      return { success: true };
    } catch (err) {
      toast.error(err.message || 'Failed to rename session');
      return { success: false, error: err.message };
    }
  },

  exportSession: async (sessionId) => {
    try {
      const data = await apiClient.get(`/chat/${sessionId}/export`);
      return { success: true, data };
    } catch (err) {
      toast.error(err.message || 'Failed to export session');
      return { success: false, error: err.message };
    }
  },

  clearMessages: () => set({ messages: [], activeSessionId: null }),
}));

export default useChatStore;
