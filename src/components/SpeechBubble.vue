<script setup lang="ts">
withDefaults(
  defineProps<{
    text: string;
    visible?: boolean;
    interactive?: boolean;
  }>(),
  {
    visible: false,
    interactive: false,
  },
);
</script>

<template>
  <div class="speech-bubble-host" aria-live="polite" aria-atomic="true">
    <Transition name="speech-bubble">
      <div
        v-if="visible && text"
        :class="['speech-bubble', { 'speech-bubble--interactive': interactive }]"
        role="status"
      >
        <span>{{ text }}</span>
        <slot />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.speech-bubble-host {
  pointer-events: none;
}

.speech-bubble {
  position: relative;
  max-width: var(--speech-bubble-max-width, 176px);
  padding: var(--speech-bubble-padding, 7px 10px);
  color: var(--speech-bubble-color, #2f2938);
  font-family: var(
    --speech-bubble-font-family,
    system-ui,
    -apple-system,
    sans-serif
  );
  font-size: var(--speech-bubble-font-size, 12px);
  line-height: 1.35;
  text-align: center;
  overflow-wrap: anywhere;
  background: var(--speech-bubble-background, rgba(255, 255, 255, 0.94));
  border: var(--speech-bubble-border, 1px solid rgba(47, 41, 56, 0.18));
  border-radius: var(--speech-bubble-border-radius, 10px);
  box-shadow: var(--speech-bubble-shadow, 0 2px 8px rgba(24, 20, 30, 0.18));
}

.speech-bubble--interactive {
  pointer-events: auto;
}

.speech-bubble::after {
  position: absolute;
  bottom: -5px;
  left: 50%;
  width: 9px;
  height: 9px;
  content: "";
  background: var(--speech-bubble-background, rgba(255, 255, 255, 0.94));
  border-right: var(--speech-bubble-border, 1px solid rgba(47, 41, 56, 0.18));
  border-bottom: var(--speech-bubble-border, 1px solid rgba(47, 41, 56, 0.18));
  transform: translateX(-50%) rotate(45deg);
}

.speech-bubble-enter-active,
.speech-bubble-leave-active {
  transition:
    opacity 140ms ease,
    transform 140ms ease;
}

.speech-bubble-enter-from,
.speech-bubble-leave-to {
  opacity: 0;
  transform: translateY(3px) scale(0.96);
}
</style>
