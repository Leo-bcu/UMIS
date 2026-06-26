# HIVE 模块复用扫描记录

> **文档级别**：设计参考（Reference）
>
> 所有新增模块开工前必须记录成熟库 / GitHub / 商业参考扫描结果，避免重复造轮子。

---

## 一、扫描规则

每个新增模块开工前必须记录：

1. 候选成熟方案。
2. 许可证/合规风险。
3. 与当前技术栈的兼容性。
4. 自研成本。
5. 采用或封装成本。
6. 最终决策。

当前技术栈：

- Frontend: React 18, TypeScript, Vite, Tailwind, Zustand, Radix UI.
- 3D: Three.js, React Three Fiber, Potree, deck.gl.
- Backend: FastAPI.
- Export: jsPDF, html2canvas, custom LAS/OBJ/CSV.

---

## 二、Phase 1 初始扫描

| 模块 | 候选成熟方案 | 许可证/风险 | 与现有栈兼容性 | 决策 | 原因 |
|------|--------------|-------------|----------------|------|------|
| 测试 runner | Vitest / Node built-in test runner + esbuild | MIT / Node 内置 | Vite/TypeScript 可适配；esbuild 已在依赖中 | 采用 Node built-in + esbuild | Vitest 安装被沙箱/网络审批阻断；无新增依赖 runner 让 TDD 继续推进 |
| Finding 状态流 | XState | MIT | React 可用，但引入状态机成本 | 暂不采用 | Phase 1 只有 5 个状态，先用类型和纯函数；状态复杂后再引入 |
| 表单/数据校验 | Zod | MIT | 已在依赖中 | 采用 | 可复用现有依赖，适合证据/导出/AI action schema |
| Finding 列表 | TanStack Table | MIT | 兼容 React | 暂不采用 | Phase 1 先做轻量队列；Phase 2 复杂筛选再评估 |
| Exploration Coverage | Turf.js / deck.gl aggregation / 自研轻量摘要 | MIT / BSD 风险低 | Turf 偏 GIS 面；deck.gl 已接入但重在渲染 | Phase 1 自研轻量摘要 | 当前产品只有路径、节点、Finding 边界，先表达“已采样/未探明/AI推断/人工确认”，不伪装完整空间覆盖 |
| 时间线 | react-chrono / 自研轻量 | 多数 MIT | 可接 React | 暂不采用 | Mission Timeline 属 Phase 2，不在 Phase 1 引入 |
| 报告生成 | 现有 jsPDF/html2canvas / pdfmake / react-pdf | 多数开源 | 现有实现已可用 | 暂保留现有 | Phase 1 只生成 Finding 报告片段，Phase 4 再评估替换 |

---

## 三、后续追加模板

```md
### 模块名

目标：
候选成熟方案：
GitHub/资料链接：
许可证：
兼容性：
自研成本：
采用成本：
最终决策：
理由：
```
