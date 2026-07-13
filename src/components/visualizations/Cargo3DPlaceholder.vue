<template>
  <article class="view-panel three-d-panel" aria-label="3D 货柜渲染">
    <header>
      <div>
        <h2>3D 货柜渲染</h2>
        <span>透视图</span>
      </div>
    </header>
    <div class="empty-state">3D 场景将在首次计算后按需加载</div>
  </article>
</template>

<style scoped>
.view-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border-radius: 8px;
  background: var(--panel-strong);
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 13px 14px;
  border-bottom: 1px solid var(--line);
}

header div {
  display: grid;
  gap: 4px;
}

h2 {
  margin: 0;
  color: var(--text);
  font-size: 17px;
}

span {
  color: var(--muted);
  font-size: 12px;
  font-weight: 700;
}

.empty-state {
  display: grid;
  place-items: center;
  color: var(--muted);
  font-size: 13px;
  background:
    radial-gradient(circle at 18% 12%, rgba(66, 214, 164, 0.1), transparent 34%),
    radial-gradient(circle at 86% 82%, rgba(104, 166, 255, 0.08), transparent 30%), rgba(3, 8, 14, 0.72);
}
</style>
