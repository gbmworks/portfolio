/* ------------------------------------------------------------------
   Warm the module graph.

   This has to run *after* the import map, because every module below
   imports the bare specifier "three" and the browser resolves a
   preloaded module's own imports the moment the link is added.  Put
   this before the import map and the page dies on
   "Failed to resolve module specifier".

   Without it the browser only discovers these three round trips deep:
   parse the HTML, fetch the entry module, parse it, then ask.
   ------------------------------------------------------------------ */
(function () {
  var CDN = 'https://cdn.jsdelivr.net/npm/three@0.169.0/examples/jsm/postprocessing/';

  function pre(href, cors) {
    var l = document.createElement('link');
    l.rel = 'modulepreload';
    l.href = href;
    if (cors) l.crossOrigin = '';
    document.head.appendChild(l);
  }

  ['EffectComposer.js', 'RenderPass.js', 'UnrealBloomPass.js', 'OutputPass.js']
    .forEach(function (f) { pre(CDN + f, true); });

  /* the core every page mounts */
  ['./js/stage.js', './js/data.js', './js/env/procedural.js',
   './js/env/props.js', './js/env/materials.js', './js/env/themes.js']
    .forEach(function (f) { pre(f, false); });
})();
