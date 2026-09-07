import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { generateUndergroundNetwork } from './undergroundDataGenerator';

describe('generateUndergroundNetwork', () => {
  it('produces karst-scale permeability values that match underground warning thresholds', () => {
    const channels = generateUndergroundNetwork();
    const permeabilityValues = channels.flatMap((channel) => [
      channel.sensorReading.permeability_md,
      ...channel.nodes.map((node) => node.sensors.permeability_md),
    ]);

    assert.ok(permeabilityValues.some((value) => value > 1000), 'underground permeability should not look like low-permeability rock fractures');
    assert.ok(permeabilityValues.some((value) => value > 5000), 'mock data should include at least one high-flow warning candidate');
  });
});
