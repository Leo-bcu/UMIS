import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { useSceneStore } from './useSceneStore';

describe('useSceneStore locale', () => {
  it('stores locale globally so language toggle can update every panel', () => {
    useSceneStore.getState().setLocale('en-US');
    assert.equal(useSceneStore.getState().locale, 'en-US');

    useSceneStore.getState().setLocale('zh-CN');
    assert.equal(useSceneStore.getState().locale, 'zh-CN');
  });
});
