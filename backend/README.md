# 井下数字孪生后端服务

FastAPI 后端，三个核心职责：
1. **数据提供** — 为前端提供裂缝/机器人/告警/点云等全部 REST 接口（匹配 `API_CONTRACT.md`）
2. **点云处理** — Open3D 去噪/ICP配准/Poisson重建/RANSAC裂缝提取/SLAM适配
3. **监控目标检测** — 独立 `Mine.pt` 推理服务，支持单图/批量/缓存/预热

## 技术栈

| 组件 | 版本 | 用途 |
|------|------|------|
| FastAPI | 0.115.0 | Web 框架 |
| Open3D | 0.18.0 | 点云处理（去噪/法线/Poisson/ICP/RANSAC） |
| NumPy | 1.26.4 | 数值计算 |
| SciPy | 1.13.1 | 科学计算（Open3D 降级备用） |
| scikit-learn | 1.5.2 | RANSAC 降级备用 |

## 快速启动

数据服务：

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

监控识别服务：

```bash
cd backend
pip install -r requirements.txt
export MINE_WEIGHTS_PATH=/Users/leo/Downloads/UMIS-backup/approch/Mine.pt
uvicorn monitor_infer_service:app --host 0.0.0.0 --port 8010 --reload
```

验证：`curl http://localhost:8000/api/health`

监控服务验证：`curl http://localhost:8010/api/health`

API 文档：`http://localhost:8000/docs`

## 第一部分：数据提供接口

前端切换到 live 模式后，所有数据请求走这些接口。

> 当前后端未实现 `/api/ai/*` 与 `/ws`。AI 对话/快捷指令仍由前端 mock 或直连 LLM 处理；WebSocket 是预留能力。

### 裂缝数据

```bash
# 获取裂缝网络（按场景）
curl http://localhost:8000/api/fractures?scenario=coal
curl http://localhost:8000/api/fractures?scenario=gold
curl http://localhost:8000/api/fractures?scenario=oil

# 单条裂缝详情
curl http://localhost:8000/api/fractures/F-001
```

### 场景数据

```bash
# 场景节点树
curl http://localhost:8000/api/scene/nodes?scenario=coal

# 点云扁平几何数据（positions, confidences, gasValues, ...）
curl http://localhost:8000/api/scene/geometry

# 场景统计
curl http://localhost:8000/api/scene/stats?scenario=coal
```

### 机器人集群

```bash
# 机器人列表（支持过滤）
curl http://localhost:8000/api/robots
curl "http://localhost:8000/api/robots?status=active&model=snake-v2"

# 单个机器人
curl http://localhost:8000/api/robots/RB-001

# 集群统计
curl http://localhost:8000/api/robots/stats
```

### 兴趣点 / 告警

```bash
curl http://localhost:8000/api/pois?scenario=coal
curl http://localhost:8000/api/alerts
curl http://localhost:8000/api/alerts?level=critical
```

## 第二部分：点云处理接口

### 处理管线

```
机器人原始点云（噪声 + 局部坐标）
    │
    ├─ SLAM 位姿估计（/api/process/slam-pose）
    │     输入: IMU + 里程计 → 输出: 全局位姿(位置+朝向)
    │
    ├─ 坐标变换（/api/process/transform）
    │     局部坐标 → 全局坐标（R @ p + t）
    │
    ├─ 去噪（/api/process/pointcloud）
    │     统计离群点过滤 + 体素下采样
    │
    └─ 裂缝重建（/api/reconstruct/fractures）
          法线估计 → Poisson 重建 → RANSAC 平面分割 → Fracture JSON
          ⚠ 处理后的裂缝数据自动存入 DataStore
          后续 GET /api/fractures 返回真实数据（而非 mock）
```

### 点云去噪

```bash
curl -X POST http://localhost:8000/api/process/pointcloud \
  -F "file=@scan.ply" \
  -F "neighbors=20" \
  -F "ratio=2.0" \
  -F "voxel_size=0.05"
```

### ICP 配准

```bash
curl -X POST http://localhost:8000/api/process/register \
  -H "Content-Type: application/json" \
  -d '{"source": [[0,0,0],[1,0,0]], "target": [[0.1,0,0],[1.1,0,0]]}'
```

### 裂缝重建（从真实点云提取）

```bash
curl -X POST http://localhost:8000/api/reconstruct/fractures \
  -H "Content-Type: application/json" \
  -d '{"points": [[0,0,0],[1,0,0],...], "scenario": "coal"}'
```

### SLAM 位姿

```bash
curl -X POST http://localhost:8000/api/process/slam-pose \
  -H "Content-Type: application/json" \
  -d '{"imu_data": {"angular_velocity": [0,0,0]}, "odom_data": {"position": [1,2,3], "orientation": [0,0,0,1]}}'
```

### 坐标变换

```bash
curl -X POST http://localhost:8000/api/process/transform \
  -H "Content-Type: application/json" \
  -d '{"local_points": [[0,0,0],[1,0,0]], "pose": {"position": [10,5,-3], "quaternion": [0,0,0,1]}}'
```

## SLAM 集成

生产环境推荐替换为完整 SLAM 系统：

| 方案 | 适用 | ROS Topic |
|------|------|-----------|
| Cartographer | 激光 SLAM | `/tf` map→base_link |
| LIO-SAM | 激光惯性 | `/odometry/aft_mapped_to_init` |
| VINS-Fusion | 视觉惯性 | `/vins_estimator/odometry` |

通过 `rosbridge_suite` 或自定义网关将 ROS 位姿转发到本服务。

## 与前端对接

修改前端 `.env`：
```
VITE_API_MODE=live
VITE_API_BASE_URL=http://localhost:8000/api
```

前端自动从 mock 切换到后端。所有数据请求通过 `src/api/` 层统一路由。

## 数据流架构

```
Mock 模式（默认）:
  浏览器 → TypeScript 生成器 → 直接渲染
  （零后端依赖，适合 Demo）

Live 模式:
  浏览器 → HTTP API → 后端 → DataStore
                                    ├─ 有真实数据 → 返回处理后的裂缝/点云
                                    └─ 无真实数据 → 返回 mock 数据

真实数据注入:
  机器人点云 → POST /api/process/pointcloud → 去噪 → 存入 DataStore
                → POST /api/reconstruct/fractures → 重建 → 存入 DataStore
                → GET /api/fractures → 前端渲染真实裂缝
```
