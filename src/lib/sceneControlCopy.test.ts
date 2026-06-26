import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getLocalizedStructureLayerCopy, getPhysicalTruthCopy, getStructureLayerCopy } from './sceneControlCopy';

describe('scene control copy', () => {
  it('uses facility copy for nuclear instead of geological rock copy', () => {
    const structure = getStructureLayerCopy('nuclear');
    const truth = getPhysicalTruthCopy('nuclear');

    assert.equal(structure?.label, '安全壳厂房');
    assert.match(structure?.desc ?? '', /反应堆安全壳/);
    assert.match(truth, /安全壳厂房/);
    assert.doesNotMatch(truth, /岩体|岩层|裂缝/);
  });

  it('uses underground flow copy for underground controls', () => {
    const structure = getStructureLayerCopy('underground');
    const truth = getPhysicalTruthCopy('underground');

    assert.equal(structure?.label, '含水层背景');
    assert.match(truth, /含水层背景/);
    assert.match(truth, /暗流通道/);
    assert.doesNotMatch(truth, /裂缝/);
  });

  it('localizes underground and nuclear structure layers cleanly in english', () => {
    const underground = getLocalizedStructureLayerCopy('underground', 'en-US');
    const nuclear = getLocalizedStructureLayerCopy('nuclear', 'en-US');

    assert.equal(underground?.label, 'Aquifer Background');
    assert.match(underground?.desc ?? '', /aquifer background/i);
    assert.equal(nuclear?.label, 'Containment Building');
    assert.match(nuclear?.desc ?? '', /Containment shell/i);
  });

  it('uses confined-space shell copy for chemical tank and reactor scenes', () => {
    const structure = getStructureLayerCopy('refinery');
    assert.equal(structure?.label, '储罐/反应釜壳体');
    assert.match(getPhysicalTruthCopy('refinery'), /密闭空间测点/);
  });
});
