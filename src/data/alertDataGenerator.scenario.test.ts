import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMockAlerts } from './alertDataGenerator';
import { generateMockRobots } from './robotDataGenerator';
import type { Robot } from '../types';

function robot(id: string): Robot {
  return {
    id,
    model: 'floatwalker',
    status: 'online',
    position: [12, -8, -210],
    battery: 84,
    meshRole: 'relay',
    meshConnected: true,
    task: '场景探测',
    depth: 210,
    signalStrength: -58,
    sensors: {
      ch4: 3.4,
      temperature: 42,
      humidity: 68,
    },
    lastUpdate: Date.now(),
  };
}

function withDeterministicRandom<T>(fn: () => T): T {
  const originalRandom = Math.random;
  Math.random = () => 0.9;
  try {
    return fn();
  } finally {
    Math.random = originalRandom;
  }
}

test('gold fracture scenario alerts use gold mine terminology instead of coal gas terminology', () => {
  const alerts = withDeterministicRandom(() => generateMockAlerts([robot('R-AU-001')], 'fracture', 'gold'));
  const text = alerts.map((alert) => `${alert.title} ${alert.description}`).join('\n');

  assert.match(text, /微震|岩爆|应力/);
  assert.doesNotMatch(text, /CH₄|CH4|瓦斯/);
});

test('oil fracture scenario alerts use reservoir terminology instead of coal gas terminology', () => {
  const alerts = withDeterministicRandom(() => generateMockAlerts([robot('R-OIL-001')], 'fracture', 'oil'));
  const text = alerts.map((alert) => `${alert.title} ${alert.description}`).join('\n');

  assert.match(text, /孔隙压力|储层|MPa/);
  assert.doesNotMatch(text, /CH₄|CH4|瓦斯/);
});

test('system startup alert reports the actual robot list size', () => {
  const robots = generateMockRobots('pipeline', 'pipeline');
  const alerts = withDeterministicRandom(() => generateMockAlerts(robots, 'pipeline', 'pipeline'));
  const startup = alerts.find((alert) => alert.type === 'system' && alert.title === '系统启动完成');

  assert.ok(startup);
  assert.match(startup.description, new RegExp(`${robots.length} 台机器人已注册`));
});
