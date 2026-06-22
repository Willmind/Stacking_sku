<script lang="ts">
export interface SelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}
</script>

<script setup lang="ts">
import { Check, ChevronDown } from "@lucide/vue";
import { computed } from "vue";
import {
  SelectContent,
  SelectIcon,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectViewport,
} from "reka-ui";

const props = withDefaults(
  defineProps<{
    id: string;
    label: string;
    modelValue: string;
    options: SelectOption[];
    ariaLabel?: string;
    density?: "default" | "compact";
    disabled?: boolean;
    showSelectedDescription?: boolean;
  }>(),
  {
    ariaLabel: "",
    density: "default",
    disabled: false,
    showSelectedDescription: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const selectedOption = computed(() => props.options.find((option) => option.value === props.modelValue));
const selectedLabel = computed(() => selectedOption.value?.label ?? props.modelValue);

function deferValueUpdate(value: string) {
  window.setTimeout(() => emit("update:modelValue", value), 0);
}

function updateValue(value: unknown) {
  if (typeof value !== "string" || value === props.modelValue) return;
  deferValueUpdate(value);
}
</script>

<template>
  <div class="base-select-field">
    <span :id="`${props.id}-label`" class="base-select-label">{{ props.label }}</span>
    <SelectRoot :model-value="props.modelValue" :name="props.id" :disabled="props.disabled" @update:model-value="updateValue">
      <SelectTrigger
        class="base-select-trigger"
        :class="{
          'base-select-trigger--with-description': props.showSelectedDescription,
          'base-select-trigger--compact': props.density === 'compact',
        }"
        :id="props.id"
        :aria-label="props.ariaLabel || undefined"
        :aria-labelledby="props.ariaLabel ? undefined : `${props.id}-label`"
      >
        <span class="base-select-trigger-copy">
          <span class="base-select-trigger-value">{{ selectedLabel }}</span>
          <span
            v-if="props.showSelectedDescription && selectedOption?.description"
            class="base-select-trigger-description"
          >
            {{ selectedOption.description }}
          </span>
        </span>
        <SelectIcon class="base-select-icon">
          <ChevronDown :size="15" :stroke-width="2.4" aria-hidden="true" />
        </SelectIcon>
      </SelectTrigger>

      <SelectPortal>
        <SelectContent
          class="base-select-content"
          :class="{ 'base-select-content--compact': props.density === 'compact' }"
          position="popper"
          :side-offset="7"
        >
          <SelectViewport
            class="base-select-viewport"
            :class="{ 'base-select-viewport--compact': props.density === 'compact' }"
          >
            <SelectItem
              v-for="option in props.options"
              :key="option.value"
              class="base-select-item"
              :class="{ 'base-select-item--compact': props.density === 'compact' }"
              :value="option.value"
              :text-value="option.label"
              :disabled="option.disabled"
            >
              <span class="base-select-item-check-slot" aria-hidden="true">
                <SelectItemIndicator class="base-select-item-indicator">
                  <Check :size="14" :stroke-width="2.7" />
                </SelectItemIndicator>
              </span>
              <span class="base-select-item-copy">
                <SelectItemText class="base-select-item-label">{{ option.label }}</SelectItemText>
                <span v-if="option.description" class="base-select-item-description">{{ option.description }}</span>
              </span>
            </SelectItem>
          </SelectViewport>
        </SelectContent>
      </SelectPortal>
    </SelectRoot>
  </div>
</template>

<style scoped>
.base-select-field {
  display: grid;
  gap: 7px;
}

.base-select-label {
  color: var(--muted);
  font-size: 12px;
  font-weight: 760;
}

.base-select-trigger {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 18px;
  gap: 8px;
  width: 100%;
  min-height: 42px;
  align-items: center;
  border: 1px solid var(--control-border);
  border-radius: 7px;
  background: linear-gradient(180deg, var(--control-bg), var(--control-bg-strong));
  color: var(--text);
  font-size: 13px;
  font-weight: 850;
  text-align: left;
  padding: 0 11px;
  transition:
    border-color 140ms ease,
    background 140ms ease,
    box-shadow 140ms ease;
}

.base-select-trigger--with-description {
  height: 58px;
  padding-block: 8px;
}

.base-select-trigger--compact {
  min-height: 36px;
  font-size: 12px;
  padding-inline: 10px;
}

.base-select-trigger:hover {
  border-color: var(--control-border-hover);
  background: linear-gradient(180deg, var(--control-bg-hover), var(--control-bg));
}

.base-select-trigger:focus-visible {
  border-color: var(--accent);
  box-shadow: var(--focus-ring);
  outline: 0;
}

.base-select-trigger[data-state="open"] {
  border-color: rgba(66, 214, 164, 0.42);
  background: linear-gradient(180deg, var(--control-bg-hover), var(--control-bg));
  outline: 0;
}

.base-select-trigger:active {
  border-color: var(--control-border-hover);
}

.base-select-trigger:disabled {
  cursor: not-allowed;
  opacity: 0.58;
}

.base-select-icon {
  display: inline-flex;
  color: var(--muted);
  transition: color 140ms ease, transform 160ms ease;
}

.base-select-trigger-copy {
  display: grid;
  min-width: 0;
  align-content: center;
  gap: 2px;
}

.base-select-trigger-value {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.base-select-trigger-description {
  display: block;
  min-width: 0;
  min-height: 14px;
  overflow: hidden;
  color: var(--subtle);
  font-size: 11px;
  font-weight: 760;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.base-select-trigger:hover .base-select-icon,
.base-select-trigger[data-state="open"] .base-select-icon {
  color: var(--text);
}

.base-select-trigger[data-state="open"] .base-select-icon {
  transform: rotate(180deg);
}

:global(.base-select-content) {
  z-index: 110;
  min-width: var(--reka-select-trigger-width);
  overflow: hidden;
  border: 1px solid var(--popover-border);
  border-radius: 9px;
  background: var(--popover-bg);
  box-shadow: var(--popover-shadow);
  backdrop-filter: blur(14px);
  transform-origin: var(--reka-select-content-transform-origin);
}

:global(.base-select-viewport) {
  display: grid;
  gap: 2px;
  padding: 5px;
}

:global(.base-select-viewport--compact) {
  gap: 1px;
  padding: 4px;
}

:global(.base-select-item) {
  position: relative;
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  gap: 9px;
  min-height: 48px;
  align-items: start;
  border-radius: 6px;
  color: var(--muted);
  font-size: 13px;
  font-weight: 820;
  padding: 8px 10px 8px 8px;
  outline: 0;
  user-select: none;
}

:global(.base-select-item--compact) {
  min-height: 34px;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  padding: 5px 9px 5px 7px;
}

:global(.base-select-item[data-highlighted]) {
  background: var(--accent-soft);
  color: var(--text);
}

:global(.base-select-item[data-state="checked"]) {
  color: var(--text);
}

:global(.base-select-item[data-disabled]) {
  color: var(--text-disabled);
  pointer-events: none;
}

:global(.base-select-item-check-slot) {
  display: inline-flex;
  min-height: 20px;
  align-items: center;
  justify-content: center;
}

:global(.base-select-item--compact .base-select-item-check-slot) {
  min-height: 18px;
}

:global(.base-select-item-indicator) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
}

:global(.base-select-item-copy) {
  display: grid;
  min-width: 0;
  gap: 3px;
  line-height: 1.28;
}

:global(.base-select-item--compact .base-select-item-copy) {
  gap: 1px;
  line-height: 1.18;
}

:global(.base-select-item-label) {
  display: block;
  min-width: 0;
  overflow: hidden;
  color: inherit;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:global(.base-select-item-description) {
  display: block;
  min-width: 0;
  overflow: hidden;
  color: var(--subtle);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

</style>
