import type { Fracture, ScenarioType } from '../types';

type Pt3 = [number, number, number];

export type TopologyIssueSeverity = 'error' | 'warning';

export interface TopologyIssue {
  scenario: ScenarioType;
  fractureId: string;
  fractureName: string;
  severity: TopologyIssueSeverity;
  code:
    | 'PATH_TOO_SHORT'
    | 'ZERO_LENGTH_SEGMENT'
    | 'UNCONNECTED_BRANCH'
    | 'UNEXPECTED_ISOLATED_ENDPOINT'
    | 'UNREALISTIC_BEND'
    | 'POINT_OUT_OF_BOUNDS'
    | 'NODE_OFF_CENTERLINE';
  message: string;
}

interface AuditOptions {
  endpointTolerance: number;
  nodeTolerance: number;
  minAngleDeg?: number;
  requireBranchAttachment: boolean;
  allowSurfaceEntry: (point: Pt3, fracture: Fracture) => boolean;
  allowTerminalEndpoint: (point: Pt3, fracture: Fracture, endpoint: 'start' | 'end') => boolean;
  /** 煤矿专用：巷道端点贴附腔体的额外容差 */
  cavityAttachExtra?: number;
  bounds: {
    x: [number, number];
    y: [number, number];
    z: [number, number];
  };
}

const INDUSTRIAL_SCENARIOS = new Set<ScenarioType>(['pipeline', 'nuclear', 'refinery']);
const NATURAL_SCENARIOS = new Set<ScenarioType>(['coal', 'gold', 'oil', 'underground']);

function dist(a: Pt3, b: Pt3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

function sub(a: Pt3, b: Pt3): Pt3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function vectorLength(v: Pt3): number {
  return Math.hypot(v[0], v[1], v[2]);
}

function angleDeg(a: Pt3, b: Pt3): number {
  const la = vectorLength(a);
  const lb = vectorLength(b);
  if (la < 1e-6 || lb < 1e-6) return 180;
  const cos = Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (la * lb)));
  return Math.acos(cos) * 180 / Math.PI;
}

function pointSegmentDistance(p: Pt3, a: Pt3, b: Pt3): number {
  const ab = sub(b, a);
  const ap = sub(p, a);
  const ab2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
  if (ab2 < 1e-9) return dist(p, a);
  const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / ab2));
  return dist(p, [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t]);
}

function minDistanceToPath(point: Pt3, path: Pt3[]): number {
  let best = Infinity;
  for (let i = 1; i < path.length; i++) {
    best = Math.min(best, pointSegmentDistance(point, path[i - 1], path[i]));
  }
  return best;
}

function nearestDistanceToOtherPaths(point: Pt3, fracture: Fracture, fractures: Fracture[]): number {
  let best = Infinity;
  for (const other of fractures) {
    if (other.id === fracture.id) continue;
    best = Math.min(best, minDistanceToPath(point, other.path));
  }
  return best;
}

function inBounds(point: Pt3, options: AuditOptions): boolean {
  return point[0] >= options.bounds.x[0] && point[0] <= options.bounds.x[1]
    && point[1] >= options.bounds.y[0] && point[1] <= options.bounds.y[1]
    && point[2] >= options.bounds.z[0] && point[2] <= options.bounds.z[1];
}

function scenarioAuditOptions(scenario: ScenarioType): AuditOptions {
  if (scenario === 'pipeline') {
    return {
      endpointTolerance: 0.35,
      nodeTolerance: 0.2,
      minAngleDeg: 42,
      requireBranchAttachment: true,
      bounds: { x: [-50, 75], y: [-12, 22], z: [-45, 45] },
      allowSurfaceEntry: (p) => p[1] >= 17,
      allowTerminalEndpoint: (_p, f, endpoint) =>
        endpoint === 'end' && (f.name.includes('盲端') || f.name.includes('出口') || f.name.includes('排放') || f.name.includes('总管')),
    };
  }
  if (scenario === 'nuclear') {
    return {
      endpointTolerance: 0.75,
      nodeTolerance: 0.25,
      minAngleDeg: 35,
      requireBranchAttachment: false,
      bounds: { x: [-32, 32], y: [-22, 12], z: [-32, 32] },
      allowSurfaceEntry: () => false,
      allowTerminalEndpoint: (_p, f) =>
        f.name.includes('主蒸汽') || f.name.includes('主给水') || f.name.includes('SG汽侧出口') || f.name.includes('给水→SG冷侧')
        || f.name.includes('卸压') || f.name.includes('喷雾')
        || f.name.includes('安注') || f.name.includes('CVCS') || f.name.includes('CCWS') || f.name.includes('排污')
        || f.name.includes('蓄压') || f.name.includes('RHR'),
    };
  }
  if (scenario === 'refinery') {
    return {
      endpointTolerance: 0.75,
      nodeTolerance: 0.25,
      minAngleDeg: 35,
      requireBranchAttachment: false,
      bounds: { x: [-42, 32], y: [-16, 38], z: [-18, 18] },
      allowSurfaceEntry: () => false,
      allowTerminalEndpoint: (_p, f) =>
        f.name.includes('出口') || f.name.includes('排放') || f.name.includes('人孔') || f.name.includes('侧线')
        || f.name.includes('检修入口') || f.name.includes('回流') || f.name.includes('入口集合管')
        || f.name.includes('内壁段') || f.name.includes('罐内空间') || f.name.includes('罐内通道')
        || f.name.includes('顶部集合') || f.name.includes('反应釜') || f.name.includes('通道-') || f.name.includes('跨层通道')
        || f.name.includes('集合总管') || f.name.includes('集合管') || f.name.includes('分配管'),
    };
  }
  if (scenario === 'underground') {
    return {
      endpointTolerance: 1.1,
      nodeTolerance: 0.3,
      requireBranchAttachment: true,
      bounds: { x: [-65, 65], y: [-68, 6], z: [-55, 55] },
      allowSurfaceEntry: (p, f) => f.type === 'main' && p[1] >= -4,
      allowTerminalEndpoint: (_p, f, endpoint) =>
        endpoint === 'end' && (f.name.includes('盲端') || f.name.includes('支流') || f.name.includes('主干')),
    };
  }
  if (scenario === 'coal') {
    return {
      endpointTolerance: 1.4,
      nodeTolerance: 0.35,
      requireBranchAttachment: true,
      bounds: { x: [-58, 58], y: [-60, 14], z: [-48, 48] },
      allowSurfaceEntry: (p, f) => (f.type === 'main' && p[1] >= 8) || (f.morphology === 'tunnel' && p[1] >= 8),
      allowTerminalEndpoint: (_p, f, endpoint) =>
        endpoint === 'end'
        && (f.name.includes('盲巷') || f.name.includes('盲端') || f.name.includes('排水硐室') || f.name.includes('注浆孔') || f.name.includes('采空区边界')),
      cavityAttachExtra: 2.0,
    };
  }
  return {
    endpointTolerance: 1.4,
    nodeTolerance: 0.35,
    requireBranchAttachment: true,
    bounds: { x: [-58, 58], y: [-21, 21], z: [-48, 48] },
    allowSurfaceEntry: (p, f) => (f.type === 'main' && p[1] >= 17) || (f.morphology === 'tunnel' && p[1] >= 15),
    allowTerminalEndpoint: (_p, f, endpoint) => endpoint === 'end' && f.type === 'main',
    // 煤矿巷道端点贴附腔体用更大容差（腔体半径 + 余量）
    cavityAttachExtra: 2.0,
  };
}

export function auditScenarioTopology(scenario: ScenarioType, fractures: Fracture[]): TopologyIssue[] {
  const issues: TopologyIssue[] = [];
  const options = scenarioAuditOptions(scenario);

  for (const fracture of fractures) {
    const path = fracture.path;
    const push = (code: TopologyIssue['code'], message: string, severity: TopologyIssueSeverity = 'error') => {
      issues.push({ scenario, fractureId: fracture.id, fractureName: fracture.name, code, message, severity });
    };

    if (path.length < 2) {
      push('PATH_TOO_SHORT', '路径点少于2个，无法形成物理通道。');
      continue;
    }

    path.forEach((point, index) => {
      if (!inBounds(point, options)) {
        push('POINT_OUT_OF_BOUNDS', `路径点 ${index} 超出该场景物理边界: [${point.join(', ')}]。`);
      }
    });

    for (let i = 1; i < path.length; i++) {
      if (dist(path[i - 1], path[i]) < 0.05) {
        push('ZERO_LENGTH_SEGMENT', `路径点 ${i - 1}→${i} 形成近零长度段。`);
      }
    }

    if (INDUSTRIAL_SCENARIOS.has(scenario) && options.minAngleDeg) {
      for (let i = 1; i < path.length - 1; i++) {
        const a = sub(path[i - 1], path[i]);
        const b = sub(path[i + 1], path[i]);
        const angle = angleDeg(a, b);
        if (angle < options.minAngleDeg) {
          push('UNREALISTIC_BEND', `路径点 ${i} 出现 ${angle.toFixed(1)}° 锐角，像折断管而不是标准弯头。`);
        }
      }
    }

    for (const node of fracture.nodes) {
      const off = minDistanceToPath(node.position, path);
      if (off > options.nodeTolerance) {
        push('NODE_OFF_CENTERLINE', `${node.id} 偏离所属中心线 ${off.toFixed(2)}m。`);
      }
    }

    // 煤矿腔体是闭合环，不存在"端点"概念，跳过端点检查
    // 矿坑内裂隙(fracture)是腔体内部装饰细节，不要求端点连通
    if (fracture.morphology === 'cavity' || fracture.morphology === 'fracture') continue;

    const endpoints = [
      ['start', path[0]] as const,
      ['end', path[path.length - 1]] as const,
    ];
    // 煤矿专用：巷道/裂隙端点若落在某腔体球内（中心距离≤半径+容差），视为已连接
    const cavities = fractures.filter((f) => f.morphology === 'cavity');
    const attachedToCavity = (point: Pt3): boolean => {
      const extra = options.cavityAttachExtra ?? 0;
      for (const cav of cavities) {
        const center = cav.path.reduce(
          (acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]] as Pt3,
          [0, 0, 0],
        );
        const n = cav.path.length || 1;
        const c: Pt3 = [center[0] / n, center[1] / n, center[2] / n];
        const r = cav.porosity || 5;
        if (dist(point, c) <= r + options.endpointTolerance + extra) return true;
      }
      return false;
    };

    for (const [endpoint, point] of endpoints) {
      const attached = nearestDistanceToOtherPaths(point, fracture, fractures) <= options.endpointTolerance
        || (fracture.morphology && attachedToCavity(point));
      const allowedSurface = options.allowSurfaceEntry(point, fracture);
      const allowedTerminal = options.allowTerminalEndpoint(point, fracture, endpoint);

      if (endpoint === 'start' && fracture.type === 'branch' && options.requireBranchAttachment && !attached && !allowedSurface) {
        push('UNCONNECTED_BRANCH', '分支起点没有贴合主管/主裂缝/主通道。');
      }

      if (!attached && !allowedSurface && !allowedTerminal) {
        const severity: TopologyIssueSeverity = NATURAL_SCENARIOS.has(scenario) && endpoint === 'end' ? 'warning' : 'error';
        push('UNEXPECTED_ISOLATED_ENDPOINT', `${endpoint === 'start' ? '起点' : '终点'}没有连接、入口或合理死端语义。`, severity);
      }
    }
  }

  return issues;
}
