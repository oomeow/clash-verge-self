import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "../../locales/en.json";
import fa from "../../locales/fa.json";
import ru from "../../locales/ru.json";
import zh_CN from "../../locales/zh_CN.json";

const resources = {
  en: { translation: en },
  ru: { translation: ru },
  zh_CN: { translation: zh_CN },
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
