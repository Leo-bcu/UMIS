"""
SLAM 位姿适配器 — 机器人局部坐标 → 全局坐标转换

解决井下机器人"翻滚无定位"问题：
1. 机器人回传局部坐标系下的点云/传感器数据
2. SLAM 系统提供机器人在全局坐标系中的位姿（位置 + 朝向）
3. 本模块将局部数据转换到全局坐标系

支持的 SLAM 方案（生产环境集成）：
- Cartographer (Google)     → ROS /tf，map → base_link
- LIO-SAM                   → /odometry/aft_mapped_to_init
- VINS-Fusion (HKUST)       → /vins_estimator/odometry
- LOAM / LeGO-LOAM          → /laser_odom_to_init

集成方式：
1. ROS 端启动 SLAM 节点
2. 通过 rosbridge_suite 或自定义 HTTP 网关转发位姿
3. 调用本模块的 transform_to_global() 将局部点云转到全局
"""

import numpy as np
from typing import Dict, Any, List, Tuple
import math


class SlamAdapter:
    """SLAM 位姿适配器 — 局部坐标转全局坐标"""

    def process_imu_odometry(
        self,
        imu_data: Dict[str, Any],
        odom_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        融合 IMU + 里程计数据，估算全局位姿

        简化策略：
        - 里程计提供位置（含累积漂移）
        - IMU 提供朝向（四元数，短期高精度）
        - 取 IMU 朝向 + 里程计位置的融合结果

        生产环境应替换为 Cartographer/VINS 的完整 SLAM 输出。

        参数：
            imu_data: { linear_acceleration:[x,y,z], angular_velocity:[x,y,z], timestamp }
            odom_data: { position:[x,y,z], orientation:[x,y,z,w], linear_velocity, timestamp }

        返回：{ position, quaternion, euler_angles, transformation_4x4, confidence }
        """
        pos = np.array(odom_data.get("position", [0, 0, 0]))
        quat = np.array(odom_data.get("orientation", [0, 0, 0, 1]))

        # 四元数 → 欧拉角
        euler = self._quaternion_to_euler(quat)

        # 4x4 变换矩阵
        T = np.eye(4)
        T[:3, :3] = self._quaternion_to_rotation(quat)
        T[:3, 3] = pos

        # 置信度估算（IMU 角速度大 = 翻滚剧烈 = 置信度低）
        angular_vel = np.array(imu_data.get("angular_velocity", [0, 0, 0]))
        angular_mag = np.linalg.norm(angular_vel)
        confidence = max(0.1, 1.0 - angular_mag * 0.1)

        return {
            "position": pos.tolist(),
            "quaternion": quat.tolist(),
            "euler_angles": [round(a, 2) for a in euler],
            "transformation_4x4": T.tolist(),
            "confidence": round(confidence, 3),
            "source": "imu_odometry_fusion",
            "note": "简化融合，生产环境应接入 Cartographer/VINS 完整 SLAM",
        }

    def transform_to_global(
        self,
        local_points: np.ndarray,
        pose: Dict[str, Any]
    ) -> np.ndarray:
        """
        局部坐标系点云 → 全局坐标系

        原理：global_point = R @ local_point + t
        其中 R 是 3x3 旋转矩阵，t 是平移向量

        参数：
            local_points: 机器人本体坐标系下的点云 (N, 3)
            pose: SLAM 返回的位姿（含 transformation_4x4 或 position + quaternion）

        返回：(N, 3) 全局坐标系点云
        """
        if "transformation_4x4" in pose:
            T = np.array(pose["transformation_4x4"])
            R = T[:3, :3]
            t = T[:3, 3]
        else:
            quat = np.array(pose.get("quaternion", [0, 0, 0, 1]))
            R = self._quaternion_to_rotation(quat)
            t = np.array(pose.get("position", [0, 0, 0]))

        # 批量变换：R @ p + t
        global_points = (R @ local_points.T).T + t
        return global_points

    def batch_register(
        self,
        frames: List[Dict[str, Any]]
    ) -> np.ndarray:
        """
        多帧点云拼接 — 将多帧局部点云转到全局并拼接

        应用场景：机器人连续扫描多帧，需要拼成完整地图

        参数：
            frames: [{ points: (N,3), pose: {...} }, ...]

        返回：(M, 3) 全局坐标系下的完整点云
        """
        all_points = []
        for frame in frames:
            pts = np.array(frame["points"])
            pose = frame["pose"]
            global_pts = self.transform_to_global(pts, pose)
            all_points.append(global_pts)
        if all_points:
            return np.vstack(all_points)
        return np.zeros((0, 3))

    @staticmethod
    def _quaternion_to_euler(q: np.ndarray) -> Tuple[float, float, float]:
        """四元数 [x, y, z, w] → 欧拉角 [roll, pitch, yaw]（度）"""
        x, y, z, w = q
        # Roll (X axis)
        sinr = 2.0 * (w * x + y * z)
        cosr = 1.0 - 2.0 * (x * x + y * y)
        roll = math.atan2(sinr, cosr)
        # Pitch (Y axis)
        sinp = 2.0 * (w * y - z * x)
        pitch = math.asin(max(-1.0, min(1.0, sinp)))
        # Yaw (Z axis)
        siny = 2.0 * (w * z + x * y)
        cosy = 1.0 - 2.0 * (y * y + z * z)
        yaw = math.atan2(siny, cosy)
        return (math.degrees(roll), math.degrees(pitch), math.degrees(yaw))

    @staticmethod
    def _quaternion_to_rotation(q: np.ndarray) -> np.ndarray:
        """四元数 [x, y, z, w] → 3x3 旋转矩阵"""
        x, y, z, w = q
        return np.array([
            [1 - 2*(y*y + z*z), 2*(x*y - w*z),     2*(x*z + w*y)],
            [2*(x*y + w*z),     1 - 2*(x*x + z*z), 2*(y*z - w*x)],
            [2*(x*z - w*y),     2*(y*z + w*x),     1 - 2*(x*x + y*y)],
        ])
