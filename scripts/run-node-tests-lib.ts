import { readdir } from 'node:fs/promises';
import path from 'node:path';

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const results: string[] = [];

  for (const entry of entries) {
    const next = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await walk(next));
      continue;
    }
    results.push(next);
  }

  return results;
}

export async function resolveNodeTestEntries(entries: string[], root: string): Promise<string[]> {
  if (entries.length > 0) {
    return entries;
  }

  const srcDir = path.join(root, 'src');
  const scriptDir = path.join(root, 'scripts');
  const files = [
    ...(await walk(srcDir)),
    ...(await walk(scriptDir)),
  ];

  return files
    .filter((file) => file.endsWith('.test.ts') || file.endsWith('.test.tsx'))
    .map((file) => path.relative(root, file))
    .sort();
}
