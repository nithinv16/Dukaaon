import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Language {
  code: string;
  name: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: 'en', name: 'English' },
  { code: 'ml', name: 'മലയാളം (Malayalam)' },
  { code: 'hi', name: 'हिंदी (Hindi)' },
  { code: 'ta', name: 'தமிழ் (Tamil)' },
  { code: 'te', name: 'తెలుగు (Telugu)' },
  { code: 'kn', name: 'ಕನ್ನಡ (Kannada)' },
  { code: 'mr', name: 'मराठी (Marathi)' },
  { code: 'bn', name: 'বাংলা (Bengali)' },
];

interface LanguageState {
  language: string;
  setLanguage: (lang: string) => Promise<void>;
  getLanguageName: (code: string) => string;
  getSupportedLanguages: () => Language[];
}

export const useLanguageStore = create<LanguageState>((set, get) => ({
  language: 'en',
  setLanguage: async (lang: string) => {
    await AsyncStorage.setItem('user-language', lang);
    set({ language: lang });
  },
  getLanguageName: (code: string) => {
    const language = SUPPORTED_LANGUAGES.find(lang => lang.code === code);
    return language ? language.name : 'English';
  },
  getSupportedLanguages: () => SUPPORTED_LANGUAGES,
}));