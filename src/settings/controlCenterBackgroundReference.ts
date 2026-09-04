import shippingBackgroundUrl from "../assets/control-center/default-background.jpg";
import mikanBackgroundUrl from "../assets/control-center/mikan-background.png";

export const CONTROL_CENTER_BUILTIN_BACKGROUND_REFERENCE =
  "builtin:shipping-default";
export const CONTROL_CENTER_MIKAN_BACKGROUND_REFERENCE = "builtin:mikan";

export const CONTROL_CENTER_BUILTIN_BACKGROUND_URL = shippingBackgroundUrl;
export const CONTROL_CENTER_MIKAN_BACKGROUND_URL = mikanBackgroundUrl;

const BUILTIN_BACKGROUND_URLS = new Map<string, string>([
  [CONTROL_CENTER_BUILTIN_BACKGROUND_REFERENCE, CONTROL_CENTER_BUILTIN_BACKGROUND_URL],
  [CONTROL_CENTER_MIKAN_BACKGROUND_REFERENCE, CONTROL_CENTER_MIKAN_BACKGROUND_URL],
]);

export function isBuiltinControlCenterBackground(
  reference: string | null | undefined,
): boolean {
  return typeof reference === "string" && BUILTIN_BACKGROUND_URLS.has(reference);
}

export function resolveBuiltinControlCenterBackground(
  reference: string | null | undefined,
): string | undefined {
  return typeof reference === "string" ? BUILTIN_BACKGROUND_URLS.get(reference) : undefined;
}

export function isManagedControlCenterBackground(
  reference: string | null | undefined,
): reference is string {
  return typeof reference === "string"
    && /^[a-z0-9][a-z0-9._-]{0,179}\.(?:png|jpe?g|webp)$/i.test(reference);
}
