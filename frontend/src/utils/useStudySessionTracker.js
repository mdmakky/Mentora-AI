import { useEffect, useRef, useCallback } from 'react';
import useStudyStore from '../stores/studyStore';

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];

const useStudySessionTracker = ({
  enabled,
  courseId = null,
  documentId = null,
  sessionType = 'reading',
  idleMs = 10 * 60 * 1000,
}) => {
  const startSession = useStudyStore((s) => s.startSession);
  const endSession = useStudyStore((s) => s.endSession);

  const sessionIdRef = useRef(null);
  const startingRef = useRef(false);
  const endingRef = useRef(false);
  const lastActivityRef = useRef(Date.now());

  const endTrackedSession = useCallback(async () => {
    if (!sessionIdRef.current || endingRef.current) return;
    endingRef.current = true;
    const currentSessionId = sessionIdRef.current;
    sessionIdRef.current = null;
    try {
      await endSession(currentSessionId);
    } finally {
      endingRef.current = false;
    }
  }, [endSession]);

  const startTrackedSession = useCallback(async () => {
    if (!enabled || !courseId || sessionIdRef.current || startingRef.current || document.hidden) return;
    startingRef.current = true;
    try {
      const result = await startSession(courseId, documentId, sessionType);
      if (result?.success && result?.data?.id) {
        sessionIdRef.current = result.data.id;
      }
    } finally {
      startingRef.current = false;
    }
  }, [enabled, courseId, documentId, sessionType, startSession]);

  useEffect(() => {
    if (!enabled || !courseId) {
      void endTrackedSession();
      return;
    }
    lastActivityRef.current = Date.now();
    void startTrackedSession();
  }, [enabled, courseId, startTrackedSession, endTrackedSession]);

  useEffect(() => {
    const markActivity = () => {
      lastActivityRef.current = Date.now();
      if (enabled && courseId && !sessionIdRef.current) {
        void startTrackedSession();
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        void endTrackedSession();
      } else {
        lastActivityRef.current = Date.now();
        if (enabled && courseId) {
          void startTrackedSession();
        }
      }
    };

    const handleBeforeUnload = () => {
      const id = sessionIdRef.current;
      if (!id) return;
      sessionIdRef.current = null;
      const token = localStorage.getItem('token');
      const apiBase = import.meta.env.VITE_API_BASE || '/api/v1';
      if (!token) return;

      fetch(`${apiBase}/study/session/${id}/end`, {
        method: 'PUT',
        keepalive: true,
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }).catch(() => {});
    };

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, markActivity, { passive: true }));
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', handleBeforeUnload);

    const idleInterval = window.setInterval(() => {
      const idleFor = Date.now() - lastActivityRef.current;
      if (idleFor >= idleMs) {
        void endTrackedSession();
      }
    }, 30 * 1000);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, markActivity));
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.clearInterval(idleInterval);
      void endTrackedSession();
    };
  }, [enabled, courseId, idleMs, startTrackedSession, endTrackedSession]);
};

export default useStudySessionTracker;
