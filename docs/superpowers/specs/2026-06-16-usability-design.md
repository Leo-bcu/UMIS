# HIVE 易用性提升设计 (演示动线化)

> **文档级别**：产品/UX 规格（Specification）
>
> **目标**：把易用性维度从 7.0 提升到 8.5+，服务现场演示，纯前端，不涉及企业化/账号。
>
> **关联**：[COMPETITIVE_SCORECARD_2026.md](../COMPETITIVE_SCORECARD_2026.md) 维度6、[UX_AUDIT_REPORT.md](../UX_AUDIT_REPORT.md) M7/ME3/ME7/ME11
>
> **代码真源**：`src/components/control-panel/FractureDetailPanel.tsx`、`RobotDetailDialog.tsx`、`ControlPanel.tsx`、`SensorTrends.tsx`、`MainLayout.tsx`、新增 `src/components/onboarding/`

---

## 1. 背景与目标

全量竞品打分（2026-06-16）显示易用性 7.0/10，是 ROI 最高的提分项。演示场景下用户反馈的四类痛点：

1. **新用户一脸懵** — 打开 7 个面板 + 3D 场景，不知先做啥（UX 报告 M7，唯一明确标"待迭代"）
2. **详情信息轰炸** — 点一个对象，右栏一上来砸 19 个传感器字段，非工程师看不懂重点
3. **操作没即时反馈** — 加载只有"加载中"文字，切换场景干等，点击不知是否生效（ME11）
4. **关键数据不好找** — 危险告警/复查项埋在面板深处，趋势固定 2.5h 看不到全貌（M1/ME7）

**目标**：一个从没见过 HIVE 的人，3 步内看到产品价值；演示对象（矿长/投资人/非工程师）无需培训即可理解右栏信息。

**不在范围**：3D 渲染、数据链路、AI 域逻辑、导出域逻辑、企业化/账号/SSO、移动端原生适配。

---

## 2. 设计原则

- **零新依赖** — 引导/骨架屏/进度条全部自研，复用现有 Radix UI 基础，沿用项目"不随意加依赖"惯例
- **渐进增强** — 所有新交互在现有数据流上叠加，不改 `sceneDataset` 单一真源
- **场景语义复用** — 摘要文案走现有 `sceneSemantics`，不手填
- **可关闭/可重看** — 引导可跳过、可重看；分层可一键展开完整数据，不剥夺工程师的深度信息
- **演示优先** — 每个改动问一句"这会让现场演示更顺吗"

---

## 3. 四个工作流

### 3.1 新手引导（Onboarding）— 解决"一脸懵"

**组件**：新增 `src/components/onboarding/OnboardingTour.tsx` + `TourOverlay.tsx`

**行为**：
- 首次访问（`localStorage.hive_onboarding_done` 不存在）自动启动 4 步引导
- 每步：半透明蒙层 + 高亮目标元素（CSS box-shadow spotlight 技巧，无第三方）+ 气泡说明 + 上一步/下一步/跳过
- 4 步动线：
  1. **场景切换器**（顶部）："一键切换煤矿/管线/核设施等 7 个行业场景"
  2. **3D 场景**（中央）："点击机器人或通道，查看实时探测数据"
  3. **右栏摘要**："右侧自动显示风险等级和关键指标"
  4. **AI 对话 + 导出**（底部/顶部）："用自然语言提问，或一键导出报告"
- 右上角常驻"？"图标按钮（`TopBar.tsx`），点击重新启动引导
- 引导文案走 `i18nCatalog`，中英双语

**实现要点**：
- spotlight 用 4 层 `box-shadow`（上/下/左/右巨大 spread）覆盖屏幕，中间挖出目标元素区域——纯 CSS，无库
- 目标元素用现有 `data-testid`（dev-state 已有）或新增稳定的 `data-tour` 锚点定位
- 引导状态加一个 `onboardingActive` 到 `useSceneStore`，引导期间禁用 3D 交互避免误触

### 3.2 详情面板摘要分层 — 解决"信息轰炸"

**组件**：重构 `FractureDetailPanel.tsx` + `RobotDetailDialog.tsx`

**新结构（三层）**：

```
┌─ 风险摘要卡（永远显示，第一眼看到）─────────────┐
│  🟢/🟡/🔴 风险等级   "CH₄ 轻微超标，建议加强通风"│  ← 一句话人话 + 色块
│  CH₄ 2.52%  温度 34°C  置信度 91%               │  ← 3 个核心指标（场景化）
└──────────────────────────────────────────────────┘
┌─ 场景化要点（按场景显示该角色最关心的）──────────┐
│  煤矿: 瓦斯扩散趋势 / 通风建议 / 复查优先级      │
│  核设施: 剂量率 / 屏蔽边界 / 人员接近限制        │
│  (走 sceneSemantics.export.objectDescription)    │
└──────────────────────────────────────────────────┘
┌─ ▼ 查看完整传感器数据（19 项，默认折叠）─────────┐
│  [展开后显示现有完整字段表]                       │
└──────────────────────────────────────────────────┘
```

**风险等级判定**（新增 `src/domain/riskSummary.ts`）：
- 输入：`SensorReading` + `ScenarioType`
- 输出：`{ level: 'safe'|'caution'|'danger', reason: string, primaryMetrics: Metric[] }`
- 用现有 `sceneSemantics.threshold` 判定等级；reason 走场景化文案
- 纯函数，可单测（沿用项目 domain 测试惯例）

**机器人详情同理**：状态摘要（在线/离线/低电量色块 + 任务 + 电量/信号大字号）在前，传感器明细折叠。

### 3.3 即时反馈 — 解决"没反馈"

**3.3a 骨架屏**（替代"加载中"文字）
- 新增 `src/components/ui/Skeleton.tsx`（自研，CSS shimmer 动画）
- `ControlPanel` 内各模块（SystemStatus/RobotFleet/SensorTrends）加载态用骨架
- 复用现有 `Card` 边框，内部用灰色 shimmer 条

**3.3b 场景切换进度条**
- 新增 `src/components/layout/SceneSwitchProgress.tsx`
- 顶部固定一条 2px 渐变进度条，切换场景时从 0→100%（自研 CSS @keyframes，零依赖）
- 监听 `useSceneStore.scenario` 变化触发

**3.3c 操作微确认**
- 告警确认：已有按钮，加一个 200ms 的勾选微动效
- 选对象：右栏摘要卡淡入动画（`framer-motion` 不引，用 CSS transition）

### 3.4 关键数据动线 — 解决"不好找"

**3.4a 危险告警强化置顶**
- `AlertFeed` 已置顶，强化为：danger 级告警卡片加左侧红色脉冲条 + 自动展开详情
- 顶部未确认计数 badge 点击 → 滚动到第一条未确认告警

**3.4b 趋势时间窗**（ME7）
- `SensorTrends.tsx` 加 1h / 2.5h / 6h / 24h 切换按钮组
- 现有 `sensorTrendGenerator` 已支持时间范围参数，只需暴露到 UI

**3.4c 任务快照可点击跳转**
- `MissionSnapshotPanel` 的"需复查 N 项"做成按钮，点击 → 切换到 Safety 角色面板 + 滚动到告警

---

## 4. 数据流

所有改动在现有数据流上叠加，**不改 `sceneDataset` 单一真源**：

```
sceneDataset (不动)
   ↓
新增 riskSummary.ts (纯函数，从 SensorReading 派生风险等级)
   ↓
FractureDetailPanel / RobotDetailDialog (消费 riskSummary，分层展示)
   ↓
sceneSemantics (复用，摘要文案/核心指标走场景语义)
```

引导/骨架/进度条/动线都是纯 UI 层，只读 store，不写新数据。

---

## 5. 组件清单

| 类型 | 文件 | 动作 |
|------|------|------|
| 新增 | `src/components/onboarding/OnboardingTour.tsx` | 4步引导主控 |
| 新增 | `src/components/onboarding/TourOverlay.tsx` | spotlight 蒙层 |
| 新增 | `src/domain/riskSummary.ts` | 风险等级判定纯函数 |
| 新增 | `src/domain/riskSummary.test.ts` | 单测 |
| 新增 | `src/components/ui/Skeleton.tsx` | 骨架屏原子 |
| 新增 | `src/components/layout/SceneSwitchProgress.tsx` | 切换进度条 |
| 重构 | `src/components/control-panel/FractureDetailPanel.tsx` | 三层分层 |
| 重构 | `src/components/scene/RobotDetailDialog.tsx` | 摘要分层 |
| 修改 | `src/components/control-panel/SensorTrends.tsx` | 时间窗 |
| 修改 | `src/components/control-panel/AlertFeed.tsx` | danger 脉冲 + 跳转 |
| 修改 | `src/components/control-panel/MissionSnapshotPanel.tsx` | 复查项可点击 |
| 修改 | `src/components/layout/TopBar.tsx` | "?"帮助按钮 |
| 修改 | `src/components/layout/MainLayout.tsx` | 挂载引导/进度条 |
| 修改 | `src/store/useSceneStore.ts` | onboardingActive 状态 |
| 修改 | `src/domain/i18nCatalog.ts` | 引导/摘要文案 key |

---

## 6. 验收标准

每个工作流独立可验收，沿用项目"改完跑 lint + 单测 + build"门禁：

- **引导**：首次访问自动启动 4 步；跳过后 localStorage 记忆；"?"可重看；中英双语
- **摘要分层**：点任意裂缝/机器人，第一眼看到风险色块 + 一句话 + 3 指标；19 字段默认折叠，可展开
- **即时反馈**：面板加载显示骨架屏非文字；切换场景有进度条；选对象有淡入
- **数据动线**：danger 告警有脉冲条；趋势可切 1h/24h；任务快照复查项可点击跳转
- **回归**：`npm run lint` 0 错误；`npm test` 全绿；`npm run build:check` 通过；新增 `riskSummary.test.ts` 覆盖 7 场景风险判定
- **演示验证**：`node scripts/full-test.mjs` 仍 0 失败，且右栏首屏可见风险摘要

---

## 7. 不做的事（YAGNI）

- 不做拖拽排序面板（复杂度高，演示价值低）
- 不做暗/亮模式切换（当前深色 3D + 浅色面板已是设计取向）
- 不做消息搜索/编辑（AI 对话不是演示核心）
- 不做字号缩放控件（已把最小字号提到 9px）
- 不引 framer-motion/shepherd.js 等第三方库

---

*设计日期：2026-06-16｜状态：待评审*
