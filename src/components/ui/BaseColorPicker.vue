<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from "reka-ui";

const recommendedColors = [
  "#D8923A",
  "#6E8BFF",
  "#42D6A4",
  "#D9A64F",
  "#F07878",
  "#B88CFF",
  "#5FB3B3",
  "#C7D0DD",
  "#7A8798",
  "#FF9F6E",
  "#8ED17C",
  "#E782A9",
];

const props = withDefaults(
  defineProps<{
    id: string;
    modelValue: string;
    ariaLabel?: string;
    ariaLabelledby?: string;
    showValue?: boolean;
    compact?: boolean;
  }>(),
  {
    ariaLabel: undefined,
    ariaLabelledby: undefined,
    showValue: false,
    compact: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
  change: [value: string];
}>();

const isOpen = ref(false);
const nativeInputRef = ref<HTMLInputElement | null>(null);
const hexValue = ref(normalizeColor(props.modelValue) ?? "#D8923A");

const displayColor = computed(() => normalizeColor(props.modelValue) ?? "#D8923A");
const colorText = computed(() => displayColor.value.toUpperCase());
const colorStyle = computed(() => ({ "--carton-color-value": displayColor.value }));
const nativeColorValue = computed(() => displayColor.value.toLowerCase());
const hexInputId = computed(() => `${props.id}-hex`);

watch(
  () => props.modelValue,
  (value) => {
    hexValue.value = normalizeColor(value) ?? "#D8923A";
  },
);

function normalizeColor(value: string) {
  const rawValue = value.trim();
  const colorValue = rawValue.startsWith("#") ? rawValue : `#${rawValue}`;
  return /^#[0-9a-fA-F]{6}$/.test(colorValue) ? colorValue.toUpperCase() : null;
}

function commitColor(value: string, closePopover = false) {
  const normalizedColor = normalizeColor(value);
  if (!normalizedColor) return;
  hexValue.value = normalizedColor;
  emit("update:modelValue", normalizedColor);
  emit("change", normalizedColor);
  if (closePopover) isOpen.value = false;
}

function updateColor(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  commitColor(value);
}

function updateHexValue(event: Event) {
  hexValue.value = (event.target as HTMLInputElement).value.toUpperCase();
}

function commitHexValue() {
  commitColor(hexValue.value);
}

function selectSwatch(color: string) {
  commitColor(color, true);
}

function openNativePicker() {
  nativeInputRef.value?.click();
}

function isSelectedColor(color: string) {
  return normalizeColor(color) === displayColor.value;
}
</script>

<template>
  <span class="carton-color-field" :class="{ 'carton-color-field--compact': props.compact }">
    <PopoverRoot v-model:open="isOpen">
      <PopoverTrigger as-child>
        <button
          class="carton-color"
          type="button"
          :style="colorStyle"
          :aria-label="props.ariaLabel"
          :aria-labelledby="props.ariaLabelledby"
          :aria-expanded="isOpen"
        >
          <span class="carton-color__swatch" aria-hidden="true"></span>
        </button>
      </PopoverTrigger>

      <PopoverPortal>
        <PopoverContent class="carton-color-popover" side="bottom" align="start" :side-offset="8">
          <div class="carton-color-popover-header">
            <span>推荐颜色</span>
            <strong>{{ colorText }}</strong>
          </div>
          <div class="carton-color-palette" aria-label="推荐颜色">
            <button
              v-for="color in recommendedColors"
              :key="color"
              class="carton-color-swatch-button"
              :class="{ 'carton-color-swatch-button--selected': isSelectedColor(color) }"
              type="button"
              :style="{ '--carton-color-value': color }"
              :aria-label="`选择颜色 ${color}`"
              @click="selectSwatch(color)"
            >
              <span aria-hidden="true"></span>
            </button>
          </div>
          <label class="carton-color-hex-field" :for="hexInputId">
            <span>HEX</span>
            <input
              :id="hexInputId"
              class="carton-color-hex-input"
              :value="hexValue"
              spellcheck="false"
              maxlength="7"
              @input="updateHexValue"
              @change="commitHexValue"
              @keydown.enter.prevent="commitHexValue"
            />
          </label>
          <button class="carton-color-more-button" type="button" @click="openNativePicker">
            更多颜色
          </button>
        </PopoverContent>
      </PopoverPortal>
    </PopoverRoot>
    <input
      :id="props.id"
      ref="nativeInputRef"
      class="carton-color__input"
      type="color"
      :value="nativeColorValue"
      tabindex="-1"
      aria-hidden="true"
      @input="updateColor"
      @change="updateColor"
    />
    <strong v-if="props.showValue" class="carton-color__value">{{ colorText }}</strong>
  </span>
</template>

<style scoped>
.carton-color-field {
  position: relative;
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.carton-color {
  --carton-color-value: #d8923a;
  display: inline-grid;
  width: 48px;
  min-width: 48px;
  min-height: 40px;
  place-items: center;
  overflow: hidden;
  border: 1px solid var(--control-border);
  border-radius: 7px;
  background: linear-gradient(180deg, var(--control-bg), var(--control-bg-strong));
  padding: 0;
  cursor: pointer;
  transition:
    border-color 140ms ease,
    background 140ms ease,
    box-shadow 140ms ease,
    transform 110ms ease;
}

.carton-color:hover {
  border-color: var(--control-border-hover);
  background: linear-gradient(180deg, var(--control-bg-hover), var(--control-bg));
}

.carton-color:focus-visible,
.carton-color[data-state="open"] {
  border-color: var(--accent);
  box-shadow: var(--focus-ring);
  outline: 0;
}

.carton-color:active {
  transform: translateY(1px);
}

.carton-color__input {
  position: fixed;
  width: 1px;
  height: 1px;
  margin: 0;
  border: 0;
  clip-path: inset(50%);
  opacity: 0;
  pointer-events: none;
}

.carton-color__swatch {
  position: relative;
  display: block;
  width: 32px;
  height: 28px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 5px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.18), rgba(255, 255, 255, 0) 48%),
    var(--carton-color-value);
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.16);
  pointer-events: none;
}

.carton-color__swatch::after {
  position: absolute;
  right: -12px;
  bottom: -14px;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.18);
  content: "";
}

.carton-color__value {
  min-width: 74px;
  color: var(--text);
  font-size: 13px;
  font-weight: 900;
  letter-spacing: 0;
}

.carton-color-field--compact {
  gap: 0;
}

:global(.carton-color-popover) {
  z-index: 70;
  display: grid;
  width: 242px;
  gap: 12px;
  border: 1px solid var(--popover-border);
  border-radius: 9px;
  background: var(--popover-bg);
  box-shadow: var(--popover-shadow);
  padding: 12px;
  backdrop-filter: blur(14px);
}

:global(.carton-color-popover-header) {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

:global(.carton-color-popover-header span) {
  color: var(--muted);
  font-size: 12px;
  font-weight: 780;
}

:global(.carton-color-popover-header strong) {
  color: var(--text);
  font-size: 12px;
  font-weight: 900;
}

:global(.carton-color-palette) {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 7px;
}

:global(.carton-color-swatch-button) {
  --carton-color-value: #d8923a;
  position: relative;
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 1px solid rgba(190, 205, 224, 0.18);
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.04);
  padding: 0;
}

:global(.carton-color-swatch-button:hover) {
  border-color: rgba(238, 244, 251, 0.55);
  background: rgba(255, 255, 255, 0.08);
}

:global(.carton-color-swatch-button:focus-visible) {
  outline: 0;
  box-shadow: var(--focus-ring);
}

:global(.carton-color-swatch-button span) {
  display: block;
  width: 18px;
  height: 18px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 5px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0) 52%),
    var(--carton-color-value);
}

:global(.carton-color-swatch-button--selected) {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(66, 214, 164, 0.14);
}

:global(.carton-color-swatch-button--selected::after) {
  position: absolute;
  right: 4px;
  bottom: 3px;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--accent);
  content: "";
}

:global(.carton-color-hex-field) {
  display: grid;
  gap: 6px;
}

:global(.carton-color-hex-field span) {
  color: var(--muted);
  font-size: 11px;
  font-weight: 780;
}

:global(.carton-color-hex-input) {
  width: 100%;
  min-height: 38px;
  border: 1px solid var(--control-border);
  border-radius: 7px;
  background: linear-gradient(180deg, var(--control-bg), var(--control-bg-strong));
  color: var(--text);
  font-size: 13px;
  font-weight: 850;
  letter-spacing: 0;
  padding: 0 10px;
  text-transform: uppercase;
}

:global(.carton-color-hex-input:hover) {
  border-color: var(--control-border-hover);
}

:global(.carton-color-hex-input:focus) {
  border-color: var(--accent);
  box-shadow: var(--focus-ring);
  outline: 0;
}

:global(.carton-color-more-button) {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  justify-content: center;
  border: 1px solid rgba(66, 214, 164, 0.32);
  border-radius: 7px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 12px;
  font-weight: 900;
  padding: 0 10px;
}

:global(.carton-color-more-button:hover) {
  border-color: rgba(66, 214, 164, 0.52);
  background: rgba(66, 214, 164, 0.2);
}

:global(.carton-color-more-button:focus-visible) {
  outline: 0;
  box-shadow: var(--focus-ring);
}
</style>
