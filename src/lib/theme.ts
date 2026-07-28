import { createTheme } from "@mui/material/styles";

const errorPalette = {
  light: "#FF0000",
  main: "#C3110C",
  dark: "#9E2A3A",
};

const successPalette = {
  light: "#9BC09C",
  main: "#8BAE66",
  dark: "#628141",
};

const warningPalette = {
  light: "#F5C857",
  main: "#F5C857",
  dark: "#E2852E",
};

const infoPalette = {
  light: "#B4E1EB",
  main: "#95BDD7",
  dark: "#78A4CB",
};

export const theme = createTheme({
  cssVariables: {
    colorSchemeSelector: "class",
  },
  colorSchemes: {
    light: {
      palette: {
        background: {
          default: "#E8DFCA",
          paper: "#F5EFE6",
        },
        primary: {
          main: "#6D94C5",
        },
        secondary: {
          main: "#CBDCEB",
        },
        text: {
          primary: "#454040",
          secondary: "#605B51",
        },
        error: errorPalette,
        success: successPalette,
        warning: warningPalette,
        info: infoPalette,
      },
    },
    dark: {
      palette: {
        background: {
          default: "#1B3C53",
          paper: "#234C6A",
        },
        primary: {
          main: "#715A5A",
        },
        secondary: {
          main: "#D2C1B6",
        },
        text: {
          primary: "#FFE5BF",
          secondary: "#FFF2DB",
        },
        error: errorPalette,
        success: successPalette,
        warning: warningPalette,
        info: infoPalette,
      },
    },
  },
});
