<script setup lang="ts">
import { X } from "@lucide/vue";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
} from "reka-ui";

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    description?: string;
    ariaLabel?: string;
    closeLabel?: string;
    size?: "default" | "large" | "fullscreen";
    bodyVariant?: "default" | "grid" | "flush";
    stableHeight?: boolean;
  }>(),
  {
    description: "",
    ariaLabel: "",
    closeLabel: "关闭弹框",
    size: "default",
    bodyVariant: "default",
    stableHeight: false,
  },
);

const DIALOG_ANIMATION_MS = 240;
const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const isClosing = ref(false);
const dialogOpen = computed(() => props.open || isClosing.value);
let closeTimer: number | null = null;

function clearCloseTimer() {
  if (closeTimer === null) return;
  window.clearTimeout(closeTimer);
  closeTimer = null;
}

function beginClose(emitAfterAnimation: boolean) {
  if (isClosing.value) return;
  clearCloseTimer();
  isClosing.value = true;
  closeTimer = window.setTimeout(() => {
    closeTimer = null;
    isClosing.value = false;
    if (emitAfterAnimation) emit("update:open", false);
  }, DIALOG_ANIMATION_MS);
}

function updateOpen(value: boolean) {
  if (value) {
    clearCloseTimer();
    isClosing.value = false;
    emit("update:open", true);
    return;
  }
  beginClose(true);
}

watch(
  () => props.open,
  (open, previousOpen) => {
    if (open) {
      clearCloseTimer();
      isClosing.value = false;
      return;
    }
    if (previousOpen) beginClose(false);
  },
);

onBeforeUnmount(clearCloseTimer);
</script>

<template>
  <DialogRoot :open="dialogOpen" @update:open="updateOpen">
    <DialogPortal v-if="dialogOpen">
      <DialogOverlay class="base-dialog-overlay" :class="{ 'base-dialog-overlay--closing': isClosing }" />
      <DialogContent
        class="base-dialog-content"
        :class="[
          `base-dialog-content--${size}`,
          {
            'base-dialog-content--closing': isClosing,
            'base-dialog-content--stable-height': stableHeight,
          },
        ]"
        :aria-describedby="description ? undefined : undefined"
      >
        <header class="base-dialog-header">
          <div class="base-dialog-title-row">
            <slot name="icon" />
            <div class="base-dialog-title-copy">
              <DialogTitle v-if="ariaLabel" class="base-dialog-title--sr-only">{{ ariaLabel }}</DialogTitle>
              <DialogTitle v-else class="base-dialog-title">{{ title }}</DialogTitle>
              <h2 v-if="ariaLabel" class="base-dialog-title">{{ title }}</h2>
              <DialogDescription v-if="description" class="base-dialog-description">
                {{ description }}
              </DialogDescription>
            </div>
          </div>
          <DialogClose class="base-dialog-close" :aria-label="closeLabel">
            <X :size="17" :stroke-width="2.35" aria-hidden="true" />
          </DialogClose>
        </header>

        <div class="base-dialog-body" :class="[`base-dialog-body--${bodyVariant}`]">
          <slot />
        </div>

        <footer v-if="$slots.footer" class="base-dialog-footer">
          <slot name="footer" />
        </footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
.base-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgba(2, 6, 12, 0.72);
  backdrop-filter: blur(12px);
  animation: base-dialog-overlay-in 220ms ease both;
}

.base-dialog-overlay--closing {
  pointer-events: none;
  animation: base-dialog-overlay-out 200ms ease both;
}

.base-dialog-content {
  position: fixed;
  left: 50%;
  top: 50%;
  z-index: 81;
  display: grid;
  width: min(980px, calc(100vw - 36px));
  max-height: min(720px, calc(100dvh - 36px));
  transform: translate(-50%, -50%);
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 14px;
  overflow: hidden;
  border: 1px solid rgba(174, 184, 201, 0.24);
  border-radius: 8px;
  background: var(--panel);
  box-shadow: 0 26px 80px rgba(0, 0, 0, 0.46), var(--panel-shadow);
  padding: 18px;
  animation: base-dialog-content-in 240ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.base-dialog-content--closing {
  pointer-events: none;
  animation: base-dialog-content-out 200ms ease both;
}

.base-dialog-content--stable-height {
  height: min(720px, calc(100dvh - 36px));
}

.base-dialog-content--large {
  width: min(1180px, calc(100vw - 36px));
  max-height: min(820px, calc(100dvh - 36px));
}

.base-dialog-content--large.base-dialog-content--stable-height {
  height: min(820px, calc(100dvh - 36px));
}

.base-dialog-content--fullscreen {
  width: min(94vw, 1480px);
  height: min(86dvh, 980px);
  max-height: min(86dvh, 980px);
  padding: 0;
  background: #071016;
}

.base-dialog-content:focus {
  outline: 0;
}

.base-dialog-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  min-width: 0;
}

.base-dialog-content--fullscreen .base-dialog-header {
  padding: 14px 16px;
  border-bottom: 1px solid rgba(174, 184, 201, 0.18);
  background: rgba(15, 24, 33, 0.92);
}

.base-dialog-title-row {
  display: flex;
  min-width: 0;
  gap: 10px;
  align-items: flex-start;
}

.base-dialog-title-copy {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.base-dialog-title {
  margin: 0;
  color: var(--text);
  font-size: 18px;
  font-weight: 900;
  line-height: 1.15;
}

.base-dialog-title--sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

.base-dialog-description {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}

.base-dialog-close {
  display: grid;
  width: 34px;
  height: 34px;
  flex: 0 0 auto;
  place-items: center;
  border: 1px solid rgba(174, 184, 201, 0.22);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.045);
  color: var(--text);
}

.base-dialog-close:hover {
  border-color: var(--control-border-hover);
  background: rgba(255, 255, 255, 0.075);
}

.base-dialog-close:active {
  transform: translateY(1px);
}

.base-dialog-close:focus-visible {
  outline: 0;
  box-shadow: var(--focus-ring);
}

.base-dialog-body {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.base-dialog-body--default {
  display: grid;
  align-content: start;
  gap: 14px;
}

.base-dialog-body--grid {
  padding: 14px;
  background:
    linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px),
    rgba(3, 8, 14, 0.74);
  background-size: 32px 32px;
}

.base-dialog-body--flush {
  display: block;
}

.base-dialog-footer {
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

@keyframes base-dialog-overlay-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

@keyframes base-dialog-overlay-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

@keyframes base-dialog-content-in {
  from {
    opacity: 0;
    transform: translate(-50%, calc(-50% + 10px)) scale(0.972);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
}

@keyframes base-dialog-content-out {
  from {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
  }
  to {
    opacity: 0;
    transform: translate(-50%, calc(-50% + 8px)) scale(0.982);
  }
}
</style>
