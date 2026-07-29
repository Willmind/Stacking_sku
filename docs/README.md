# 项目知识库

本目录保存跨任务、跨窗口需要持续复用的项目知识。新任务不应依赖历史聊天记录来恢复业务上下文，而应从本页和 `AGENTS.md` 开始读取。

## 产品可读文档

下面这些文档可以直接提供给产品、业务和项目相关人员：

| 文档                                                             | 产品用途                                         | 标记     |
| ---------------------------------------------------------------- | ------------------------------------------------ | -------- |
| [`../README.md`](../README.md)                                   | 了解项目能力、使用方式、交付方式和当前边界       | 产品可读 |
| [`project-input-requirements.md`](project-input-requirements.md) | 确认页面输入、校验、批量导入和暂未支持的业务条件 | 产品可读 |
| [`packing-terminology.md`](packing-terminology.md)               | 统一总ID、所属层、所属排、排内ID和码垛顺序       | 产品可读 |
| [`business/coordinate-system.md`](business/coordinate-system.md) | 确认机器人坐标、纸箱锚点、尺寸和 `ABC` 姿态      | 产品可读 |
| [`business/benchmark-cases.md`](business/benchmark-cases.md)     | 确认两组实际装柜数量和不可回退指标               | 产品可读 |

以下资料默认属于研发内部：

- `AGENTS.md`：Agent 工作规范。
- `architecture.md`：代码数据流与模块边界。
- `decisions/`：技术和业务决策过程。
- `superpowers/specs/`、`superpowers/plans/`：历史规格和实施计划。

研发内部并不表示保密；它表示产品确认需求时通常不需要阅读，且不能把历史计划当成当前功能说明。

## 信息优先级

当不同资料出现冲突时，按以下顺序判断：

1. 用户在当前任务中明确确认的新要求。
2. 当前代码和自动化测试所表达的实际行为。
3. `docs/business/` 下标记为“现行”的业务规则。
4. `docs/decisions/` 下已接受的决策记录。
5. 其他说明文档。
6. `docs/superpowers/specs/` 和 `docs/superpowers/plans/` 下的历史规格与实施计划。

历史规格和计划用于解释当时为什么修改，不能覆盖后续已经确认并落地的新规则。

## 新任务阅读路径

先阅读仓库根目录的 `AGENTS.md`，再根据改动范围选择资料：

| 改动范围                               | 必读资料                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 坐标、CSV、机器人位姿、纸箱朝向        | [`business/coordinate-system.md`](business/coordinate-system.md)                                                   |
| 总ID、所属层、所属排、排内ID、码垛先后 | [`packing-terminology.md`](packing-terminology.md)                                                                 |
| 装载量、算法候选、角件避让             | [`business/benchmark-cases.md`](business/benchmark-cases.md) 和 [`packing-terminology.md`](packing-terminology.md) |
| 表单、柜型、公差、批量导入             | [`project-input-requirements.md`](project-input-requirements.md)                                                   |
| Store、Worker、算法、渲染模块边界      | [`architecture.md`](architecture.md)                                                                               |
| 追溯重要规则为什么这样确定             | [`decisions/`](decisions/)                                                                                         |

## 维护规则

- 业务规则改变时，同一个需求中应同步修改代码、测试和对应业务文档。
- 新增重要且长期有效的技术或业务选择时，在 `docs/decisions/` 增加决策记录。
- 需求专属规格和计划继续放在 `docs/superpowers/specs/` 与 `docs/superpowers/plans/`。
- 不要在多个“现行”文档中完整复制同一规则；保留一个事实来源，其他文档使用链接。
- 文档中的示例数值必须有测试或明确业务确认支撑。
- 仅修改文案、注释或历史记录时，不应顺带改变算法行为。

## 当前事实来源

- 纸箱坐标数据：`src/core/boxCoordinates.ts`
- 装柜算法：`src/core/packing/`
- 页面状态：`src/stores/packingStore.ts`
- Worker 计算链路：`src/core/packingWorkerClient.ts`、`src/workers/`
- 2D 渲染：`src/renderers/plan2d.ts`
- 3D 场景模型：`src/renderers/cargoSceneModel.ts`
- 坐标规则回归：`tests/box-coordinates.test.ts`
- 核心装载基准：`tests/packing-core.test.ts`
- 浏览器业务回归：`tests/packing-e2e.spec.ts`
