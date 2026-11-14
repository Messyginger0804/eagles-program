// Run after `npm run build`. Verifies every internal URL in dist/**/*.html is
// base-prefixed and resolves to a real file.
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const BASE = '/eagles-program/';
const dist = resolve(process.argv[2] ?? 'dist');
const origin = 'https://local.invalid';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function exists(pathname: string): boolean {
  const rel = decodeURIComponent(pathname.slice(BASE.length));
  const target = resolve(dist, rel);
  if (target !== dist && !target.startsWith(dist + sep)) return false;
  if (rel === '' || rel.endsWith('/')) return existsSync(join(target, 'index.html'));
  return existsSync(target) && statSync(target).isFile();
}

const attr = /\b(href|src|action)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;
const failures: string[] = [];
let checked = 0;

for (const file of walk(dist).filter((f) => f.endsWith('.html'))) {
  const html = readFileSync(file, 'utf8');
  const rel = relative(dist, file).split(sep).join('/');
  const pageUrl = new URL(rel.replace(/(^|\/)index\.html$/, '$1'), origin + BASE);
  for (const m of html.matchAll(attr)) {
    const raw = (m[2] ?? m[3]).trim();
    if (!raw || raw.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(raw) || raw.startsWith('//')) continue;
    checked++;
    if (raw.startsWith('/') && !raw.startsWith(BASE)) {
      failures.push(`${rel}: ${m[1]}="${raw}" does not start with ${BASE}`);
      continue;
    }
    const u = new URL(raw, pageUrl);
    if (!u.pathname.startsWith(BASE)) {
      failures.push(`${rel}: ${m[1]}="${raw}" resolves outside ${BASE} (${u.pathname})`);
    } else if (!exists(u.pathname)) {
      failures.push(`${rel}: ${m[1]}="${raw}" -> missing ${u.pathname}`);
    }
  }
}

for (const f of failures) console.error(f);
console.log(`check:links: ${checked} internal URLs checked, ${failures.length} failures`);
process.exit(failures.length ? 1 : 0);
