// Refreshes the self-contained demo DB (demo/crawler.db) with one site's HTTP-detection inputs, copied
// from the full crawler DB (storage/crawler.db). Run it after a fresh crawl/analysis of the app under
// test so the demo always reflects the latest collected data. The demo stays HTTP-only and fully
// offline/deterministic — see demo/README.md and scripts/runDemo.ts.
//
// Usage:
//   npx tsx scripts/buildDemo.ts <START_URL>
//   npx tsx scripts/buildDemo.ts https://www.busuu.com/dashboard  --src storage/crawler.db  --dest demo/crawler.db
//
// SITE is derived from START_URL's hostname (the same label the crawler stores a site's rows under).
import { exportSiteToDemoDb } from '../src/db/demoExport';
import { config } from '../src/config';

function flag(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const startUrl = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : process.env.START_URL;
if (!startUrl) {
  console.error('Usage: npx tsx scripts/buildDemo.ts <START_URL> [--src storage/crawler.db] [--dest demo/crawler.db]');
  process.exit(1);
}
let site: string;
try {
  site = new URL(startUrl).hostname;
} catch {
  console.error(`Not a valid URL: ${startUrl}`);
  process.exit(1);
}

const sourceDbPath = flag('src', config.db.path);
const destDbPath = flag('dest', config.db.demoPath);

console.log(`Building demo snapshot for ${site}`);
console.log(`  source: ${sourceDbPath}`);
console.log(`  dest:   ${destDbPath}`);

const result = exportSiteToDemoDb({ sourceDbPath, destDbPath, site });

console.log('  copied rows:');
for (const [table, n] of Object.entries(result.counts)) console.log(`    ${table.padEnd(22)} ${n}`);
console.log(`  source currently has ${result.sourceHttpFindings} HTTP finding(s) for ${site} — the demo should re-derive the same number.`);
console.log(`\nDone. Verify with:\n  npx tsx scripts/runDemo.ts ${startUrl}`);
