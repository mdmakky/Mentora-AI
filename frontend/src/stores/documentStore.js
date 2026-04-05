import { create } from 'zustand';
import { apiClient } from '../lib/apiClient';

const useDocumentStore = create((set, get) => ({
  documents: [],
  folders: [],
  currentDoc: null,
  uploading: false,
  uploadProgress: 0,
  loading: false,

  // ─── Documents ────────────────────────────────
  fetchDocuments: async (courseId, folderId = null) => {
    set({ loading: true });
    try {
      let url = `/documents/${courseId}`;
      if (folderId) url += `?folder_id=${folderId}`;
      const data = await apiClient.get(url);
      set({ documents: data || [], loading: false });
    } catch (err) {
      console.error('Failed to fetch documents:', err);
      set({ loading: false });
    }
  },

  getDocument: async (docId) => {
    try {
      const data = await apiClient.get(`/documents/${docId}/detail`);
      set({ currentDoc: data });
      return data;
    } catch (err) {
      console.error('Failed to get document:', err);
      return null;
    }
  },

  getDocumentUrl: async (docId) => {
    try {
      const data = await apiClient.get(`/documents/${docId}/url`);
      return data?.url || null;
    } catch {
      return null;
    }
  },

  uploadDocument: async (file, courseId, folderId, docCategory = 'lecture') => {
    set({ uploading: true, uploadProgress: 0 });
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('course_id', courseId);
      if (folderId) formData.append('folder_id', folderId);
      formData.append('doc_category', docCategory);
      formData.append('declaration_accepted', 'true');

      const data = await apiClient.postForm('/documents/upload', formData);

      set((s) => ({
        documents: [data, ...s.documents],
        uploading: false,
        uploadProgress: 100,
      }));
      return { success: true, data };
    } catch (err) {
      set({ uploading: false, uploadProgress: 0 });
      return { success: false, error: err.message };
    }
  },

  deleteDocument: async (docId) => {
    try {
      await apiClient.delete(`/documents/${docId}`);
      set((s) => ({
        documents: s.documents.filter((d) => d.id !== docId),
      }));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // ─── Folders ────────────────────────────────
  fetchFolders: async (courseId) => {
    try {
      const data = await apiClient.get(`/folders/course/${courseId}`);
      set({ folders: data || [] });
    } catch (err) {
      console.error('Failed to fetch folders:', err);
    }
  },

  createFolder: async (payload) => {
    try {
      const data = await apiClient.post('/folders', payload);
      set((s) => ({ folders: [...s.folders, data] }));
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  deleteFolder: async (folderId) => {
    try {
      await apiClient.delete(`/folders/${folderId}`);
      set((s) => ({
        folders: s.folders.filter((f) => f.id !== folderId),
      }));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  clearCurrentDoc: () => set({ currentDoc: null }),
}));

export default useDocumentStore;
