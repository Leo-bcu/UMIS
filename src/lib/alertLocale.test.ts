import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { localizeAlertCopy } from './alertLocale';
import type { AlertEvent } from '../data/alertDataGenerator';

describe('alertLocale', () => {
  it('translates underground metric alerts into English copy', () => {
    const alert: AlertEvent = {
      id: 'a-1',
      level: 'danger',
      type: 'gas_overload',
      title: '矿化度异常 — R-060',
      description: 'R-060 检测到 矿化度 67037mg/L，超过安全阈值 50000mg/L，位置 深度=268m',
      robotId: 'R-060',
      timestamp: Date.now(),
      acknowledged: false,
    };

    const localized = localizeAlertCopy(alert, 'en-US', 'underground');
    assert.match(localized.title, /Mineralization Alert - R-060/);
    assert.match(localized.description, /mineralization 67037mg\/L/i);
    assert.match(localized.description, /threshold 50000mg\/L/i);
    assert.match(localized.description, /depth=268m/i);
  });

  it('keeps Chinese copy unchanged in Chinese locale', () => {
    const alert: AlertEvent = {
      id: 'a-2',
      level: 'warning',
      type: 'battery_low',
      title: '电量告警 — R-024',
      description: 'R-024 电量仅剩 14%，建议尽快返回充电桩，当前任务: 溶洞沉积物探测',
      robotId: 'R-024',
      timestamp: Date.now(),
      acknowledged: false,
    };

    const localized = localizeAlertCopy(alert, 'zh-CN', 'underground');
    assert.equal(localized.title, alert.title);
    assert.equal(localized.description, alert.description);
  });
});
