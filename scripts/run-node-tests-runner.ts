import path from 'node:path';
import type { BuildOptions } from 'esbuild';

export function createNodeTestOutfile(entry: string): string {
  return entry
    .replace(/[\\/]/g, '_')
    .replace(/\./g, '_')
    .replace(/_tsx?$/, '.mjs');
}

export function nodeTestEsbuildOptions(outfile: string): BuildOptions {
  return {
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    sourcemap: 'inline',
    external: ['react', 'react-dom', 'three', '@react-three/fiber', '@react-three/drei'],
    banner: {
      js: 'import.meta.env ??= { VITE_API_MODE: "mock" };',
    },
  };
}

export function resolveNodeTestOutPath(outdir: string, entry: string) {
  return path.join(outdir, createNodeTestOutfile(entry));
}
