import type { DesktopPetSettings } from "./settingsTypes";

type ControlCenterTheme = DesktopPetSettings["controlCenter"];

export function createControlCenterThemeVariables(
  theme: ControlCenterTheme,
): Record<string, string> {
  const cardBackground = hexToRgba(theme.cardBackgroundColor, theme.cardBackgroundOpacity);
  return {
    "--cc-background": hexToRgba(theme.backgroundColor, theme.backgroundOpacity),
    "--cc-sidebar-background": hexToRgba(theme.sidebarBackgroundColor, theme.sidebarBackgroundOpacity),
    "--cc-sidebar-text": theme.sidebarTextColor,
    "--cc-sidebar-active-background": hexToRgba(theme.sidebarActiveBackgroundColor, theme.sidebarActiveBackgroundOpacity),
    "--cc-sidebar-active-text": theme.sidebarActiveTextColor,
    "--cc-text-primary": theme.primaryTextColor,
    "--cc-text-secondary": theme.secondaryTextColor,
    "--cc-card-bg": cardBackground,
    "--cc-card-border": hexToRgba(theme.cardBorderColor, theme.cardBorderOpacity),
    "--cc-card-border-width": `${theme.cardBorderWidth}px`,
    "--cc-accent": theme.accentColor,
    "--cc-on-accent": theme.sidebarActiveTextColor,
    "--cc-accent-hover": `color-mix(in srgb, ${theme.accentColor} 84%, #000000)`,
    "--cc-muted-surface": `color-mix(in srgb, ${theme.accentColor} 8%, ${cardBackground})`,
    "--cc-danger": `color-mix(in srgb, #C94F64 72%, ${theme.primaryTextColor})`,
    "--cc-danger-bg": `color-mix(in srgb, #C94F64 13%, ${cardBackground})`,
    "--cc-success": `color-mix(in srgb, #3C946B 72%, ${theme.primaryTextColor})`,
    "--cc-success-bg": `color-mix(in srgb, #3C946B 13%, ${cardBackground})`,
    "--cc-warning": `color-mix(in srgb, #B07828 72%, ${theme.primaryTextColor})`,
    "--cc-warning-bg": `color-mix(in srgb, #D99A37 14%, ${cardBackground})`,
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
