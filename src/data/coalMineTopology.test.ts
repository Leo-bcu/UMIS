import test from 'node:test';
import assert from 'node:assert/strict';
import { generateFractureNetwork, getAllPathPoints } from './fractureDataGenerator';
import { generateMockRobots } from './robotDataGenerator';

function distanceToNearestPathPoint(
  position: [number, number, number],
  points: [number, number, number][],
): number {
  return Math.min(
    ...points.map((point) =>
      Math.hypot(position[0] - point[0], position[1] - point[1], position[2] - point[2]),
    ),
  );
}

test('coal scenario models a realistic mine entry, roadway, goaf, drainage, and sealing topology', () => {
  const fractures = generateFractureNetwork('coal');
  const names = fractures.map((fracture) => fracture.name).join('\n');

  assert.match(names, /地表投放|井口|斜井|主井/);
  assert.match(names, /主运输巷|回风巷|联络巷/);
  assert.match(names, /采空区|老窑/);
  assert.match(names, /封堵墙|注浆孔/);
  assert.match(names, /暗流|排水|涌水/);

  const entries = fractures.filter((fracture) => /地表投放|井口|斜井|主井/.test(fracture.name));
  assert.ok(entries.some((fracture) => fracture.path[0][1] >= 8), 'mine robots should have a visible surface/portal release point');

  const allPoints = fractures.flatMap((fracture) => fracture.path);
  const yValues = allPoints.map((point) => point[1]);
  const minY = Math.min(...yValues);
  const maxY = Math.max(...yValues);
  assert.ok(maxY - minY >= 58, 'coal mine topology should read as a vertical cutaway, not a flat plan');
  assert.ok(allPoints.some((point) => point[1] >= 8), 'vertical cutaway should include a compact surface or near-surface entry');
  assert.ok(allPoints.some((point) => point[1] <= -45), 'vertical cutaway should include deep mine workings');

  const upperRoadways = fractures.filter((fracture) => /主运输巷|回风巷/.test(fracture.name));
  assert.ok(
    upperRoadways.some((fracture) => fracture.path.some((point) => point[1] < -15 && point[1] > -36)),
    'upper roadways should descend into the mine instead of staying near the surface',
  );

  const goaf = fractures.filter((fracture) => /采空区|老窑/.test(fracture.name));
  assert.ok(goaf.some((fracture) => fracture.sensorReading.ch4_pct >= 2.2), 'goaf/sealed areas should carry gas accumulation evidence');
  assert.ok(goaf.some((fracture) => fracture.path.some((point) => point[1] <= -38)), 'goaf cavities should sit in deeper workings');

  const water = fractures.filter((fracture) => /暗流|排水|涌水/.test(fracture.name));
  assert.ok(water.some((fracture) => fracture.sensorReading.water_pressure_mpa >= 4.5), 'drainage/runoff zones should carry hydraulic evidence');
  assert.ok(water.some((fracture) => fracture.path.some((point) => point[1] <= -48)), 'drainage/runoff zones should sit near the low point of the section');

  const cavities = fractures.filter((fracture) => fracture.morphology === 'cavity');
  assert.ok(cavities.length >= 4, 'coal mine should include multiple chamber/goaf voids');
  for (const cavity of cavities) {
    const xs = cavity.path.map((point) => point[0]);
    const ys = cavity.path.map((point) => point[1]);
    const zs = cavity.path.map((point) => point[2]);
    const spanX = Math.max(...xs) - Math.min(...xs);
    const spanY = Math.max(...ys) - Math.min(...ys);
    const spanZ = Math.max(...zs) - Math.min(...zs);
    assert.ok(spanX >= 5 || spanZ >= 5, `${cavity.name} should read as an elongated chamber, not a sphere`);
    assert.ok(spanY <= Math.max(spanX, spanZ) * 0.55, `${cavity.name} should keep a low roof-to-floor ratio`);
  }
});

test('coal robots deploy from the entry network and stay on mine roadway paths', () => {
  generateFractureNetwork('coal');
  const pathPoints = getAllPathPoints();
  const robots = generateMockRobots('fracture', 'coal');
  const nearPathCount = robots.filter((robot) => distanceToNearestPathPoint(robot.position, pathPoints) <= 0.65).length;

  assert.equal(robots.length, 200);
  assert.ok(nearPathCount / robots.length > 0.94, 'coal robots should be constrained to mapped mine paths');

  const firstTwentyAvgDepth =
    robots.slice(0, 20).reduce((sum, robot) => sum + robot.depth, 0) / 20;
  const lastTwentyAvgDepth =
    robots.slice(-20).reduce((sum, robot) => sum + robot.depth, 0) / 20;
  assert.ok(lastTwentyAvgDepth > firstTwentyAvgDepth + 40, 'later robots should be deeper in the explored mine topology');

  const tasks = robots.map((robot) => robot.task).join('\n');
  assert.match(tasks, /入口投放|巷道建图|采空区|瓦斯积聚|暗流|封堵/);
});
