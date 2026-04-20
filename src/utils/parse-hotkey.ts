import getSystem from "./get-system";

const OS = getSystem();

const CODE_MAP: Record<string, string> = {
  BACKQUOTE: "`",
  BACKSLASH: "\\",
  BRACKETLEFT: "[",
  BRACKETRIGHT: "]",
  COMMA: ",",
  EQUAL: "=",
  MINUS: "-",
  PERIOD: ".",
  QUOTE: "'",
  SEMICOLON: ";",
  SLASH: "/",
};

export const parseHotkey = (keyCode: string) => {
  let key = keyCode.toUpperCase();

  if (key.startsWith("KEY")) {
    key = key.slice(3);
  } else if (key.startsWith("DIGIT")) {
    key = key.slice(5);
  } else if (key.startsWith("ARROW")) {
    key = key.slice(5);
  } else if (key.endsWith("LEFT")) {
    key = key.slice(0, -4);
  } else if (key.endsWith("RIGHT")) {
    key = key.slice(0, -5);
  }

  switch (key) {
    case "CONTROL":
      return "CTRL";
    case "ALT":
      if (OS === "macos") {
        return "OPTION";
      } else {
        return "ALT";
      }
    case "META":
      return "CMD";
    case "SPACE":
      return "SPACE";
    default:
      return CODE_MAP[key] || key;
  }
};
