import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMockRobots } from './robotDataGenerator';

test('gold fracture robots use gold mine tasks instead of coal gas tasks', () => {
  const robots = generateMockRobots('fracture', 'gold');
  const taskText = robots.map((robot) => robot.task).join('\n');

  assert.match(taskText, /微震|岩爆|应力|矿脉|采空区|岩温/);
  assert.doesNotMatch(taskText, /瓦斯|顶板|气体泄漏/);
});

test('oil fracture robots use reservoir tasks instead of coal gas tasks', () => {
  const robots = generateMockRobots('fracture', 'oil');
  const taskText = robots.map((robot) => robot.task).join('\n');

  assert.match(taskText, /孔隙压力|储层|渗透率|含水率|地层/);
  assert.doesNotMatch(taskText, /瓦斯|顶板|气体泄漏/);
});

test('underground robots keep non-negative depth and underground-specific task vocabulary', () => {
  const robots = generateMockRobots('underground', 'underground');
  const taskText = robots.map((robot) => robot.task).join('\n');

  assert.ok(robots.every((robot) => robot.depth >= 0), 'underground depth should never be negative');
  assert.match(taskText, /暗流|水质|矿化度|瓶颈|水文|流量|地温/);
  assert.doesNotMatch(taskText, /瓦斯|顶板|采空区/);
});

test('pipeline robots use pipeline-specific tasks and spider model deployment', () => {
  const robots = generateMockRobots('pipeline', 'pipeline');
  const taskText = robots.map((robot) => robot.task).join('\n');
  const spiderCount = robots.filter((robot) => robot.model === 'spider').length;

  assert.ok(spiderCount / robots.length > 0.55, 'pipeline robots should be spider-dominant while allowing heterogeneous support models');
  assert.match(taskText, /壁厚|腐蚀|焊缝|泄漏|阀门|H₂S|流量计|沉降/);
  assert.doesNotMatch(taskText, /裂缝|岩爆|采空区|剂量率|暗流/);
});

test('nuclear robots use reactor-specific tasks and spider model deployment', () => {
  const robots = generateMockRobots('nuclear', 'nuclear');
  const taskText = robots.map((robot) => robot.task).join('\n');

  assert.ok(robots.every((robot) => robot.model === 'spider'), 'nuclear robots should use the radiation-hardened spider fleet');
  assert.match(taskText, /焊缝|剂量率|涡流|FAC|辐射热点|疲劳|安注管路|主泵密封/);
  assert.doesNotMatch(taskText, /裂缝|岩爆|瓦斯|暗流|蒸馏塔/);
});

test('refinery robots use refinery-specific tasks and snake model deployment', () => {
  const robots = generateMockRobots('refinery', 'refinery');
  const taskText = robots.map((robot) => robot.task).join('\n');
  const snakeCount = robots.filter((robot) => robot.model === 'snake').length;

  assert.ok(snakeCount / robots.length > 0.45, 'refinery robots should be snake-dominant while allowing tracked/climbing support models');
  assert.match(taskText, /储罐|反应釜|人孔|壁厚|H₂S|O₂|可燃气体/);
  assert.doesNotMatch(taskText, /裂缝|岩爆|剂量率|暗流|采空区/);
});

test('industrial robot positions do not exactly overlap when fleets outnumber path points', () => {
  for (const [dataSource, scenario] of [
    ['pipeline', 'pipeline'],
    ['nuclear', 'nuclear'],
    ['refinery', 'refinery'],
  ] as const) {
    const robots = generateMockRobots(dataSource, scenario);
    const unique = new Set(robots.map((robot) => robot.position.join(',')));

    assert.equal(unique.size, robots.length, `${scenario} robots should have unique mock positions`);
  }
});
