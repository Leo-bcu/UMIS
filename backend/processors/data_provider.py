"""
Mock 数据生成器（Python 版）

当后端没有真实数据时，生成与前端 TypeScript 版本等效的模拟数据。
当真实数据通过点云处理管线上传后，数据会被存储并由这些接口返回。

关键：这个模块确保切换 VITE_API_MODE=live 后，前端能获得与 mock 模式
相同结构的数据，而不是 404。
"""

import math
import random
import hashlib
import time
from typing import Any

# 各场景的传感器参数范围
SCENARIO_PARAMS = {
    "coal": {
        "name": "煤矿井下",
        "ch4_range": (0.1, 4.5),
        "co_range": (5, 80),
        "h2s_range": (0, 15),
        "temp_range": (18, 38),
        "stress_range": (8, 28),
        "permeability_range": (0.01, 5.0),
        "aperture_range": (30, 120),  # µm
        "rock_strength_range": (20, 60),
        "humidity_range": (60, 95),
    },
    "gold": {
        "name": "金矿井下",
        "ch4_range": (0.01, 0.5),
        "co_range": (0, 10),
        "h2s_range": (0, 5),
        "temp_range": (25, 45),
        "stress_range": (15, 45),
        "permeability_range": (0.001, 0.5),
        "aperture_range": (10, 80),
        "rock_strength_range": (80, 180),
        "humidity_range": (50, 80),
    },
    "oil": {
        "name": "油气储层",
        "ch4_range": (0.5, 15),
        "co_range": (0, 5),
        "h2s_range": (0, 50),
        "temp_range": (40, 90),
        "stress_range": (20, 60),
        "permeability_range": (0.1, 100),
        "aperture_range": (20, 200),
        "rock_strength_range": (30, 120),
        "humidity_range": (10, 40),
    },
}


def _rand(a: float, b: float) -> float:
    return random.uniform(a, b)


def _sensor_reading(scenario: str) -> dict:
    """生成传感器读数"""
    p = SCENARIO_PARAMS.get(scenario, SCENARIO_PARAMS["coal"])
    return {
        "ch4_pct": round(_rand(*p["ch4_range"]), 3),
        "co_ppm": round(_rand(*p["co_range"]), 1),
        "h2s_ppm": round(_rand(*p["h2s_range"]), 1),
        "temperature_c": round(_rand(*p["temp_range"]), 1),
        "stress_mpa": round(_rand(*p["stress_range"]), 2),
        "stress_sigma1": round(_rand(*p["stress_range"]) * 2.2, 2),
        "stress_sigma2": round(_rand(*p["stress_range"]) * 1.5, 2),
        "stress_sigma3": round(_rand(*p["stress_range"]) * 0.8, 2),
        "permeability_md": round(_rand(*p["permeability_range"]), 4),
        "water_pressure_mpa": round(_rand(0.1, 10), 2),
        "microseismic_count": random.randint(0, 50),
        "acoustic_emission_mv": round(_rand(0, 500), 1),
        "humidity_pct": round(_rand(*p["humidity_range"]), 1),
        "fracture_aperture_um": round(_rand(*p["aperture_range"]), 1),
        "displacement_mm": round(_rand(0, 5), 3),
        "rock_strength_mpa": round(_rand(*p["rock_strength_range"]), 1),
        "pore_pressure_mpa": round(_rand(1, 20), 2),
        "porosity_pct": round(_rand(0.5, 15), 2),
        "fluid_ph": round(_rand(5.5, 9.0), 2),
        "water_saturation_pct": round(_rand(10, 80), 1),
    }


def _generate_path(
    origin: list, direction: list, length: float, step_size: float
) -> list:
    """生成裂缝路径（随机游走）"""
    path = []
    pos = list(origin)
    dir_vec = list(direction)
    # 归一化方向
    mag = math.sqrt(sum(d * d for d in dir_vec))
    if mag > 0:
        dir_vec = [d / mag for d in dir_vec]

    remaining = length
    while remaining > 0:
        path.append([round(pos[0], 3), round(pos[1], 3), round(pos[2], 3)])
        # 随机扰动方向
        dir_vec = [
            dir_vec[0] + random.uniform(-0.3, 0.3),
            dir_vec[1] + random.uniform(-0.1, 0.1),
            dir_vec[2] + random.uniform(-0.3, 0.3),
        ]
        mag = math.sqrt(sum(d * d for d in dir_vec))
        if mag > 0:
            dir_vec = [d / mag for d in dir_vec]
        pos = [pos[i] + dir_vec[i] * step_size for i in range(3)]
        remaining -= step_size
    return path


def generate_fractures(scenario: str = "coal") -> list:
    """生成裂缝网络数据（与前端 fractureDataGenerator 等效）"""
    random.seed(hashlib.md5(scenario.encode()).hexdigest())

    # 6 条主裂缝入口
    entries = [
        {"origin": [-35, 18, -20], "dir": [0.3, -1, 0.2]},
        {"origin": [10, 19, -15], "dir": [-0.2, -1, -0.1]},
        {"origin": [-10, 20, 20], "dir": [0.1, -1, -0.3]},
        {"origin": [30, 18, 5], "dir": [-0.3, -1, 0.1]},
        {"origin": [-40, 19, 10], "dir": [0.2, -1, -0.2]},
        {"origin": [20, 20, -30], "dir": [-0.1, -1, 0.3]},
    ]

    fractures = []
    for i, entry in enumerate(entries):
        fid = f"F-{i+1:03d}"
        path = _generate_path(entry["origin"], entry["dir"], _rand(25, 65), _rand(0.3, 1.2))
        length = sum(
            math.sqrt(
                (path[j+1][0]-path[j][0])**2 +
                (path[j+1][1]-path[j][1])**2 +
                (path[j+1][2]-path[j][2])**2
            )
            for j in range(len(path)-1)
        )

        # 生成节点
        nodes = []
        for k, pos in enumerate(path):
            nodes.append({
                "id": f"{fid}-N{k+1:03d}",
                "position": pos,
                "sensors": _sensor_reading(scenario),
                "timestamp": int(time.time() * 1000) - random.randint(0, 300000),
                "robotId": None,
            })

        fractures.append({
            "id": fid,
            "name": f"主裂缝 {i+1}",
            "type": "main" if i < 4 else "branch",
            "path": path,
            "length": round(length, 2),
            "aperture_um": round(_rand(30, 120), 1),
            "porosity": round(_rand(0.5, 15), 2),
            "fractal_dim": round(_rand(1.2, 1.8), 3),
            "tortuosity": round(_rand(1.0, 2.5), 3),
            "dip_angle": round(_rand(10, 80), 1),
            "azimuth_angle": round(_rand(0, 360), 1),
            "roughness_coeff": round(_rand(0.05, 0.5), 3),
            "connectivity": random.randint(3, 8),
            "sensorReading": _sensor_reading(scenario),
            "nodes": nodes,
            "parentFractureId": None,
        })

        # 分支裂缝
        if i < 6:
            num_branches = random.randint(1, 3)
            for b in range(num_branches):
                branch_point = path[random.randint(max(1, len(path)//4), len(path)-1)]
                branch_dir = [
                    random.uniform(-0.8, 0.8),
                    -1,
                    random.uniform(-0.8, 0.8),
                ]
                branch_path = _generate_path(branch_point, branch_dir, _rand(8, 25), _rand(0.3, 1.0))
                bfid = f"F-{i+1:03d}-B{b+1}"

                branch_nodes = []
                for k, pos in enumerate(branch_path):
                    branch_nodes.append({
                        "id": f"{bfid}-N{k+1:03d}",
                        "position": pos,
                        "sensors": _sensor_reading(scenario),
                        "timestamp": int(time.time() * 1000) - random.randint(0, 300000),
                        "robotId": None,
                    })

                blen = sum(
                    math.sqrt(
                        (branch_path[j+1][0]-branch_path[j][0])**2 +
                        (branch_path[j+1][1]-branch_path[j][1])**2 +
                        (branch_path[j+1][2]-branch_path[j][2])**2
                    )
                    for j in range(len(branch_path)-1)
                )

                fractures.append({
                    "id": bfid,
                    "name": f"分支 {i+1}-{b+1}",
                    "type": "branch",
                    "path": branch_path,
                    "length": round(blen, 2),
                    "aperture_um": round(_rand(20, 80), 1),
                    "porosity": round(_rand(0.3, 10), 2),
                    "fractal_dim": round(_rand(1.1, 1.6), 3),
                    "tortuosity": round(_rand(1.2, 3.0), 3),
                    "dip_angle": round(_rand(5, 60), 1),
                    "azimuth_angle": round(_rand(0, 360), 1),
                    "roughness_coeff": round(_rand(0.03, 0.4), 3),
                    "connectivity": random.randint(1, 5),
                    "sensorReading": _sensor_reading(scenario),
                    "nodes": branch_nodes,
                    "parentFractureId": fid,
                })

    return fractures


def generate_scene_nodes(scenario: str = "coal") -> list:
    """生成场景树节点"""
    fractures = generate_fractures(scenario)
    nodes = []

    # 根节点
    nodes.append({
        "id": "root",
        "label": SCENARIO_PARAMS.get(scenario, {}).get("name", "地下空间"),
        "type": "root",
        "position": [0, 0, 0],
        "children": [],
    })

    # 裂缝组
    for f in fractures[:6]:
        nodes.append({
            "id": f["id"],
            "label": f["name"],
            "type": "fracture",
            "position": f["path"][0] if f["path"] else [0, 0, 0],
            "children": [n["id"] for n in f["nodes"][:5]],
        })

    return nodes


def generate_flat_geometry(count: int = 60000) -> dict:
    """生成扁平几何数据（用于 Three.js BufferGeometry 点云渲染）"""
    random.seed(42)
    positions = []
    confidences = []
    gas_values = []
    temp_values = []
    intensities = []

    for _ in range(count):
        # 在岩体范围内随机分布
        x = random.uniform(-100, 100)
        y = random.uniform(-22, 20)
        z = random.uniform(-50, 50)

        # 靠近裂缝的密度更高
        if random.random() < 0.3:
            x += random.uniform(-5, 5)
            y += random.uniform(-3, 3)

        positions.extend([round(x, 3), round(y, 3), round(z, 3)])
        confidences.append(round(random.uniform(0.3, 1.0), 4))
        gas_values.append(round(random.uniform(0, 4.5), 4))
        temp_values.append(round(random.uniform(15, 40), 4))
        intensities.append(round(random.uniform(0, 1), 4))

    return {
        "positions": positions,
        "confidences": confidences,
        "gasValues": gas_values,
        "tempValues": temp_values,
        "intensities": intensities,
        "count": count,
    }


def generate_robots(count: int = 200) -> list:
    """生成机器人集群数据"""
    random.seed(99)
    robots = []
    models = ["snake", "tracked", "wheeled", "climbing", "aerial", "spider"]
    statuses = ["online", "offline", "low_battery", "error", "maintenance"]
    mesh_roles = ["gateway", "relay", "edge", "leaf"]
    status_weights = [0.68, 0.08, 0.12, 0.05, 0.07]
    tasks = ["裂缝巡检", "气体采样", "Mesh 中继", "点云扫描", "回充待命", "异常复核"]

    for i in range(count):
        rid = f"R-{i+1:03d}"
        status = random.choices(statuses, weights=status_weights)[0]
        battery = random.randint(8, 100)
        if battery < 20 and status == "online":
            status = "low_battery"
        mesh_connected = random.random() > 0.08 and status != "offline"
        robots.append({
            "id": rid,
            "model": random.choices(models, weights=[0.32, 0.2, 0.12, 0.12, 0.08, 0.16])[0],
            "status": status,
            "meshRole": random.choices(mesh_roles, weights=[0.08, 0.28, 0.34, 0.3])[0],
            "meshConnected": mesh_connected,
            "position": [
                round(random.uniform(-90, 90), 2),
                round(random.uniform(-20, 18), 2),
                round(random.uniform(-40, 40), 2),
            ],
            "battery": battery,
            "signalStrength": random.randint(-92, -45),
            "task": random.choice(tasks),
            "depth": round(random.uniform(5, 40), 1),
            "sensors": {
                "ch4": round(random.uniform(0, 4), 2),
                "temperature": round(random.uniform(15, 45), 1),
                "humidity": round(random.uniform(45, 96), 1),
            },
            "lastUpdate": int(time.time() * 1000) - random.randint(0, 30000),
        })

    return robots


def generate_pois(scenario: str = "coal") -> list:
    """生成兴趣点"""
    fractures = generate_fractures(scenario)
    pois = []

    # 裂缝入口
    for i, f in enumerate(fractures[:6]):
        pois.append({
            "id": f"POI-ENTRY-{i+1}",
            "label": f"裂缝入口 {i+1}",
            "type": "entry",
            "position": f["path"][0] if f["path"] else [0, 0, 0],
            "description": f"{f['name']} 地表入口",
        })

    # 危险区域
    for i in range(3):
        pois.append({
            "id": f"POI-DANGER-{i+1}",
            "label": f"高瓦斯区域 {i+1}",
            "type": "danger",
            "position": [
                round(random.uniform(-60, 60), 1),
                round(random.uniform(-15, 10), 1),
                round(random.uniform(-30, 30), 1),
            ],
            "description": "瓦斯浓度持续偏高，建议加强通风",
        })

    # 传感器站点
    for i in range(5):
        pois.append({
            "id": f"POI-SENSOR-{i+1}",
            "label": f"监测站 {i+1}",
            "type": "sensor",
            "position": [
                round(random.uniform(-80, 80), 1),
                round(random.uniform(-18, 15), 1),
                round(random.uniform(-35, 35), 1),
            ],
            "description": "固定式多参数传感器站",
        })

    return pois


def generate_alerts() -> list:
    """生成告警事件"""
    robots = generate_robots()
    random.seed(123)
    alerts = []
    levels = ["danger", "warning", "info"]
    level_weights = [0.15, 0.45, 0.4]
    sources = ["gas", "seismic", "structural", "thermal", "displacement"]
    descs = {
        "gas": "瓦斯浓度超限",
        "seismic": "微震活动异常",
        "structural": "结构应力变化",
        "thermal": "温度异常升高",
        "displacement": "位移变形监测",
    }

    for i in range(20):
        robot = random.choice(robots)
        source = random.choice(sources)
        level = random.choices(levels, weights=level_weights)[0]
        alerts.append({
            "id": f"ALT-{i+1:04d}",
            "robotId": robot["id"],
            "level": level,
            "type": "gas_overload" if source == "gas" else "temp_anomaly" if source == "thermal" else "system",
            "title": descs[source],
            "description": f"{robot['id']} 在 [{robot['position'][0]:.1f}, {robot['position'][1]:.1f}] 报告{descs[source]}",
            "value": round(random.uniform(0.5, 5.0), 2),
            "threshold": round(random.uniform(1.0, 3.0), 2),
            "position": robot["position"],
            "timestamp": int(time.time() * 1000) - random.randint(0, 3600000),
            "acknowledged": False,
        })

    alerts.sort(key=lambda a: a["timestamp"], reverse=True)
    return alerts


def get_scene_stats(scenario: str = "coal") -> dict:
    """场景统计"""
    fractures = generate_fractures(scenario)
    robots = generate_robots()
    active_robots = sum(1 for r in robots if r["status"] == "online")
    alerts = generate_alerts()
    critical = sum(1 for a in alerts if a["level"] == "danger")

    return {
        "fractureCount": len(fractures),
        "robotTotal": len(robots),
        "robotActive": active_robots,
        "alertCount": len(alerts),
        "criticalAlerts": critical,
        "scenario": scenario,
        "lastUpdate": int(time.time() * 1000),
    }


# ==================== 真实数据存储 ====================

class DataStore:
    """
    真实数据存储。

    当机器人数据通过点云处理管线上传后，处理结果存到这里。
    数据提供接口会优先返回真实数据，否则返回 mock。
    """

    def __init__(self):
        self._fractures: dict[str, list] = {}  # scenario → fractures
        self._pointcloud: list = []
        self._has_real_data = False

    def set_fractures(self, scenario: str, fractures: list):
        """存储从真实点云重建的裂缝数据"""
        self._fractures[scenario] = fractures
        self._has_real_data = True

    def set_pointcloud(self, points: list):
        """存储去噪后的点云"""
        self._pointcloud = points

    def get_fractures(self, scenario: str) -> list | None:
        return self._fractures.get(scenario)

    @property
    def has_real_data(self) -> bool:
        return self._has_real_data


# 全局单例
data_store = DataStore()
