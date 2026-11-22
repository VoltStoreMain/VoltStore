import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repository = fileURLToPath(new URL('../', import.meta.url));
export const previewDirectory = path.join(repository, 'preview');

// Deliberate allowlist: never copy the live shop, production config or functions.
const assets = [
  'market.html', 'market.css', 'market-core.js', 'market.js',
  'mobile-shell.css', 'mobile-shell.js', 'photo-store.js', 'pwa-client.js',
  'voltdeal.html', 'voltdeal.css', 'voltdeal-core.js', 'voltdeal.js',
  'voltguide.html', 'voltguide.css', 'voltguide-core.js', 'voltguide.js',
  'passport-core.js', 'passport-app.js', 'voltpassport.html', 'voltpassport.css',
  'voltcheck-all.html', 'voltcheck-all.css', 'voltcheck-all.js',
  'offline.html', 'manifest.webmanifest', 'sw.js',
  'icons/voltstore-192.png', 'icons/voltstore-512.png', 'icons/voltstore-maskable-512.png'
];

export const contentSecurityPolicy = [
  "default-src 'self'", "script-src 'self'", "connect-src 'self'",
  "img-src 'self' data: blob:", "style-src 'self' 'unsafe-inline'",
  "worker-src 'self'", "object-src 'none'", "base-uri 'none'", "form-action 'none'"
].join('; ');

function isolatedHtml(html) {
  // The real passport may use Supabase. The demo needs no remote SDK at all.
  const local = html.replace(/\s*<script\b[^>]*\bsrc=["']https?:\/\/[^"']+["'][^>]*>\s*<\/script>/gi, '');
  return local.replace(/<head>/i, '<head>\n  <meta http-equiv="Content-Security-Policy" content="' + contentSecurityPolicy + '">');
}

const index = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive">
<meta http-equiv="refresh" content="0;url=./market.html">
<title>VoltStore — тестовая версия</title></head>
<body><p>Демо без реальных сделок и оплаты.</p><a href="./market.html">Открыть каталог</a></body></html>
`;

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, {cwd: repository, encoding: 'utf8'}).trim();

async function filesIn(directory, prefix = '') {
  const result = [];
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const name = prefix + entry.name;
    if (entry.isDirectory()) result.push(...await filesIn(path.join(directory, entry.name), name + '/'));
    else if (entry.isFile()) result.push(name);
    else throw new Error('Preview must not contain links or special files: ' + name);
  }
  return result.sort();
}

function assertIsolated(name, bytes) {
  if (!/\.(?:js|html|json|webmanifest|txt)$/.test(name)) return;
  const text = bytes.toString('utf8');
  if (/https?:\/\/[a-z0-9.-]+\.supabase\.(?:co|com)\b/i.test(text) ||
      /\beyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/.test(text)) {
    throw new Error('Backend URL or credential found in demo asset: ' + name);
  }
  if (name.endsWith('.html') && /<script\b[^>]*\bsrc=["']https?:\/\//i.test(text)) {
    throw new Error('Remote script found in demo HTML: ' + name);
  }
}

export async function buildPreview({outDir = previewDirectory} = {}) {
  const destination = path.resolve(outDir);
  // Only replace a generated directory explicitly named preview, never the repo.
  if (path.basename(destination) !== 'preview' || destination === repository.replace(/\/$/, '')) {
    throw new Error('Output directory must be named preview');
  }
  const sourceCommit = git('rev-parse', 'HEAD');
  const sourceDirty = !!git('status', '--porcelain', '--untracked-files=normal');
  await mkdir(path.dirname(destination), {recursive: true});
  const staging = await mkdtemp(path.join(path.dirname(destination), '.voltstore-preview-'));
  try {
    const generated = new Map([
      ['index.html', isolatedHtml(index)],
      ['config.js', 'window.VOLT_CONFIG = Object.freeze({supabaseUrl:"",supabaseAnonKey:"",paymentProvider:"disabled"});\n'],
      ['robots.txt', 'User-agent: *\nDisallow: /\n'],
      ['vercel.json', JSON.stringify({headers: [{source: '/(.*)', headers: [
        {key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive'},
        {key: 'X-VoltStore-Preview', value: 'demo-only'},
        {key: 'X-Content-Type-Options', value: 'nosniff'},
        {key: 'Content-Security-Policy', value: contentSecurityPolicy}
      ]}]}, null, 2) + '\n']
    ]);
    for (const asset of assets) {
      let bytes = await readFile(path.join(repository, asset));
      if (asset.endsWith('.html')) bytes = Buffer.from(isolatedHtml(bytes.toString('utf8')));
      generated.set(asset, bytes);
    }
    const files = [];
    for (const [name, content] of [...generated.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
      const bytes = Buffer.from(content);
      assertIsolated(name, bytes);
      await mkdir(path.dirname(path.join(staging, name)), {recursive: true});
      await writeFile(path.join(staging, name), bytes);
      files.push({path: name, bytes: bytes.length, sha256: digest(bytes)});
    }
    const manifest = {
      version: 1, mode: 'demo-only',
      sourceCommit, sourceDirty,
      artifactDigest: digest(JSON.stringify(files)), files
    };
    await writeFile(path.join(staging, 'build-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    await rm(destination, {recursive: true, force: true});
    await rename(staging, destination);
    return manifest;
  } catch (error) {
    await rm(staging, {recursive: true, force: true});
    throw error;
  }
}

export async function verifyPreview(directory = previewDirectory) {
  const manifest = JSON.parse(await readFile(path.join(directory, 'build-manifest.json'), 'utf8'));
  if (manifest.version !== 1 || manifest.mode !== 'demo-only' || manifest.sourceCommit !== git('rev-parse', 'HEAD')) {
    throw new Error('Preview does not match the checked-out source commit');
  }
  if (manifest.artifactDigest !== digest(JSON.stringify(manifest.files))) throw new Error('Invalid preview manifest');
  const names = await filesIn(directory);
  const allowed = new Set(assets.concat('index.html', 'config.js', 'robots.txt', 'vercel.json'));
  const expected = [...allowed].sort();
  if (JSON.stringify(manifest.files.map(file => file.path).sort()) !== JSON.stringify(expected) ||
      JSON.stringify(names) !== JSON.stringify(expected.concat('build-manifest.json').sort())) {
    throw new Error('Unexpected or missing preview files');
  }
  for (const file of manifest.files) {
    if (!allowed.has(file.path)) throw new Error('File outside demo allowlist: ' + file.path);
    const bytes = await readFile(path.join(directory, file.path));
    assertIsolated(file.path, bytes);
    if (bytes.length !== file.bytes || digest(bytes) !== file.sha256) throw new Error('Preview asset changed: ' + file.path);
  }
  return manifest;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const manifest = process.argv.includes('--verify') ? await verifyPreview() : await buildPreview();
  console.log(`Demo-only preview: ${manifest.files.length} files; source ${manifest.sourceCommit}; sha256 ${manifest.artifactDigest}${manifest.sourceDirty ? ' (uncommitted source changes)' : ''}`);
}
