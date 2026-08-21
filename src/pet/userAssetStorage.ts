import { invoke, isTauri } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import type { UnlistenFn } from "@tauri-apps/api/event";
import type { PetState } from "./types";
import type {
  UploadedUserAsset,
  UserPetManifest,
} from "./userAssetTypes";

const USER_MANIFEST_UPDATED_EVENT = "desktop-pet://user-assets-updated";
const BROWSER_MANIFEST_KEY = "desktop-pet.user-assets.v1";

export const userAssetStorage = {
  async loadManifest(petId: string): Promise<unknown | undefined> {
    const serialized = isTauri()
      ? await invoke<string | null>("load_user_pet_manifest", { petId })
      : localStorage.getItem(`${BROWSER_MANIFEST_KEY}.${petId}`);

    return serialized ? (JSON.parse(serialized) as unknown) : undefined;
  },

  async saveManifest(manifest: UserPetManifest): Promise<void> {
    const contents = JSON.stringify(manifest, null, 2);

    if (isTauri()) {
      await invoke("save_user_pet_manifest", {
        petId: manifest.petId,
        contents,
      });
      return;
    }

    localStorage.setItem(`${BROWSER_MANIFEST_KEY}.${manifest.petId}`, contents);
  },

  async uploadPng(
    petId: string,
    state: PetState,
    file: File,
  ): Promise<UploadedUserAsset> {
    if (!isTauri()) {
      throw new Error("PNG 上传仅在 Tauri 桌面运行环境中可用。");
    }

    const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
    return invoke<UploadedUserAsset>("upload_user_pet_png", {
      petId,
      state,
      fileName: file.name,
      bytes,
    });
  },

  async loadPng(
    petId: string,
    state: PetState,
    storedName: string,
  ): Promise<Uint8Array> {
    const bytes = await invoke<number[]>("load_user_pet_png", {
      petId,
      state,
      storedName,
    });
    return Uint8Array.from(bytes);
  },

  async deletePng(
    petId: string,
    state: PetState,
    storedName: string,
  ): Promise<void> {
    if (!isTauri()) {
      throw new Error("PNG 删除仅在 Tauri 桌面运行环境中可用。");
    }

    await invoke("delete_user_pet_png", { petId, state, storedName });
  },

  async broadcast(manifest: UserPetManifest): Promise<void> {
    if (isTauri()) {
      await emit(USER_MANIFEST_UPDATED_EVENT, manifest);
      return;
    }

    window.dispatchEvent(
      new CustomEvent<UserPetManifest>(USER_MANIFEST_UPDATED_EVENT, {
        detail: manifest,
      }),
    );
  },

  async subscribe(listener: (manifest: unknown) => void): Promise<UnlistenFn> {
    if (isTauri()) {
      return listen<unknown>(USER_MANIFEST_UPDATED_EVENT, ({ payload }) => {
        listener(payload);
      });
    }

    const handler = (event: Event): void => {
      listener((event as CustomEvent<unknown>).detail);
    };
    window.addEventListener(USER_MANIFEST_UPDATED_EVENT, handler);
    return () => window.removeEventListener(USER_MANIFEST_UPDATED_EVENT, handler);
  },
};
