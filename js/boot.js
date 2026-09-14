/* ------------------------------------------------------------------
   Everything every page does before its own module runs.

   This replaces head.js + preload.js, and it replaces the eleven-line
   #boot fallback that used to be copy-pasted into all five HTML files.

   It is a classic script, not a module, and it must sit *after* the
   import map: every module below imports the bare specifier "three",
   and the browser resolves a preloaded module's own imports the moment
   the link is added.  Put this before the map and the page dies on
   "Failed to resolve module specifier".

   The import map stays inline in each HTML file.  It is eight lines of
   load-bearing infrastructure, and injecting it from here would mean
   one network hiccup takes the whole site down.

   The stylesheets, the font link and the preconnects are inline too,
   and that is not an oversight.  They used to be created here, which
   meant the preload scanner — the browser's whole defence against
   latency — saw nothing but this file, and no CSS was even requested
   until this file had been fetched, parsed and run.  Measured cold on
   localhost: HTML done at 5ms, first stylesheet requested at 32ms.
   Over a real connection that gap is a full round trip, with the
   Google Fonts hop stacked in series behind it.

   So what is left here is only what markup cannot express: things that
   depend on a condition, and the fallback.
   ------------------------------------------------------------------ */
(function () {
  var THREE_CDN = 'https://cdn.jsdelivr.net/npm/three@0.169.0/';
  var head = document.head;

  function el(tag, attrs) {
    var n = document.createElement(tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    head.appendChild(n);
    return n;
  }

  /* ---------------- head ---------------- */

  el('meta', { name: 'author', content: 'Govind B Mohan' });
  el('meta', { name: 'theme-color', content: '#0b0b10' });

  /* icons are not on the critical path, so they can be created here */
  el('link', { rel: 'icon', href: './assets/favicon.svg', type: 'image/svg+xml' });
  el('link', { rel: 'alternate icon', href: './assets/1x/favicon.png' });

  /* ---------------- warm the module graph ----------------
     Without this the browser only discovers these three round trips
     deep: parse the HTML, fetch the entry module, parse it, then ask.
     three.module.min.js is preloaded from the markup; everything here
     resolves the bare specifier "three" and so has to wait for the
     import map, which is why it cannot move up with the stylesheets. */

  function pre(href, cors) {
    var l = document.createElement('link');
    l.rel = 'modulepreload';
    l.href = href;
    if (cors) l.crossOrigin = '';
    head.appendChild(l);
  }

  /* The post chain belongs to the landing page only, where the wheel's
     glow is the subject.  A backdrop page imports none of it, so
     preloading it there would be four requests spent on modules that
     are never evaluated.  <html data-stage="hero"> opts in. */
  if (document.documentElement.getAttribute('data-stage') === 'hero') {
    ['EffectComposer.js', 'RenderPass.js', 'UnrealBloomPass.js', 'OutputPass.js']
      .forEach(function (f) { pre(THREE_CDN + 'examples/jsm/postprocessing/' + f, true); });
  }

  /* the core every page mounts */
  ['./js/stage.js', './js/sectors.js', './js/site.js', './js/links.js',
   './js/env/procedural.js', './js/env/props.js',
   './js/env/materials.js', './js/env/themes.js']
    .forEach(function (f) { pre(f, false); });

  /* ---------------- the fallback ----------------
     If the app has not signalled ready, surface a plain, usable page
     rather than leaving a black screen — a blocked CDN, no WebGL, or a
     very slow first load.

     The markup comes from the page's own <noscript>, which has to be
     static anyway and already says exactly the right thing for that
     page.  In a scripting-enabled document a <noscript> element's
     children are never parsed, so its textContent is the raw markup —
     which means the two fallbacks are one fallback, written once per
     page instead of twice. */
  setTimeout(function () {
    if (document.documentElement.hasAttribute('data-ready') || !document.body) return;
    var boot = document.getElementById('boot');
    var alt = document.querySelector('noscript.fallback');
    if (boot && alt && !boot.innerHTML.trim()) boot.innerHTML = alt.textContent;
    document.body.classList.add('is-stalled');
  }, 7000);
})();
