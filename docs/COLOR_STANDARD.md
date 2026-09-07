# 3D 数字孪生渲染色彩标准

> **文档级别**：强制规范（Mandatory）  
> **适用范围**：本项目所有 3D 场景渲染组件  
> **代码实现**：`src/lib/sceneColors.ts`（唯一真源 Single Source of Truth）  
> **最后更新**：2026-06-13

---

## 一、总则

1. **所有 3D 渲染颜色必须引用 `src/lib/sceneColors.ts` 中的常量**，禁止在组件中硬编码十六进制色值。
2. 本标准基于以下工业/国家标准：
   - ANSI/ASME A13.1-2015 — 管道流体识别色
   - DZ/T 0179-2025 — 地质图用色标准（国标）
   - GB/T 958-2015 — 区域地质图图例
   - IS 2379 — 管道流体识别色（印度标准，分类最细）
   - Turbo Colormap — 科学可视化通用数据色图
3. 色彩分为四大体系：**结构身份色**、**科学数据色**、**状态色**、**交互色**。

---

## 二、五大模拟场景着色映射

| 模拟数据 | 场景 | 结构色来源 | 管道/通道渲染 | 岩体渲染 |
|---------|------|-----------|-------------|---------|
| 一·地下裂缝 | coal / gold / oil | `GEO_IDENTITY` | `FractureSurface` (vertexColors) | `GEO_IDENTITY.sedimentary` |
| 二·油气管线 | pipeline | `PIPE_IDENTITY.flammable` | `PipeMesh` (flat color) | 不渲染岩体 |
| 三·核反应堆 | nuclear | `NUCLEAR_IDENTITY` | `PipeMesh` (flat color) | `ReactorContainment` |
| 四·炼油化工 | refinery | `PIPE_IDENTITY.hotAlloy` | `PipeMesh` (flat color) | 不渲染岩体 |
| 五·地下暗流 | underground | `GEO_IDENTITY.groundwater` | `UndergroundChannelMesh` (vertexColors) | `GEO_IDENTITY.deepRock` |

---

## 三、四大色彩体系

### 3.1 状态色 `STATUS` — 红绿灯（全局统一）

| 常量 | 色值 | 含义 |
|------|------|------|
| `STATUS.danger` | `#FF2222` 红 | 超阈值/紧急 |
| `STATUS.warning` | `#FF8844` 橙 | 接近阈值 |
| `STATUS.caution` | `#FFAA00` 黄 | 提示 |
| `STATUS.safe` | `#44DD88` 绿 | 正常/安全 |

### 3.2 交互色 `INTERACTION` — 黄色高亮（全局统一）

| 常量 | 色值 | 含义 |
|------|------|------|
| `INTERACTION.selected` | `#FFE600` | 选中 |
| `INTERACTION.hover` | `#FFCC00` | 悬停 |
| `INTERACTION.highlight` | `#FFE600` | 区域高亮 |

### 3.3 机器人状态色 `ROBOT_STATUS`

| 常量 | 色值 | 含义 |
|------|------|------|
| `ROBOT_STATUS.online` | `#00FF66` 绿 | 在线 |
| `ROBOT_STATUS.offline` | `#444444` 灰 | 离线 |
| `ROBOT_STATUS.low_battery` | `#FFA500` 橙 | 低电量 |
| `ROBOT_STATUS.error` | `#FF3333` 红 | 故障 |
| `ROBOT_STATUS.maintenance` | `#4DA6FF` 蓝 | 维护中 |

### 3.4 管道身份色 `PIPE_IDENTITY`（ANSI/ASME A13.1 + IS 2379）

| 常量 | 色值 | 标准依据 | 介质 |
|------|------|---------|------|
| `PIPE_IDENTITY.water` | `#006B3F` 绿 | ANSI 绿 | 冷却水/给水 |
| `PIPE_IDENTITY.flammable` | `#6B4A2B` 棕 | ANSI 棕 | 原油/天然气/柴油 |
| `PIPE_IDENTITY.toxic` | `#FF8200` 橙 | ANSI 橙 | H₂S/酸/碱 |
| `PIPE_IDENTITY.fireProtect` | `#C8102E` 红 | ANSI 红 | 消防水/泡沫 |
| `PIPE_IDENTITY.compressed` | `#007BA7` 蓝 | ANSI 蓝 | 压缩气体/仪表风 |
| `PIPE_IDENTITY.steam` | `#B0B8C0` 银灰 | BS 1710 | 蒸汽 |
| `PIPE_IDENTITY.stainless` | `#4499AA` 青灰 | 工业惯例 | 核反应堆一回路 |
| `PIPE_IDENTITY.hotAlloy` | `#CC8844` 琥珀 | 行业惯例 | 高温炉管 |

### 3.5 地质身份色 `GEO_IDENTITY`（DZ/T 0179 + GB/T 958）

| 常量 | 色值 | 含义 |
|------|------|------|
| `GEO_IDENTITY.sedimentary` | `#6B5635` | 沉积岩（砂岩/泥岩） |
| `GEO_IDENTITY.sedimentaryLight` | `#7D6645` | 沉积岩浅层 |
| `GEO_IDENTITY.igneous` | `#8B5C42` | 火成岩（花岗岩/玄武岩） |
| `GEO_IDENTITY.metamorphic` | `#5A6B5A` | 变质岩 |
| `GEO_IDENTITY.deepRock` | `#3A3028` | 深部岩体 |
| `GEO_IDENTITY.basement` | `#2A2218` | 基岩/基底 |
| `GEO_IDENTITY.groundwater` | `#1A5588` | 地下水/暗流 |
| `GEO_IDENTITY.waterGlow` | `#22AACC` | 暗流流光效 |
| `GEO_IDENTITY.fault` | `#8B2020` | 断层/裂缝 |
| `GEO_IDENTITY.vein` | `#8B7355` | 矿脉 |

### 3.6 核设施身份色 `NUCLEAR_IDENTITY`

| 常量 | 色值 | 含义 |
|------|------|------|
| `NUCLEAR_IDENTITY.containment` | `#8A8A8A` | 安全壳混凝土 |
| `NUCLEAR_IDENTITY.rpv` | `#555566` | 反应堆压力容器 |
| `NUCLEAR_IDENTITY.sg` | `#666677` | 蒸汽发生器 |
| `NUCLEAR_IDENTITY.rcp` | `#777788` | 主泵 |
| `NUCLEAR_IDENTITY.prz` | `#888899` | 稳压器 |

### 3.7 科学数据色 — Turbo Colormap `valueToColor()`

```
低值 → 蓝(#1199E6) → 青(#11CC99) → 绿(#44DD66) → 黄(#FFDD33) → 红(#FF2211) ← 高值
```

- 超阈值区域强制偏移为红橙警告色
- 所有场景的传感器数据着色统一使用此函数
- 每个场景通过 `getSensorMetric()` 定义各自的 value/min/max/threshold

---

## 四、入口标记色 `ENTRANCE`

| 常量 | 色值 | 场景 |
|------|------|------|
| `ENTRANCE.pipe` | `#FF6600` 橙 | 管道入口 |
| `ENTRANCE.underground` | `#22AACC` 水蓝 | 地下暗流入口 |
| `ENTRANCE.fracture` | `#FFE600` 黄 | 裂缝入口 |

---

## 五、地下暗流通道可见性规则

地下暗流通道嵌在半透明深色岩体内部，必须遵守以下规则确保远视角可见性：

1. **通道材质**：使用 `meshStandardMaterial`（**禁止使用 `meshPhysicalMaterial` 的 `transmission`**）
   - 原因：`transmission` 需要环境贴图(Environment Map)，无环境贴图时会导致通道变黑
2. **基础自发光**：通道默认 `emissive = GEO_IDENTITY.waterGlow`，`emissiveIntensity >= 0.2`
   - 确保远视角下通道自发光可见，不被暗色岩体吞没
3. **岩体外壳透明度**：地下场景外层岩壳 `opacity <= 0.5`（不得高于 0.5）
4. **渲染顺序**：通道 `renderOrder = 2`，岩体 `renderOrder = 0`

---

## 六、编码规范

1. **禁止**在 `.tsx` 组件中出现硬编码十六进制颜色（如 `color="#3A3028"`）
2. 所有颜色必须从 `src/lib/sceneColors.ts` 导入常量
3. 新增场景或新结构体时，必须先在 `sceneColors.ts` 中定义对应身份色
4. PR Review 时检查项：搜索 `#[0-9A-Fa-f]{6}` 确认无违规硬编码
