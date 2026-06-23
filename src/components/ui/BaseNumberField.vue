<script setup lang="ts">
import { ChevronDown, ChevronUp } from "@lucide/vue";
import { NumberFieldDecrement, NumberFieldIncrement, NumberFieldInput, NumberFieldRoot } from "reka-ui";

const props = withDefaults(
  defineProps<{
    id: string;
    label: string;
    modelValue: number;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
  }>(),
  {
    min: undefined,
    max: undefined,
    step: 1,
    disabled: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: number];
}>();

function updateValue(value: number) {
  emit("update:modelValue", value);
}
</script>

<template>
  <NumberFieldRoot
    class="base-number-field"
    :id="props.id"
    :model-value="props.modelValue"
    :min="props.min"
    :max="props.max"
    :step="props.step"
    :disabled="props.disabled"
    :disable-wheel-change="true"
    :format-options="{ useGrouping: false, maximumFractionDigits: 0 }"
    @update:model-value="updateValue"
  >
    <span :id="`${props.id}-label`" class="base-number-label">{{ props.label }}</span>
    <div class="base-number-control">
      <NumberFieldInput class="base-number-input" :aria-labelledby="`${props.id}-label`" />
      <div class="base-number-actions" aria-hidden="false">
        <NumberFieldIncrement class="base-number-stepper" :aria-label="`增加 ${props.label}`">
          <ChevronUp :size="13" :stroke-width="2.7" aria-hidden="true" />
        </NumberFieldIncrement>
        <NumberFieldDecrement class="base-number-stepper" :aria-label="`减少 ${props.label}`">
          <ChevronDown :size="13" :stroke-width="2.7" aria-hidden="true" />
        </NumberFieldDecrement>
      </div>
    </div>
  </NumberFieldRoot>
</template>

<style scoped>
.base-number-field {
  display: grid;
  gap: 7px;
  min-width: 0;
}

.base-number-label {
  color: var(--muted);
  font-size: 12px;
  font-weight: 760;
}

.base-number-control {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  min-height: 42px;
  align-items: stretch;
  overflow: hidden;
  border: 1px solid var(--control-border);
  border-radius: 7px;
  background: linear-gradient(180deg, var(--control-bg), var(--control-bg-strong));
  transition:
    border-color 140ms ease,
    background 140ms ease,
    box-shadow 140ms ease;
}

.base-number-field:hover .base-number-control {
  border-color: var(--control-border-hover);
  background: linear-gradient(180deg, var(--control-bg-hover), var(--control-bg));
}

.base-number-field:focus-within .base-number-control {
  border-color: var(--accent);
  box-shadow: var(--focus-ring);
}

.base-number-input {
  width: 100%;
  min-width: 0;
  min-height: 40px;
  border: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
  font-size: 13px;
  font-weight: 850;
  padding: 0 10px;
}

.base-number-input:focus {
  outline: 0;
}

.base-number-actions {
  display: grid;
  width: 26px;
  min-height: 0;
  align-items: stretch;
  justify-items: stretch;
  grid-template-rows: repeat(2, minmax(0, 1fr));
  border-left: 1px solid var(--control-border);
  background: rgba(255, 255, 255, 0.025);
}

.base-number-stepper {
  display: grid;
  width: 100%;
  min-width: 0;
  min-height: 0;
  place-items: center;
  border: 0;
  border-top: 1px solid rgba(190, 205, 224, 0.08);
  background: transparent;
  color: var(--muted);
  line-height: 0;
  padding: 0;
}

.base-number-stepper svg {
  display: block;
}

.base-number-stepper:first-child {
  border-top: 0;
}

.base-number-stepper:hover {
  background: rgba(255, 255, 255, 0.07);
  color: var(--text);
}

.base-number-stepper:active,
.base-number-stepper[data-pressed="true"] {
  background: var(--accent-soft);
  color: var(--accent);
  transform: translateY(1px);
}

.base-number-stepper:focus-visible {
  outline: 0;
  box-shadow: inset 0 0 0 1px rgba(66, 214, 164, 0.72);
}

.base-number-stepper:disabled,
.base-number-stepper[data-disabled] {
  color: var(--text-disabled);
  cursor: not-allowed;
  opacity: 0.55;
}
</style>
