<script setup lang="ts">
import { Check, ChevronDown, Monitor, Moon, Sun } from "@lucide/vue";
import { computed, ref } from "vue";
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from "reka-ui";
import { type ThemeMode, useTheme } from "../../composables/useTheme";

const { themeMode, resolvedTheme, setThemeMode } = useTheme();
const isOpen = ref(false);

const options = [
  { value: "light", label: "浅色", description: "始终使用浅色界面", icon: Sun },
  { value: "dark", label: "深色", description: "始终使用深色界面", icon: Moon },
  { value: "system", label: "跟随系统", description: "随系统外观自动切换", icon: Monitor },
] as const;

const activeOption = computed(() => options.find((option) => option.value === themeMode.value) ?? options[2]);
const currentDescription = computed(() =>
  themeMode.value === "system" ? `跟随系统，当前为${resolvedTheme.value === "dark" ? "深色" : "浅色"}` : `${activeOption.value.label}模式`,
);

function selectTheme(mode: ThemeMode) {
  setThemeMode(mode);
  isOpen.value = false;
}
</script>

<template>
  <PopoverRoot v-model:open="isOpen">
    <PopoverTrigger as-child>
      <button
        id="theme-mode-trigger"
        class="theme-mode-trigger"
        type="button"
        :aria-label="`外观：${currentDescription}`"
        :title="`外观：${currentDescription}`"
      >
        <component :is="activeOption.icon" :size="16" :stroke-width="2.25" aria-hidden="true" />
        <span>{{ activeOption.label }}</span>
        <ChevronDown class="theme-mode-chevron" :size="13" :stroke-width="2.4" aria-hidden="true" />
      </button>
    </PopoverTrigger>

    <PopoverPortal>
      <PopoverContent class="theme-mode-popover" side="bottom" align="end" :side-offset="8" aria-label="选择外观模式">
        <div class="theme-mode-heading">
          <strong>外观模式</strong>
          <span>应用到整个界面</span>
        </div>
        <div class="theme-mode-options" role="menu" aria-label="外观模式">
          <button
            v-for="option in options"
            :key="option.value"
            class="theme-mode-option"
            :class="{ 'theme-mode-option--active': themeMode === option.value }"
            type="button"
            role="menuitemradio"
            :aria-checked="themeMode === option.value"
            @click="selectTheme(option.value)"
          >
            <span class="theme-mode-option-icon" aria-hidden="true">
              <component :is="option.icon" :size="16" :stroke-width="2.2" />
            </span>
            <span class="theme-mode-option-copy">
              <strong>{{ option.label }}</strong>
              <small>{{ option.description }}</small>
            </span>
            <Check v-if="themeMode === option.value" class="theme-mode-check" :size="15" :stroke-width="2.8" aria-hidden="true" />
          </button>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<style scoped>
.theme-mode-trigger {
  display: inline-flex;
  min-height: 36px;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid var(--control-border);
  border-radius: 8px;
  background: linear-gradient(180deg, var(--control-bg), var(--control-bg-strong));
  color: var(--muted);
  font-size: 12px;
  font-weight: 850;
  line-height: 1;
  padding: 0 9px;
}

.theme-mode-trigger:hover,
.theme-mode-trigger[data-state="open"] {
  border-color: var(--control-border-hover);
  background: linear-gradient(180deg, var(--control-bg-hover), var(--control-bg));
  color: var(--text);
}

.theme-mode-trigger[data-state="open"] {
  border-color: color-mix(in srgb, var(--accent) 48%, transparent);
  box-shadow: var(--focus-ring);
}

.theme-mode-trigger:focus-visible {
  border-color: var(--accent);
  outline: 0;
}

.theme-mode-chevron {
  transition: transform 160ms ease;
}

.theme-mode-trigger[data-state="open"] .theme-mode-chevron {
  transform: rotate(180deg);
}

:global(.theme-mode-popover) {
  z-index: 120;
  display: grid;
  width: 248px;
  gap: 9px;
  border: 1px solid var(--popover-border);
  border-radius: 10px;
  background: var(--popover-bg);
  box-shadow: var(--popover-shadow);
  padding: 8px;
  backdrop-filter: blur(16px);
}

:global(.theme-mode-heading) {
  display: grid;
  gap: 2px;
  padding: 5px 7px 7px;
  border-bottom: 1px solid var(--line);
}

:global(.theme-mode-heading strong) {
  color: var(--text);
  font-size: 13px;
  font-weight: 900;
}

:global(.theme-mode-heading span) {
  color: var(--subtle);
  font-size: 11px;
  font-weight: 700;
}

:global(.theme-mode-options) {
  display: grid;
  gap: 3px;
}

:global(.theme-mode-option) {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) 18px;
  gap: 9px;
  min-height: 52px;
  align-items: center;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--muted);
  padding: 6px 8px;
  text-align: left;
}

:global(.theme-mode-option:hover),
:global(.theme-mode-option:focus-visible) {
  border-color: var(--control-border);
  background: var(--control-bg-hover);
  color: var(--text);
  outline: 0;
}

:global(.theme-mode-option--active) {
  border-color: color-mix(in srgb, var(--accent) 28%, transparent);
  background: var(--accent-soft);
  color: var(--text);
}

:global(.theme-mode-option-icon) {
  display: grid;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 1px solid var(--control-border);
  border-radius: 7px;
  background: var(--control-bg);
  color: var(--muted);
}

:global(.theme-mode-option--active .theme-mode-option-icon),
:global(.theme-mode-check) {
  color: var(--accent);
}

:global(.theme-mode-option-copy) {
  display: grid;
  min-width: 0;
  gap: 3px;
}

:global(.theme-mode-option-copy strong) {
  color: inherit;
  font-size: 12px;
  font-weight: 900;
}

:global(.theme-mode-option-copy small) {
  color: var(--subtle);
  font-size: 10px;
  font-weight: 700;
  line-height: 1.2;
}
</style>
