import test from 'node:test';
import assert from 'node:assert/strict';
import { generateFractureNetwork } from '../data/fractureDataGenerator';
import { generateMockRobots } from '../data/robotDataGenerator';
import { computePlaybackState, resetPlaybackCache } from './playbackEngine';

test('playback starts with no reconstructed topology revealed', () => {
  resetPlaybackCache();
  const fractures = generateFractureNetwork('coal');
  const robots = generateMockRobots('fracture', 'coal');
  const state = computePlaybackState(robots, fractures, 0);

  assert.equal(state.robots.length, robots.length);
  assert.ok(Object.values(state.revealRatios).every((ratio) => ratio === 0));
});

test('playback reveals topology only after robot crawl progress advances', () => {
  resetPlaybackCache();
  const fractures = generateFractureNetwork('coal');
  const robots = generateMockRobots('fracture', 'coal');
  const early = computePlaybackState(robots, fractures, 0.05);
  const later = computePlaybackState(robots, fractures, 0.7);

  assert.ok(Object.values(early.revealRatios).every((ratio) => ratio <= 0.05));
  assert.ok(Object.values(later.revealRatios).some((ratio) => ratio > 0.25));
  assert.ok(Object.values(later.revealRatios).some((ratio) => ratio < 1));
});
