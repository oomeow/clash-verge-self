import en from "@/locales/en.json";
import fa from "@/locales/fa.json";
import ru from "@/locales/ru.json";
import zh from "@/locales/zh.json";
import { localeKeyMap } from "@/services/i18n-keymap";
import i18n, { type TFunction } from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  en: { translation: en },
  ru: { translation: ru },
  zh: { translation: zh },
  fa: { translation: fa },
};

i18n.use(initReactI18next).init({
  resources,
  lng: "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export function resolveLocaleKey(key: string) {
  return localeKeyMap[key as keyof typeof localeKeyMap] ?? key;
}

export function translateDynamicKey(
  t: TFunction,
  key: string,
  options?: Record<string, unknown>,
) {
  return t(resolveLocaleKey(key), { defaultValue: key, ...options });
}
