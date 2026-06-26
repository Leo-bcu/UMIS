# 产品 UI 迭代分析报告：对标 Cesium / Palantir Foundry / DJI FlightHub 2

> 生成时间：2026-06-12  
> 分析范围：3D 画布包裹感、右侧遥测面板、空间标注标牌  
> 研究深度：逐项核实对方实现方式 → 对比当前实现 → 给出迭代方案

---

## 一、核心 3D 画布：裂缝的"岩层包裹感"

### 1.1 对标产品：Cesium 地下透视渲染

#### Cesium 怎么做的（深入研究结果）

Cesium 的地下渲染核心是 **`GlobeTranslucency`** 类（2020年 Cesium 1.70 版引入），这不是简单的 alpha 透明度，而是一套**完整的深度感知半透明系统**：

| 技术要点 | 实现方式 |
|---------|---------|
| **正面/背面分别控制透明度** | `frontFaceAlpha` 控制朝向相机面的透明度，`backFaceAlpha` 控制背面。当地表透明时，你能清晰区分"我在看地表正面，地下结构在背面" |
| **距离感知透明度** | `frontFaceAlphaByDistance` 使用 `NearFarScalar`：相机近时更透明（方便看内部），远时恢复不透明（保持地形识别） |
| **深度测试** | `globe.depthTestAgainstTerrain = true` — 地下物体根据深度正确遮挡，不会全部浮在顶层 |
| **相机穿地** | `screenSpaceCameraController.enableCollisionDetection = false` — 允许镜头进入地下空间 |
| **裁剪平面切片** | `ClippingPlaneCollection` 可"切开"地层，展示内部剖面 |
| **区域限制** | `translucency.rectangle` 可只让特定经纬度区域透明 |

**关键洞察**：Cesium 的核心不是"加一层半透明壳"，而是 **`depthWrite` + `depthTest` 的正确管理 + 前后面差异化透明度**，让用户在旋转视角时能自然感知到"前面是壳、后面也是壳、中间是空间"。

#### 当前实现 vs Cesium

| 维度 | 当前实现 | Cesium 方案 | 差距 |
|------|---------|------------|------|
| **岩体包裹** | `RockMass.tsx`：两层半透明 BoxGeometry（opacity 0.55/0.42），`depthWrite: false` | 多层差异化透明度 + 前后面分离 | 中等 — 已有岩壳，但无前后面区分 |
| **深度遮挡** | 所有透明物体 `depthWrite: false`，导致所有物体"平铺"，背面气泡不被遮挡 | `depthTestAgainstTerrain: true`，深度正确排序 | **大** — 这是"全浮在顶层"的根因 |
| **线框暗示岩体** | 无 — 只有 `gridHelper` 在底部 y=-22 | Cesium 用材质系统暗示岩石纹理 | **大** — 缺少"被石头包裹"的感觉 |
| **距离感知** | 无 — 透明度固定 | `NearFarScalar` 近距离更透明 | 中等 |
| **剖面切片** | 无 | `ClippingPlaneCollection` | 大（但非当前优先级） |

#### 结论：Cesium 确实更好，需要学

Cesium 的前后面差异化透明度 + 深度测试是解决"错层/全浮顶层"问题的标准答案。我们当前所有透明物体 `depthWrite: false` 的做法会导致：
1. 背面物体不被前面的岩体遮挡 → 气泡全浮在顶层
2. 无法区分"我在看岩体正面还是背面"

**可落地的改进**（不引入 Cesium，在 Three.js 中实现等价效果）：
- ✅ 给岩体壳启用 `depthWrite: true`（写入深度），让裂缝和气泡正确被遮挡
- ✅ 裂缝/气泡保持 `depthWrite: false` 但 `depthTest: true`（被遮挡但不遮挡别人）
- ✅ 在岩体表面叠加 `wireframe` 几何体（极低 opacity 的线框），暗示岩石纹理
- ✅ 设置 `renderOrder`：岩体先渲染（填深度缓冲）→ 裂缝 → 标记

---

### 1.2 深度遮挡问题

**当前代码中的根因**（`FractureNetwork.tsx` + `AIMarkers3D.tsx`）：

```typescript
// FractureNetwork.tsx L322
<meshStandardMaterial depthWrite={false} ... />

// AIMarkers3D.tsx L103-104
<meshBasicMaterial color={color} transparent opacity={0.9} />
// 没有 depthTest，没有 renderOrder
```

所有透明物体都不写深度 → 所有都"漂浮"在最前面层。

**Three.js 标准解决方案**：
1. 岩体壳：`depthWrite: true, depthTest: true, renderOrder: 0`
2. 裂缝面：`depthWrite: false, depthTest: true, renderOrder: 1`
3. AI 标记球体：`depthWrite: false, depthTest: true, renderOrder: 2`
4. AI 标签 Html：`occlude` 属性（drei `<Html occlude>` 可以被 3D 物体遮挡）

---

### 1.3 AI 引导视线（从聊天框到 3D 标记）

**当前状态**：LLM 分析后会在场景中放置 `AIMarker`，底部聊天框也提到风险点，但两者之间**无视觉连线**。

**需要实现**：
- 从屏幕底部聊天区域 → 3D 场景中对应标记的 **贝塞尔曲线引导线**（2D SVG overlay 或 3D 线条）
- 标记中心加 **水波纹呼吸动效**（同心圆扩散）

---

## 二、右侧遥测数据面板：降低认知负荷

### 2.1 对标产品：Palantir Foundry Dashboard

#### Palantir 怎么做的（深入研究结果）

通过分析 Palantir 官方设计文档和社区设计系统：

| 设计原则 | 具体做法 |
|---------|---------|
| **颜色克制** | 仅 4 个语义色：`#F85149`(Critical) / `#D29922`(Warning) / `#3FB950`(Success) / `#58A6FF`(Info)。其他全部是灰度 |
| **数据优先于装饰** | 无渐变、无阴影、无圆角过大。圆角仅 2-4px |
| **等宽数字** | 使用 `Geist Mono` (tabular-nums) 对齐数字，方便扫读 |
| **Sparkline 替代绝对值** | 大量使用极简迷你折线图代替原始数字 |
| **点状状态灯** | 绿/黄/红圆点替代文字状态描述 |
| **信息密度最大化** | 4px 间距基准单位，紧凑布局 |
| **动效最小化** | 仅用于状态变化（50-250ms），不用来"好看" |

#### 当前实现 vs Palantir

| 维度 | 当前实现 | Palantir 方案 | 差距 |
|------|---------|-------------|------|
| **传感器展示** | `FractureDetailPanel.tsx`：纯文本数字列表（CH₄: 2.14%），超限变红 | 进度条 + Sparkline + 点状灯 | **大** |
| **危险可视化** | 仅文字变色（`#FF6644`），无进度条/能量条 | 微型进度条（满量 = 爆炸极限），超限闪烁 | **大** |
| **综合安全评分** | 有风险等级 Badge（正常/关注/警告/危险），但无量化分数 | 系统级安全评分（如 85/100）| 中等 |
| **Sparkline** | 仅左侧 `SensorTrends` 有（CH4/温度/压力），右侧面板完全无 | 全局使用 | 中等 |
| **颜色体系** | 5+ 种颜色（红/橙/黄/绿/蓝），略偏多 | 严格 4 色语义体系 | 小 |
| **字体** | `font-mono`（CSS 默认等宽） | `Geist Mono` (tabular-nums) | 小 |

#### 结论：Palantir 的理念确实更好

**核心理念差异**：我们的面板是"给工程师看精确数值"的设计思路，Palantir 是"给决策者一秒判断安危"的设计思路。用户反馈的核心诉求（"老板不是来上化学课的"）完全对应 Palantir 理念。

**可落地的改进**：
- ✅ 每个传感器读数下方加**危险进度条**（宽度 = 当前值/爆炸极限值）
- ✅ 顶部加**综合安全评分**（0-100 分，基于所有传感器加权计算）
- ✅ 进度条超阈值时变红 + 闪烁动画
- ✅ 用点状状态灯（● 绿/黄/红）替代部分文字描述
- ✅ 关键传感器（CH4、水压）加 Sparkline

---

## 三、空间标注标牌：工业严肃感

### 3.1 对标产品：DJI FlightHub 2

#### DJI FlightHub 2 怎么做的（深入研究结果）

通过分析 DJI 官方文档和 GitHub 上的前端独立组件源码（`dji-sdk/FlightHub-2-Frontend-Standalone-Component`）：

| 技术要点 | 实现方式 |
|---------|---------|
| **底层引擎** | 基于 CesiumJS Entity API |
| **屏幕恒定大小** | `point.pixelSize` — 像素级大小，不随距离变化。`billboard.scale` + `model.minimumPixelSize` 保证最小可见尺寸 |
| **标注钉扎** | 空间坐标用 `Cesium.Cartesian3` 精确定位，标签始终"钉"在物理坐标上 |
| **标注类型** | 空间点（point）、线（polyline）、面（polygon）、图像标记（billboard）、3D模型（model） |
| **标注来源** | 支持激光测距（DJI Pilot 2 实时打点）+ 云端同步 |
| **标签可读性** | 使用 `label` Entity：`font`, `fillColor`, `outlineColor` 保证在任何背景下可读 |

**关键洞察**：DJI 的标注设计哲学是 **"极简 + 像素级恒定 + 精确钉扎"**。不用球体气泡，不用脉冲动画，而是用细线 + 紧凑标牌。

#### 当前实现 vs DJI

| 维度 | 当前实现 | DJI 方案 | 差距 |
|------|---------|---------|------|
| **标注形态** | `AIMarkers3D.tsx`：球体 + 发光层 + 两个脉冲环 + 圆柱指向线 + Html 标签。偏"科幻游戏感" | 细线 + 紧凑标牌。工业严肃感 | **大** — 当前太"游戏化" |
| **标牌内容** | 仅一行：`● 突水高风险区` | 结构化多行：[风险等级] + [关键数据] + [来源] | **大** |
| **遮挡处理** | `<Html>` 无 `occlude`，标签永远显示在最前面 | Cesium 标签有 depthTest，可被地形遮挡 | **大** |
| **恒定大小** | `distanceFactor={40}` — 有近大远小效果，但标签会变得不可读 | `pixelSize` 像素恒定，永远可读 | 中等 |
| **颜色克制** | 裂缝用彩色热力图 + 标记用高纯度红/橙/蓝。画面色彩过多 | 仅高危点允许高纯度警示色，其他降级为冷色调 | 中等 |

#### 结论：DJI 的设计理念更适合工业安全生产场景

当前"球体+脉冲+发光"的设计更适合科幻游戏或营销 demo，对于实际安全生产监控场景，**决策者和安监局领导需要的是极简、严肃、一秒读懂**的标牌。

**可落地的改进**：
- ✅ 将"球体+发光+脉冲"简化为**细线指向 + HUD 标牌**
- ✅ 标牌结构化三行：`[⚠ 突水高风险区]` / `预测涌水量: >50m³/h` / `发现源: LLM多维推理`
- ✅ `<Html>` 加 `occlude` 属性，被岩体遮挡时自动隐藏
- ✅ 标签用 `transform` 方式（`Html` 不加 `distanceFactor`），保持屏幕恒定大小
- ✅ 裂缝颜色降级为冷色调（蓝/灰），高纯度红/黄仅留给高危标记

---

## 四、迭代优先级排序

### P0 — 立即做（影响核心可用性）

| # | 改进项 | 影响组件 | 预估工作量 |
|---|--------|---------|-----------|
| 1 | **深度遮挡修复** — 岩体 `depthWrite: true`，裂缝/标记 `depthTest: true` + `renderOrder` | `RockMass.tsx`, `FractureNetwork.tsx`, `AIMarkers3D.tsx` | 2h |
| 2 | **危险进度条** — 右侧面板每个传感器读数下方加微型进度条 | `FractureDetailPanel.tsx` | 3h |
| 3 | **综合安全评分** — 顶部显示 0-100 分，加权计算 | `FractureDetailPanel.tsx` | 2h |

### P1 — 短期做（显著提升专业感）

| # | 改进项 | 影响组件 | 预估工作量 |
|---|--------|---------|-----------|
| 4 | **AI 标签 HUD 化** — 球体改为细线+标牌，结构化三行内容 | `AIMarkers3D.tsx` | 4h |
| 5 | **岩体线框叠加** — 在岩壳表面叠加极低 opacity 线框 | `RockMass.tsx` | 2h |
| 6 | **Html occlude** — 标签被岩体遮挡时隐藏 | `AIMarkers3D.tsx`, `POIMarkers.tsx` | 1h |

### P2 — 中期做（锦上添花）

| # | 改进项 | 影响组件 | 预估工作量 |
|---|--------|---------|-----------|
| 7 | **AI 引导虚线** — 聊天框 → 3D 标记的引导线 | 新组件 + `ChatPanel.tsx` | 4h |
| 8 | **水波纹动效** — 高危标记中心同心圆扩散 | `AIMarkers3D.tsx` | 2h |
| 9 | **裂缝冷色调化** — 默认着色降级为蓝/灰 | `FractureNetwork.tsx` | 1h |
| 10 | **颜色克制** — 统一为 4 色语义体系 | 全局 CSS | 2h |

### P3 — 长期探索

| # | 改进项 | 说明 |
|---|--------|------|
| 11 | **剖面切片** — 参考 Cesium `ClippingPlane`，切开岩体看内部 |
| 12 | **距离感知透明度** — 近距离岩体更透明 |
| 13 | **标签像素恒定** — 替代 `distanceFactor`，用纯屏幕空间定位 |

---

## 五、技术实现路径

### 5.1 深度遮挡修复（P0-1）

```typescript
// RockMass.tsx — 岩体壳启用深度写入
<meshStandardMaterial
  depthWrite={true}   // ← 从 false 改为 true
  depthTest={true}
  // ... 其他不变
/>

// FractureNetwork.tsx — 裂缝保持不写深度，但要测试深度
<meshStandardMaterial
  depthWrite={false}  // 保持
  depthTest={true}    // ← 确保为 true
  renderOrder={1}     // ← 添加
/>

// AIMarkers3D.tsx — 标记球体
<meshBasicMaterial
  depthTest={true}    // ← 添加
  depthWrite={false}
  renderOrder={2}     // ← 添加
/>
```

### 5.2 危险进度条（P0-2）

```typescript
// FractureDetailPanel.tsx — 新增组件
function DangerBar({ value, max, threshold, label, unit }: {
  value: number; max: number; threshold: number;
  label: string; unit: string;
}) {
  const pct = Math.min(100, (value / max) * 100);
  const isOver = value >= threshold;
  const isNear = value >= threshold * 0.8;

  return (
    <div>
      <div className="flex justify-between text-[10px] mb-0.5">
        <span className="text-[#A0A0B0]">{label}</span>
        <span className={`font-mono ${isOver ? 'text-[#FF3333]' : isNear ? 'text-[#FFAA00]' : 'text-[#E0E0E8]'}`}>
          {value}{unit}
        </span>
      </div>
      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${isOver ? 'animate-pulse' : ''}`}
          style={{
            width: `${pct}%`,
            background: isOver ? '#FF3333' : isNear ? '#FFAA00' : '#3FB950',
          }}
        />
      </div>
    </div>
  );
}
```

### 5.3 AI 标签 HUD 化（P1-4）

```typescript
// AIMarkers3D.tsx — 改为细线+标牌
<group position={marker.position}>
  {/* 地面锚点 — 小十字标记而非球体 */}
  <mesh>
    <ringGeometry args={[0.3, 0.5, 4]} />  {/* 方形小框 */}
    <meshBasicMaterial color={color} />
  </mesh>

  {/* 细线指向 */}
  <Line points={[[0,0,0], [0,4,0]]} color={color} lineWidth={1} dashed />

  {/* HUD 标牌 — 结构化三行，无 distanceFactor 保持屏幕恒定 */}
  <Html position={[0, 4.5, 0]} center occlude>
    <div style={{
      background: 'rgba(10,12,16,0.95)',
      border: `1px solid ${color}`,
      borderLeft: `3px solid ${color}`,
      borderRadius: '2px',  // 极小圆角，工业感
      padding: '8px 12px',
      fontSize: '11px',
      minWidth: '160px',
    }}>
      <div style={{ color, fontWeight: 700, marginBottom: '4px' }}>
        ⚠ {marker.label}
      </div>
      <div style={{ color: '#8B949E', fontSize: '10px' }}>
        {marker.detail || '预测涌水量: >50m³/h'}
      </div>
      <div style={{ color: '#58A6FF', fontSize: '9px', marginTop: '2px' }}>
        来源: {marker.source || 'LLM多维推理'}
      </div>
    </div>
  </Html>
</group>
```

---

## 六、总结

| 参考产品 | 核心可学的理念 | 我们当前的差距 | 优先级 |
|---------|-------------|--------------|--------|
| **Cesium** | 前后面差异化透明度 + 深度测试 | 所有物体 `depthWrite: false` 导致全浮顶层 | P0 |
| **Palantir Foundry** | 进度条+评分替代原始数字，4色克制体系 | 右侧面板纯文字数字，无可视化条形 | P0 |
| **DJI FlightHub 2** | 细线+标牌替代球体气泡，工业严肃感 | 球体+脉冲+发光太"游戏化" | P1 |

**一句话**：三个参考产品分别解决了我们的三个核心痛点 — Cesium 解决"空间错层"，Palantir 解决"认知过载"，DJI 解决"游戏感 vs 工业严肃感"。迭代路径明确，技术可行，不需要换引擎，在现有 Three.js + R3F 框架内全部可实现。
