import type { Draft, DraftStore } from './types';

const KEY = 'kmhelper.draft.v1';

/**
 * The draft in localStorage. Every access is guarded: storage throws in a private window and in
 * some embedded browsers, and losing a draft must never take the page down with it.
 */
export function createLocalDraftStore(): DraftStore {
  return {
    load: () => {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw === null) return null;
        return JSON.parse(raw) as Draft;
      } catch {
        return null;
      }
    },
    save: (draft) => {
      try {
        localStorage.setItem(KEY, JSON.stringify(draft));
      } catch {
        // A full or blocked store is not worth telling anyone about: nothing is lost but the draft.
      }
    },
    clear: () => {
      try {
        localStorage.removeItem(KEY);
      } catch {
        // As above.
      }
    },
  };
}
