import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getLocalizedNetworkLabel, getLocalizedSceneObjectLabel, getLocalizedTrendLabels, getSceneSemantics, SCENE_SEMANTICS } from './sceneSemantics';
import type { ScenarioType } from '../types';

const SCENARIOS: ScenarioType[] = ['coal', 'gold', 'oil', 'pipeline', 'nuclear', 'refinery', 'underground'];

describe('scene semantics', () => {
  it('defines trend and threshold semantics for every scenario', () => {
    for (const scenario of SCENARIOS) {
      const semantics = getSceneSemantics(scenario);
      assert.equal(semantics, SCENE_SEMANTICS[scenario]);
      assert.ok(semantics.objectLabel.length > 0);
      assert.ok(semantics.trend.primary.label.length > 0);
      assert.ok(semantics.threshold.label.length > 0);
      assert.ok(semantics.export.objectDescription.length > 0);
    }
  });

  it('keeps underground flow terminology out of fracture and CH4 defaults', () => {
    const semantics = getSceneSemantics('underground');
    const visibleCopy = [
      semantics.objectLabel,
      semantics.networkLabel,
      semantics.regionPrefix,
      semantics.status.overThresholdLabel,
      semantics.threshold.label,
      semantics.threshold.tooltip,
      semantics.trend.primary.label,
      semantics.trend.aux.label,
      semantics.export.objectDescription,
      semantics.export.sensorMatrixDescription,
    ].join(' ');

    assert.match(visibleCopy, /暗流|通道|含水层|渗透率|地温/);
    assert.doesNotMatch(visibleCopy, /裂缝|瓦斯|CH4|CH₄|孔压/);
  });

  it('uses explicit industrial object labels in english for non-fracture scenes', () => {
    assert.equal(getLocalizedSceneObjectLabel('pipeline', 'en-US'), 'Pipe Segment');
    assert.equal(getLocalizedSceneObjectLabel('nuclear', 'en-US'), 'Reactor Pipe');
    assert.equal(getLocalizedSceneObjectLabel('refinery', 'en-US'), 'Confined Space');
    assert.equal(getLocalizedSceneObjectLabel('underground', 'en-US'), 'Underground Channel');
  });

  it('localizes network labels without mixed Chinese and English fragments', () => {
    assert.equal(getLocalizedNetworkLabel('underground', 'en-US'), 'Underground Channel Network');
    assert.equal(getLocalizedNetworkLabel('pipeline', 'en-US'), 'Small-Bore Pipe Network');
    assert.equal(getLocalizedNetworkLabel('nuclear', 'en-US'), 'Reactor Piping System');
    assert.equal(getLocalizedNetworkLabel('underground', 'zh-CN'), '地下暗流通道网络');
  });

  it('localizes trend labels without Chinese fragments in English mode', () => {
    for (const scenario of SCENARIOS) {
      const labels = getLocalizedTrendLabels(scenario, 'en-US');
      const copy = `${labels.primary.label} ${labels.primary.unit} ${labels.temperature.label} ${labels.temperature.unit} ${labels.aux.label} ${labels.aux.unit}`;
      assert.doesNotMatch(copy, /[\u4e00-\u9fff]/, `${scenario} trend labels and units should be fully English`);
    }
  });
});
