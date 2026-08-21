import { readonly, ref } from "vue";
import type { PetState } from "./types";

const currentState = ref<PetState>("idle");
const readonlyCurrentState = readonly(currentState);

function setState(nextState: PetState): void {
  currentState.value = nextState;
}

export function usePetStore() {
  return {
    currentState: readonlyCurrentState,
    setState,
  };
}
