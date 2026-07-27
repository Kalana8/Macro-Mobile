// Design tokens extracted from Macro App.dc.html / Macro Admin Dashboard.dc.html.
// Both prototypes define an identical `colors` object — this is the single
// source of truth for the real Tailwind theme in both apps.

export const colors = {
  primary: "#0E62D1",
  primaryDark: "#034581",
  orange: "#FF7A1A",
  olive: "#B7D400",
  oliveText: "#5C6900",
  pageBg: "#EEF1F6", // outer page/body background
  bg: "#F5F7FA", // card / section / input subtle fill
  border: "#E4E8EF",
  textDark: "#16202E",
  textMuted: "#6E7887",
  placeholder: "#9AA4B2",
  error: "#C0392B",
  errorText: "#B3261E",
  white: "#FFFFFF",
  // status badges (normalized — the prototypes used two slightly different
  // ambers/reds for the same meaning; we standardize on one each)
  successBg: "rgba(183,212,0,0.18)",
  successText: "#5C6900",
  warningBg: "rgba(255,122,26,0.15)",
  warningText: "#B35A10",
  neutralBg: "#EEF0F3",
  neutralText: "#6E7887",
  infoBg: "rgba(14,98,209,0.12)",
  infoText: "#0E62D1",
  modalBackdrop: "rgba(22,32,46,0.45)",
} as const;

export const radii = {
  xs: "4px",
  sm: "7px",
  md: "10px",
  lg: "14px",
  xl: "18px",
  "2xl": "20px",
  full: "9999px",
} as const;

export const fontFamily = {
  sans: ["Inter", "system-ui", "sans-serif"],
} as const;

// NOTE: Tailwind v4 reads its theme from a static `@theme` block in each
// app's app/globals.css (Tailwind can't consume JS at build time) — the
// values there are kept in sync with `colors`/`radii` above by hand. This
// module is the source of truth for anything referenced from TSX/JS
// (inline styles, chart colors, dynamic badge styling).
