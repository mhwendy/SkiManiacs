import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import sr from './sr.json';

const i18n = createInstance();

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    sr: { translation: sr },
  },
  lng: 'sr',
  fallbackLng: 'sr',
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

export default i18n;
