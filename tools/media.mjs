/* ------------------------------------------------------------------
   The media pipeline.

     node tools/media.mjs posters     assets/web/**.webm -> assets/posters/**.jpg
     node tools/media.mjs encode      assets/media/**.webm -> assets/web/**.webm
     node tools/media.mjs report      what is on disk, and what it costs

   Two jobs, and the first one matters more.

   POSTERS.  A tile near the viewport used to fetch `preload=metadata`
   from a multi-megabyte clip just to paint a still frame — for a wall of
   twenty-six tiles that is tens of megabytes of video pulled to show
   what a 40 KB JPEG shows.  So every clip gets a poster, the tile shows
   the poster, and not one video byte is requested until somebody
   actually hovers.

   ENCODE.  Re-encodes from assets/media (the originals, kept out of the
   repo) rather than from assets/web, because re-compressing an already
   lossy file throws away quality for nothing.  The deployed clips were
   encoded at wildly different bitrates — 418 kbps to 5175 kbps for the
   same kind of content, a twelvefold spread — which is the actual reason
   assets/web is 52 MB.  One CRF for everything fixes that.

   VP9 is slow. `encode` takes a while and prints as it goes.
   ------------------------------------------------------------------ */

import { execFileSync, execFile } from 'node:child_process';
import { readdirSync, statSync, mkdirSync, existsSync, renameSync, unlinkSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const WEB = join(ROOT, 'assets/web');
const MEDIA = join(ROOT, 'assets/media');
const POSTERS = join(ROOT, 'assets/posters');

/* A poster is shown at tile size (~600px) and in the preview stage
   (~1360px wide, so a portrait clip lands about 480px across). 900px on
   the long edge is generous for both and still lands around 40-70 KB. */
const POSTER_LONG_EDGE = 900;
const POSTER_QUALITY = 4;        // ffmpeg -q:v, 2 = best, 5 = getting soft

/* CRF 34 is the sweet spot for VP9 at this size — visually clean at tile
   and stage size, and it drops the outliers by 3-5x. Raise for smaller. */
const CRF = 34;

/* ---------------------------------------------------------------- */

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.webm$/i.test(name)) out.push(p);
  }
  return out;
}

const mb = (n) => (n / 1048576).toFixed(1) + ' MB';

function probe(file) {
  const out = execFileSync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height', '-show_entries', 'format=duration',
    '-of', 'csv=p=0:nk=1', file
  ], { encoding: 'utf8' }).trim().split(/[\r\n,]+/).filter(Boolean);
  return { w: +out[0], h: +out[1], dur: +out[2] || 0, bytes: statSync(file).size };
}

/* ---------------------------------------------------------------- */

async function posters() {
  const clips = walk(WEB);
  console.log(`posters — ${clips.length} clips\n`);
  let made = 0, total = 0;

  for (const clip of clips) {
    const rel = relative(WEB, clip).replace(/\\/g, '/');
    const out = join(POSTERS, rel.replace(/\.webm$/i, '.jpg'));
    mkdirSync(dirname(out), { recursive: true });

    const { dur } = probe(clip);
    /* a fifth of the way in: past any fade-up, before any outro */
    const at = Math.max(0.1, dur * 0.2);

    await run('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-ss', String(at), '-i', clip,
      '-frames:v', '1',
      '-vf', `scale='if(gt(iw,ih),${POSTER_LONG_EDGE},-2)':'if(gt(iw,ih),-2,${POSTER_LONG_EDGE})':flags=lanczos`,
      '-q:v', String(POSTER_QUALITY),
      out
    ]);

    const size = statSync(out).size;
    total += size; made++;
    console.log(`  ${rel.padEnd(30)} ${String(Math.round(size / 1024)).padStart(4)} KB`);
  }
  console.log(`\n  ${made} posters, ${mb(total)} total`);
  console.log('  (the clips they stand in for: ' + mb(clips.reduce((n, c) => n + statSync(c).size, 0)) + ')');
}

/* ---------------------------------------------------------------- */

async function encode() {
  const originals = walk(MEDIA);
  if (!originals.length) {
    console.error('assets/media is empty — the originals are not in the repo.');
    process.exit(1);
  }
  console.log(`encode — ${originals.length} originals at CRF ${CRF}\n`);
  let before = 0, after = 0;

  for (const src of originals) {
    const rel = relative(MEDIA, src).replace(/\\/g, '/');
    const out = join(WEB, rel);
    if (!existsSync(out)) { console.log(`  ${rel.padEnd(30)} skipped — not a deployed clip`); continue; }

    const wasBytes = statSync(out).size;
    const tmp = out + '.tmp.webm';

    /* Encode to the dimensions the deployed clip already has, not to a
       cap derived from the original.  The originals are all 1080x1920;
       the deployed files were downscaled to 608x1080 or 720x1280 at some
       point, and capping the original's long edge at 1280 quietly
       *upscaled* the 608-wide ones — which is why the first run produced
       bigger files than it replaced. The problem here was never
       resolution, it was that these were encoded at anything from 418 to
       5175 kbps. One CRF at the size they already are fixes exactly
       that and cannot grow the frame. */
    const dep = probe(out);

    await run('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-i', src,
      '-c:v', 'libvpx-vp9', '-crf', String(CRF), '-b:v', '0',
      '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2',
      '-vf', `scale=${dep.w}:${dep.h}:flags=lanczos`,
      '-an',                       // the tiles never play sound
      tmp
    ], { maxBuffer: 1 << 26 });

    const nowBytes = statSync(tmp).size;
    /* only keep it if it actually helped */
    if (nowBytes < wasBytes) {
      /* fs, not a shelled-out move: half these filenames have spaces in
         them and "Burj Khalifa.webm" would be two arguments to cmd */
      renameSync(tmp, out);
      console.log(`  ${rel.padEnd(30)} ${mb(wasBytes).padStart(8)} -> ${mb(nowBytes).padStart(8)}  (-${Math.round((1 - nowBytes / wasBytes) * 100)}%)`);
      after += nowBytes;
    } else {
      unlinkSync(tmp);
      console.log(`  ${rel.padEnd(30)} ${mb(wasBytes).padStart(8)}     kept — re-encode was bigger`);
      after += wasBytes;
    }
    before += wasBytes;
  }

  console.log(`\n  assets/web: ${mb(before)} -> ${mb(after)}  (-${Math.round((1 - after / before) * 100)}%)`);
  console.log('  now re-run: node tools/media.mjs posters');
}

/* ---------------------------------------------------------------- */

function report() {
  const clips = walk(WEB);
  let t = 0;
  console.log('  ' + 'clip'.padEnd(30) + 'size'.padStart(9) + 'dur'.padStart(7) + 'res'.padStart(12) + 'bitrate'.padStart(10) + '  poster');
  for (const c of clips) {
    const rel = relative(WEB, c).replace(/\\/g, '/');
    const { w, h, dur, bytes } = probe(c);
    t += bytes;
    const poster = join(POSTERS, rel.replace(/\.webm$/i, '.jpg'));
    const p = existsSync(poster) ? Math.round(statSync(poster).size / 1024) + ' KB' : 'MISSING';
    console.log('  ' + rel.padEnd(30) + mb(bytes).padStart(9) + (Math.round(dur) + 's').padStart(7) +
      `${w}x${h}`.padStart(12) + (Math.round((bytes * 8 / 1000) / (dur || 1)) + 'k').padStart(10) + '  ' + p);
  }
  console.log('\n  total ' + mb(t));
}

/* ---------------------------------------------------------------- */

const cmd = process.argv[2];
if (cmd === 'posters') await posters();
else if (cmd === 'encode') await encode();
else if (cmd === 'report') report();
else {
  console.log('usage: node tools/media.mjs posters | encode | report');
  process.exit(1);
}
