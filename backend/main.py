"""
井下数字孪生后端服务

两个职责：
1. 数据提供 — 匹配前端 API_CONTRACT.md 定义的全部 REST 接口
2. 点云处理 — Open3D 去噪/ICP配准/Poisson重建/RANSAC裂缝提取/SLAM适配

启动：
    cd backend
    pip install -r requirements.txt
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload

前端切换到 live 模式：
    修改 .env: VITE_API_MODE=live, VITE_API_BASE_URL=http://localhost:8000/api
"""

import traceback
import shutil
import subprocess
import tempfile
import os
import numpy as np
from typing import List, Optional
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from monitor_image_store import ensure_monitor_image_store_ready, serve_monitor_frame

from processors.pointcloud_processor import PointCloudProcessor
from processors.slam_adapter import SlamAdapter
from processors.data_provider import (
    generate_fractures,
    generate_scene_nodes,
    generate_flat_geometry,
    generate_robots,
    generate_pois,
    generate_alerts,
    get_scene_stats,
    data_store,
)

app = FastAPI(
    title="井下数字孪生后端",
    description="数据提供 + 点云处理 + 裂缝重建",
    version="2.0.0",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 初始化处理器
pc_processor = PointCloudProcessor()
slam_adapter = SlamAdapter()
ensure_monitor_image_store_ready()

# Potree 八叉树输出目录
POTREE_OUTPUT_DIR = Path(__file__).parent / "potree_output"
POTREE_OUTPUT_DIR.mkdir(exist_ok=True)

# 挂载 Potree 静态文件服务（前端 PotreeViewer 加载 octree tiles）
if (POTREE_OUTPUT_DIR / "pointcloud").exists():
    app.mount("/api/potree", StaticFiles(directory=str(POTREE_OUTPUT_DIR / "pointcloud")), name="potree")
else:
    POTREE_OUTPUT_DIR.joinpath("pointcloud").mkdir(parents=True, exist_ok=True)
    app.mount("/api/potree", StaticFiles(directory=str(POTREE_OUTPUT_DIR / "pointcloud")), name="potree")


# ====================================================================
# 第一部分：数据提供接口（匹配前端 API_CONTRACT.md）
# ====================================================================

@app.get("/api/fractures")
async def get_fractures(scenario: str = Query("coal")):
    """
    GET /api/fractures?scenario=coal|gold|oil
    返回 Fracture[] — 裂缝网络数据

    优先返回真实数据（通过点云处理管线上传的），
    否则返回 mock 数据。
    """
    real = data_store.get_fractures(scenario)
    if real:
        return real
    return generate_fractures(scenario)


@app.get("/api/fractures/{fracture_id}")
async def get_fracture_by_id(fracture_id: str, scenario: str = Query("coal")):
    """GET /api/fractures/:id — 单条裂缝详情"""
    real = data_store.get_fractures(scenario)
    fractures = real if real else generate_fractures(scenario)
    for f in fractures:
        if f["id"] == fracture_id:
            return f
    raise HTTPException(404, f"裂缝 {fracture_id} 不存在")


@app.get("/api/scene/nodes")
async def get_scene_nodes(scenario: str = Query("coal")):
    """GET /api/scene/nodes → SceneNode[]"""
    return generate_scene_nodes(scenario)


@app.get("/api/scene/geometry")
async def get_scene_geometry():
    """
    GET /api/scene/geometry → FlatGeometryData
    返回点云的扁平几何数据（positions, confidences, gasValues, ...）
    """
    return generate_flat_geometry(60000)


@app.get("/api/scene/stats")
async def get_scene_stats_endpoint(scenario: str = Query("coal")):
    """GET /api/scene/stats → SceneStats"""
    return get_scene_stats(scenario)


@app.get("/api/robots")
async def get_robots(
    status: Optional[str] = Query(None),
    model: Optional[str] = Query(None),
    mesh_role: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
):
    """GET /api/robots → Robot[]（支持过滤）"""
    robots = generate_robots()
    if q:
        robots = [r for r in robots if q.lower() in r["id"].lower()]
    if status and status != "all":
        robots = [r for r in robots if r["status"] == status]
    if model and model != "all":
        robots = [r for r in robots if r["model"] == model]
    if mesh_role and mesh_role != "all":
        robots = [r for r in robots if r["meshRole"] == mesh_role]
    return robots


@app.get("/api/robots/{robot_id}")
async def get_robot_by_id(robot_id: str):
    """GET /api/robots/:id → Robot"""
    robots = generate_robots()
    for r in robots:
        if r["id"] == robot_id:
            return r
    raise HTTPException(404, f"机器人 {robot_id} 不存在")


@app.get("/api/robots/stats")
async def get_robot_stats():
    """GET /api/robots/stats → RobotFleetStats"""
    robots = generate_robots()
    return {
        "total": len(robots),
        "online": sum(1 for r in robots if r["status"] == "online"),
        "offline": sum(1 for r in robots if r["status"] == "offline"),
        "lowBattery": sum(1 for r in robots if r["status"] == "low_battery"),
        "error": sum(1 for r in robots if r["status"] == "error"),
        "maintenance": sum(1 for r in robots if r["status"] == "maintenance"),
        "meshConnected": sum(1 for r in robots if r["meshConnected"]),
        "avgBattery": round(sum(r["battery"] for r in robots) / len(robots), 1),
    }


@app.get("/api/pois")
async def get_pois(scenario: str = Query("coal")):
    """GET /api/pois → POI[]"""
    return generate_pois(scenario)


@app.get("/api/alerts")
async def get_alerts(level: Optional[str] = Query(None)):
    """GET /api/alerts → AlertEvent[]"""
    alerts = generate_alerts()
    if level:
        alerts = [a for a in alerts if a["level"] == level]
    return alerts


@app.get("/api/health")
async def health():
    """健康检查"""
    return {
        "status": "ok",
        "service": "HIVE-backend",
        "version": "2.0.0",
        "open3d_available": pc_processor.o3d is not None,
        "has_real_data": data_store.has_real_data,
    }


@app.get("/api/monitors/{monitor_id}/frame/{frame_index}")
async def get_monitor_frame(monitor_id: str, frame_index: int):
    return serve_monitor_frame(monitor_id, frame_index)


# ====================================================================
# 第二部分：点云处理接口（Open3D）
# ====================================================================

class RegisterRequest(BaseModel):
    source: List[List[float]]
    target: List[List[float]]
    max_iter: int = 50
    threshold: float = 0.05


class FractureRequest(BaseModel):
    points: List[List[float]]
    scenario: str = "coal"
    voxel_size: float = 0.05
    poisson_depth: int = 8


class SlamPoseRequest(BaseModel):
    imu_data: dict
    odom_data: dict


class TransformRequest(BaseModel):
    local_points: List[List[float]]
    pose: dict


@app.post("/api/process/pointcloud")
async def process_pointcloud(
    file: UploadFile = File(...),
    neighbors: int = Query(20, description="去噪近邻数"),
    ratio: float = Query(2.0, description="标准差倍率"),
    voxel_size: float = Query(0.05, description="体素大小（米）"),
):
    """
    点云去噪 — 上传 .ply/.las/.xyz/.pcd，返回去噪后点云

    处理后的点云会存入 data_store，后续 GET /api/scene/geometry 会返回这些点
    """
    try:
        raw_bytes = await file.read()
        points = _parse_pointcloud(raw_bytes, file.filename)
        original_count = len(points)

        if original_count == 0:
            raise HTTPException(400, "点云文件为空或解析失败")

        # ① 去噪
        clean_points, denoise_stats = pc_processor.denoise(points, neighbors, ratio)

        # ② 体素下采样
        ds_points, ds_stats = pc_processor.voxel_downsample(clean_points, voxel_size)

        # 存储去噪后的点云
        ds_list = ds_points.tolist()
        data_store.set_pointcloud(ds_list)

        return {
            "status": "ok",
            "filename": file.filename,
            "denoise": denoise_stats,
            "downsample": ds_stats,
            "points": ds_list,
            "point_count": len(ds_list),
        }
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, f"处理失败: {str(e)}")


@app.post("/api/process/register")
async def register_pointclouds(req: RegisterRequest):
    """ICP 配准 — 将源点云对齐到目标点云"""
    try:
        source = np.array(req.source)
        target = np.array(req.target)
        result = pc_processor.icp_register(source, target, req.threshold, req.max_iter)
        return {"status": "ok", "result": result}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, f"ICP 配准失败: {str(e)}")


@app.post("/api/reconstruct/fractures")
async def reconstruct_fractures(req: FractureRequest):
    """
    裂缝重建 — 从点云提取裂缝网络

    完整管线：去噪 → 法线估计 → Poisson 重建 → RANSAC 平面分割 → Fracture JSON

    处理后的裂缝数据会存入 data_store，后续 GET /api/fractures 会返回这些真实数据
    """
    try:
        points = np.array(req.points)
        fractures = pc_processor.extract_fracture_network(
            points, req.scenario, req.voxel_size, req.poisson_depth
        )

        # 存储真实裂缝数据 — 这之后 GET /api/fractures 就会返回真实数据
        data_store.set_fractures(req.scenario, fractures)

        return {
            "status": "ok",
            "input_points": len(points),
            "fracture_count": len(fractures),
            "fractures": fractures,
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, f"裂缝重建失败: {str(e)}")


@app.post("/api/process/slam-pose")
async def process_slam_pose(req: SlamPoseRequest):
    """
    SLAM 位姿适配 — 融合 IMU + 里程计，输出全局位姿

    生产环境应替换为 Cartographer/VINS-Fusion 完整 SLAM 输出
    """
    try:
        pose = slam_adapter.process_imu_odometry(req.imu_data, req.odom_data)
        return {"status": "ok", "pose": pose}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, f"SLAM 位姿处理失败: {str(e)}")


@app.post("/api/process/transform")
async def transform_points(req: TransformRequest):
    """坐标变换 — 将机器人局部坐标系点云转到全局坐标系"""
    try:
        local = np.array(req.local_points)
        global_pts = slam_adapter.transform_to_global(local, req.pose)
        return {
            "status": "ok",
            "point_count": len(global_pts),
            "points": global_pts.tolist(),
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, f"坐标变换失败: {str(e)}")


# ====================================================================
# 第三部分：Potree 八叉树转换接口
# ====================================================================

def _find_potree_converter() -> Optional[str]:
    """查找 PotreeConverter 二进制路径"""
    # 检查环境变量
    env_path = os.environ.get("POTREE_CONVERTER_PATH")
    if env_path and os.path.isfile(env_path):
        return env_path
    # 检查 PATH
    return shutil.which("PotreeConverter")


@app.post("/api/potree/convert")
async def convert_to_potree(
    file: UploadFile = File(...),
):
    """
    将上传的点云文件转换为 Potree 八叉树 LOD 格式

    前端 PotreeViewer 在 live 模式下从 /api/potree/cloud.js 加载转换后的数据。
    需要在服务器上安装 PotreeConverter（https://github.com/potree/PotreeConverter）。

    环境变量 POTREE_CONVERTER_PATH 可指定二进制路径。
    """
    converter = _find_potree_converter()
    if not converter:
        raise HTTPException(
            503,
            "PotreeConverter 未安装。请在服务器上安装 PotreeConverter "
            "并设置环境变量 POTREE_CONVERTER_PATH，"
            "或将其加入 PATH。"
            "安装指南: https://github.com/potree/PotreeConverter"
        )

    raw_bytes = await file.read()
    suffix = os.path.splitext(file.filename or ".ply")[1]

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp_in:
        tmp_in.write(raw_bytes)
        tmp_in_path = tmp_in.name

    output_dir = POTREE_OUTPUT_DIR / "pointcloud"
    # 清空旧数据
    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True)

    try:
        result = subprocess.run(
            [converter, tmp_in_path, "-o", str(output_dir),
             "--generate-page", "index"],
            capture_output=True, text=True, timeout=300
        )

        if result.returncode != 0:
            raise HTTPException(
                500,
                f"PotreeConverter 执行失败: {result.stderr[:500]}"
            )

        return {
            "status": "ok",
            "message": "点云已转换为 Potree 八叉树格式",
            "url": "/api/potree/cloud.js",
            "stderr": result.stderr[:200] if result.stderr else "",
        }
    except subprocess.TimeoutExpired:
        raise HTTPException(504, "PotreeConverter 转换超时（300秒限制）")
    finally:
        os.unlink(tmp_in_path)


@app.get("/api/potree/status")
async def potree_status():
    """检查 PotreeConverter 是否可用及是否已有点云数据"""
    output_dir = POTREE_OUTPUT_DIR / "pointcloud"
    cloud_js = output_dir / "cloud.js"
    return {
        "converter_available": _find_potree_converter() is not None,
        "has_pointcloud": cloud_js.exists(),
        "cloud_url": "/api/potree/cloud.js" if cloud_js.exists() else None,
    }


# ====================================================================
# 辅助函数
# ====================================================================

def _parse_pointcloud(raw_bytes: bytes, filename: str) -> np.ndarray:
    """解析上传的点云文件（支持 .ply/.pcd/.xyz/.las/.json）"""
    if pc_processor.o3d is not None:
        import tempfile, os
        suffix = os.path.splitext(filename)[1]
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
            f.write(raw_bytes)
            tmp_path = f.name
        try:
            if suffix in (".ply", ".pcd"):
                pcd = pc_processor.o3d.io.read_point_cloud(tmp_path)
                return np.asarray(pcd.points)
        finally:
            os.unlink(tmp_path)

    # 降级：尝试解析 JSON
    try:
        import json
        text = raw_bytes.decode("utf-8")
        data = json.loads(text)
        if isinstance(data, list):
            return np.array(data)
    except Exception:
        pass

    # XYZ 格式
    try:
        lines = raw_bytes.decode("utf-8").strip().split("\n")
        points = []
        for line in lines:
            parts = line.strip().split()
            if len(parts) >= 3:
                points.append([float(parts[0]), float(parts[1]), float(parts[2])])
        return np.array(points) if points else np.zeros((0, 3))
    except Exception:
        return np.zeros((0, 3))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
