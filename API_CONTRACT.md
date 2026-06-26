# API 对接契约

> 前端已通过标准化数据接口层解耦所有 mock 数据。
> 后端只需实现以下接口，将 `.env` 中 `VITE_API_MODE` 改为 `live` 即可上线。

## 数据源切换

```bash
# .env 文件
VITE_API_MODE=mock        # mock=内置模拟数据 | live=真实后端
VITE_API_BASE_URL=/api    # 后端 API 基础地址
VITE_WS_URL=ws://host/ws  # WebSocket 实时推送地址（预留；当前 backend 未实现）
```

---

## 数据清洗与筛选标准（机器人负责人必读）

> 本节定义了前端 3D 可视化系统所需的数据格式和字段要求。
> 机器人团队在清洗/筛选原始采集数据时，请严格按照以下结构组织。

### 通用规则

1. **坐标系统**：所有 3D 坐标使用 `[x, y, z]` 数组格式，单位**米**。Y 轴朝上。
2. **时间戳**：统一使用 **毫秒级 Unix 时间戳**（`Date.now()` 格式）。
3. **数值精度**：
   - 浓度百分比：保留 2 位小数（如 `1.25`）
   - 温度：保留 1 位小数（如 `35.6`）
   - 压力 MPa：保留 2 位小数（如 `108.50`）
   - 微震计数：整数
   - 声发射：整数（mV·s）
4. **空值处理**：传感器无数据时传 `0` 或 `null`，**不要省略字段**。
5. **ID 命名**：使用 `{类型前缀}-{三位数字}` 格式，如 `F-001`、`R-012`、`V-5832`。

---

## REST API 接口定义

### 1. 获取裂缝网络数据（核心接口）

```
GET /fractures?scenario={coal|gold|oil}
```

**这是前端 3D 热力图和裂缝网络的主要数据源。**

**响应** `Fracture[]`

```jsonc
[
  {
    // === 基础标识 ===
    "id": "F-001",                    // 裂缝编号，必须唯一
    "name": "F-1",                    // 可读名称
    "type": "main",                   // "main"=主裂缝 | "branch"=分支裂缝

    // === 空间几何（必须） ===
    "path": [                         // 裂缝3D路径点，至少3个点
      [-40.0, 2.5, -30.0],
      [-38.5, 2.3, -28.1],
      [-36.2, 1.8, -25.5],
      // ... 建议每2-5米一个路径点
    ],

    // === 裂缝参数 ===
    "length": 35.2,                   // 裂缝长度（米），保留1位小数
    "aperture_um": 52.3,              // 裂缝开度（微米），保留1位小数
    "porosity": 0.0152,               // 孔隙率（0-1），保留4位小数
    "fractal_dim": 2.1234,            // 分形维数，保留4位小数
    "tortuosity": 1.1245,             // 迂曲度，保留4位小数
    "dip_angle": 25.3,                // 倾角（度），保留1位小数
    "azimuth_angle": 145.0,           // 走向角（度），保留1位小数
    "roughness_coeff": 0.35,          // 粗糙度系数，保留2位小数
    "connectivity": 3,                // 连通性（与其他裂缝交叉数），整数

    // === 整条裂缝的平均传感器读数 ===
    "sensorReading": {
      // 通用字段（所有场景都需要）
      "temperature_c": 35.6,          // 温度（°C）
      "stress_mpa": 15.25,            // 地应力（MPa）
      "stress_sigma1": 12.50,         // 最大主应力 σ₁（MPa）
      "stress_sigma2": 9.30,          // 中间主应力 σ₂（MPa）
      "stress_sigma3": 8.20,          // 最小主应力 σ₃（MPa）
      "permeability_md": 1.2540,      // 渗透率（mD）
      "humidity_pct": 65.5,           // 湿度（%）
      "fracture_aperture_um": 52.3,   // 裂缝开度（µm）

      // 煤矿场景重点字段
      "ch4_pct": 2.35,                // CH₄浓度（%），0~5，超过1.5%为黄色预警，超过3.0%为红色危险
      "co_ppm": 15.5,                 // CO浓度（ppm），超过24ppm为预警
      "h2s_ppm": 3.2,                 // H₂S浓度（ppm），超过10ppm为预警
      "water_pressure_mpa": 3.50,     // 水压（MPa），超过5MPa为预警
      "microseismic_count": 8,        // 微震事件（次/h），超过10为预警，超过15为危险
      "acoustic_emission_mv": 2500,   // 声发射（mV·s），超过3000为预警

      // 金矿场景重点字段
      "displacement_mm": 3.50,        // 位移（mm），超过5mm为预警
      "rock_strength_mpa": 85.0,      // 岩体强度（MPa）

      // 油气场景重点字段
      "pore_pressure_mpa": 22.50,     // 孔隙压力（MPa），超过30为危险
      "porosity_pct": 12.5,           // 孔隙度（%）
      "fluid_ph": 7.2,                // 流体pH值
      "water_saturation_pct": 35.0,   // 含水饱和度（%）

      // 以下字段可传0
      "water_pressure_mpa": 0,
      "displacement_mm": 0,
      "rock_strength_mpa": 0,
      "pore_pressure_mpa": 0,
      "porosity_pct": 0,
      "fluid_ph": 0,
      "water_saturation_pct": 0
    },

    // === 测点数据（关键！热力图的逐顶点着色依赖此字段）===
    "nodes": [
      {
        "id": "F-001-N0",             // 测点编号
        "position": [-40.0, 2.5, -30.0],  // 测点3D坐标
        "sensors": {                   // 与 sensorReading 结构相同
          "ch4_pct": 1.85,
          "co_ppm": 12.0,
          // ... 完整字段同上
        },
        "timestamp": 1718169600000,    // 采集时间
        "robotId": "R-005"             // 采集机器人编号，null=无机器人
      },
      // ... 每条裂缝建议3-10个测点
    ],

    // === 分支关系 ===
    "parentFractureId": null           // 父裂缝ID，主裂缝为null
  }
]
```

**数据量参考**：
- 主裂缝：6 条
- 分支裂缝：12 条
- 总测点：60-120 个

### 2. 获取场景节点数据（点云）

```
GET /scene/nodes
```

**响应** `SceneNode[]`

```jsonc
[
  {
    "node_id": "V-5832",
    "timestamp": 1718169600000,
    "confidence_score": 0.92,
    "geometry": {
      "center": { "x": 5.2, "y": -1.3, "z": -40.5 },
      "mesh_vertices": [
        { "x": 5.1, "y": -1.2, "z": -40.4 }
      ],
      "raw_points": [
        { "x": 5.15, "y": -1.25, "z": -40.45, "intensity": 0.8 }
      ]
    },
    "sensors": {
      "ch4_concentration_pct": 3.2,
      "temperature_celsius": 35.6,
      "pressure_kpa": 108.5
    }
  }
]
```

### 3. 获取预计算点云几何（可选，高性能渲染）

```
GET /scene/geometry
```

**响应** `FlatGeometryData`

```jsonc
{
  "positions": [5.2, -1.3, -40.5, 5.15, ...],
  "confidences": [0.92, 0.88, ...],
  "gasValues": [3.2, 2.8, ...],
  "tempValues": [35.6, 30.2, ...],
  "intensities": [0.8, 0.6, ...],
  "count": 60000
}
```

### 4. 获取场景统计信息

```
GET /scene/stats
```

**响应** `SceneStats`

```jsonc
{
  "totalNodes": 12000,
  "avgGas": 1.85,
  "avgTemp": 28.5,
  "avgConf": 72,
  "overThreshold": 342,
  "onlineSensors": 11856,
  "lastUpdate": 1718169600000
}
```

### 5. 获取 POI 兴趣点

```
GET /pois
```

**响应** `POI[]`

```jsonc
[
  {
    "id": "POI-001",
    "position": [8.5, -2.1, -40.2],
    "label": "瓦斯异常区-A",
    "type": "gas",                    // "crack" | "gas" | "collapse" | "sensor"
    "description": "CH4浓度持续偏高，建议加强通风",
    "sensors": {
      "ch4_concentration_pct": 3.2,
      "temperature_celsius": 35.6,
      "pressure_kpa": 108.5
    }
  }
]
```

### 6. 获取快捷指令

> 当前由前端 mock/本地命令提供；`backend/main.py` 尚未实现该路由。

```
GET /ai/quick-commands
```

**响应** `QuickCommand[]`

```jsonc
[
  { "label": "评估3号区塌方风险", "command": "评估3号区塌方风险" }
]
```

### 7. AI 流式对话

> 当前由前端 `src/api/aiApi.ts` mock/直连 LLM；`backend/main.py` 尚未实现该路由。

```
POST /ai/chat
Content-Type: application/json
```

**请求**

```jsonc
{
  "messages": [
    { "role": "assistant", "content": "系统就绪..." },
    { "role": "user", "content": "评估3号区塌方风险" }
  ]
}
```

**响应** SSE 流

```
data: {"textDelta": "## "}
data: {"textDelta": "3号区"}
data: {"textDelta": "塌方"}
...
data: {"textDelta": "...", "action": {"type": "flyTo", "position": [12.1, -3.0, 60.5], "region": "zone-3"}}
data: [DONE]
```

`action` 字段（可选）触发前端空间联动：

| type | 含义 | 必需字段 |
|------|------|---------|
| `flyTo` | 相机飞向指定坐标 | `position: [x,y,z]`, `region?: string` |
| `toggleLayer` | 切换图层显示 | `layer: "mesh"|"pointCloud"|"gasHeatmap"|"tempHeatmap"` |
| `highlight` | 高亮指定区域 | `position: [x,y,z]`, `region?: string` |

### 8. 获取集群机器人列表

```
GET /robots?status=&model=&mesh_role=&q=
```

**Query 参数**（均可选）

| 参数 | 值 | 说明 |
|------|-----|------|
| `status` | `online` \| `offline` \| `low_battery` \| `error` \| `maintenance` | 按状态过滤 |
| `model` | `tracked` \| `wheeled` \| `climbing` \| `snake` \| `aerial` | 按型号过滤 |
| `mesh_role` | `gateway` \| `relay` \| `edge` \| `leaf` | 按 Mesh 组网角色过滤 |
| `q` | `R-00` | 按编号模糊搜索 |

**响应** `Robot[]`

```jsonc
[
  {
    "id": "R-001",
    "model": "tracked",
    "status": "online",
    "position": [3.2, -1.5, -45.0],
    "battery": 78,
    "meshRole": "relay",
    "meshConnected": true,
    "task": "三维扫描建图",
    "depth": 45.0,
    "signalStrength": -58,
    "sensors": {
      "ch4": 1.2,
      "temperature": 33.5,
      "humidity": 72
    },
    "lastUpdate": 1718169600000
  }
]
```

### 9. 获取单个机器人详情

```
GET /robots/:id
```

**响应** `Robot`（同上结构）

### 10. 获取集群统计概览

```
GET /robots/stats
```

**响应** `RobotFleetStats`

```jsonc
{
  "total": 200,
  "online": 131,
  "offline": 16,
  "lowBattery": 23,
  "error": 18,
  "maintenance": 12,
  "meshConnected": 156,
  "avgBattery": 62
}
```

---

## WebSocket 实时推送（可选）

> 预留接口；`backend/main.py` 当前没有 WebSocket 路由，live 后端接入时再实现。

```
WS /ws
```

**消息格式**

```jsonc
{
  "type": "sensor_update",
  "timestamp": 1718169600000,
  "data": {
    "node_id": "V-5832",
    "ch4_concentration_pct": 3.5,
    "temperature_celsius": 36.1,
    "pressure_kpa": 109.0
  }
}
```

| type | data 结构 |
|------|----------|
| `sensor_update` | `{ node_id, ch4_concentration_pct, temperature_celsius, pressure_kpa }` |
| `alert` | `{ level: "warning"\|"danger", message: string, position: [x,y,z] }` |
| `robot_position` | `{ robot_id: string, position: [x,y,z], battery: number, status: string }` |

---

## 各场景传感器数据字段要求

### 煤矿场景（coal）— 重点字段

| 字段 | 类型 | 单位 | 采集范围 | 预警阈值 | 危险阈值 |
|------|------|------|---------|---------|---------|
| `ch4_pct` | number | % | 0.1 ~ 4.5 | > 1.5 | > 3.0 |
| `co_ppm` | number | ppm | 0 ~ 50 | > 24 | — |
| `h2s_ppm` | number | ppm | 0 ~ 15 | > 10 | — |
| `temperature_c` | number | °C | 22 ~ 45 | > 35 | — |
| `water_pressure_mpa` | number | MPa | 0.5 ~ 8.0 | > 5.0 | — |
| `microseismic_count` | integer | 次/h | 0 ~ 25 | > 10 | > 15 |
| `acoustic_emission_mv` | integer | mV·s | 0 ~ 5000 | > 3000 | — |
| `stress_mpa` | number | MPa | 5 ~ 25 | — | — |
| `permeability_md` | number | mD | 0.01 ~ 4.0 | — | — |
| `fracture_aperture_um` | number | µm | 38 ~ 68 | — | — |

### 金矿场景（gold）— 重点字段

| 字段 | 类型 | 单位 | 采集范围 | 预警阈值 | 危险阈值 |
|------|------|------|---------|---------|---------|
| `microseismic_count` | integer | 次/h | 0 ~ 30 | > 8 | > 15 |
| `acoustic_emission_mv` | integer | mV·s | 0 ~ 8000 | > 5000 | — |
| `displacement_mm` | number | mm | 0 ~ 12 | > 5 | — |
| `stress_mpa` | number | MPa | 8 ~ 35 | — | > 25 |
| `rock_strength_mpa` | number | MPa | 30 ~ 120 | — | — |
| `permeability_md` | number | mD | 0.001 ~ 2.0 | — | — |
| `fracture_aperture_um` | number | µm | 20 ~ 55 | — | — |

### 油气场景（oil）— 重点字段

| 字段 | 类型 | 单位 | 采集范围 | 预警阈值 | 危险阈值 |
|------|------|------|---------|---------|---------|
| `pore_pressure_mpa` | number | MPa | 5 ~ 35 | > 20 | > 30 |
| `permeability_md` | number | mD | 0.01 ~ 100 | — | — |
| `porosity_pct` | number | % | 2 ~ 25 | — | — |
| `fracture_aperture_um` | number | µm | 10 ~ 300 | — | — |
| `temperature_c` | number | °C | 30 ~ 90 | — | — |
| `fluid_ph` | number | — | 5.5 ~ 8.5 | — | — |
| `water_saturation_pct` | number | % | 10 ~ 60 | — | — |

---

## 3D 热力图颜色映射规则

前端将传感器数值映射为以下颜色（供数据团队理解前端显示逻辑）：

```
数值比例 t = (value - min) / (max - min)

  t < 0.33 → 蓝色 (#1A80E0) → 青色 (#44DDAA)    安全
  t < 0.66 → 青色 → 黄色 (#DDCC22)                临界
  t < 1.00 → 黄色 → 红色 (#FF2222)                危险

  超过阈值 → 红橙色脉冲动画
```

---

## 前端架构

```
.env (VITE_API_MODE=mock|live)
  ↓
src/api/config.ts          → 配置读取
src/api/httpClient.ts      → HTTP 客户端
src/api/sceneApi.ts        → 场景数据接口
src/api/poiApi.ts          → POI 接口
src/api/aiApi.ts           → AI 对话接口
src/api/robotApi.ts        → 集群机器人接口
  ↓
src/hooks/                 → React Hooks（缓存 + 加载状态）
  useSceneNodes.ts
  useSceneStats.ts
  usePOIs.ts
  useQuickCommands.ts
  useRobots.ts
  ↓
src/components/            → UI 组件（永远不直接接触 mock 数据）
```

## 快速检查清单

对接前请确认：

- [ ] 裂缝路径 `path` 每条至少 3 个 `[x, y, z]` 坐标点
- [ ] 测点 `nodes` 每条裂缝至少 3 个，坐标在 `path` 附近
- [ ] 所有 `sensors` 字段完整，未采集的字段填 `0`
- [ ] `timestamp` 为毫秒级 Unix 时间戳
- [ ] 机器人编号格式 `R-XXX`，裂缝编号格式 `F-XXX`
- [ ] 坐标 Y 轴朝上，单位为米
- [ ] `/fractures` 接口支持 `scenario` 查询参数
