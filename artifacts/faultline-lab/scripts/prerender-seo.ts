import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AppView } from '../src/types';
import { ROUTE_SEO, CANONICAL_ORIGIN } from '../src/lib/seo';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const DIST = resolve(ROOT, 'dist', 'public');
const SOURCE_INDEX = resolve(DIST, 'index.html');
const DEFAULT_OG_IMAGE = '/og-image.jpg';

interface PrerenderTarget {
  view: AppView;
  outPath: string;
}

const TARGETS: PrerenderTarget[] = [
  { view: 'boot', outPath: 'index.html' },
  { view: 'store', outPath: 'store/index.html' },
  { view: 'pricing', outPath: 'pricing/index.html' },
  { view: 'daily', outPath: 'daily/index.html' },
  { view: 'sandbox', outPath: 'sandbox/index.html' },
];

function escapeHtmlAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeHtmlText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function replaceTitle(html: string, title: string): string {
  return html.replace(
    /<title>[\s\S]*?<\/title>/,
    `<title>${escapeHtmlText(title)}</title>`,
  );
}

function replaceMetaName(html: string, name: string, content: string): string {
  const re = new RegExp(`<meta\\s+name=["']${name}["'][^>]*>`, 'i');
  const tag = `<meta name="${name}" content="${escapeHtmlAttr(content)}" />`;
  return re.test(html) ? html.replace(re, tag) : html.replace('</head>', `    ${tag}\n  </head>`);
}

function replaceMetaProperty(html: string, property: string, content: string): string {
  const re = new RegExp(`<meta\\s+property=["']${property}["'][^>]*>`, 'i');
  const tag = `<meta property="${property}" content="${escapeHtmlAttr(content)}" />`;
  return re.test(html) ? html.replace(re, tag) : html.replace('</head>', `    ${tag}\n  </head>`);
}

function setCanonical(html: string, href: string): string {
  const re = /<link\s+rel=["']canonical["'][^>]*>/i;
  const tag = `<link rel="canonical" href="${escapeHtmlAttr(href)}" />`;
  return re.test(html) ? html.replace(re, tag) : html.replace('</head>', `    ${tag}\n  </head>`);
}

function renderRoute(sourceHtml: string, view: AppView): string {
  const seo = ROUTE_SEO[view];
  const url = `${CANONICAL_ORIGIN}${seo.path}`;
  const ogTitle = seo.ogTitle ?? seo.title;
  const ogDescription = seo.ogDescription ?? seo.description;
  const ogImage = `${CANONICAL_ORIGIN}${DEFAULT_OG_IMAGE}`;

  let html = sourceHtml;
  html = replaceTitle(html, seo.title);
  html = replaceMetaName(html, 'description', seo.description);
  html = replaceMetaProperty(html, 'og:title', ogTitle);
  html = replaceMetaProperty(html, 'og:description', ogDescription);
  html = replaceMetaProperty(html, 'og:url', url);
  html = replaceMetaProperty(html, 'og:image', ogImage);
  html = replaceMetaProperty(html, 'og:type', 'website');
  html = replaceMetaName(html, 'twitter:title', ogTitle);
  html = replaceMetaName(html, 'twitter:description', ogDescription);
  html = replaceMetaName(html, 'twitter:image', ogImage);
  html = setCanonical(html, url);
  return html;
}

function main(): void {
  if (!existsSync(SOURCE_INDEX)) {
    throw new Error(
      `[prerender-seo] expected ${SOURCE_INDEX} to exist. Run \`vite build\` first.`,
    );
  }
  const sourceHtml = readFileSync(SOURCE_INDEX, 'utf8');

  let written = 0;
  for (const target of TARGETS) {
    const html = renderRoute(sourceHtml, target.view);
    const outFile = resolve(DIST, target.outPath);
    mkdirSync(dirname(outFile), { recursive: true });
    writeFileSync(outFile, html);
    written++;
  }

  console.log(
    `[prerender-seo] wrote ${written} per-route HTML snapshots into ${DIST}`,
  );
}

main();
