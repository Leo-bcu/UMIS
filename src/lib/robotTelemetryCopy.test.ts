import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getRobotTelemetryCopy } from './robotTelemetryCopy';

describe('robot telemetry copy', () => {
  it('keeps robot telemetry labels truthful across industrial scenes', () => {
    const gold = getRobotTelemetryCopy('gold');
    const oil = getRobotTelemetryCopy('oil');
    const nuclear = getRobotTelemetryCopy('nuclear');
    const refinery = getRobotTelemetryCopy('refinery');
    const underground = getRobotTelemetryCopy('underground');

    assert.equal(gold.primary.label, '微震');
    assert.equal(gold.primary.unit, '次/h');
    assert.equal(oil.primary.label, '孔压');
    assert.equal(oil.primary.unit, 'MPa');
    assert.equal(nuclear.primary.label, '剂量');
    assert.equal(nuclear.aux.label, '湿度');
    assert.equal(refinery.aux.label, '湿度');
    assert.equal(underground.primary.label, '矿化度');
    assert.equal(underground.aux.label, '湿度');
    assert.equal(nuclear.depthLabel, '距RPV');
    assert.equal(refinery.depthLabel, '行程');
  });
});
