# 数据导出合规标准文档

> **适用范围**: HIVE 群智数字孪生主控舱 — 数据导出 / 交付中心 (Export Hub)
>
> **强制等级**: 所有导出功能必须遵循本文档标准。PR Review 时需检查合规性。

---

## 一、四大导出格式总览

| 格式 | 国际标准 | 目标用户 | 兼容软件 |
|------|---------|---------|---------|
| **PDF** | ISO 32000-1 | 高管 / 安监局 / 投资人 | 任意 PDF 阅读器 |
| **LAS 1.4** | ASPRS LAS 1.4-R15 (2023) | 持证测绘工程师 | Trimble Business Center, AutoCAD Civil 3D, CloudCompare, ArcGIS Pro |
| **OBJ + MTL** | Wavefront OBJ Spec | 三维建模 / 3D 打印 | Blender, 3ds Max, AutoCAD, Cura (3D 打印切片) |
| **CSV** | RFC 4180 | 矿企 IT / 自动化部门 | Excel, WPS, SCADA, ERP, Python pandas |

---

## 二、LAS 1.4 点云格式合规标准

### 2.1 文件头 (Public Header Block)

| 字段 | 偏移 | 长度 | HIVE 取值 | 合规说明 |
|------|------|------|----------|---------|
| File Signature | 0 | 4 | `LASF` | ASPRS 固定魔数 |
| Version Major.Minor | 24-25 | 1+1 | `1.4` | LAS 1.4 标准 |
| System Identifier | 26 | 32 | `HIVE_DIGITAL_TWIN_LIDAR` | 标识数据来源系统 |
| Generating Software | 58 | 32 | `HIVE_EXPORT_HUB_v1.0` | 标识生成软件 |
| Point Data Format ID | 104 | 1 | `2` | 格式 2 = 含 RGB，无 GPS 时间 |
| Point Data Record Length | 105 | 2 | `26` 字节 | 固定大小 |
| Scale/Offset X/Y/Z | 131-163 | 3×8+3×8 | 自动计算 | 确保整数精度无损 |

### 2.2 点数据记录 (Point Data Record Format 2)

| 字段 | 长度 | 说明 |
|------|------|------|
| X, Y, Z | 4+4+4 | 整数坐标 = (实际值 - Offset) / Scale |
| Intensity | 2 | 激光反射强度 0-65535 |
| Return Info + Flags | 1 | Return Number, Number of Returns |
| Classification | 1 | ASPRS 分类码 (见下表) |
| Scan Angle Rank | 1 | 扫描角度 |
| User Data | 1 | 用户自定义 |
| Point Source ID | 2 | 来源传感器 ID |
| **Red, Green, Blue** | 2+2+2 | RGB 16-bit (0-65535) |

### 2.3 ASPRS 分类码映射

| 码值 | ASPRS 定义 | HIVE 数据来源 |
|------|-----------|-------------|
| 1 | Unclassified | 体素点云原始扫描点 |
| 2 | Ground | 主裂缝路径 (地面可见裂缝) |
| 63 | Reserved | 自定义: 裂缝路径线 |
| 64 | Reserved | 自定义: 机器人位置 |

### 2.4 RGB 着色规则

CH4 浓度按 turbo colormap 映射:
- `0%` → 蓝 `(0, 0, 65535)`
- `1%` → 绿 `(0, 65535, 0)`
- `2.5%` → 黄 `(65535, 65535, 0)`
- `5%+` → 红 `(65535, 0, 0)`

---

## 三、OBJ + MTL 网格格式合规标准

### 3.1 文件结构

```
HIVE-Mesh-{scenario}-{timestamp}.obj   ← 主网格文件
HIVE-Mesh-{scenario}-{timestamp}.mtl   ← 材质库
```

### 3.2 OBJ 文件头

```obj
# HIVE Digital Twin - OBJ Export
# Scenario: {coal|gold|oil|pipeline|nuclear|refinery|underground}
# Exported: {ISO 8601 timestamp}
# Fractures: {count}
# Robots: {online count}
mtllib hive_export.mtl
```

### 3.3 对象命名规范

| 对象前缀 | 含义 | 材质 |
|---------|------|------|
| `main_fracture_{id}` | 主裂缝管道 | `mat_fracture_main` (黄 Kd 1.0 0.9 0.0) |
| `branch_fracture_{id}` | 分支裂缝管道 | `mat_fracture_branch` (橙 Kd 1.0 0.6 0.0) |
| `voxel_surface` | 体素表面 | `mat_voxel` (棕 Kd 0.42 0.34 0.21) |
| `robot_{id}` | 机器人 | `mat_robot` (绿 Kd 0.0 1.0 0.4) |

### 3.4 几何参数

- 管道半径: 主缝 0.4m, 分支 0.2m
- 管道段数: `max(8, path.length * 2)`
- 径向分段: 8
- 机器人: OctahedronGeometry 半径 0.8m
- 体素表面: 采样 2000 点, 四点四面

---

## 四、CSV 数据格式合规标准

### 4.1 编码

- **字符集**: UTF-8 with BOM (`\uFEFF`) — 确保 Excel 中文不乱码
- **分隔符**: 逗号 `,`
- **引用符**: 双引号 `"` (RFC 4180)
- **换行符**: `\n`

### 4.2 四大数据分区

#### Section 1: 裂缝节点传感器矩阵
```
时间戳, 裂缝ID, 节点ID, 节点类型, X, Y, Z, CH4(%), CO(ppm), H2S(ppm), 温度(°C), 
应力(MPa), Sigma1, Sigma2, Sigma3, 渗透率(mD), 水压(MPa), 微震次数, 声发射(mV), 
湿度(%), 裂缝开面(μm), 位移(mm), 岩石强度(MPa), 孔隙压力(MPa), 孔隙度(%), 
流体pH, 含水饱和度(%)
```

#### Section 2: 机器人状态矩阵
```
机器人ID, 型号, 状态, X, Y, Z, 深度(m), 电量(%), Mesh角色, Mesh连接, 
信号强度(dBm), CH4(%), 温度(°C), 湿度(%), 最后回传, 当前任务
```

#### Section 3: 告警事件
```
时间, 级别, 标题, 描述, 机器人ID, 确认
```

#### Section 4: 裂缝几何参数
```
裂缝ID, 名称, 类型, 长度(m), 开面(μm), 孔隙度, 分形维数, 曲折度, 
倾角(°), 方位角(°), 粗糙度系数, 连通性, 父裂缝ID
```

---

## 五、数据完整性保障

| 机制 | 适用格式 | 说明 |
|------|---------|------|
| **SHA-256 哈希** | PDF | 嵌入报告末尾, 可离线校验 |
| **时间戳** | 全部 | ISO 8601 UTC, 精确到秒 |
| **来源标识** | 全部 | System Identifier / 文件头注释 |
| **坐标精度** | LAS/OBJ | 小数点后 4 位 (0.1mm 级) |

---

## 六、商业定位

> **本系统是数据采集和决策看盘工具，不替代 Trimble / AutoCAD / Bentley 重型工程画图软件。**

- **高管与安监局** (看主控舱): 浏览器 → 3D 热力图 → AI 预警 → PDF 报告 → 决策开工
- **持证测绘工程师** (用 Trimble/CAD): 导出 LAS → Trimble 后处理 → 官方施工图纸
- **矿企 IT 部门** (用 ERP/SCADA): 导出 CSV → 导入企业系统 → 数据流转

绝不制造数据孤岛。

---

## 七、编码规范 (PR Review 检查项)

- [ ] 所有导出函数必须包含 `try-catch` 错误处理
- [ ] LAS 文件头必须包含正确的 System Identifier 和 Version
- [ ] OBJ 文件必须同时输出 `.obj` 和 `.mtl` 两个文件
- [ ] CSV 文件必须以 UTF-8 BOM 开头
- [ ] 文件名必须包含场景类型和时间戳
- [ ] 大文件 (>10MB) 导出时必须显示进度提示
- [ ] 导出组件中禁止硬编码色值, 引用 `sceneColors.ts` 常量
