<script setup lang="ts">
import BaseNumberField from "../ui/BaseNumberField.vue";
import BaseSelect, { type SelectOption } from "../ui/BaseSelect.vue";
import { usePackingStore } from "../../stores/packingStore";

const store = usePackingStore();

const containerOptions: SelectOption[] = [
  { value: "20GP", label: "20GP", description: "标准小柜" },
  { value: "40GP", label: "40GP", description: "标准大柜" },
  { value: "40HQ", label: "40HQ", description: "高柜" },
];
</script>

<template>
  <section class="field-group" aria-label="集装箱规格">
    <h2>集装箱规格</h2>
    <BaseSelect id="container-type" label="柜型" :model-value="store.containerType" :options="containerOptions" @update:model-value="store.setContainerType" />
    <div class="triple-grid">
      <BaseNumberField id="container-length" label="长 mm" v-model="store.container.length" :min="1" @update:model-value="store.markDirty" />
      <BaseNumberField id="container-width" label="宽 mm" v-model="store.container.width" :min="1" @update:model-value="store.markDirty" />
      <BaseNumberField id="container-height" label="高 mm" v-model="store.container.height" :min="1" @update:model-value="store.markDirty" />
    </div>
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
  box-shadow: var(--control-inner-shadow);
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
</style>
