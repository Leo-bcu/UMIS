import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAlerts } from './alertApi';

test('fetchAlerts uses fracture subscenario robots for gold alerts', async () => {
  const alerts = await fetchAlerts(undefined, 'fracture', 'gold');
  const text = alerts.map((alert) => `${alert.title} ${alert.description}`).join('\n');

  assert.match(text, /微震|岩爆|应力|矿脉/);
  assert.doesNotMatch(text, /瓦斯浓度巡检|顶板位移监测|CH₄/);
});

test('fetchAlerts uses fracture subscenario robots for oil alerts', async () => {
  const alerts = await fetchAlerts(undefined, 'fracture', 'oil');
  const text = alerts.map((alert) => `${alert.title} ${alert.description}`).join('\n');

  assert.match(text, /孔隙压力|储层|渗透率|地层/);
  assert.doesNotMatch(text, /瓦斯浓度巡检|顶板位移监测|CH₄/);
});
