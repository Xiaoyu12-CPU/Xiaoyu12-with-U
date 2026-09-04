import mikanPreviewUrl from "../assets/control-center/mikan-background-preview.jpg";
import {
  CONTROL_CENTER_BUILTIN_BACKGROUND_URL,
  CONTROL_CENTER_MIKAN_BACKGROUND_REFERENCE,
} from "./controlCenterBackgroundReference";
import type {
  ControlCenterAppearance,
  ControlCenterAppearanceTheme,
  ControlCenterThemeState,
} from "./settingsTypes";

export const DEFAULT_CONTROL_CENTER_THEME_ID = "default";
export const MIKAN_CONTROL_CENTER_THEME_ID = "mikan";
export const DEFAULT_CONTROL_CENTER_THEME_NAME = "默认主题";
export const MIKAN_CONTROL_CENTER_THEME_NAME = "蜜柑主题";

export const MIKAN_CONTROL_CENTER_APPEARANCE: Readonly<ControlCenterAppearance> = {
  backgroundColor: "#FFFFFF",
  backgroundOpacity: 0,
  backgroundImage: CONTROL_CENTER_MIKAN_BACKGROUND_REFERENCE,
  backgroundImageFit: "cover",
  backgroundImageOpacity: 1,
  backgroundImageBlur: 0,
  sidebarBackgroundColor: "#2E073E",
  sidebarBackgroundOpacity: 0.4,
  sidebarTextColor: "#EBEBEB",
  sidebarActiveBackgroundColor: "#8B78FF",
  sidebarActiveBackgroundOpacity: 0.55,
  sidebarActiveTextColor: "#FFFFFF",
  primaryTextColor: "#30283D",
  secondaryTextColor: "#919191",
  contentTextShadowColor: "#FFFFFF",
  contentTextShadowOpacity: 0.1,
  contentTextShadowSize: 2,
  contentTextShadowBlur: 3,
  cardBackgroundColor: "#FFFFFF",
  cardBackgroundOpacity: 0.2,
  cardBorderColor: "#FEC700",
  cardBorderOpacity: 0.2,
  cardBorderWidth: 1,
  accentColor: "#745BC9",
};

export function createBlankControlCenterAppearance(
  defaultAppearance: ControlCenterAppearance,
): ControlCenterAppearance {
  return {
    ...structuredClone(defaultAppearance),
    backgroundColor: "#FFFFFF",
    backgroundOpacity: 1,
    backgroundImage: null,
    backgroundImageOpacity: 1,
    backgroundImageBlur: 0,
  };
}

export function createDefaultControlCenterThemeState(
  defaultAppearance: ControlCenterAppearance,
): ControlCenterThemeState {
  return {
    activeThemeId: DEFAULT_CONTROL_CENTER_THEME_ID,
    nextCustomThemeNumber: 1,
    themes: [
      {
        id: DEFAULT_CONTROL_CENTER_THEME_ID,
        name: DEFAULT_CONTROL_CENTER_THEME_NAME,
        builtin: true,
        appearance: structuredClone(defaultAppearance),
      },
      {
        id: MIKAN_CONTROL_CENTER_THEME_ID,
        name: MIKAN_CONTROL_CENTER_THEME_NAME,
        builtin: true,
        appearance: structuredClone(MIKAN_CONTROL_CENTER_APPEARANCE),
      },
    ],
  };
}

export function findControlCenterTheme(
  state: ControlCenterThemeState,
  id: string,
): ControlCenterAppearanceTheme | undefined {
  return state.themes.find((theme) => theme.id === id);
}

export function controlCenterThemePreviewUrl(themeId: string): string | undefined {
  if (themeId === DEFAULT_CONTROL_CENTER_THEME_ID) {
    return CONTROL_CENTER_BUILTIN_BACKGROUND_URL;
  }
  if (themeId === MIKAN_CONTROL_CENTER_THEME_ID) {
    return mikanPreviewUrl;
  }
  return undefined;
}
