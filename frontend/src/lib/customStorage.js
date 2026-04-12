import { createJSONStorage } from 'zustand/middleware';

const smartStorage = {
  getItem: (name) => {
    return localStorage.getItem(name) || sessionStorage.getItem(name) || null;
  },
  setItem: (name, value) => {
    // Check size of the stringified value
    const sizeInBytes = new Blob([value]).size;
    const sizeInMB = sizeInBytes / (1024 * 1024);

    if (sizeInMB < 2) {
      localStorage.setItem(name, value);
      sessionStorage.removeItem(name); // Clean up if it was previously in session
    } else {
      sessionStorage.setItem(name, value);
      localStorage.removeItem(name); // Clean up if it was previously in local
    }
  },
  removeItem: (name) => {
    localStorage.removeItem(name);
    sessionStorage.removeItem(name);
  },
};

export const getSmartStorage = () => createJSONStorage(() => smartStorage);
