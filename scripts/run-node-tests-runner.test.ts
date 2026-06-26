import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createNodeTestOutfile, nodeTestEsbuildOptions } from './run-node-tests-runner.ts';

describe('node test runner helpers', () => {
  it('normalizes output file names so dotted test basenames stay loadable', () => {
    const outfile = createNodeTestOutfile('src/store/useSceneStore.dataSource.test.ts');

    assert.equal(outfile, 'src_store_useSceneStore_dataSource_test.mjs');
  });

  it('injects a safe import.meta.env default for node-bundled tests', () => {
    const options = nodeTestEsbuildOptions('/tmp/out.mjs');

    assert.match(options.banner?.js ?? '', /import\.meta\.env/);
    assert.match(options.banner?.js ?? '', /VITE_API_MODE/);
  });
});
