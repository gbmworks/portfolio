/* ------------------------------------------------------------------
   Regenerate sitemap.xml from the content.

     node tools/sitemap.mjs

   The site has no build step and does not need one — this is the single
   exception, because a sitemap has to be a real file for crawlers and
   there is one URL per case study.  Run it after adding a project.

   Only projects that are actually listed on a page get a URL.  A record
   that no page references is still in projects.js — so an old link to
   it resolves — but it is not offered to crawlers as if it were part of
   the site.  Published galleries have no page at all.
   ------------------------------------------------------------------ */

import { writeFileSync } from 'node:fs';
import { SECTIONS } from '../js/sectors.js';
import { PROJECTS, ARCHIVE, pageEntries, entryHref } from '../js/projects.js';
import { projectUrl, sectorUrl } from '../js/links.js';
import { SITE } from '../js/site.js';

const ORIGIN = SITE.origin + '/';
const today = new Date().toISOString().slice(0, 10);

/* every project reachable from a page, in page order, no duplicates */
const listed = [];
for (const s of SECTIONS) {
  for (const e of pageEntries(s.id)) {
    if (e.kind === 'project' && !listed.includes(e.project)) listed.push(e.project);
  }
}

/* Where a project's row goes is where the sitemap sends a crawler:
   entryHref() is the one function that answers that, so the two cannot
   disagree.  A record that runs but keeps its page — the avatar studio —
   is worth both URLs, the page for the write-up and the thing itself. */
const urls = [
  { loc: '', priority: '1.0' },
  ...SECTIONS.map(s => ({ loc: sectorUrl(s), priority: '0.8' })),
  ...listed.map(p => ({ loc: entryHref(p), priority: '0.6' })),
  ...listed.filter(p => p.live && !p.liveFromRow).map(p => ({ loc: p.live, priority: '0.6' }))
];

const xml =
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url>
    <loc>${(ORIGIN + u.loc).replace(/&/g, '&amp;')}</loc>
    <lastmod>${today}</lastmod>
    <priority>${u.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;

writeFileSync(new URL('../sitemap.xml', import.meta.url), xml);
console.log(
  `sitemap.xml — ${urls.length} URLs: ${SECTIONS.length} sectors, ` +
  `${listed.length} project pages listed ` +
  `(of ${PROJECTS.length} records; ${ARCHIVE.length} galleries have no page)`
);
