/**
 * LAS 1.2 点云导出器
 * 兼容 Trimble Business Center / AutoCAD Civil 3D / CloudCompare / ArcGIS
 *
 * 规范参考: ASPRS LAS Specification 1.2
 * Point Data Record Format: 2 (支持 RGB)
 *
 * 数据来源:
 * - 体素点云 (FlatGeometryData): 12,000 节点 x ~5 点 = ~60,000 点
 * - 裂缝/通道网络节点 (FractureNode[]): 精确测绘路径点
 * - 机器人位置: 当前在线机器人的 XYZ 坐标
 */

import type { Fracture, Robot } from '../types';
import { getFlatGeometryData } from '../data/mockDataGenerator';

// ── LAS 1.2 二进制写入器 ──

interface LASPoint {
  x: number;
  y: number;
  z: number;
  intensity: number; // 0-65535
  r: number; // 0-65535
  g: number; // 0-65535
  b: number; // 0-65535
  classification: number; // LAS classification code
  sourceId: number;
}

function writeUint32LE(buf: Uint8Array, offset: number, val: number): number {
  buf[offset] = val & 0xff;
  buf[offset + 1] = (val >> 8) & 0xff;
  buf[offset + 2] = (val >> 16) & 0xff;
  buf[offset + 3] = (val >> 24) & 0xff;
  return offset + 4;
}

function writeUint16LE(buf: Uint8Array, offset: number, val: number): number {
  buf[offset] = val & 0xff;
  buf[offset + 1] = (val >> 8) & 0xff;
  return offset + 2;
}

function writeUint8(buf: Uint8Array, offset: number, val: number): number {
  buf[offset] = val & 0xff;
  return offset + 1;
}

function writeDoubleLE(buf: Uint8Array, offset: number, val: number): number {
  const view = new DataView(buf.buffer, buf.byteOffset + offset, 8);
  view.setFloat64(0, val, true);
  return offset + 8;
}

/**
 * 将浮点 XYZ 坐标缩放为 LAS 整数坐标
 */
function computeScaleOffset(min: number, max: number): { scale: number; offset: number } {
  const range = max - min || 1;
  const scale = range / (2 ** 31 - 1);
  return { scale, offset: min };
}

export function buildLASBuffer(
  fractures: Fracture[],
  robots: Robot[] | null,
): Uint8Array {
  const points = collectPoints(fractures, robots);

  if (points.length === 0) {
    throw new Error('无可导出的点云数据');
  }

  // ── 计算坐标范围 ──
  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.z < minZ) minZ = p.z;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
    if (p.z > maxZ) maxZ = p.z;
  }

  const sx = computeScaleOffset(minX, maxX);
  const sy = computeScaleOffset(minY, maxY);
  const sz = computeScaleOffset(minZ, maxZ);

  // ── LAS 1.2 Header (227 bytes) ──
  const HEADER_SIZE = 227;
  const POINT_RECORD_FORMAT = 2; // with RGB
  const POINT_RECORD_SIZE = 26; // Format 2: X(4)+Y(4)+Z(4)+Intensity(2)+Flags(1)+Classification(1)+ScanAngle(1)+UserData(1)+PtSrcId(2)+RGB(6)
  const pointCount = points.length;
  const totalSize = HEADER_SIZE + pointCount * POINT_RECORD_SIZE;

  const buf = new Uint8Array(totalSize);
  let off = 0;

  // File Signature "LASF"
  buf[0] = 0x4c; buf[1] = 0x41; buf[2] = 0x53; buf[3] = 0x46;
  off = 4;

  // File Source ID (2)
  off = writeUint16LE(buf, off, 0);
  // Global Encoding (2) — bit 0 = GPS time
  off = writeUint16LE(buf, off, 0);
  // Project ID GUID (16 bytes) — all zeros
  off += 16;
  // Version Major (1) + Minor (1)
  off = writeUint8(buf, off, 1);
  off = writeUint8(buf, off, 2);
  // System Identifier (32 bytes)
  const sysId = 'HIVE_DIGITAL_TWIN_LIDAR';
  for (let i = 0; i < 32; i++) {
    off = writeUint8(buf, off, i < sysId.length ? sysId.charCodeAt(i) : 0);
  }
  // Generating Software (32 bytes)
  const genSoft = 'HIVE_EXPORT_HUB_v1.0';
  for (let i = 0; i < 32; i++) {
    off = writeUint8(buf, off, i < genSoft.length ? genSoft.charCodeAt(i) : 0);
  }
  // File Creation Day of Year (2)
  off = writeUint16LE(buf, off, Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000) + 1);
  // File Creation Year (2)
  off = writeUint16LE(buf, off, new Date().getFullYear());
  // Header Size (2)
  off = writeUint16LE(buf, off, HEADER_SIZE);
  // Offset to Point Data (4)
  off = writeUint32LE(buf, off, HEADER_SIZE);
  // Number of VLRs (4)
  off = writeUint32LE(buf, off, 0);
  // Point Data Format ID (1)
  off = writeUint8(buf, off, POINT_RECORD_FORMAT);
  // Point Data Record Length (2)
  off = writeUint16LE(buf, off, POINT_RECORD_SIZE);
  // Number of Point Records (4)
  off = writeUint32LE(buf, off, pointCount);
  // Number of Points by Return (5 x 4 = 20)
  for (let i = 0; i < 5; i++) {
    off = writeUint32LE(buf, off, i === 0 ? pointCount : 0);
  }
  // Scale Factors
  off = writeDoubleLE(buf, off, sx.scale);
  off = writeDoubleLE(buf, off, sy.scale);
  off = writeDoubleLE(buf, off, sz.scale);
  // Offset
  off = writeDoubleLE(buf, off, sx.offset);
  off = writeDoubleLE(buf, off, sy.offset);
  off = writeDoubleLE(buf, off, sz.offset);
  // Max/Min X/Y/Z
  off = writeDoubleLE(buf, off, maxX);
  off = writeDoubleLE(buf, off, minX);
  off = writeDoubleLE(buf, off, maxY);
  off = writeDoubleLE(buf, off, minY);
  off = writeDoubleLE(buf, off, maxZ);
  off = writeDoubleLE(buf, off, minZ);

  // ── Point Records ──
  for (let i = 0; i < pointCount; i++) {
    const p = points[i];
    const ix = Math.round((p.x - sx.offset) / sx.scale);
    const iy = Math.round((p.y - sy.offset) / sy.scale);
    const iz = Math.round((p.z - sz.offset) / sz.scale);

    off = writeUint32LE(buf, off, ix);
    off = writeUint32LE(buf, off, iy);
    off = writeUint32LE(buf, off, iz);
    off = writeUint16LE(buf, off, p.intensity);

    // Flags byte: bits 0-2 = return number, bits 3-5 = number of returns, bit 6 = scan direction, bit 7 = edge of flight line
    off = writeUint8(buf, off, 0b00000001); // return 1 of 1
    // Classification byte
    off = writeUint8(buf, off, p.classification);
    // Scan Angle Rank (-128 to 127, signed)
    off = writeUint8(buf, off, 0);
    // User Data
    off = writeUint8(buf, off, 0);
    // Point Source ID
    off = writeUint16LE(buf, off, p.sourceId);
    // RGB (Format 2)
    off = writeUint16LE(buf, off, p.r);
    off = writeUint16LE(buf, off, p.g);
    off = writeUint16LE(buf, off, p.b);
  }

  return buf;
}

/**
 * 生成 LAS 1.2 文件并触发下载
 */
export function exportLAS(
  fractures: Fracture[],
  robots: Robot[] | null,
  scenario: string,
): void {
  const buffer = buildLASBuffer(fractures, robots);
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  a.download = `HIVE-PointCloud-${scenario}-${ts}.las`;
  a.click();
  URL.revokeObjectURL(url);

  return void 0;
}

// ── 点采集逻辑 ──

/**
 * LAS Classification Codes (ASPRS Standard):
 * 0   = Created, never classified
 * 1   = Unclassified
 * 2   = Ground
 * 3   = Low Vegetation
 * ...
 * 12  = Overlap Points
 */

function collectPoints(
  fractures: Fracture[],
  robots: Robot[] | null,
): LASPoint[] {
  const points: LASPoint[] = [];

  // 1. 体素点云 — 激光雷达扫描的基础数据
  const flatData = getFlatGeometryData();
  for (let i = 0; i < flatData.count; i++) {
    const x = flatData.positions[i * 3];
    const y = flatData.positions[i * 3 + 1];
    const z = flatData.positions[i * 3 + 2];

    // 颜色编码: 根据 CH4 浓度映射 (蓝→红)
    const gas = flatData.gasValues[i];
    const { r, g, b } = gasToRGB(gas);

    points.push({
      x, y, z,
      intensity: Math.round(flatData.intensities[i] * 65535),
      r, g, b,
      classification: 1, // Unclassified (原始扫描点)
      sourceId: 0,
    });
  }

  // 2. 裂缝/通道网络节点 — 精确测绘路径
  for (const frac of fractures) {
    for (const node of frac.nodes) {
      const [x, y, z] = node.position;
      points.push({
        x, y, z,
        intensity: Math.round(node.sensors.ch4_pct / 5 * 65535),
        r: 65535, g: 38250, b: 0, // 橙色标记裂缝节点
        classification: frac.type === 'main' ? 2 : 1, // main = Ground(2), branch = Unclassified(1)
        sourceId: parseInt(node.id.replace(/\D/g, '')) || 0,
      });
    }
    // 裂缝路径点
    for (const [x, y, z] of frac.path) {
      points.push({
        x, y, z,
        intensity: 40000,
        r: 65535, g: 23025, b: 0, // 黄色标记路径
        classification: 2, // Ground/feature path point
        sourceId: 0,
      });
    }
  }

  // 3. 在线机器人位置
  if (robots) {
    for (const robot of robots) {
      if (robot.status === 'offline') continue;
      const [x, y, z] = robot.position;
      points.push({
        x, y, z,
        intensity: 65000,
        r: 0, g: 65535, b: 26112, // 绿色标记机器人
        classification: 1, // Unclassified robot evidence point
        sourceId: parseInt(robot.id.replace(/\D/g, '')) || 0,
      });
    }
  }

  return points;
}

/**
 * CH4 浓度 → RGB 颜色映射 (turbo colormap 简化版)
 * 0% = 蓝 (0,0,65535)
 * 1% = 绿 (0,65535,0)
 * 2.5% = 黄 (65535,65535,0)
 * 5%+ = 红 (65535,0,0)
 */
function gasToRGB(gas: number): { r: number; g: number; b: number } {
  const t = Math.min(1, gas / 5);
  let r: number, g: number, b: number;
  if (t < 0.25) {
    const k = t / 0.25;
    r = 0; g = Math.round(k * 65535); b = 65535;
  } else if (t < 0.5) {
    const k = (t - 0.25) / 0.25;
    r = 0; g = 65535; b = Math.round(65535 * (1 - k));
  } else if (t < 0.75) {
    const k = (t - 0.5) / 0.25;
    r = Math.round(k * 65535); g = 65535; b = 0;
  } else {
    const k = (t - 0.75) / 0.25;
    r = 65535; g = Math.round(65535 * (1 - k)); b = 0;
  }
  return { r, g, b };
}

/**
 * 导出点云统计信息（用于 UI 展示）
 */
export function getLASStats(
  fractures: Fracture[],
  robots: Robot[] | null,
): { totalPoints: number; estimatedSizeMB: number } {
  const flatData = getFlatGeometryData();
  const voxelPoints = flatData.count;
  const fracturePoints = fractures.reduce((s, f) => s + f.nodes.length + f.path.length, 0);
  const robotPoints = robots ? robots.filter((r) => r.status !== 'offline').length : 0;
  const total = voxelPoints + fracturePoints + robotPoints;
  // LAS 1.2 point record = 26 bytes, header = 227 bytes
  const sizeMB = (227 + total * 26) / (1024 * 1024);
  return { totalPoints: total, estimatedSizeMB: Math.round(sizeMB * 100) / 100 };
}
