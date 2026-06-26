import { mkdir, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { resolveNodeTestEntries } from './run-node-tests-lib.ts';
import { nodeTestEsbuildOptions, resolveNodeTestOutPath } from './run-node-tests-runner.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outdir = path.join(root, 'node_modules/.tmp/node-tests');
const entries = await resolveNodeTestEntries(process.argv.slice(2), root);

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });

const outputs = [];

for (const entry of entries) {
  const absEntry = path.resolve(root, entry);
  const outFile = resolveNodeTestOutPath(outdir, entry);
  await esbuild.build({
    entryPoints: [absEntry],
    ...nodeTestEsbuildOptions(outFile),
  });
  outputs.push(outFile);
}

const result = spawnSync(process.execPath, ['--test', ...outputs], {
  cwd: root,
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
