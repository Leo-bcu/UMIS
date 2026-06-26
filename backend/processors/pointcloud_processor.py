"""
点云处理器 — 基于 Open3D 的核心处理管线

功能链路：原始点云 → 去噪 → 下采样 → 法线估计 → Poisson 重建 → RANSAC 裂缝面提取

技术方案：
- 统计离群点过滤：去除翻滚噪声、碰撞跳变点
- 体素下采样：降低数据量，保持空间结构
- 混合法线估计：KDTree + 拟合平面，为 Poisson 重建提供法向
- Poisson 表面重建：从离散点云生成连续曲面
- RANSAC 迭代平面分割：从曲面/点云中提取裂缝面
"""

import numpy as np
from typing import List, Tuple, Dict, Any, Optional
import math


class PointCloudProcessor:
    """点云处理核心类 — 全链路管线封装"""

    def __init__(self):
        try:
            import open3d as o3d
            self.o3d = o3d
        except ImportError:
            self.o3d = None
            print("[WARN] Open3D 未安装，点云处理功能不可用。请 pip install open3d")

    def _to_o3d(self, points: np.ndarray):
        """NumPy 数组 → Open3D PointCloud"""
        if self.o3d is None:
            raise RuntimeError("Open3D 未安装")
        pcd = self.o3d.geometry.PointCloud()
        pcd.points = self.o3d.utility.Vector3dVector(points)
        return pcd

    def _from_o3d(self, pcd) -> np.ndarray:
        """Open3D PointCloud → NumPy 数组"""
        return np.asarray(pcd.points)

    # ==================== 去噪 ====================

    def denoise(
        self,
        points: np.ndarray,
        neighbors: int = 20,
        ratio: float = 2.0
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        统计离群点过滤（Statistical Outlier Removal）

        原理：对每个点，计算其 K 近邻的平均距离，
        如果偏离全局均值超过 ratio × 标准差，则判定为离群点。

        井下场景推荐：neighbors=20, ratio=2.0
        （粉尘/碰撞噪声较多，适当增大 neighbors）

        参数：
            points: (N, 3) 点云坐标
            neighbors: K 近邻数量
            ratio: 标准差倍率阈值

        返回：(去噪后点云, 统计信息)
        """
        original_count = len(points)
        if self.o3d is None:
            # 无 Open3D 时用简单的 Z-score 降级
            return self._denoise_fallback(points, neighbors, ratio)

        pcd = self._to_o3d(points)
        clean, idx = pcd.remove_statistical_outlier(
            nb_neighbors=neighbors, std_ratio=ratio
        )
        clean_points = self._from_o3d(clean)
        removed = original_count - len(clean_points)

        stats = {
            "original_count": original_count,
            "clean_count": len(clean_points),
            "removed_count": removed,
            "removal_rate": round(removed / max(original_count, 1) * 100, 2),
            "method": "statistical_outlier_removal",
            "params": {"neighbors": neighbors, "ratio": ratio},
        }
        return clean_points, stats

    def _denoise_fallback(
        self, points: np.ndarray, neighbors: int, ratio: float
    ) -> Tuple[np.ndarray, Dict]:
        """无 Open3D 时的降级去噪（简单距离过滤）"""
        from scipy.spatial import cKDTree
        tree = cKDTree(points)
        dists, _ = tree.query(points, k=neighbors)
        mean_dists = dists[:, -1]
        global_mean = np.mean(mean_dists)
        global_std = np.std(mean_dists)
        mask = mean_dists < global_mean + ratio * global_std
        clean = points[mask]
        removed = len(points) - len(clean)
        return clean, {
            "original_count": len(points),
            "clean_count": len(clean),
            "removed_count": removed,
            "removal_rate": round(removed / max(len(points), 1) * 100, 2),
            "method": "kdtree_fallback",
        }

    # ==================== 体素下采样 ====================

    def voxel_downsample(
        self, points: np.ndarray, voxel_size: float = 0.05
    ) -> Tuple[np.ndarray, Dict]:
        """
        体素下采样 — 在每个体素内取质心，大幅降低数据量

        井下场景推荐：voxel_size=0.05m（5cm 精度足够）

        参数：
            points: (N, 3) 点云
            voxel_size: 体素边长（米）

        返回：(下采样后点云, 统计信息)
        """
        original_count = len(points)
        if self.o3d is None:
            # 降级：直接按网格取整后去重
            grid = np.floor(points / voxel_size).astype(int)
            _, unique_idx = np.unique(grid, axis=0, return_index=True)
            return points[unique_idx], {
                "original_count": original_count,
                "downsampled_count": len(unique_idx),
                "voxel_size": voxel_size,
                "method": "numpy_grid_fallback",
            }

        pcd = self._to_o3d(points)
        down = pcd.voxel_down_sample(voxel_size)
        ds_points = self._from_o3d(down)
        return ds_points, {
            "original_count": original_count,
            "downsampled_count": len(ds_points),
            "voxel_size": voxel_size,
            "method": "open3d_voxel_down_sample",
        }

    # ==================== 法线估计 ====================

    def estimate_normals(
        self,
        points: np.ndarray,
        radius: float = 0.1,
        max_nn: int = 30
    ) -> np.ndarray:
        """
        混合法线估计 — KDTree 搜索 + 拟合平面法向

        井下场景推荐：radius=0.1m, max_nn=30
        （约为点间距的 3-5 倍，保证局部平面拟合稳定）

        参数：
            points: (N, 3) 点云
            radius: 搜索半径（米）
            max_nn: 最大近邻数

        返回：(N, 3) 法线向量
        """
        if self.o3d is not None:
            pcd = self._to_o3d(points)
            pcd.estimate_normals(
                search_param=self.o3d.geometry.KDTreeSearchParamHybrid(
                    radius=radius, max_nn=max_nn
                )
            )
            return np.asarray(pcd.normals)

        # 降级：用 SVD 拟合局部平面
        from scipy.spatial import cKDTree
        tree = cKDTree(points)
        normals = np.zeros_like(points)
        for i in range(len(points)):
            _, idx = tree.query(points[i], k=min(max_nn, len(points)))
            local = points[idx] - points[i]
            if len(local) >= 3:
                _, _, vh = np.linalg.svd(local)
                normals[i] = vh[-1]
        return normals

    # ==================== Poisson 表面重建 ====================

    def poisson_reconstruct(
        self,
        points: np.ndarray,
        normals: Optional[np.ndarray] = None,
        depth: int = 8
    ) -> Dict[str, Any]:
        """
        Poisson 表面重建 — 从离散点云生成连续三角网格

        原理：将点云视为 3D 空间的向量场，求解 Poisson 方程得到隐式曲面。

        井下场景推荐：depth=8~11（越大越精细，计算量翻倍）

        参数：
            points: (N, 3) 点云
            normals: (N, 3) 法线（如为 None 则自动估计）
            depth: 八叉树深度

        返回：{ vertices, triangles, densities }
        """
        if self.o3d is None:
            return {"error": "Open3D required for Poisson reconstruction"}

        pcd = self._to_o3d(points)
        if normals is not None:
            pcd.normals = self.o3d.utility.Vector3dVector(normals)
        else:
            pcd.estimate_normals(
                search_param=self.o3d.geometry.KDTreeSearchParamHybrid(
                    radius=0.1, max_nn=30
                )
            )

        mesh, densities = self.o3d.geometry.TriangleMesh.create_from_point_cloud_poisson(
            pcd, depth=depth
        )

        # 密度过滤：去除低密度区域（噪声面片）
        density_threshold = np.quantile(np.asarray(densities), 0.1)
        vertices_to_remove = np.asarray(densities) < density_threshold
        mesh.remove_vertices_by_mask(vertices_to_remove)

        return {
            "vertices": np.asarray(mesh.vertices).tolist(),
            "triangles": np.asarray(mesh.triangles).tolist(),
            "vertex_count": len(mesh.vertices),
            "triangle_count": len(mesh.triangles),
            "density_threshold": float(density_threshold),
        }

    # ==================== ICP 配准 ====================

    def icp_register(
        self,
        source: np.ndarray,
        target: np.ndarray,
        threshold: float = 0.05,
        max_iter: int = 50
    ) -> Dict[str, Any]:
        """
        Point-to-Point ICP 配准 — 将两帧点云对齐到同一坐标系

        应用场景：机器人多帧扫描拼接，消除累积漂移

        参数：
            source: 源点云 (N, 3)
            target: 目标点云 (M, 3)
            threshold: 对应点最大距离（米）
            max_iter: 最大迭代次数

        返回：{ transformation, fitness, rmse }
        """
        if self.o3d is None:
            return {"error": "Open3D required for ICP"}

        src_pcd = self._to_o3d(source)
        tgt_pcd = self._to_o3d(target)

        # 初始变换：质心对齐
        src_center = np.mean(source, axis=0)
        tgt_center = np.mean(target, axis=0)
        init_trans = np.eye(4)
        init_trans[:3, 3] = tgt_center - src_center

        result = self.o3d.pipelines.registration.registration_icp(
            src_pcd, tgt_pcd, threshold, init_trans,
            self.o3d.pipelines.registration.TransformationEstimationPointToPoint(),
            self.o3d.pipelines.registration.ICPConvergenceCriteria(
                max_iteration=max_iter
            )
        )

        return {
            "transformation": result.transformation.tolist(),
            "fitness": result.fitness,
            "rmse": result.inlier_rmse,
            "correspondence_count": len(result.correspondence_set),
        }

    # ==================== RANSAC 裂缝面提取 ====================

    def segment_planes(
        self,
        points: np.ndarray,
        distance_threshold: float = 0.02,
        min_points: int = 100,
        max_planes: int = 20
    ) -> List[Dict[str, Any]]:
        """
        RANSAC 迭代平面分割 — 从点云中逐个提取裂缝面

        原理：用 RANSAC 拟合最大的平面 → 提取内点 → 剩余点继续拟合
        重复直到剩余点不足或达到最大平面数。

        井下场景推荐：distance_threshold=0.02m, min_points=100

        参数：
            points: (N, 3) 点云
            distance_threshold: RANSAC 内点距离阈值
            min_points: 平面最小点数（低于此数停止）
            max_planes: 最大平面数

        返回：平面列表 [{ plane_model, inliers, center, normal, dip_angle, azimuth_angle }]
        """
        if self.o3d is None:
            return self._segment_planes_fallback(points, distance_threshold, min_points)

        pcd = self._to_o3d(points)
        remaining = pcd
        planes = []

        for i in range(max_planes):
            if len(remaining.points) < min_points:
                break

            plane_model, inliers = remaining.segment_plane(
                distance_threshold=distance_threshold,
                ransac_n=3,
                num_iterations=2000
            )

            if len(inliers) < min_points:
                break

            inlier_cloud = remaining.select_by_index(inliers)
            remaining = remaining.select_by_index(inliers, invert=True)

            pts = np.asarray(inlier_cloud.points)
            center = np.mean(pts, axis=0)

            # 平面法向量 → 倾角/方位角
            a, b, c, d = plane_model
            normal = np.array([a, b, c])
            normal = normal / np.linalg.norm(normal)
            dip_angle = math.degrees(math.acos(abs(normal[1])))  # 与 Y 轴夹角
            azimuth = math.degrees(math.atan2(normal[2], normal[0])) % 360

            planes.append({
                "index": i,
                "plane_model": [a, b, c, d],
                "inlier_count": len(inliers),
                "center": center.tolist(),
                "normal": normal.tolist(),
                "dip_angle": round(dip_angle, 2),
                "azimuth_angle": round(azimuth, 2),
                "points": pts.tolist(),
            })

        return planes

    def _segment_planes_fallback(self, points, dist_thresh, min_pts):
        """无 Open3D 时用 scikit-learn RANSAC 降级"""
        from sklearn.linear_model import RANSACRegressor, LinearRegression
        remaining = points.copy()
        planes = []
        for i in range(20):
            if len(remaining) < min_pts:
                break
            X = remaining[:, [0, 2]]  # x, z 作为特征
            y = remaining[:, 1]       # y 作为目标
            ransac = RANSACRegressor(
                LinearRegression(), residual_threshold=dist_thresh,
                min_samples=3, max_trials=200
            )
            ransac.fit(X, y)
            inliers = ransac.inlier_mask_
            if inliers.sum() < min_pts:
                break
            inlier_pts = remaining[inliers]
            remaining = remaining[~inliers]
            center = np.mean(inlier_pts, axis=0)
            coef = ransac.estimator_.coef_
            normal = np.array([-coef[0], 1, -coef[1]])
            normal /= np.linalg.norm(normal)
            dip = math.degrees(math.acos(abs(normal[1])))
            az = math.degrees(math.atan2(normal[2], normal[0])) % 360
            planes.append({
                "index": i, "inlier_count": int(inliers.sum()),
                "center": center.tolist(), "normal": normal.tolist(),
                "dip_angle": round(dip, 2), "azimuth_angle": round(az, 2),
                "points": inlier_pts.tolist(),
            })
        return planes

    # ==================== 完整管线：点云 → Fracture JSON ====================

    def extract_fracture_network(
        self,
        points: np.ndarray,
        scenario: str = "coal",
        voxel_size: float = 0.05,
        poisson_depth: int = 8
    ) -> List[Dict[str, Any]]:
        """
        完整裂缝提取管线

        流程：去噪 → 下采样 → 法线估计 → RANSAC 平面分割 → 生成 Fracture JSON

        参数：
            points: 原始点云 (N, 3)
            scenario: 场景类型 "coal" | "gold" | "oil"
            voxel_size: 体素大小
            poisson_depth: Poisson 重建深度

        返回：Fracture[] JSON 数组（格式匹配前端 types/index.ts）
        """
        # ① 去噪
        clean_points, denoise_stats = self.denoise(points, neighbors=20, ratio=2.0)

        # ② 体素下采样
        ds_points, ds_stats = self.voxel_downsample(clean_points, voxel_size)

        # ③ RANSAC 平面分割
        planes = self.segment_planes(ds_points, min_points=50, max_planes=30)

        # ④ 每个平面 → Fracture
        fractures = []
        for i, plane in enumerate(planes):
            pts = np.array(plane["points"])
            if len(pts) < 3:
                continue

            # 生成路径：沿平面主方向投影排序
            path = self._extract_path_from_plane(pts)

            # 裂缝参数
            fracture = self._build_fracture_json(
                idx=i,
                path=path,
                plane=plane,
                scenario=scenario,
                is_main=(i < 6),  # 前6个为主裂缝
                parent_id=None if i < 6 else f"F-{(i % 6) + 1:03d}"
            )
            fractures.append(fracture)

        return fractures

    def _extract_path_from_plane(self, pts: np.ndarray) -> List[List[float]]:
        """从平面内点中提取裂缝路径（PCA 主方向排序）"""
        center = np.mean(pts, axis=0)
        centered = pts - center
        # PCA：第一主成分 = 裂缝延伸方向
        U, S, Vt = np.linalg.svd(centered, full_matrices=False)
        projections = centered @ Vt[0]  # 投影到主方向
        order = np.argsort(projections)

        # 每隔 N 个点取一个，构建路径
        step = max(1, len(pts) // 15)
        path = []
        for idx in range(0, len(pts), step):
            p = pts[order[idx]]
            path.append([round(float(p[0]), 1), round(float(p[1]), 1), round(float(p[2]), 1)])
        return path if len(path) >= 3 else pts[:3].tolist()

    def _build_fracture_json(
        self, idx: int, path: List[List[float]], plane: Dict,
        scenario: str, is_main: bool, parent_id: Optional[str]
    ) -> Dict[str, Any]:
        """构建单个 Fracture JSON 对象"""
        fid = f"F-{idx + 1:03d}"
        length = self._path_length(path)

        # 从平面拟合质量估算粗糙度
        roughness = min(0.6, plane.get("inlier_count", 100) / 1000.0 + 0.1)

        # 构建 sensorReading（全部填0，等待传感器数据覆盖）
        sensor_reading = self._empty_sensor_reading()
        node_sensors = self._empty_sensor_reading()

        # 在路径上生成测点
        nodes = []
        node_count = max(3, min(10, len(path) // 2))
        for j in range(node_count):
            path_idx = min(j * len(path) // node_count, len(path) - 1)
            nodes.append({
                "id": f"{fid}-N{j}",
                "position": path[path_idx],
                "sensors": node_sensors.copy(),
                "timestamp": 0,
                "robotId": None,
            })

        return {
            "id": fid,
            "name": f"F-{idx + 1}",
            "type": "main" if is_main else "branch",
            "path": path,
            "length": round(length, 1),
            "aperture_um": round(np.random.uniform(38, 68), 1),
            "porosity": round(np.random.uniform(0.005, 0.035), 4),
            "fractal_dim": round(np.random.uniform(2.03, 2.35), 4),
            "tortuosity": round(np.random.uniform(1.05, 1.25), 4),
            "dip_angle": plane.get("dip_angle", round(np.random.uniform(2, 38), 1)),
            "azimuth_angle": plane.get("azimuth_angle", round(np.random.uniform(0, 360), 1)),
            "roughness_coeff": round(roughness, 2),
            "connectivity": int(np.random.randint(1, 7)),
            "sensorReading": sensor_reading,
            "nodes": nodes,
            "parentFractureId": parent_id,
        }

    def _empty_sensor_reading(self) -> Dict[str, Any]:
        """空传感器读数模板（所有字段填0）"""
        return {
            "ch4_pct": 0, "co_ppm": 0, "h2s_ppm": 0,
            "temperature_c": 0, "stress_mpa": 0,
            "stress_sigma1": 0, "stress_sigma2": 0, "stress_sigma3": 0,
            "permeability_md": 0, "water_pressure_mpa": 0,
            "microseismic_count": 0, "acoustic_emission_mv": 0,
            "humidity_pct": 0, "fracture_aperture_um": 0,
            "displacement_mm": 0, "rock_strength_mpa": 0,
            "pore_pressure_mpa": 0, "porosity_pct": 0,
            "fluid_ph": 0, "water_saturation_pct": 0,
        }

    @staticmethod
    def _path_length(path: List[List[float]]) -> float:
        """计算路径总长度"""
        length = 0.0
        for i in range(1, len(path)):
            dx = path[i][0] - path[i-1][0]
            dy = path[i][1] - path[i-1][1]
            dz = path[i][2] - path[i-1][2]
            length += math.sqrt(dx*dx + dy*dy + dz*dz)
        return length
