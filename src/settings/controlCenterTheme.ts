import type { DesktopPetSettings } from "./settingsTypes";

type ControlCenterTheme = DesktopPetSettings["controlCenter"];

export function createControlCenterThemeVariables(
  theme: ControlCenterTheme,
): Record<string, string> {
  return {
    "--cc-background": hexToRgba(theme.backgroundColor, theme.backgroundOpacity),
    "--cc-sidebar-background": hexToRgba(theme.sidebarBackgroundColor, theme.sidebarBackgroundOpacity),
    "--cc-sidebar-text": theme.sidebarTextColor,
    "--cc-sidebar-active-background": hexToRgba(theme.sidebarActiveBackgroundColor, theme.sidebarActiveBackgroundOpacity),
    "--cc-sidebar-active-text": theme.sidebarActiveTextColor,
    "--cc-text-primary": theme.primaryTextColor,
    "--cc-text-secondary": theme.secondaryTextColor,
    "--cc-card-bg": hexToRgba(theme.cardBackgroundColor, theme.cardBackgroundOpacity),
    "--cc-card-border": hexToRgba(theme.cardBorderColor, theme.cardBorderOpacity),
    "--cc-card-border-width": `${theme.cardBorderWidth}px`,
    "--cc-accent": theme.accentColor,
    "--cc-input-bg": hexToRgba(theme.cardBackgroundColor, Math.max(theme.cardBackgroundOpacity, 0.78)),
  };
}

export function createControlCenterBackgroundStyle(
  theme: ControlCenterTheme,
  imageUrl?: string,
): Record<string, string> {
  const fit = theme.backgroundImageFit;
  return {
    backgroundImage: imageUrl ? `url("${imageUrl}")` : "none",
    backgroundPosition: "center",
    backgroundRepeat: fit === "tile" ? "repeat" : "no-repeat",
    backgroundSize: fit === "stretch" ? "100% 100%" : fit === "center" || fit === "tile" ? "auto" : fit,
    opacity: String(theme.backgroundImageOpacity),
  };
}

export function hexToRgba(hex: string, opacity: number): string {
  const value = hex.slice(1);
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`;
}
