const CHAT_PREFERENCES_KEY = 'mentora-chat-preferences';

const DEFAULT_PREFERENCES = {
  language: 'en',
  responseMode: 'learn',
  explanationLevel: 'balanced',
  retrievalScope: 'whole_document',
};

export const getDefaultChatPreferences = () => ({ ...DEFAULT_PREFERENCES });

export const readChatPreferences = (scope = 'assistant') => {
  try {
    const raw = localStorage.getItem(CHAT_PREFERENCES_KEY);
    if (!raw) return getDefaultChatPreferences();

    const parsed = JSON.parse(raw);
    const scoped = parsed?.[scope] || {};
    return {
      ...DEFAULT_PREFERENCES,
      ...scoped,
    };
  } catch {
    return getDefaultChatPreferences();
  }
};

export const writeChatPreferences = (scope = 'assistant', preferences = {}) => {
  try {
    const raw = localStorage.getItem(CHAT_PREFERENCES_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const next = {
      ...parsed,
      [scope]: {
        ...DEFAULT_PREFERENCES,
        ...preferences,
      },
    };
    localStorage.setItem(CHAT_PREFERENCES_KEY, JSON.stringify(next));
  } catch {
    // Ignore persistence failures and keep chat functional.
  }
};