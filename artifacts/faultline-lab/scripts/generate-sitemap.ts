import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROUTE_SEO, CANONICAL_ORIGIN } from '../src/lib/seo';
import type { AppView } from '../src/types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OUT = resolve(ROOT, 'public', 'sitemap.xml');

interface RouteMeta {
  changefreq: string;
  priority: string;
}

const ROUTE_META: Partial<Record<AppView, RouteMeta>> = {
  'incident-board': { changefreq: 'weekly', priority: '1.0' },
  store: { changefreq: 'weekly', priority: '0.8' },
  pricing: { changefreq: 'monthly', priority: '0.9' },
  daily: { changefreq: 'daily', priority: '0.8' },
  sandbox: { changefreq: 'monthly', priority: '0.6' },
  auth: { changefreq: 'yearly', priority: '0.4' },
  profile: { changefreq: 'monthly', priority: '0.4' },
  settings: { changefreq: 'yearly', priority: '0.3' },
};

const EXCLUDED_VIEWS: ReadonlySet<AppView> = new Set<AppView>([
  'boot',
  'investigation',
  'debrief',
  'admin',
  'account',
]);

const DEFAULT_META: RouteMeta = { changefreq: 'monthly', priority: '0.5' };

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function build(): string {
  const seen = new Set<string>();
  const entries: { loc: string; meta: RouteMeta }[] = [];

  for (const view of Object.keys(ROUTE_SEO) as AppView[]) {
    if (EXCLUDED_VIEWS.has(view)) continue;
    const seo = ROUTE_SEO[view];
    if (seen.has(seo.path)) continue;
    seen.add(seo.path);
    entries.push({
      loc: `${CANONICAL_ORIGIN}${seo.path}`,
      meta: ROUTE_META[view] ?? DEFAULT_META,
    });
  }

  const urls = entries
    .map(
      ({ loc, meta }) =>
        `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <changefreq>${meta.changefreq}</changefreq>\n    <priority>${meta.priority}</priority>\n  </url>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function main(): void {
  const xml = build();
  writeFileSync(OUT, xml, 'utf8');
  console.log(`[sitemap] wrote ${OUT}`);
}

main();
