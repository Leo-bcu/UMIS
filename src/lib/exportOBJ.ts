/**
 * OBJ + MTL 3D 网格导出器
 * 兼容 AutoCAD / Blender / 3ds Max / CloudCompare / 3D 打印切片软件
 *
 * 规范参考: Wavefront OBJ Specification
 *
 * 数据来源:
 * - 裂缝/通道管道: 基于 CatmullRom 曲线生成的 TubeGeometry
 * - 机器人: 八面体简化网格
 * - 体素网格: 基于 SceneNode 中心的简化三角面片
 */

import * as THREE from 'three';
import type { Fracture, Robot } from '../types';
import { getFlatGeometryData } from '../data/mockDataGenerator';

interface OBJMeshData {
  positions: number[]; // [x,y,z, x,y,z, ...]
  normals: number[]; // [nx,ny,nz, ...]
  indices: number[]; // [i0,i1,i2, ...]
  uvs?: number[];
}

/**
 * 生成 OBJ 文件并触发下载
 */
export function exportOBJ(
  fractures: Fracture[],
  robots: Robot[] | null,
  scenario: string,
): void {
  const meshes: { name: string; data: OBJMeshData; material: string }[] = [];

  // 1. 裂缝/通道管道 → TubeGeometry
  for (const frac of fractures) {
    if (frac.path.length < 2) continue;
    const curve = new THREE.CatmullRomCurve3(
      frac.path.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
    );
    const radius = frac.type === 'main' ? 0.4 : 0.2;
    const tubeGeo = new THREE.TubeGeometry(curve, Math.max(8, frac.path.length * 2), radius, 8, false);
    const mesh = geometryToOBJData(tubeGeo);
    meshes.push({
      name: `${frac.type}_fracture_${frac.id}`,
      data: mesh,
      material: frac.type === 'main' ? 'mat_fracture_main' : 'mat_fracture_branch',
    });
    tubeGeo.dispose();
  }

  // 2. 体素网格简化表示 (每 50 个点采样一个三角面片)
  const flatData = getFlatGeometryData();
  const voxelMesh = buildVoxelSurface(flatData);
  meshes.push({
    name: 'voxel_surface',
    data: voxelMesh,
    material: 'mat_voxel',
  });

  // 3. 机器人 → 八面体
  if (robots) {
    for (const robot of robots) {
      if (robot.status === 'offline') continue;
      const [x, y, z] = robot.position;
      const octGeo = new THREE.OctahedronGeometry(0.8, 0);
      octGeo.translate(x, y, z);
      meshes.push({
        name: `robot_${robot.id}`,
        data: geometryToOBJData(octGeo),
        material: 'mat_robot',
      });
      octGeo.dispose();
    }
  }

  // ── Build OBJ text ──
  const obj: string[] = [];
  const mtl: string[] = [];

  obj.push('# HIVE Digital Twin - OBJ Export');
  obj.push(`# Scenario: ${scenario}`);
  obj.push(`# Exported: ${new Date().toISOString()}`);
  obj.push(`# Fractures: ${fractures.length}`);
  obj.push(`# Robots: ${robots?.filter((r) => r.status !== 'offline').length ?? 0}`);
  obj.push('mtllib hive_export.mtl');
  obj.push('');

  // MTL definitions
  mtl.push('# HIVE Digital Twin - Material Library');
  mtl.push('# Exported: ' + new Date().toISOString());
  mtl.push('');
  mtl.push('newmtl mat_fracture_main');
  mtl.push('Kd 1.000 0.900 0.000'); // Yellow
  mtl.push('Ka 0.200 0.180 0.000');
  mtl.push('Ke 0.500 0.450 0.000');
  mtl.push('Ns 32.0');
  mtl.push('d 0.85');
  mtl.push('');
  mtl.push('newmtl mat_fracture_branch');
  mtl.push('Kd 1.000 0.600 0.000'); // Orange
  mtl.push('Ka 0.200 0.120 0.000');
  mtl.push('Ke 0.300 0.180 0.000');
  mtl.push('Ns 32.0');
  mtl.push('d 0.70');
  mtl.push('');
  mtl.push('newmtl mat_voxel');
  mtl.push('Kd 0.420 0.340 0.210'); // Brown rock
  mtl.push('Ka 0.084 0.068 0.042');
  mtl.push('Ke 0.000 0.000 0.000');
  mtl.push('Ns 10.0');
  mtl.push('d 0.55');
  mtl.push('');
  mtl.push('newmtl mat_robot');
  mtl.push('Kd 0.000 1.000 0.400'); // Green
  mtl.push('Ka 0.000 0.200 0.080');
  mtl.push('Ke 0.000 0.400 0.160');
  mtl.push('Ns 64.0');
  mtl.push('d 1.0');
  mtl.push('');

  let vertexOffset = 0;
  let normalOffset = 0;

  for (const m of meshes) {
    obj.push(`o ${m.name}`);
    obj.push(`usemtl ${m.material}`);
    obj.push(`g ${m.name}`);

    // Vertices
    for (let i = 0; i < m.data.positions.length; i += 3) {
      obj.push(`v ${m.data.positions[i].toFixed(4)} ${m.data.positions[i + 1].toFixed(4)} ${m.data.positions[i + 2].toFixed(4)}`);
    }

    // Normals
    for (let i = 0; i < m.data.normals.length; i += 3) {
      obj.push(`vn ${m.data.normals[i].toFixed(4)} ${m.data.normals[i + 1].toFixed(4)} ${m.data.normals[i + 2].toFixed(4)}`);
    }

    // Faces (1-indexed)
    for (let i = 0; i < m.data.indices.length; i += 3) {
      const a = m.data.indices[i] + 1 + vertexOffset;
      const b = m.data.indices[i + 1] + 1 + vertexOffset;
      const c = m.data.indices[i + 2] + 1 + vertexOffset;
      const na = m.data.indices[i] + 1 + normalOffset;
      const nb = m.data.indices[i + 1] + 1 + normalOffset;
      const nc = m.data.indices[i + 2] + 1 + normalOffset;
      obj.push(`f ${a}//${na} ${b}//${nb} ${c}//${nc}`);
    }

    vertexOffset += m.data.positions.length / 3;
    normalOffset += m.data.normals.length / 3;
    obj.push('');
  }

  // ── Download OBJ ──
  const objText = obj.join('\n');
  const mtlText = mtl.join('\n');

  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

  // Download OBJ
  downloadBlob(new Blob([objText], { type: 'text/plain' }), `HIVE-Mesh-${scenario}-${ts}.obj`);
  // Download MTL
  downloadBlob(new Blob([mtlText], { type: 'text/plain' }), `HIVE-Mesh-${scenario}-${ts}.mtl`);
}

function geometryToOBJData(geo: THREE.BufferGeometry): OBJMeshData {
  const pos = geo.attributes.position;
  const idx = geo.index;
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i < pos.count; i++) {
    positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
  }

  // Compute normals if missing
  if (!geo.attributes.normal) {
    geo.computeVertexNormals();
  }
  const nor = geo.attributes.normal;
  for (let i = 0; i < nor.count; i++) {
    normals.push(nor.getX(i), nor.getY(i), nor.getZ(i));
  }

  if (idx) {
    for (let i = 0; i < idx.count; i++) {
      indices.push(idx.getX(i));
    }
  } else {
    for (let i = 0; i < pos.count; i++) {
      indices.push(i);
    }
  }

  return { positions, normals, indices };
}

/**
 * 将体素点云构建为简化三角面片表面
 * 采样 ~2000 个点，用 Delaunay-like 简化方法连接相邻点
 */
function buildVoxelSurface(flatData: {
  positions: Float32Array;
  count: number;
}): OBJMeshData {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  const step = Math.max(1, Math.floor(flatData.count / 2000));
  const sampled: { x: number; y: number; z: number }[] = [];

  for (let i = 0; i < flatData.count; i += step) {
    sampled.push({
      x: flatData.positions[i * 3],
      y: flatData.positions[i * 3 + 1],
      z: flatData.positions[i * 3 + 2],
    });
  }

  // Build quads from sequential points (simplified surface tiling)
  for (let i = 0; i + 3 < sampled.length; i += 4) {
    const p0 = sampled[i];
    const p1 = sampled[i + 1];
    const p2 = sampled[i + 2];
    const p3 = sampled[i + 3];

    const baseIdx = positions.length / 3;
    positions.push(p0.x, p0.y, p0.z);
    positions.push(p1.x, p1.y, p1.z);
    positions.push(p2.x, p2.y, p2.z);
    positions.push(p3.x, p3.y, p3.z);

    // Face normal (approximate)
    const e1x = p1.x - p0.x, e1y = p1.y - p0.y, e1z = p1.z - p0.z;
    const e2x = p3.x - p0.x, e2y = p3.y - p0.y, e2z = p3.z - p0.z;
    let nx = e1y * e2z - e1z * e2y;
    let ny = e1z * e2x - e1x * e2z;
    let nz = e1x * e2y - e1y * e2x;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    nx /= len; ny /= len; nz /= len;

    for (let j = 0; j < 4; j++) {
      normals.push(nx, ny, nz);
    }

    // Two triangles per quad
    indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
    indices.push(baseIdx, baseIdx + 2, baseIdx + 3);
  }

  return { positions, normals, indices };
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 导出网格统计信息（用于 UI 展示）
 */
export function getOBJStats(
  fractures: Fracture[],
  robots: Robot[] | null,
): { meshCount: number; estimatedVertices: number; estimatedSizeMB: number } {
  let meshCount = fractures.filter((f) => f.path.length >= 2).length;
  let vertices = 0;

  for (const frac of fractures) {
    if (frac.path.length < 2) continue;
    const tubularSegments = Math.max(8, frac.path.length * 2);
    vertices += tubularSegments * 8; // approx
  }

  // Voxel surface
  const flatData = getFlatGeometryData();
  const voxelPoints = Math.min(2000, Math.floor(flatData.count / Math.max(1, Math.floor(flatData.count / 2000))));
  vertices += voxelPoints;
  meshCount += 1;

  // Robots
  const onlineRobots = robots?.filter((r) => r.status !== 'offline').length ?? 0;
  vertices += onlineRobots * 6; // Octahedron = 6 vertices
  meshCount += onlineRobots;

  // Rough OBJ text size: ~80 bytes per vertex + ~30 bytes per face
  const sizeMB = (vertices * 80 + vertices * 2 * 30) / (1024 * 1024);

  return {
    meshCount,
    estimatedVertices: vertices,
    estimatedSizeMB: Math.round(sizeMB * 100) / 100,
  };
}
