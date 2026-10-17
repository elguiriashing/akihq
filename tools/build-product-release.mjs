import { cp, mkdir, readFile, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = ['assets', 'index.html', 'manifest.webmanifest', 'sw.js', 'config.js', '_headers', '_redirects', 'LICENSE', 'NOTICE', 'VERSION'];

// Produce an isolated static Pages artifact. Source files, auth contracts, RPCs,
// storage keys and provider resource names stay stable across the role swap.
export async function buildProductRelease(output, roleSwap = process.env.NEXT_PUBLIC_AKISUITE_ROLE_SWAP === 'true') {
  const destination = path.resolve(output);
  if (destination === path.resolve(root) || path.resolve(root).startsWith(destination + path.sep)) throw new Error('Output must not contain the source repository.');
  try { await access(destination); throw new Error('Output must be a new directory.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  await mkdir(destination, { recursive: true });
  for (const file of files) await cp(path.join(root, file), path.join(destination, file), { recursive: true });
  if (roleSwap) {
    const changes = JSON.parse(await readFile(new URL('./operations-product-release.json', import.meta.url), 'utf8'));
    for (const [file, rules] of Object.entries(changes)) {
      let source = await readFile(path.join(destination, file), 'utf8');
      for (const { from, to } of rules) {
        if (!from || source.split(from).length !== 2) throw new Error(`Release transformation no longer matches exactly once: ${file}. Review the source changes before release.`);
        source = source.replace(from, to);
      }
      await writeFile(path.join(destination, file), source);
    }
  }
  const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  const sourceTreeDirty = Boolean(execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], { cwd: root, encoding: 'utf8' }).trim());
  await writeFile(path.join(destination, 'release-source.json'), JSON.stringify({ sourceCommit, sourceTreeDirty, roleSwap, product: roleSwap ? 'AkiBusiness' : 'AkiHQ', canonicalOrigin: roleSwap ? 'https://akibusiness.com' : 'https://akihq.app' }, null, 2) + '\n');
  return destination;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(await buildProductRelease(process.argv[2] || path.join(root, 'dist-product')));
}
