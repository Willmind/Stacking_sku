# 项目架构与模块边界

- 状态：现行
- 最后确认：2026-07-29
- 阅读对象：开发、测试
- 产品可读：否，产品无需阅读

本文档帮助新任务快速定位代码，不替代具体业务规则。

## 技术栈

- Vue 3 + TypeScript + Vite
- Pinia
- Three.js / TresJS
- Konva
- Vitest
- Playwright

## 主要数据流

```text
Vue 表单与操作
    ↓
packingStore
    ↓
packingWorkerClient
    ↓
packing.worker / packingWorkerRuntime
    ↓
src/core/packing
    ↓
PackingResult
    ├─ 结果摘要与 SKU 明细
    ├─ boxCoordinates → 坐标弹窗 / CSV
    ├─ plan2d → 2D 视图
    └─ cargoSceneModel → 3D 视图
```

## 模块职责

| 模块                               | 职责                                     | 不应承担           |
| ---------------------------------- | ---------------------------------------- | ------------------ |
| `src/components/`                  | 用户交互和结果展示                       | 重新实现装柜算法   |
| `src/stores/packingStore.ts`       | 页面状态、计算触发和结果编排             | 复杂几何计算       |
| `src/core/packing/`                | 装柜候选、几何规则、朝向、验证和结果生成 | UI 状态和 DOM 操作 |
| `src/core/boxCoordinates.ts`       | 将装柜结果转换为机器人坐标和 CSV         | 改变最终装载排布   |
| `src/core/batchImport.ts`          | Excel 输入解析与批量计算数据整理         | 页面渲染           |
| `src/workers/`                     | 后台计算协议和运行时                     | 业务展示文案       |
| `src/renderers/plan2d.ts`          | 2D 场景数据                              | 修改算法位置       |
| `src/renderers/cargoSceneModel.ts` | 3D 场景模型                              | 修改装载顺序       |
| `src/styles/`                      | 全局视觉 token 和基础样式                | 业务逻辑           |

## 关键数据约定

- `PackingResult` 是算法到页面和渲染器的主要结果边界。
- `BoxPosition.sequenceIndex` 是总ID和播放进度的来源。
- `BoxPosition.faceIndex`、`stackIndex` 是算法内部排布与堆叠信息。
- 机器人坐标不是算法内部坐标，必须通过 `src/core/boxCoordinates.ts` 转换。
- 2D、3D、坐标表必须共享同一套装载结果和顺序，不能各自重新排序。

## 修改路由

- 改装载量或排布：从 `src/core/packing/` 和 `tests/packing-core.test.ts` 开始。
- 改机器人坐标或 CSV：从 `src/core/boxCoordinates.ts` 和 `tests/box-coordinates.test.ts` 开始。
- 改页面输入：先检查 `packingStore.ts`、对应 `components/controls/` 和 Worker 协议。
- 改 2D/3D：先确认问题属于场景模型还是视觉组件，避免在组件中修补算法数据。
- 改耗时任务：同时检查 Worker、取消逻辑、超时策略和 loading 状态。

## 验证层级

1. 业务函数测试：验证公式、几何和数据结构。
2. Store/Worker 测试：验证计算链路和失败处理。
3. E2E：验证用户可见流程、导出、2D/3D 和主题。
4. `npm run build`：执行 TypeScript 检查并验证静态构建。

基准数值见 [`business/benchmark-cases.md`](business/benchmark-cases.md)，坐标规则见 [`business/coordinate-system.md`](business/coordinate-system.md)。
