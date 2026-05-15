import getSystem from "@/utils/get-system";
const OS = getSystem();

// default theme setting
export const defaultTheme: IVergeThemeSettings = {
  primary_color: "#2F82F7",
  secondary_color: "#00C2CC",
  primary_text: "#0D121B",
  secondary_text: "#383D47",
  info_color: "#038dcb",
  error_color: "#F8413D",
  warning_color: "#DE9A00",
  success_color: "#00A14D",
  background_color: "#E4F2FF",
  // paper_background_color: "#DDE8FD",
  font_family: `-apple-system, BlinkMacSystemFont,"Microsoft YaHei UI", "Microsoft YaHei", Roboto, "Helvetica Neue", Arial, sans-serif, "Apple Color Emoji"${
    OS === "windows" ? ", twemoji mozilla" : ""
  }`,
};

// dark mode
export const defaultDarkTheme: IVergeThemeSettings = {
  ...defaultTheme,
  primary_color: "#2F82F7",
  secondary_color: "#00C2CD",
  primary_text: "#DAE2EF",
  secondary_text: "#BEC4D0",
  info_color: "#008ECC",
  error_color: "#F9423D",
  warning_color: "#DE9A00",
  success_color: "#00A14C",
  background_color: "#050C1E",
  // paper_background_color: "#020511",
};

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
