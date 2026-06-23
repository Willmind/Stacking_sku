<script setup lang="ts">
import BaseSelect, { type SelectOption } from "../ui/BaseSelect.vue";
import { usePackingStore } from "../../stores/packingStore";
import BaseNumberField from "../ui/BaseNumberField.vue";

const store = usePackingStore();

const containerOptions: SelectOption[] = [
  { value: "20GP", label: "20GP", description: "长宽高 5898 × 2352 × 2393 mm" },
  { value: "40GP", label: "40GP", description: "长宽高 12032 × 2352 × 2393 mm" },
  { value: "40HQ", label: "40HQ", description: "长宽高 12032 × 2352 × 2698 mm" },
];

const clearanceFields = [
  { key: "front", label: "前 mm" },
  { key: "rear", label: "后 mm" },
  { key: "left", label: "左 mm" },
  { key: "right", label: "右 mm" },
  { key: "top", label: "顶部 mm" },
] as const;
</script>

<template>
  <section class="field-group" aria-label="集装箱规格">
    <h2>集装箱规格</h2>
    <BaseSelect
      id="container-type"
      label="柜型"
      :model-value="store.containerType"
      :options="containerOptions"
      show-selected-description
      @update:model-value="store.setContainerType"
    />
    <section class="clearance-panel" aria-label="车厢公差">
      <div class="clearance-heading">
        <h3>车厢公差</h3>
        <p>按站在柜口正视柜内为基准，输入需要预留的间隙。</p>
      </div>
      <div class="clearance-grid">
        <BaseNumberField
          v-for="field in clearanceFields"
          :id="`clearance-${field.key}`"
          :key="field.key"
          class="clearance-number-field"
          :label="field.label"
          :model-value="store.containerClearance[field.key]"
          :min="0"
          @update:model-value="store.updateContainerClearance(field.key, $event)"
        />
      </div>
    </section>
    <!-- <div class="triple-grid">
      <BaseNumberField id="container-length" label="长 mm" v-model="store.container.length" :min="1" @update:model-value="store.markDirty" />
      <BaseNumberField id="container-width" label="宽 mm" v-model="store.container.width" :min="1" @update:model-value="store.markDirty" />
      <BaseNumberField id="container-height" label="高 mm" v-model="store.container.height" :min="1" @update:model-value="store.markDirty" />
    </div> -->
  </section>
</template>

<style scoped>
.field-group {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.042), rgba(255, 255, 255, 0.022));
}

h2 {
  margin: 0;
  color: var(--accent);
  font-size: 14px;
}

.triple-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.clearance-panel {
  display: grid;
  gap: 10px;
  padding-top: 4px;
}

.clearance-heading {
  display: grid;
  gap: 4px;
}

h3,
.clearance-heading p {
  margin: 0;
}

h3 {
  color: var(--text);
  font-size: 13px;
  font-weight: 900;
}

.clearance-heading p {
  color: var(--muted);
  font-size: 11px;
  font-weight: 760;
  line-height: 1.45;
}

.clearance-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.clearance-number-field {
  min-width: 0;
}

.clearance-number-field :deep(.base-number-control) {
  min-height: 36px;
  border-radius: 6px;
}

.clearance-number-field :deep(.base-number-input) {
  min-height: 34px;
  padding: 0 7px;
  font-size: 12px;
  text-align: center;
}

.clearance-number-field :deep(.base-number-actions) {
  width: 22px;
}
</style>
