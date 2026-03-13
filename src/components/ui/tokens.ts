export const T = {
  bg:        "#07090f",
  surface:   "#0c1118",
  card:      "#101822",
  border:    "#192436",
  borderHi:  "#243450",

  cyan:      "#00d4f5",
  cyanDim:   "#007a8a",
  green:     "#00e5a0",
  greenDim:  "#008055",
  red:       "#ff3d5e",
  yellow:    "#ffb020",
  purple:    "#a78bfa",
  amber:     "#fb923c",

  text:      "#ddeeff",
  textMuted: "#6b859e",
  textDim:   "#2e4060",

  mono: "'JetBrains Mono','Courier New',monospace",
  sans: "'Outfit','Segoe UI',sans-serif",

  chart: [
    "#00d4f5", "#00e5a0", "#a78bfa", "#ffb020",
    "#ff3d5e", "#fb923c", "#06d6a0", "#e879f9",
  ],
} as const;

export type TokenColor = typeof T[keyof Pick<typeof T,
  "cyan"|"cyanDim"|"green"|"greenDim"|"red"|"yellow"|"purple"|"amber"|"text"|"textMuted"|"textDim"
>];
