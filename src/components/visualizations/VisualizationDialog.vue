<script setup lang="ts">
import BaseDialog from "../ui/BaseDialog.vue";

defineProps<{
  open: boolean;
  title: string;
  subtitle?: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

function close() {
  emit("close");
}

function handleOpenChange(open: boolean) {
  if (!open) close();
}
</script>

<template>
  <BaseDialog
    :open="open"
    :title="title"
    :description="subtitle"
    :aria-label="`放大查看 ${title}`"
    close-label="关闭放大视图"
    size="fullscreen"
    body-variant="grid"
    @update:open="handleOpenChange"
  >
    <slot />
  </BaseDialog>
</template>
