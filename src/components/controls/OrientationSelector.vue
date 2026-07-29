<script setup lang="ts">
import { Check } from "@lucide/vue";
import { CARTON_ORIENTATION_OPTIONS, type CartonOrientationId } from "../../core/packing";

const props = withDefaults(
  defineProps<{
    idPrefix: string;
    label: string;
    modelValue: CartonOrientationId[];
    compact?: boolean;
  }>(),
  {
    compact: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: CartonOrientationId[]];
}>();

function isSelected(id: CartonOrientationId) {
  return props.modelValue.includes(id);
}

function toggleOrientation(id: CartonOrientationId) {
  const selected = isSelected(id);
  if (selected && props.modelValue.length <= 1) return;
  const next = selected ? props.modelValue.filter((item) => item !== id) : [...props.modelValue, id];
  emit("update:modelValue", next);
}
</script>

<template>
  <fieldset class="orientation-selector" :class="{ 'orientation-selector--compact': compact }">
    <legend>{{ label }}</legend>
    <div class="orientation-grid">
      <label
        v-for="option in CARTON_ORIENTATION_OPTIONS"
        :key="option.id"
        class="orientation-option"
        :class="{ 'orientation-option--selected': isSelected(option.id) }"
        :title="option.axisLabel"
      >
        <input
          :id="`${idPrefix}-${option.id}`"
          type="checkbox"
          :checked="isSelected(option.id)"
          :disabled="isSelected(option.id) && modelValue.length <= 1"
          @change="toggleOrientation(option.id)"
        />
        <span class="orientation-check" aria-hidden="true">
          <Check :size="12" :stroke-width="3" />
        </span>
        <span>{{ option.label }}</span>
      </label>
    </div>
  </fieldset>
</template>

<style scoped>
.orientation-selector {
  display: grid;
  gap: 8px;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

legend {
  margin: 0 0 10px;
  padding: 0;
  color: var(--muted);
  font-size: 12px;
  font-weight: 800;
}

.orientation-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.orientation-option {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  gap: 7px;
  align-items: center;
  min-width: 0;
  min-height: 34px;
  padding: 8px 9px;
  border: 1px solid var(--control-border);
  border-radius: 7px;
  background: linear-gradient(180deg, var(--control-bg), var(--control-bg-strong));
  color: var(--muted);
  font-size: 12px;
  font-weight: 850;
  cursor: pointer;
  user-select: none;
}

.orientation-option:hover {
  border-color: var(--control-border-hover);
  color: var(--text);
}

.orientation-option--selected {
  border-color: var(--orientation-selected-border);
  background: var(--orientation-selected-bg);
  color: var(--orientation-selected-text);
}

.orientation-option input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.orientation-check {
  display: inline-grid;
  width: 18px;
  height: 18px;
  place-items: center;
  border: 1px solid var(--orientation-check-border);
  border-radius: 5px;
  color: transparent;
  background: var(--orientation-check-bg);
  box-shadow: inset 0 1px 2px rgba(16, 36, 29, 0.08);
}

.orientation-option--selected .orientation-check {
  border-color: var(--orientation-check-selected-border);
  color: var(--orientation-check-selected-text);
  background: var(--orientation-check-selected-bg);
  box-shadow: none;
}

.orientation-option:has(input:focus-visible) {
  outline: 2px solid var(--orientation-focus-ring);
  outline-offset: 2px;
}

.orientation-option:has(input:disabled) {
  cursor: not-allowed;
}

.orientation-selector--compact .orientation-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 7px;
}

.orientation-selector--compact legend {
  margin-bottom: 8px;
}

.orientation-selector--compact .orientation-option {
  grid-template-columns: 16px minmax(0, 1fr);
  gap: 5px;
  min-height: 30px;
  padding: 6px 7px;
  font-size: 11px;
}

.orientation-selector--compact .orientation-check {
  width: 16px;
  height: 16px;
}

@media (max-width: 520px) {
  .orientation-grid,
  .orientation-selector--compact .orientation-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
