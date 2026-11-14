// Deterministic SQL text dump of a SQLite DB (for readable git diffs via textconv).
// Usage: node scripts/db-dump.ts [path]   (default db/eagles.db)
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';

export function dumpSql(path: string): string {
  const db = new DatabaseSync(path, { readOnly: true });
  const out: string[] = [];
  try {
    const objs = db.prepare(
      "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND sql IS NOT NULL ORDER BY (type = 'table') DESC, tbl_name, type DESC, name",
    ).all() as { type: string; name: string; sql: string }[];
    for (const o of objs.filter((x) => x.type === 'table')) {
      out.push(`${o.sql};`);
    }
    for (const o of objs.filter((x) => x.type === 'table')) {
      const info = db.prepare(`PRAGMA table_info("${o.name}")`).all() as { name: string; pk: number }[];
      const pk = info.filter((c) => c.pk > 0).sort((a, b) => a.pk - b.pk).map((c) => `"${c.name}"`);
      const all = info.map((c) => `"${c.name}"`);
      const order = pk.length ? pk.join(', ') : all.join(', ');
      const q = all.map((c) => `quote(${c})`).join(" || ',' || ");
      for (const r of db.prepare(`SELECT ${q} AS v FROM "${o.name}" ORDER BY ${order}, ${all.join(', ')}`).all() as { v: string }[]) {
        out.push(`INSERT INTO "${o.name}" VALUES(${r.v});`);
      }
    }
    for (const o of objs.filter((x) => x.type !== 'table')) out.push(`${o.sql};`);
  } finally {
    db.close();
  }
  return out.join('\n') + '\n';
}

if (import.meta.main) {
  process.stdout.write(dumpSql(resolve(process.argv[2] ?? 'db/eagles.db')));
}
