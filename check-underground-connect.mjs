// Underground connectivity check — Union-Find graph theory
import { generateUndergroundNetwork } from './src/data/undergroundDataGenerator.ts';

const channels = generateUndergroundNetwork();

// Sample path points for proximity matching
const TOL = 1.2;
const allPoints = [];
channels.forEach((ch, ci) => {
  ch.path.forEach((p, pi) => {
    allPoints.push({ ch: ci, pt: pi, x: p[0], y: p[1], z: p[2] });
  });
});

// Union-Find
const parent = Array(channels.length).fill(0).map((_, i) => i);
function find(x) { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; }
function union(a, b) { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; }

// Check proximity between all sample points across different channels
for (let i = 0; i < allPoints.length; i++) {
  for (let j = i + 1; j < allPoints.length; j++) {
    if (allPoints[i].ch === allPoints[j].ch) continue;
    const dx = allPoints[i].x - allPoints[j].x;
    const dy = allPoints[i].y - allPoints[j].y;
    const dz = allPoints[i].z - allPoints[j].z;
    if (dx*dx + dy*dy + dz*dz < TOL * TOL) {
      union(allPoints[i].ch, allPoints[j].ch);
    }
  }
}

// Count components
const components = new Set();
for (let i = 0; i < channels.length; i++) components.add(find(i));

// Find disconnected channels
const compMap = {};
for (let i = 0; i < channels.length; i++) {
  const r = find(i);
  if (!compMap[r]) compMap[r] = [];
  compMap[r].push(channels[i].name);
}

console.log(`\n=== Underground Channel Connectivity Check ===`);
console.log(`Total channels: ${channels.length}`);
console.log(`Connected components: ${components.size}`);
console.log(`Disconnected channels: ${channels.length - (compMap[find(0)]?.length || 0)}`);

if (components.size === 1) {
  console.log(`✅ ALL CONNECTED — 1 component, 0 disconnected`);
} else {
  console.log(`\n❌ DISCONNECTED — ${components.size} components:`);
  Object.entries(compMap).forEach(([root, names]) => {
    console.log(`  Component (root=${root}): ${names.join(', ')}`);
  });
}

// Diameter stats
const dias = channels.map(ch => ch.porosity);
console.log(`\nDiameter range: ${Math.min(...dias).toFixed(2)}m ~ ${Math.max(...dias).toFixed(2)}m`);
console.log(`Channel types:`);
const types = {};
channels.forEach(ch => {
  const t = ch.name.includes('溶洞') ? 'chamber' : ch.name.includes('狭窄') ? 'constriction' : ch.name.includes('盲端') ? 'blind_end' : ch.name.includes('支流') || ch.name.includes('汇流') ? 'tributary' : 'trunk';
  types[t] = (types[t] || 0) + 1;
});
Object.entries(types).forEach(([t, c]) => console.log(`  ${t}: ${c}`));
