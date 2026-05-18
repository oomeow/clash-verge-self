import getSystem from "@/utils/get-system";
const OS = getSystem();

// default theme setting — Material Blue
export const defaultTheme: IVergeThemeSettings = {
  primary_color: "#1565C0",
  secondary_color: "#42A5F5",
  primary_text: "#0B1A2E",
  secondary_text: "#3D5467",
  info_color: "#0288D1",
  error_color: "#D32F2F",
  warning_color: "#F9A825",
  success_color: "#388E3C",
  background_color: "#F5F8FF",
  paper_background_color: "#EBF2FC",
  font_family: `-apple-system, BlinkMacSystemFont,"Microsoft YaHei UI", "Microsoft YaHei", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji"${
    OS === "windows" ? ", twemoji mozilla" : ""
  }`,
};

// dark mode
export const defaultDarkTheme: IVergeThemeSettings = {
  ...defaultTheme,
  primary_color: "#64B5F6",
  secondary_color: "#90CAF9",
  primary_text: "#E3F0FF",
  secondary_text: "#A0B9D4",
  info_color: "#4FC3F7",
  error_color: "#EF5350",
  warning_color: "#FFD54F",
  success_color: "#66BB6A",
  background_color: "#0A1628",
  paper_background_color: "#0F1E33",
  font_family: "",
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
      primary_color: "#006B6B",
      secondary_color: "#4DB6AC",
      primary_text: "#0B1A1A",
      secondary_text: "#2D4A4A",
      info_color: "#0097A7",
      error_color: "#C62828",
      warning_color: "#F9A825",
      success_color: "#2E7D32",
      background_color: "#F0FAFA",
      paper_background_color: "#E0F2F2",
      font_family: "",
    },
    dark: {
      primary_color: "#4DB6AC",
      secondary_color: "#80CBC4",
      primary_text: "#E0F2F2",
      secondary_text: "#A0C4C4",
      info_color: "#4DD0E1",
      error_color: "#EF5350",
      warning_color: "#FFD54F",
      success_color: "#66BB6A",
      background_color: "#0F1A1A",
      paper_background_color: "#192929",
      font_family: "",
    },
  },
  {
    name: "forest",
    light: {
      primary_color: "#2E7D32",
      secondary_color: "#66BB6A",
      primary_text: "#0B1A0C",
      secondary_text: "#2D4A2E",
      info_color: "#00897B",
      error_color: "#C62828",
      warning_color: "#F9A825",
      success_color: "#2E7D32",
      background_color: "#F2FAF2",
      paper_background_color: "#E4F2E4",
      font_family: "",
    },
    dark: {
      primary_color: "#66BB6A",
      secondary_color: "#81C784",
      primary_text: "#E4F2E4",
      secondary_text: "#A0C4A0",
      info_color: "#4DB6AC",
      error_color: "#EF5350",
      warning_color: "#FFD54F",
      success_color: "#66BB6A",
      background_color: "#0F1A10",
      paper_background_color: "#192A1A",
      font_family: "",
    },
  },
  {
    name: "sunset",
    light: {
      primary_color: "#E65100",
      secondary_color: "#FF8A65",
      primary_text: "#1A0F0A",
      secondary_text: "#4A3020",
      info_color: "#BF6A30",
      error_color: "#C62828",
      warning_color: "#F9A825",
      success_color: "#5D8A3C",
      background_color: "#FFF8F5",
      paper_background_color: "#FFEDE0",
      font_family: "",
    },
    dark: {
      primary_color: "#FF8A65",
      secondary_color: "#FFAB91",
      primary_text: "#FFEDE0",
      secondary_text: "#CCB0A0",
      info_color: "#CC8A50",
      error_color: "#EF5350",
      warning_color: "#FFD54F",
      success_color: "#81C784",
      background_color: "#1A0F0A",
      paper_background_color: "#2A1910",
      font_family: "",
    },
  },
  {
    name: "lavender",
    light: {
      primary_color: "#6A1B9A",
      secondary_color: "#AB47BC",
      primary_text: "#1A0B2B",
      secondary_text: "#4A2D6E",
      info_color: "#7B1FA2",
      error_color: "#C62828",
      warning_color: "#F9A825",
      success_color: "#2E7D32",
      background_color: "#FAF5FC",
      paper_background_color: "#F3E5F7",
      font_family: "",
    },
    dark: {
      primary_color: "#CE93D8",
      secondary_color: "#AB47BC",
      primary_text: "#F3E5F7",
      secondary_text: "#C4A5D0",
      info_color: "#BA68C8",
      error_color: "#EF5350",
      warning_color: "#FFD54F",
      success_color: "#66BB6A",
      background_color: "#140A1A",
      paper_background_color: "#22142A",
      font_family: "",
    },
  },
  {
    name: "monochrome",
    light: {
      primary_color: "#545454",
      secondary_color: "#808080",
      primary_text: "#1A1A1A",
      secondary_text: "#4B4B4B",
      info_color: "#607D8B",
      error_color: "#B33A3A",
      warning_color: "#9A8C3A",
      success_color: "#4A7A5A",
      background_color: "#F7F7F7",
      paper_background_color: "#ECECEC",
      font_family: "",
    },
    dark: {
      primary_color: "#C0C0C0",
      secondary_color: "#909090",
      primary_text: "#E8E8E8",
      secondary_text: "#A0A0A0",
      info_color: "#78909C",
      error_color: "#CC5555",
      warning_color: "#BAAA55",
      success_color: "#6A9A7A",
      background_color: "#1A1A1A",
      paper_background_color: "#2D2D2D",
      font_family: "",
    },
  },
];

// import { ThemeOptions } from '@mui/material/styles';
// export const themeOptions: ThemeOptions = {
//   palette: {
//     mode: 'light',
//     primary: {
//       main: '#2F82F7',
//     },
//     secondary: {
//       main: '#00c2cd',
//     },
//     background: {
//       default: '#e4f2ff',
//       paper: '#DDE8FD',
//     },
//     text: {
//       primary: '#0D121B',
//       secondary: '#383D47',
//     },
//     error: {
//       main: '#f9423d',
//     },
//     warning: {
//       main: '#de9a00',
//     },
//     info: {
//       main: '#008ecc',
//     },
//     success: {
//       main: '#00a14c',
//     },
//     divider: '#D1D8E5',
//   },
// };
