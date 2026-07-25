import type { CSSProperties } from "react";

/** Fixed swatch palette for categories and tags — simple color picking, no color-picker dependency. */
export const SWATCHES = [
  "#6b7280", // gray
  "#ef4444", // red
  "#f97316", // orange
  "#f59e0b", // amber
  "#84cc16", // lime
  "#10b981", // emerald
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
];

export function colorStyle(hex: string) {
  return {
    backgroundColor: `${hex}1a`,
    color: hex,
    borderColor: `${hex}33`,
  } as React.CSSProperties;
}
