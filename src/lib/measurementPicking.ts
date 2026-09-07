import type { Fracture } from '../types';

export type MeasurementPickTarget = 'raw' | 'node' | 'path';
export type Vec3Tuple = [number, number, number];

export interface MeasurementSnapResult {
  point: Vec3Tuple;
  snapped: boolean;
  targetType: MeasurementPickTarget;
  targetId?: string;
  distance: number;
}

function squaredDistance(a: Vec3Tuple, b: Vec3Tuple): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return dx * dx + dy * dy + dz * dz;
}

function closestPointOnSegment(point: Vec3Tuple, a: Vec3Tuple, b: Vec3Tuple): Vec3Tuple {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const abz = b[2] - a[2];
  const lenSq = abx * abx + aby * aby + abz * abz;
  if (lenSq <= 1e-9) return a;

  const apx = point[0] - a[0];
  const apy = point[1] - a[1];
  const apz = point[2] - a[2];
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby + apz * abz) / lenSq));
  return [a[0] + abx * t, a[1] + aby * t, a[2] + abz * t];
}

export function snapMeasurementPoint(
  rawPoint: Vec3Tuple,
  fractures: Fracture[],
  maxDistance = 2.5
): MeasurementSnapResult {
  const maxDistanceSq = maxDistance * maxDistance;
  let best: MeasurementSnapResult = {
    point: rawPoint,
    snapped: false,
    targetType: 'raw',
    distance: 0,
  };
  let bestSq = Number.POSITIVE_INFINITY;

  for (const fracture of fractures) {
    for (const node of fracture.nodes) {
      const distSq = squaredDistance(rawPoint, node.position);
      if (distSq < bestSq) {
        bestSq = distSq;
        best = {
          point: node.position,
          snapped: distSq <= maxDistanceSq,
          targetType: distSq <= maxDistanceSq ? 'node' : 'raw',
          targetId: distSq <= maxDistanceSq ? node.id : undefined,
          distance: Math.sqrt(distSq),
        };
      }
    }
  }

  if (best.snapped && best.targetType === 'node') return best;

  for (const fracture of fractures) {
    for (let i = 1; i < fracture.path.length; i += 1) {
      const projected = closestPointOnSegment(rawPoint, fracture.path[i - 1], fracture.path[i]);
      const distSq = squaredDistance(rawPoint, projected);
      if (distSq < bestSq) {
        bestSq = distSq;
        best = {
          point: projected,
          snapped: distSq <= maxDistanceSq,
          targetType: distSq <= maxDistanceSq ? 'path' : 'raw',
          targetId: distSq <= maxDistanceSq ? fracture.id : undefined,
          distance: Math.sqrt(distSq),
        };
      }
    }
  }

  return best.snapped ? best : {
    point: rawPoint,
    snapped: false,
    targetType: 'raw',
    distance: 0,
  };
}
