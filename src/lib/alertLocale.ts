import type { Locale } from '../domain/i18nCatalog';
import type { ScenarioType } from '../types';
import type { AlertEvent } from '../data/alertDataGenerator';
import { localizeTask } from './taskLocale';

const ROLE_LABELS_EN: Record<string, string> = {
  gateway: 'gateway',
  relay: 'relay',
  edge: 'edge',
  leaf: 'leaf',
};

const PRIMARY_LABEL_EN: Record<ScenarioType, string> = {
  coal: 'CH4',
  gold: 'microseismic',
  oil: 'pore pressure',
  pipeline: 'leak level',
  nuclear: 'dose rate',
  refinery: 'wall thinning',
  underground: 'mineralization',
};

const TEMP_LABEL_EN: Record<ScenarioType, string> = {
  coal: 'temperature',
  gold: 'rock temperature',
  oil: 'formation temperature',
  pipeline: 'pipe temperature',
  nuclear: 'coolant temperature',
  refinery: 'operating temperature',
  underground: 'ground temperature',
};

function fallback(alert: AlertEvent): { title: string; description: string } {
  return { title: alert.title, description: alert.description };
}

export function localizeAlertCopy(
  alert: AlertEvent,
  locale: Locale,
  scenario: ScenarioType
): { title: string; description: string } {
  if (locale === 'zh-CN') return fallback(alert);

  const robotId = alert.robotId ?? alert.title.match(/R-\d+/)?.[0] ?? 'Robot';
  const depthField = scenario === 'coal' ? 'Z' : 'depth';

  if (alert.type === 'system') {
    return {
      title: 'System Startup Complete',
      description: 'HIVE control cabin initialized and the robot mesh topology is online.',
    };
  }

  if (alert.type === 'task_complete') {
    return {
      title: 'Regional Scan Complete',
      description: `3D reconstruction finished. Current primary metric: ${PRIMARY_LABEL_EN[scenario]}.`,
    };
  }

  if (alert.type === 'robot_error') {
    const model = alert.description.match(/型号\s+([a-zA-Z0-9_-]+)/)?.[1] ?? 'unknown';
    return {
      title: `Hardware Fault - ${robotId}`,
      description: `${robotId} reported a hardware fault on model ${model} and needs manual inspection.`,
    };
  }

  if (alert.type === 'robot_offline') {
    const pos = alert.description.match(/\[([^\]]+)\]/)?.[1] ?? '0, 0, 0';
    const depth = alert.description.match(/(?:Z|深度|距RPV|行程)=([0-9.]+)m/)?.[1] ?? '0';
    return {
      title: `Robot Offline - ${robotId}`,
      description: `${robotId} is offline. Last position [${pos}], ${depthField}=${depth}m.`,
    };
  }

  if (alert.type === 'battery_low') {
    const battery = alert.description.match(/(\d+)%/)?.[1] ?? '0';
    const task = alert.description.match(/当前任务:\s*(.+)$/)?.[1] ?? 'current task';
    return {
      title: `Low Battery - ${robotId}`,
      description: `${robotId} battery is down to ${battery}%. Return to charge soon. Current task: ${localizeTask(task, 'en-US')}.`,
    };
  }

  if (alert.type === 'mesh_disconnect') {
    const role = alert.description.match(/角色\s+([a-zA-Z0-9_-]+)/)?.[1] ?? 'leaf';
    const depth = alert.description.match(/(?:Z|深度|距RPV|行程)=([0-9.]+)m/)?.[1] ?? '0';
    return {
      title: `Mesh Disconnect - ${robotId}`,
      description: `${robotId} dropped from the mesh network as ${ROLE_LABELS_EN[role] ?? role}, affecting the ${depthField}=${depth}m relay chain.`,
    };
  }

  if (alert.type === 'gas_overload') {
    const reading = alert.description.match(/([0-9.]+)([%A-Za-z/]+)[，,]\s*超过安全阈值\s*([0-9.]+)([%A-Za-z/]+)/);
    const depth = alert.description.match(/(?:Z|深度|距RPV|行程)=([0-9.]+)m/)?.[1] ?? '0';
    return {
      title: `${PRIMARY_LABEL_EN[scenario][0].toUpperCase()}${PRIMARY_LABEL_EN[scenario].slice(1)} Alert - ${robotId}`,
      description: reading
        ? `${robotId} measured ${PRIMARY_LABEL_EN[scenario]} ${reading[1]}${reading[2]}, above the threshold ${reading[3]}${reading[4]}, at ${depthField}=${depth}m.`
        : `${robotId} exceeded the ${PRIMARY_LABEL_EN[scenario]} threshold at ${depthField}=${depth}m.`,
    };
  }

  if (alert.type === 'temp_anomaly') {
    const temp = alert.description.match(/([0-9.]+)°C/)?.[1] ?? '0';
    const depth = alert.description.match(/(?:Z|深度|距RPV|行程)=([0-9.]+)m/)?.[1] ?? '0';
    return {
      title: `${TEMP_LABEL_EN[scenario][0].toUpperCase()}${TEMP_LABEL_EN[scenario].slice(1)} Alert - ${robotId}`,
      description: `${robotId} reported ${TEMP_LABEL_EN[scenario]} ${temp}°C, outside the normal range, at ${depthField}=${depth}m.`,
    };
  }

  return fallback(alert);
}
