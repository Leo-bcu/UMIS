import { mkdir, rm, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import * as esbuild from 'esbuild';

await rm('node_modules/.tmp/check-all-connect', { recursive: true, force: true });
await mkdir('node_modules/.tmp/check-all-connect', { recursive: true });

await esbuild.build({
  entryPoints: ['src/data/fractureDataGenerator.ts', 'src/data/pipelineDataGenerator.ts', 'src/data/nuclearDataGenerator.ts', 'src/data/refineryDataGenerator.ts', 'src/data/undergroundDataGenerator.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outdir: 'node_modules/.tmp/check-all-connect',
});

await writeFile('node_modules/.tmp/check-all-connect/package.json', '{"type":"module"}');

const { generateFractureNetwork } = await import(pathToFileURL('node_modules/.tmp/check-all-connect/fractureDataGenerator.js'));
const { generatePipelineNetwork } = await import(pathToFileURL('node_modules/.tmp/check-all-connect/pipelineDataGenerator.js'));
const { generateNuclearNetwork } = await import(pathToFileURL('node_modules/.tmp/check-all-connect/nuclearDataGenerator.js'));
const { generateRefineryNetwork } = await import(pathToFileURL('node_modules/.tmp/check-all-connect/refineryDataGenerator.js'));
const { generateUndergroundNetwork } = await import(pathToFileURL('node_modules/.tmp/check-all-connect/undergroundDataGenerator.js'));

const scenarios = [
  ['coal', () => generateFractureNetwork('coal')],
  ['gold', () => generateFractureNetwork('gold')],
  ['oil', () => generateFractureNetwork('oil')],
  ['pipeline', () => generatePipelineNetwork()],
  ['nuclear', () => generateNuclearNetwork()],
  ['refinery', () => generateRefineryNetwork()],
  ['underground', () => generateUndergroundNetwork()],
];

for (const [sc, gen] of scenarios) {
  const fractures = gen();
  const TOL = 1.5;
  const pts = [];
  fractures.forEach((f, ci) => f.path.forEach((p, pi) => pts.push({ ci, x: p[0], y: p[1], z: p[2], pi })));
  const parent = fractures.map((_, i) => i);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };
  let connections = 0;
  for (let i = 0; i < pts.length; i++) {
    for (let j = i + 1; j < pts.length; j++) {
      if (pts[i].ci === pts[j].ci) continue;
      const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y, dz = pts[i].z - pts[j].z;
      if (dx*dx + dy*dy + dz*dz < TOL*TOL) { union(pts[i].ci, pts[j].ci); connections++; }
    }
  }
  const comps = new Set(fractures.map((_, i) => find(i)));
  const compMap = {};
  fractures.forEach((f, i) => { const r = find(i); (compMap[r] = compMap[r] || []).push(f.type); });
  const mainCount = fractures.filter(f => f.type === 'main').length;
  const branchCount = fractures.filter(f => f.type === 'branch').length;
  console.log(`${sc.padEnd(11)}: ${String(fractures.length).padStart(2)}通道(主${mainCount}/支${branchCount}) | ${comps.size}分量 | ${connections}连接`);
}
