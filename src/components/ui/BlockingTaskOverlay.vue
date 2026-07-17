<script setup lang="ts">
import { LoaderCircle, X } from "@lucide/vue";
import { DialogContent, DialogDescription, DialogOverlay, DialogPortal, DialogRoot, DialogTitle } from "reka-ui";

withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    description: string;
    statusLabel?: string;
    statusDetail?: string;
    cancelLabel?: string;
  }>(),
  {
    statusLabel: "正在处理",
    statusDetail: "请稍候，不要关闭当前页面。",
    cancelLabel: "取消",
  },
);

const emit = defineEmits<{
  cancel: [];
}>();

function handleOpenChange(open: boolean) {
  if (!open) emit("cancel");
}
</script>

<template>
  <DialogRoot :open="open" @update:open="handleOpenChange">
    <DialogPortal v-if="open">
      <DialogOverlay class="blocking-task-overlay" />
      <DialogContent class="blocking-task-content" aria-modal="true" @pointer-down-outside.prevent>
        <header class="blocking-task-header">
          <DialogTitle class="blocking-task-title">{{ title }}</DialogTitle>
          <DialogDescription class="blocking-task-description">{{ description }}</DialogDescription>
        </header>

        <div class="blocking-task-body">
          <span class="blocking-task-spinner" aria-hidden="true">
            <LoaderCircle :size="38" :stroke-width="2.2" />
          </span>
          <div class="blocking-task-status" role="status" aria-live="polite" aria-atomic="true">
            <strong>{{ statusLabel }}</strong>
            <span>{{ statusDetail }}</span>
          </div>
        </div>

        <footer class="blocking-task-footer">
          <button class="blocking-task-cancel" type="button" @click="emit('cancel')">
            <X :size="16" :stroke-width="2.4" aria-hidden="true" />
            {{ cancelLabel }}
          </button>
        </footer>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style scoped>
.blocking-task-overlay {
  position: fixed;
  inset: 0;
  z-index: 140;
  background: rgba(2, 6, 12, 0.78);
  backdrop-filter: blur(14px);
  animation: blocking-task-overlay-in 180ms ease both;
}

.blocking-task-content {
  position: fixed;
  left: 50%;
  top: 50%;
  z-index: 141;
  display: grid;
  width: min(460px, calc(100vw - 32px));
  max-height: calc(100dvh - 32px);
  transform: translate(-50%, -50%);
  gap: 18px;
  overflow: auto;
  padding: 20px;
  border: 1px solid rgba(174, 184, 201, 0.26);
  border-radius: 9px;
  outline: none;
  background: var(--panel);
  box-shadow:
    0 28px 90px rgba(0, 0, 0, 0.56),
    var(--panel-shadow);
  animation: blocking-task-content-in 220ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.blocking-task-header {
  display: grid;
  min-width: 0;
  gap: 5px;
}

.blocking-task-title {
  margin: 0;
  color: var(--text);
  font-size: 18px;
  font-weight: 900;
  line-height: 1.2;
}

.blocking-task-description {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
  line-height: 1.5;
}

.blocking-task-body {
  display: grid;
  min-height: 170px;
  place-items: center;
  align-content: center;
  gap: 13px;
  text-align: center;
}

.blocking-task-spinner {
  display: grid;
  width: 76px;
  height: 76px;
  place-items: center;
  border: 1px solid rgba(66, 214, 164, 0.3);
  border-radius: 999px;
  background: radial-gradient(circle, rgba(66, 214, 164, 0.16), transparent 68%), rgba(8, 18, 25, 0.72);
  color: var(--accent);
  box-shadow: 0 0 38px rgba(66, 214, 164, 0.14);
}

.blocking-task-spinner svg {
  animation: blocking-task-spin 900ms linear infinite;
}

.blocking-task-status {
  display: grid;
  gap: 6px;
}

.blocking-task-status strong {
  color: var(--text);
  font-size: 16px;
  font-weight: 900;
}

.blocking-task-status span {
  max-width: 340px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
  line-height: 1.6;
}

.blocking-task-footer {
  display: flex;
  justify-content: flex-end;
  padding-top: 14px;
  border-top: 1px solid rgba(174, 184, 201, 0.18);
}

.blocking-task-cancel {
  display: inline-flex;
  min-height: 40px;
  gap: 7px;
  align-items: center;
  justify-content: center;
  padding: 0 16px;
  border: 1px solid rgba(240, 120, 120, 0.4);
  border-radius: 7px;
  background: rgba(240, 120, 120, 0.1);
  color: #ffabab;
  font-weight: 900;
}

.blocking-task-cancel:hover {
  border-color: rgba(240, 120, 120, 0.68);
  background: rgba(240, 120, 120, 0.16);
}

@keyframes blocking-task-spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes blocking-task-overlay-in {
  from {
    opacity: 0;
  }
}

@keyframes blocking-task-content-in {
  from {
    opacity: 0;
    transform: translate(-50%, calc(-50% + 10px)) scale(0.98);
  }
}

@media (max-height: 480px) {
  .blocking-task-content {
    gap: 12px;
    padding: 16px;
  }

  .blocking-task-body {
    min-height: 112px;
  }

  .blocking-task-spinner {
    width: 58px;
    height: 58px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .blocking-task-overlay,
  .blocking-task-content,
  .blocking-task-spinner svg {
    animation: none;
  }
}
</style>
