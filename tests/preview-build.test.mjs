import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {buildPreview, verifyPreview} from '../scripts/build-preview.mjs';

test('demo artifact is isolated, reproducible and detects stale or altered files', async t => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'voltstore-build-test-'));
  t.after(() => rm(temporary, {recursive: true, force: true}));
  const outDir = path.join(temporary, 'preview');
  const originalConfig = await readFile(new URL('../config.js', import.meta.url));
  const manifest = await buildPreview({outDir});
  const read = name => readFile(path.join(outDir, name), 'utf8');
  const names = manifest.files.map(file => file.path);
  for (const forbidden of ['app.js', 'live.js', 'styles.css', 'voltcheck.html']) assert.ok(!names.includes(forbidden));
  assert.ok(!names.some(name => /^(?:netlify|supabase)\//.test(name)));
  const context = {window: {}};
  vm.runInNewContext(await read('config.js'), context);
  assert.equal(context.window.VOLT_CONFIG.supabaseUrl, '');
  assert.equal(context.window.VOLT_CONFIG.supabaseAnonKey, '');
  assert.equal(context.window.VOLT_CONFIG.paymentProvider, 'disabled');
  assert.ok(Object.isFrozen(context.window.VOLT_CONFIG));
  assert.match(await read('index.html'), /url=\.\/market\.html/);
  assert.doesNotMatch(await read('index.html'), /app\.js|live\.js|name="cn"|name="cv"/);
  assert.doesNotMatch(await read('voltpassport.html'), /<script[^>]*src="https?:/);
  for (const page of ['market', 'voltdeal', 'voltguide', 'voltpassport', 'voltcheck-all']) {
    assert.match(await read(page + '.html'), /Content-Security-Policy/);
  }
  for (const file of manifest.files) {
    const bytes = await readFile(path.join(outDir, file.path));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
  }
  const sw = await read('sw.js');
  const precache = [...sw.match(/const STATIC=\[([\s\S]*?)\];/)[1].matchAll(/'\.\/([^']+)'/g)].map(match => match[1]);
  for (const name of precache) assert.ok(names.includes(name), 'Missing offline asset: ' + name);
  assert.deepEqual(await verifyPreview(outDir), manifest);
  assert.deepEqual(await buildPreview({outDir}), manifest);
  assert.deepEqual(await readFile(new URL('../config.js', import.meta.url)), originalConfig);

  await writeFile(path.join(outDir, 'market.js'), '// unexpected change');
  await assert.rejects(verifyPreview(outDir), /asset changed/);
  await buildPreview({outDir});
  await writeFile(path.join(outDir, 'live.js'), '// must never ship');
  await assert.rejects(verifyPreview(outDir), /Unexpected/);
  await buildPreview({outDir});
  const stale = JSON.parse(await read('build-manifest.json'));
  stale.sourceCommit = '0'.repeat(40);
  await writeFile(path.join(outDir, 'build-manifest.json'), JSON.stringify(stale));
  await assert.rejects(verifyPreview(outDir), /source commit/);
  await assert.rejects(buildPreview({outDir: temporary}), /must be named preview/);
});
