import mikanPreviewUrl from "../assets/control-center/mikan-background-preview.jpg";
import type { TranslationKey } from "../i18n";
import { createDefaultControlCenterAppearance } from "./defaultSettings";
import {
  CONTROL_CENTER_BUILTIN_BACKGROUND_URL,
  CONTROL_CENTER_MIKAN_BACKGROUND_REFERENCE,
} from "./controlCenterBackgroundReference";
import type { DesktopPetSettings } from "./settingsTypes";

export type ControlCenterAppearance = DesktopPetSettings["controlCenter"];
export type ControlCenterAppearanceThemeId = "default" | "mikan" | "blank";

export interface ControlCenterAppearanceTheme {
  id: ControlCenterAppearanceThemeId;
  title: TranslationKey;
  subtitle: TranslationKey;
  previewUrl?: string;
  appearance: Readonly<ControlCenterAppearance>;
}

const defaultAppearance = createDefaultControlCenterAppearance();

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

export const BLANK_CONTROL_CENTER_APPEARANCE: Readonly<ControlCenterAppearance> = {
  ...defaultAppearance,
  backgroundColor: "#FFFFFF",
  backgroundOpacity: 1,
  backgroundImage: null,
  backgroundImageOpacity: 1,
  backgroundImageBlur: 0,
};

export const CONTROL_CENTER_APPEARANCE_THEMES: readonly ControlCenterAppearanceTheme[] = [
  {
    id: "default",
    title: "默认主题",
    subtitle: "外观主题 1",
    previewUrl: CONTROL_CENTER_BUILTIN_BACKGROUND_URL,
    appearance: defaultAppearance,
  },
  {
    id: "mikan",
    title: "蜜柑主题",
    subtitle: "外观主题 2",
    previewUrl: mikanPreviewUrl,
    appearance: MIKAN_CONTROL_CENTER_APPEARANCE,
  },
  {
    id: "blank",
    title: "新增主题",
    subtitle: "空白主题",
    appearance: BLANK_CONTROL_CENTER_APPEARANCE,
  },
];

export function createControlCenterAppearanceTheme(
  id: ControlCenterAppearanceThemeId,
): ControlCenterAppearance {
  const theme = CONTROL_CENTER_APPEARANCE_THEMES.find((candidate) => candidate.id === id);
  if (!theme) return structuredClone(defaultAppearance);
  return structuredClone(theme.appearance);
}

export function matchControlCenterAppearanceTheme(
  appearance: ControlCenterAppearance,
): ControlCenterAppearanceThemeId | undefined {
  return CONTROL_CENTER_APPEARANCE_THEMES.find(
    (theme) => appearancesEqual(appearance, theme.appearance),
  )?.id;
}

function appearancesEqual(
  left: ControlCenterAppearance,
  right: Readonly<ControlCenterAppearance>,
): boolean {
  return (Object.keys(right) as Array<keyof ControlCenterAppearance>)
    .every((key) => left[key] === right[key]);
}
