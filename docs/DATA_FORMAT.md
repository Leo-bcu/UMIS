# 数据格式说明文档

> 本文档详细说明项目中所有数据的结构、来源和渲染方式。
> 供数据采集团队、后端开发、前端开发参考。

---

## 一、数据来源说明

### 当前状态：100% Mock（模拟）数据

| 数据类型 | 来源 | 文件 |
|---------|------|------|
| 裂缝网络 | 前端随机生成 | `src/data/fractureDataGenerator.ts` |
| 点云节点 | 前端种子随机（seed=42） | `src/data/mockDataGenerator.ts` |
| 机器人集群 | 前端种子随机（seed=7777） | `src/data/robotDataGenerator.ts` |
| 告警数据 | 前端生成 | `src/data/alertDataGenerator.ts` |
| 传感器趋势 | 前端生成 | `src/data/sensorTrendGenerator.ts` |
| AI 对话 | 关键词匹配 + LLM（可选） | `src/lib/mockAI.ts` / `src/api/aiApi.ts` |

### Mock 数据生成原理

- **裂缝数据**：基于真实论文参数范围（如 Huang et al. 2024 的开度 38-68µm），使用 `Math.random()` 在参数区间内随机生成
- **裂缝路径**：使用随机游走算法（Random Walk），从岩体表面向下延伸，每步叠加随机扰动
- **传感器数值**：按场景类型（煤矿/金矿/油气）在预设范围内随机取值
- **缓存策略**：`generateFractureNetwork()` 全局缓存，首次生成后永远返回同一份数据

### 切换到真实数据

修改 `.env` 文件：

```bash
VITE_API_MODE=live                    # mock → live
VITE_API_BASE_URL=https://your-api/v1 # 后端地址
VITE_WS_URL=wss://your-api/ws         # WebSocket 地址
```

后端实现 REST API 接口（详见 `API_CONTRACT.md`），前端自动切换数据源。

---

## 二、3D 裂缝渲染方案

### 技术方案：程序化几何体（非逆向渲染）

| 维度 | 说明 |
|------|------|
| 渲染引擎 | Three.js（原生） + @react-three/fiber（React 封装） |
| 曲线平滑 | `THREE.CatmullRomCurve3` 样条插值 |
| 几何体类型 | `THREE.BufferGeometry` 程序化三角带（Triangle Strip） |
| 着色方式 | `vertexColors`（顶点级热力图着色） |
| 粗糙度模拟 | sin/cos 三角函数叠加噪声（非 Perlin Noise） |

### 是否使用开源逆向渲染方案？

**否。** 不使用 NeRF、点云重建、NURBS 曲面拟合、3D Gaussian Splatting 等方案。
当前是纯手写的程序化几何体生成：路径点 → 样条平滑 → 局部坐标系 → 双盘顶点 → 三角带索引。

### 渲染流程

```
Fracture.path [x,y,z][]
    │
    ├─ CatmullRomCurve3 样条插值 → 密集骨架点
    │
    ├─ 每个骨架点计算局部坐标系（切线/侧向/法线）
    │
    ├─ 不规则宽度噪声：width = base + sin(x) * 0.4 + cos(y) * 0.3
    │
    ├─ 上下盘顶点生成：
    │     upperVerts = [p - side*halfW, y + gapHalf + noise, p + side*halfW]
    │     lowerVerts = [p - side*halfW, y - gapHalf - noise, p + side*halfW]
    │
    ├─ 三角带索引连接相邻四边形顶点
    │
    └─ Vertex Colors：按传感器数值着色（蓝→绿→黄→红）
```

### 颜色映射规则

```
数值比例 t = (value - min) / (max - min)

  t < 0.33 → 蓝色 (#1A80E0) → 青色 (#44DDAA)    安全
  t < 0.66 → 青色 → 黄色 (#DDCC22)                临界
  t < 1.00 → 黄色 → 红色 (#FF2222)                危险
  超过阈值 → 红橙色脉冲动画
```

### 关键渲染参数

| 参数 | 主裂缝 | 分支裂缝 |
|------|--------|---------|
| 盘间距 (gap) | 0.8 | 0.4 |
| 基础半宽 (halfWidth) | 1.8~2.5 | 0.8~1.2 |
| 不透明度 | 0.7 | 0.6 |
| 边缘线颜色 | #8B7355 | #8B7355 |

---

## 三、核心数据类型定义

### 3.1 Fracture（裂缝）

```typescript
interface Fracture {
  id: string;                        // "F-001" 裂缝编号
  name: string;                      // "F-1" 可读名称
  type: 'main' | 'branch';           // 主裂缝 | 分支裂缝
  path: [number, number, number][];  // 3D路径点序列（至少3个点）
  length: number;                    // 长度（米）
  aperture_um: number;               // 开度（微米，论文范围 38-68µm）
  porosity: number;                  // 孔隙率（0-1）
  fractal_dim: number;               // 分形维数（2.03-2.35）
  tortuosity: number;                // 迂曲度（1.05-1.25）
  dip_angle: number;                 // 倾角（度）
  azimuth_angle: number;             // 走向方位角（度）
  roughness_coeff: number;           // 粗糙度系数（0.1-0.6）
  connectivity: number;              // 连通性（1-6，与其他裂缝交叉数）
  sensorReading: SensorReading;      // 整条裂缝的平均传感器读数
  nodes: FractureNode[];             // 测点列表（3-10个）
  parentFractureId: string | null;   // 父裂缝ID（分支用，主裂缝为null）
}
```

### 3.2 FractureNode（裂缝测点）

```typescript
interface FractureNode {
  id: string;                          // "F-001-N0" 测点编号
  position: [number, number, number];  // 3D坐标
  sensors: SensorReading;              // 测点级传感器读数
  timestamp: number;                   // 采集时间（毫秒级Unix时间戳）
  robotId: string | null;              // 采集机器人ID，null=无机器人
}
```

### 3.3 SensorReading（传感器读数）

```typescript
interface SensorReading {
  // === 煤矿场景重点 ===
  ch4_pct: number;                // 甲烷浓度（%），>1.5预警，>3.0危险
  co_ppm: number;                 // CO浓度（ppm），>24预警
  h2s_ppm: number;                // H₂S浓度（ppm），>10预警
  temperature_c: number;          // 温度（°C）

  // === 应力相关 ===
  stress_mpa: number;             // 地应力（MPa）
  stress_sigma1: number;          // 最大主应力 σ₁（MPa）
  stress_sigma2: number;          // 中间主应力 σ₂（MPa）
  stress_sigma3: number;          // 最小主应力 σ₃（MPa）

  // === 渗流相关 ===
  permeability_md: number;        // 渗透率（mD）
  water_pressure_mpa: number;     // 水压（MPa），>5预警
  humidity_pct: number;           // 湿度（%）
  fracture_aperture_um: number;   // 裂缝开度（µm）

  // === 微震/声学 ===
  microseismic_count: number;     // 微震事件（次/h），>10预警，>15危险
  acoustic_emission_mv: number;   // 声发射（mV·s），>3000预警

  // === 金矿场景重点 ===
  displacement_mm: number;        // 位移（mm），>5预警
  rock_strength_mpa: number;      // 岩体强度（MPa）

  // === 油气场景重点 ===
  pore_pressure_mpa: number;      // 孔隙压力（MPa），>30危险
  porosity_pct: number;           // 孔隙度（%）
  fluid_ph: number;               // 流体pH值
  water_saturation_pct: number;   // 含水饱和度（%）
}
```

> **重要**：所有字段必须传递，未采集的字段填 `0`。不要省略字段。

### 3.4 SceneNode（场景点云节点）

```typescript
interface SceneNode {
  node_id: string;               // "V-5832" 节点编号
  timestamp: number;             // 毫秒级Unix时间戳
  confidence_score: number;      // 置信度（0-1）
  geometry: {
    center: { x: number; y: number; z: number };
    mesh_vertices: { x: number; y: number; z: number }[];
    raw_points: { x: number; y: number; z: number; intensity: number }[];
  };
  sensors: {
    ch4_concentration_pct: number;   // CH₄浓度
    temperature_celsius: number;     // 温度
    pressure_kpa: number;            // 压力
  };
}
```

### 3.5 Robot（机器人）

```typescript
interface Robot {
  id: string;                            // "R-001"
  model: 'tracked' | 'wheeled' | 'climbing' | 'snake' | 'aerial';
  status: 'online' | 'offline' | 'low_battery' | 'error' | 'maintenance';
  position: [number, number, number];    // 3D位置
  battery: number;                       // 电量（0-100）
  meshRole: 'gateway' | 'relay' | 'edge' | 'leaf';
  meshConnected: boolean;                // Mesh网络连接状态
  task: string;                          // 当前任务
  depth: number;                         // 深度（米）
  signalStrength: number;                // 信号强度（dBm）
  sensors: { ch4: number; temperature: number; humidity: number };
  lastUpdate: number;                    // 最后更新时间
}
```

### 3.6 POI（兴趣点）

```typescript
interface POI {
  id: string;                            // "POI-001"
  position: [number, number, number];
  label: string;                         // "瓦斯异常区-A"
  type: 'crack' | 'gas' | 'collapse' | 'sensor';
  description: string;
  sensors: {
    ch4_concentration_pct: number;
    temperature_celsius: number;
    pressure_kpa: number;
  };
}
```

### 3.7 SceneAction（AI 场景控制动作）

> 这是 LLM Function Calling 返回的场景操作指令，支持"言出法随"。

```typescript
interface SceneAction {
  type: 'flyTo' | 'highlight' | 'toggleLayer' | 'markPoints'
      | 'activateTool' | 'selectFracture' | 'setGasThreshold'
      | 'switchScenario' | 'fitAll' | 'clearMarkers';
  position?: [number, number, number];   // 目标坐标
  region?: string;                        // 区域标识
  layer?: string;                         // 图层名
  tool?: AnnotationTool;                  // 标注工具类型
  fractureId?: string;                    // 裂缝ID
  threshold?: number;                     // 阈值
  scenario?: ScenarioType;                // 场景类型
  points?: {                              // 标记点列表
    position: [number, number, number];
    label: string;
    level?: 'danger' | 'warning' | 'info';
  }[];
  radius?: number;                        // 高亮半径
}
```

**动作类型说明：**

| type | 功能 | 触发示例 |
|------|------|---------|
| `flyTo` | 相机飞向指定坐标 | "带我去F-003裂缝" |
| `highlight` | 高亮指定区域 | "高亮3号区域" |
| `toggleLayer` | 切换图层显示 | "显示温度热力图" |
| `markPoints` | 在3D场景放置标记 | "标记最危险的点" |
| `activateTool` | 激活标注工具 | "测距" / "框选" / "剖面" |
| `selectFracture` | 选中并聚焦裂缝 | "选中F-005" |
| `setGasThreshold` | 设置瓦斯阈值 | "阈值调到2%" |
| `switchScenario` | 切换场景 | "切到金矿场景" |
| `fitAll` | 重置视角到全景 | "全景视图" |
| `clearMarkers` | 清除所有标记 | "清除标记" |

### 3.8 AIMarker（AI 3D 标记）

```typescript
interface AIMarker {
  id: string;                            // 唯一标识
  position: [number, number, number];    // 3D位置
  label: string;                         // 标签文本
  level: 'danger' | 'warning' | 'info';  // 危险级别（红/黄/蓝）
  createdAt: number;                     // 创建时间
}
```

---

## 四、各场景传感器数据参数范围

### 煤矿场景（coal）

| 字段 | 单位 | 范围 | 预警阈值 | 危险阈值 |
|------|------|------|---------|---------|
| ch4_pct | % | 0.1 ~ 4.5 | > 1.5 | > 3.0 |
| co_ppm | ppm | 0 ~ 50 | > 24 | — |
| h2s_ppm | ppm | 0 ~ 15 | > 10 | — |
| temperature_c | °C | 22 ~ 45 | > 35 | — |
| water_pressure_mpa | MPa | 0.5 ~ 8.0 | > 5.0 | — |
| microseismic_count | 次/h | 0 ~ 25 | > 10 | > 15 |
| acoustic_emission_mv | mV·s | 0 ~ 5000 | > 3000 | — |
| stress_mpa | MPa | 5 ~ 25 | — | — |
| permeability_md | mD | 0.01 ~ 4.0 | — | — |
| fracture_aperture_um | µm | 38 ~ 68 | — | — |

### 金矿场景（gold）

| 字段 | 单位 | 范围 | 预警阈值 | 危险阈值 |
|------|------|------|---------|---------|
| microseismic_count | 次/h | 0 ~ 30 | > 8 | > 15 |
| acoustic_emission_mv | mV·s | 0 ~ 8000 | > 5000 | — |
| displacement_mm | mm | 0 ~ 12 | > 5 | — |
| stress_mpa | MPa | 8 ~ 35 | — | > 25 |
| rock_strength_mpa | MPa | 30 ~ 120 | — | — |
| permeability_md | mD | 0.001 ~ 2.0 | — | — |
| fracture_aperture_um | µm | 20 ~ 55 | — | — |

### 油气场景（oil）

| 字段 | 单位 | 范围 | 预警阈值 | 危险阈值 |
|------|------|------|---------|---------|
| pore_pressure_mpa | MPa | 5 ~ 35 | > 20 | > 30 |
| permeability_md | mD | 0.01 ~ 100 | — | — |
| porosity_pct | % | 2 ~ 25 | — | — |
| fracture_aperture_um | µm | 10 ~ 300 | — | — |
| temperature_c | °C | 30 ~ 90 | — | — |
| fluid_ph | — | 5.5 ~ 8.5 | — | — |
| water_saturation_pct | % | 10 ~ 60 | — | — |

---

## 五、通用数据规则

1. **坐标系**：`[x, y, z]` 数组格式，单位**米**，Y 轴朝上
2. **岩体范围**：x[-50, 50], y[-20, 20], z[-40, 40]
3. **时间戳**：毫秒级 Unix 时间戳（`Date.now()` 格式）
4. **ID 命名**：`{类型}-{三位数字}`，如 `F-001`、`R-012`、`V-5832`
5. **数值精度**：
   - 浓度 %：2 位小数
   - 温度 °C：1 位小数
   - 压力 MPa：2 位小数
   - 微震/声发射：整数
6. **空值处理**：传感器无数据时传 `0`，不要省略字段

---

## 六、LLM 场景上下文注入

当 AI 对话开启时，以下场景上下文会注入到 System Prompt：

```
- 当前场景类型：煤矿 / 金矿 / 油气
- 裂缝总数：18 条
- 每条裂缝的：ID、名称、类型、坐标范围、传感器数值
- 瓦斯阈值设置
- 场景传感器参数范围
```

LLM 基于这些上下文做出数据驱动的决策，并通过 Function Calling 直接控制 3D 场景。

---

## 七、API 接口速查

详细 API 定义见 `API_CONTRACT.md`，核心接口：

| 接口 | 方法 | 说明 |
|------|------|------|
| `/fractures?scenario=` | GET | 裂缝网络数据 |
| `/scene/nodes` | GET | 点云节点 |
| `/scene/geometry` | GET | 预计算点云几何 |
| `/scene/stats` | GET | 场景统计 |
| `/pois` | GET | 兴趣点 |
| `/robots?status=&model=` | GET | 机器人列表 |
| `/robots/:id` | GET | 机器人详情 |
| `/robots/stats` | GET | 集群统计 |
| `/ai/chat` | POST (SSE) | AI 流式对话 |
| `/ai/quick-commands` | GET | 快捷指令 |
| `WS /ws` | WebSocket | 实时推送 |
