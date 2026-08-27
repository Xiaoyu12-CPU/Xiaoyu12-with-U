import shippingBackgroundUrl from "../assets/control-center/default-background.jpg";

export const CONTROL_CENTER_BUILTIN_BACKGROUND_REFERENCE =
  "builtin:shipping-default";

export const CONTROL_CENTER_BUILTIN_BACKGROUND_URL = shippingBackgroundUrl;

export function isBuiltinControlCenterBackground(
  reference: string | null | undefined,
): boolean {
  return reference === CONTROL_CENTER_BUILTIN_BACKGROUND_REFERENCE;
}

export function isManagedControlCenterBackground(
  reference: string | null | undefined,
): reference is string {
  return typeof reference === "string"
    && /^[a-z0-9][a-z0-9._-]{0,179}\.(?:png|jpe?g|webp)$/i.test(reference);
}
