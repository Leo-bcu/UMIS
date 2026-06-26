#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const [inputPath, outputPath, sampleArg = '4'] = process.argv.slice(2);

if (!inputPath || !outputPath) {
  console.error('Usage: node scripts/convert-wrl-to-obj.mjs <input.wrl> <output.obj> [sampleStep]');
  process.exit(1);
}

const sampleStep = Math.max(1, Number.parseInt(sampleArg, 10) || 1);
const text = fs.readFileSync(inputPath, 'utf8');

const coordStart = text.indexOf('coord Coordinate { point [');
if (coordStart < 0) throw new Error('Cannot find VRML coord Coordinate point block.');
const coordEnd = text.indexOf(']', coordStart);
const coordNumbers = text.slice(coordStart, coordEnd).match(/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g) ?? [];

const faceStart = text.indexOf('coordIndex [', coordEnd);
if (faceStart < 0) throw new Error('Cannot find VRML coordIndex block.');
const faceEnd = text.indexOf(']', faceStart);
const indexNumbers = text.slice(faceStart, faceEnd).match(/-?\d+/g) ?? [];

const vertices = [];
for (let i = 0; i < coordNumbers.length; i += 3) {
  vertices.push([
    Number.parseFloat(coordNumbers[i]),
    Number.parseFloat(coordNumbers[i + 1]),
    Number.parseFloat(coordNumbers[i + 2]),
  ]);
}

const used = new Map();
const faces = [];
let polygon = [];
let faceCounter = 0;

for (const token of indexNumbers) {
  const index = Number.parseInt(token, 10);
  if (index === -1) {
    if (polygon.length >= 3 && faceCounter % sampleStep === 0) {
      const remapped = polygon.map((vertexIndex) => {
        if (!used.has(vertexIndex)) used.set(vertexIndex, used.size + 1);
        return used.get(vertexIndex);
      });
      for (let i = 1; i < remapped.length - 1; i += 1) {
        faces.push([remapped[0], remapped[i], remapped[i + 1]]);
      }
    }
    faceCounter += 1;
    polygon = [];
  } else {
    polygon.push(index);
  }
}

const orderedVertices = Array.from(used.entries())
  .sort((a, b) => a[1] - b[1])
  .map(([vertexIndex]) => vertices[vertexIndex]);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
const stream = fs.createWriteStream(outputPath);
stream.write(`# Converted from ${path.basename(inputPath)}\n`);
stream.write(`# Source vertices: ${vertices.length}; sampled faces: ${faces.length}; sampleStep: ${sampleStep}\n`);
stream.write('o real_mine_reference\n');
for (const [x, y, z] of orderedVertices) {
  stream.write(`v ${x} ${y} ${z}\n`);
}
for (const [a, b, c] of faces) {
  stream.write(`f ${a} ${b} ${c}\n`);
}
stream.end();

stream.on('finish', () => {
  console.log(JSON.stringify({
    input: inputPath,
    output: outputPath,
    sourceVertices: vertices.length,
    exportedVertices: orderedVertices.length,
    exportedFaces: faces.length,
    sampleStep,
  }, null, 2));
});
