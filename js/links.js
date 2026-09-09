/* ------------------------------------------------------------------
   Outbound URLs.

   Nothing published is re-hosted: a record carries a reference and the
   URL is built from it.  These four builders are the only place that
   knows the shape of an external address.
   ------------------------------------------------------------------ */

/* Behance serves project covers from an unsigned, stable CDN path, so a
   tile can show the real cover without a copy living in this repo. */
const BE_CDN = 'https://mir-s3-cdn-cf.behance.net/';

/* 'assets/...' is ours; anything else is a Behance CDN path */
export const coverUrl = (path) =>
  !path ? '' : (path.startsWith('assets/') ? path : BE_CDN + path);

/* { id, slug } -> behance.net/gallery/<id>/<slug> */
export const behanceUrl = (b) =>
  'https://www.behance.net/gallery/' + b.id + '/' + b.slug;

/* { code, kind } -> instagram.com/<kind>/<code>/   kind: 'p' | 'reel'
   Thumbnails *are* saved locally, in assets/covers/instagram/<code>.jpg,
   because Instagram's CDN URLs are signed and expire. */
export const igUrl = (p) =>
  'https://www.instagram.com/' + p.kind + '/' + p.code + '/';

/* a case study owns a page; an archive entry does not */
export const projectUrl = (p) => 'project.html?p=' + p.slug;

export const sectorUrl = (s) => (typeof s === 'string' ? s : s.id) + '.html';
