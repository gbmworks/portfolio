/* ------------------------------------------------------------------
   Regenerate sitemap.xml from the content.

     node tools/sitemap.mjs

   The site has no build step and does not need one — this is the single
   exception, because a sitemap has to be a real file for crawlers and
   there is now one URL per project.  Run it after adding a project.
   ------------------------------------------------------------------ */

import { writeFileSync } from 'node:fs';
import { SECTIONS } from '../js/data.js';
import { PROJECTS, projectUrl } from '../js/projects.js';

const ORIGIN = 'https://govindbmohan.com/';
const today = new Date().toISOString().slice(0, 10);

const urls = [
  { loc: '', priority: '1.0' },
  ...SECTIONS.map(s => ({ loc: s.id + '.html', priority: '0.8' })),
  ...PROJECTS.map(p => ({ loc: projectUrl(p), priority: p.feature ? '0.7' : '0.6' }))
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
console.log(`sitemap.xml — ${urls.length} URLs (${PROJECTS.length} projects)`);
