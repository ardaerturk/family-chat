"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { translate, type Language } from "@/lib/translations";
const LanguageContext = createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}>({
  language: "en",
  setLanguage: () => {},
  t: (key: string, values?: Record<string, string | number>) =>
    translate("en", key, values),
});
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, updateLanguage] = useState<Language>("en");
  const setLanguage = useCallback((value: Language) => {
    updateLanguage(value);
    document.documentElement.lang = value;
    try {
      localStorage.setItem("chatgpt-language", value);
    } catch {}
  }, []);
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("chatgpt-language");
    } catch {}
    setLanguage(
      saved === "tr" || saved === "en"
        ? saved
        : navigator.language.startsWith("tr")
          ? "tr"
          : "en",
    );
  }, [setLanguage]);
  const t = useCallback(
    (key: string, values?: Record<string, string | number>) =>
      translate(language, key, values),
    [language],
  );
  const value = useMemo(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t],
  );
  return <LanguageContext value={value}>{children}</LanguageContext>;
}
export function useI18n() {
  return useContext(LanguageContext);
}
