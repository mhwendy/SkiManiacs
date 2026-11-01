import { create } from 'zustand';
import i18n from '@/i18n';
import { readJson, writeJson } from '@/storage/kv';
import type { Language } from '@/domain/types';

const LANGUAGE_KEY = 'language';

type LanguageState = {
  language: Language;
  setLanguage: (language: Language) => void;
  hydrate: () => Promise<void>;
};

function isLanguage(value: unknown): value is Language {
  return value === 'sr' || value === 'en';
}

export const useLanguageStore = create<LanguageState>((set) => ({
  language: 'sr',
  setLanguage: (language) => {
    set({ language });
    void i18n.changeLanguage(language);
    void writeJson(LANGUAGE_KEY, language);
  },
  hydrate: async () => {
    const stored = await readJson<unknown>(LANGUAGE_KEY);
    if (isLanguage(stored)) {
      set({ language: stored });
      await i18n.changeLanguage(stored);
    }
  },
}));
