import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '../lib/apiClient';
import { getSmartStorage } from '../lib/customStorage';
import useAuthStore from './authStore';

const useDocumentStore = create(
  persist(
    (set, get) => ({
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
      // Fetch the document via standard API client using Authorization header, avoiding token in URL
      const token = localStorage.getItem('token');
      const base = import.meta.env.VITE_API_BASE || '/api/v1';
      
      const response = await fetch(`${base}/documents/${docId}/proxy`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) throw new Error('Failed to fetch document proxy');
      
      const blob = await response.blob();
      return URL.createObjectURL(blob);
    } catch {
      return null;
    }
  },

  // Fire-and-forget upload: adds a placeholder card instantly, closes modal immediately.
  // The actual HTTP upload runs in the background; on completion the placeholder is
  // replaced with the real document (triggering the existing polling flow).
  startUploadBackground: (file, courseId, folderId, docCategory = 'lecture') => {
    const tempId = `uploading-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    set((s) => ({
      documents: [{
        id: tempId,
        file_name: file.name,
        processing_status: 'uploading',
        course_id: courseId,
        folder_id: folderId || null,
        _isPlaceholder: true,
      }, ...s.documents],
    }));

    const formData = new FormData();
    formData.append('file', file);
    formData.append('course_id', courseId);
    if (folderId) formData.append('folder_id', folderId);
    formData.append('doc_category', docCategory);
    formData.append('declaration_accepted', 'true');

    apiClient.postForm('/documents/upload', formData)
      .then((data) => {
        set((s) => ({
          documents: s.documents.map((d) => d.id === tempId ? data : d),
        }));
      })
      .catch((err) => {
        if (err.message?.toLowerCase().includes('suspended')) {
          try { useAuthStore.getState().refreshUser?.(); } catch {}
        }
        set((s) => ({
          documents: s.documents.map((d) =>
            d.id === tempId
              ? { ...d, processing_status: 'upload_failed', _uploadError: err.message }
              : d
          ),
        }));
      });
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
    // Placeholder cards (fire-and-forget uploads) live only in memory — no API call needed
    if (docId.startsWith('uploading-')) {
      set((s) => ({ documents: s.documents.filter((d) => d.id !== docId) }));
      return { success: true };
    }
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

  rescanDocument: async (docId) => {
    try {
      const data = await apiClient.put(`/documents/${docId}/rescan`, {});
      set((s) => ({
        documents: s.documents.map((d) => (d.id === docId ? { ...d, ...data } : d)),
      }));
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message || 'Failed to rescan document' };
    }
  },

  requestDocumentReview: async (docId, note = '') => {
    try {
      const data = await apiClient.post(`/documents/${docId}/review-request`, { note });
      set((s) => ({
        documents: s.documents.map((d) => (d.id === docId ? { ...d, ...data } : d)),
      }));
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message || 'Failed to submit review request' };
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

  renameFolder: async (folderId, name) => {
    try {
      const data = await apiClient.put(`/folders/${folderId}`, { name });
      set((s) => ({
        folders: s.folders.map((f) => f.id === folderId ? { ...f, name } : f),
      }));
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  },

  // ─── Status Polling ────────────────────────────
  pollDocumentStatus: (docId) => {
    const interval = setInterval(async () => {
      try {
        const data = await apiClient.get(`/documents/${docId}/status`);
        if (data && (data.processing_status === 'ready' || data.processing_status === 'failed')) {
          clearInterval(interval);
          // Update the document in our list
          set((s) => ({
            documents: s.documents.map((d) =>
              d.id === docId
                ? { ...d, processing_status: data.processing_status, chunk_count: data.chunk_count }
                : d
            ),
          }));
        } else if (data) {
          set((s) => ({
            documents: s.documents.map((d) =>
              d.id === docId
                ? { ...d, processing_status: data.processing_status }
                : d
            ),
          }));
        }
      } catch (err) {
        console.error('Polling error:', err);
        clearInterval(interval);
      }
    }, 3000);
    return interval;
  },

  clearCurrentDoc: () => set({ currentDoc: null }),
}),
    {
      name: 'mentora-document-store',
      storage: getSmartStorage(),
      // Exclude in-flight placeholder docs from hitting localStorage
      partialize: (state) => ({
        ...state,
        documents: state.documents.filter((d) => !d._isPlaceholder),
      }),
    }
  )
);

export default useDocumentStore;
