import getSystem from "@/utils/get-system";

const OS = getSystem();
const DEFAULT_FONT_FAMILY = `-apple-system, BlinkMacSystemFont,"Microsoft YaHei UI", "Microsoft YaHei", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji"${
  OS === "windows" ? ", twemoji mozilla" : ""
}`;

// default theme setting — Cool Blue
export const defaultTheme: IVergeThemeSettings = {
  primary_color: "#1976D2",
  secondary_color: "#42A5F5",
  primary_text: "#1A1C1E",
  secondary_text: "#44474E",
  info_color: "#00ACC1",
  error_color: "#E53935",
  warning_color: "#FFA726",
  success_color: "#43A047",
  background_color: "#F4F8FF",
  paper_background_color: "#EAEEF8",
  font_family: DEFAULT_FONT_FAMILY,
};

// dark mode
export const defaultDarkTheme: IVergeThemeSettings = {
  primary_color: "#42A5F5",
  secondary_color: "#64B5F6",
  primary_text: "#E2E2E6",
  secondary_text: "#C4C6D0",
  info_color: "#4DD0E1",
  error_color: "#EF5350",
  warning_color: "#FFB74D",
  success_color: "#66BB6A",
  background_color: "#111520",
  paper_background_color: "#1A1F2C",
  font_family: DEFAULT_FONT_FAMILY,
};

export type ThemePreset = {
  name: string;
  light: IVergeThemeSettings;
  dark: IVergeThemeSettings;
};

export const THEME_PRESETS: ThemePreset[] = [
  {
    name: "default",
    light: defaultTheme,
    dark: defaultDarkTheme,
  },
  {
    name: "ocean",
    light: {
      primary_color: "#26A69A",
      secondary_color: "#4DD0E1",
      primary_text: "#1A1C1E",
      secondary_text: "#44474E",
      info_color: "#42A5F5",
      error_color: "#E53935",
      warning_color: "#FFA726",
      success_color: "#43A047",
      background_color: "#F0F8FA",
      paper_background_color: "#E6F0F4",
      font_family: DEFAULT_FONT_FAMILY,
    },
    dark: {
      primary_color: "#26A69A",
      secondary_color: "#80DEEA",
      primary_text: "#E2E2E6",
      secondary_text: "#C4C6D0",
      info_color: "#64B5F6",
      error_color: "#EF5350",
      warning_color: "#FFB74D",
      success_color: "#66BB6A",
      background_color: "#0E1718",
      paper_background_color: "#162224",
      font_family: DEFAULT_FONT_FAMILY,
    },
  },
  {
    name: "indigo",
    light: {
      primary_color: "#3949AB",
      secondary_color: "#5C6BC0",
      primary_text: "#1A1C1E",
      secondary_text: "#44474E",
      info_color: "#26C6DA",
      error_color: "#E53935",
      warning_color: "#FFA726",
      success_color: "#43A047",
      background_color: "#F4F5FD",
      paper_background_color: "#EAECF7",
      font_family: DEFAULT_FONT_FAMILY,
    },
    dark: {
      primary_color: "#5C6BC0",
      secondary_color: "#7986CB",
      primary_text: "#E2E2E6",
      secondary_text: "#C4C6D0",
      info_color: "#4DD0E1",
      error_color: "#EF5350",
      warning_color: "#FFB74D",
      success_color: "#66BB6A",
      background_color: "#131222",
      paper_background_color: "#1C1A2E",
      font_family: DEFAULT_FONT_FAMILY,
    },
  },
  {
    name: "sunset",
    light: {
      primary_color: "#D81B60",
      secondary_color: "#AB47BC",
      primary_text: "#1A1C1E",
      secondary_text: "#44474E",
      info_color: "#00ACC1",
      error_color: "#E53935",
      warning_color: "#FFA726",
      success_color: "#43A047",
      background_color: "#F5F8FC",
      paper_background_color: "#EAEEF4",
      font_family: DEFAULT_FONT_FAMILY,
    },
    dark: {
      primary_color: "#D81B60",
      secondary_color: "#CE93D8",
      primary_text: "#E2E2E6",
      secondary_text: "#C4C6D0",
      info_color: "#4DD0E1",
      error_color: "#EF5350",
      warning_color: "#FFB74D",
      success_color: "#66BB6A",
      background_color: "#1A1219",
      paper_background_color: "#261B24",
      font_family: DEFAULT_FONT_FAMILY,
    },
  },
  {
    name: "lavender",
    light: {
      primary_color: "#7E57C2",
      secondary_color: "#9575CD",
      primary_text: "#1A1C1E",
      secondary_text: "#44474E",
      info_color: "#42A5F5",
      error_color: "#E53935",
      warning_color: "#FFA726",
      success_color: "#43A047",
      background_color: "#F6F6FF",
      paper_background_color: "#EDEAF8",
      font_family: DEFAULT_FONT_FAMILY,
    },
    dark: {
      primary_color: "#7E57C2",
      secondary_color: "#B39DDB",
      primary_text: "#E2E2E6",
      secondary_text: "#C4C6D0",
      info_color: "#64B5F6",
      error_color: "#EF5350",
      warning_color: "#FFB74D",
      success_color: "#66BB6A",
      background_color: "#141222",
      paper_background_color: "#1D1A2E",
      font_family: DEFAULT_FONT_FAMILY,
    },
  },
  {
    name: "monochrome",
    light: {
      primary_color: "#607D8B",
      secondary_color: "#78909C",
      primary_text: "#1A1C1E",
      secondary_text: "#44474E",
      info_color: "#42A5F5",
      error_color: "#E53935",
      warning_color: "#FFA726",
      success_color: "#43A047",
      background_color: "#F4F5F8",
      paper_background_color: "#E8E9EE",
      font_family: DEFAULT_FONT_FAMILY,
    },
    dark: {
      primary_color: "#607D8B",
      secondary_color: "#90A4AE",
      primary_text: "#E2E2E6",
      secondary_text: "#C4C6D0",
      info_color: "#64B5F6",
      error_color: "#EF5350",
      warning_color: "#FFB74D",
      success_color: "#66BB6A",
      background_color: "#12151D",
      paper_background_color: "#1C1F28",
      font_family: DEFAULT_FONT_FAMILY,
    },
  },
];
