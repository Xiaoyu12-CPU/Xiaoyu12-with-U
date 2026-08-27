import { invoke, isTauri } from "@tauri-apps/api/core";
import { readonly, ref } from "vue";
import {
  CONTROL_CENTER_BUILTIN_BACKGROUND_URL,
  isBuiltinControlCenterBackground,
  isManagedControlCenterBackground,
} from "./controlCenterBackgroundReference";

export const CONTROL_CENTER_BACKGROUND_MAX_BYTES = 20 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"]);

export interface UploadedControlCenterBackground {
  storedName: string;
  fileName: string;
  mimeType: string;
}

export interface ControlCenterBackgroundStorage {
  upload(file: File): Promise<UploadedControlCenterBackground>;
  load(storedName: string): Promise<Uint8Array>;
  remove(storedName: string): Promise<void>;
}

export interface BackgroundUrlFactory {
  create(bytes: Uint8Array, mimeType: string): string;
  revoke(url: string): void;
}

export function validateControlCenterBackgroundFile(file: File): void {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error("背景图片仅支持 PNG、JPG / JPEG 与 WebP。");
  }
  if (file.size > CONTROL_CENTER_BACKGROUND_MAX_BYTES) {
    throw new Error("背景图片不能超过 20 MB。");
  }
}

export function backgroundMimeType(storedName: string): string {
  const extension = storedName.split(".").pop()?.toLowerCase();
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  return "image/jpeg";
}

export const controlCenterBackgroundStorage: ControlCenterBackgroundStorage = {
  async upload(file) {
    validateControlCenterBackgroundFile(file);
    if (!isTauri()) {
      throw new Error("背景图片导入仅在 Tauri 桌面运行环境中可用。");
    }
    const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
    return invoke<UploadedControlCenterBackground>(
      "upload_control_center_background",
      { fileName: file.name, bytes },
    );
  },

  async load(storedName) {
    const bytes = await invoke<number[]>("load_control_center_background", {
      storedName,
    });
    return Uint8Array.from(bytes);
  },

  async remove(storedName) {
    if (!isTauri()) return;
    await invoke("delete_control_center_background", { storedName });
  },
};

const browserUrlFactory: BackgroundUrlFactory = {
  create(bytes, mimeType) {
    return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
  },
  revoke(url) {
    URL.revokeObjectURL(url);
  },
};

export function createControlCenterBackgroundManager(
  storage: ControlCenterBackgroundStorage = controlCenterBackgroundStorage,
  urlFactory: BackgroundUrlFactory = browserUrlFactory,
) {
  const imageUrl = ref<string>();
  const currentStoredName = ref<string>();
  const lastError = ref("");
  let currentUrlNeedsRevoke = false;

  function clearUrl(): void {
    if (imageUrl.value && currentUrlNeedsRevoke) {
      urlFactory.revoke(imageUrl.value);
    }
    imageUrl.value = undefined;
    currentStoredName.value = undefined;
    currentUrlNeedsRevoke = false;
  }

  async function sync(storedName: string | null): Promise<void> {
    if (!storedName) {
      clearUrl();
      lastError.value = "";
      return;
    }
    if (storedName === currentStoredName.value && imageUrl.value) return;

    if (isBuiltinControlCenterBackground(storedName)) {
      clearUrl();
      imageUrl.value = CONTROL_CENTER_BUILTIN_BACKGROUND_URL;
      currentStoredName.value = storedName;
      lastError.value = "";
      return;
    }

    try {
      const bytes = await storage.load(storedName);
      clearUrl();
      imageUrl.value = urlFactory.create(bytes, backgroundMimeType(storedName));
      currentStoredName.value = storedName;
      currentUrlNeedsRevoke = true;
      lastError.value = "";
    } catch (error) {
      clearUrl();
      lastError.value = `背景图片不可用，已回退到背景颜色：${toErrorMessage(error)}`;
    }
  }

  async function upload(file: File): Promise<UploadedControlCenterBackground> {
    validateControlCenterBackgroundFile(file);
    return storage.upload(file);
  }

  async function remove(storedName: string | null): Promise<void> {
    clearUrl();
    lastError.value = "";
    if (isManagedControlCenterBackground(storedName)) {
      await storage.remove(storedName);
    }
  }

  async function deleteManaged(storedName: string | null): Promise<void> {
    if (isManagedControlCenterBackground(storedName)) {
      await storage.remove(storedName);
    }
  }

  return {
    imageUrl: readonly(imageUrl),
    lastError: readonly(lastError),
    sync,
    upload,
    remove,
    deleteManaged,
  };
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const controlCenterBackgroundManager =
  createControlCenterBackgroundManager();
