import { create } from 'zustand';
import { apiClient } from '../lib/apiClient';

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
      return { success: false, error: err.message };
    }
  },

  // ─── Messages ────────────────────────────────
  sendMessage: async (content, documentIds = null) => {
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
      const payload = { content };
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
            ses.id === activeSessionId ? { ...ses, title } : ses
          ),
        }));
      }

      return { success: true, data: aiMsg };
    } catch (err) {
      set({ sending: false });
      return { success: false, error: err.message };
    }
  },

  clearMessages: () => set({ messages: [], activeSessionId: null }),
}));

export default useChatStore;
