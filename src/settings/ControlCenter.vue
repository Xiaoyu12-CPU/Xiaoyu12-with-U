<script setup lang="ts">
import { ref } from "vue";
import type { PetControlAction } from "../pet/petControl";
import { useRemotePetRuntime } from "../pet/runtimeBridge";
import DialogueEditor from "./DialogueEditor.vue";
import StateAnimationEditor from "./StateAnimationEditor.vue";
import StatusPage from "./StatusPage.vue";
import SettingsPage from "./SettingsPage.vue";

type ControlCenterPage = "status" | "states" | "dialogue" | "settings";

const activePage = ref<ControlCenterPage>("status");
const { snapshot, isConnected, executeAction } = useRemotePetRuntime();

function handleAction(action: PetControlAction): void {
  executeAction(action);
}
</script>

<template>
  <main class="control-center">
    <aside>
      <div class="brand">
        <span class="brand__mark">DP</span>
        <div>
          <strong>DesktopPet</strong>
          <small>控制中心</small>
        </div>
      </div>

      <nav aria-label="控制中心页面">
        <button
          type="button"
          :class="{ active: activePage === 'status' }"
          @click="activePage = 'status'"
        >
          当前状态
        </button>
        <button
          type="button"
          :class="{ active: activePage === 'states' }"
          @click="activePage = 'states'"
        >
          状态与动画
        </button>
        <button
          type="button"
          :class="{ active: activePage === 'dialogue' }"
          @click="activePage = 'dialogue'"
        >
          Dialogue 编辑
        </button>
        <button
          type="button"
          :class="{ active: activePage === 'settings' }"
          @click="activePage = 'settings'"
        >
          设置
        </button>
      </nav>

      <p>Phase 3-C</p>
    </aside>

    <div class="control-center__content">
      <StatusPage
        v-if="activePage === 'status'"
        :snapshot="snapshot"
        :connected="isConnected"
        @action="handleAction"
      />
      <StateAnimationEditor
        v-else-if="activePage === 'states'"
        :runtime-state="snapshot?.state"
      />
      <DialogueEditor v-else-if="activePage === 'dialogue'" @action="handleAction" />
      <SettingsPage v-else />
    </div>
  </main>
</template>

<style scoped>
.control-center {
  display: grid;
  grid-template-columns: 190px minmax(0, 1fr);
  width: 100%;
  height: 100%;
  color: #30283d;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: #f3f0f7;
}

aside {
  display: flex;
  flex-direction: column;
  gap: 28px;
  padding: 26px 18px 18px;
  color: #f8f6ff;
  background: linear-gradient(180deg, #312941 0%, #221d2f 100%);
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand__mark {
  display: grid;
  width: 38px;
  height: 38px;
  font-size: 12px;
  font-weight: 800;
  background: #8069d7;
  border-radius: 11px;
  place-items: center;
}

.brand > div {
  display: grid;
  gap: 2px;
}

.brand strong {
  font-size: 14px;
}

.brand small {
  color: #aaa1b9;
  font-size: 11px;
}

nav {
  display: grid;
  gap: 6px;
}

nav button {
  padding: 10px 12px;
  color: #c8c1d4;
  font: inherit;
  font-size: 13px;
  text-align: left;
  background: transparent;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
}

nav button:hover,
nav button.active {
  color: #fff;
  background: rgba(139, 120, 255, 0.22);
}

aside > p {
  margin: auto 0 0;
  color: #82798f;
  font-size: 11px;
}

.control-center__content {
  min-width: 0;
  padding: 30px;
  overflow: auto;
  background: #fff;
}

@media (max-width: 620px) {
  .control-center {
    grid-template-columns: 1fr;
  }

  aside {
    gap: 16px;
    padding: 14px;
  }

  nav {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  aside > p {
    display: none;
  }

  .control-center__content {
    padding: 20px;
  }
}
</style>
