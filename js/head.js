/* ------------------------------------------------------------------
   The invariant half of every <head>.

   Fonts, the stylesheet, icons and the boot guard are identical on
   every page, so they live here instead of being copied into each HTML
   file — one more page should not mean one more copy.

   What stays in the HTML is what differs per page or is read by
   crawlers that do not run scripts: the title, description, canonical
   link, the Open Graph / Twitter block, and the import map.

   This is a classic script, not a module: it must run while the head
   is still parsing so the stylesheet is requested before the body, and
   so the import map that follows it is untouched.
   ------------------------------------------------------------------ */
(function () {
  var head = document.head;

  function el(tag, attrs) {
    var n = document.createElement(tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    head.appendChild(n);
    return n;
  }

  el('meta', { name: 'author', content: 'Govind B Mohan' });
  el('meta', { name: 'theme-color', content: '#0b0b10' });

  el('link', { rel: 'icon', href: './assets/favicon.svg', type: 'image/svg+xml' });
  el('link', { rel: 'alternate icon', href: './assets/1x/favicon.png' });

  el('link', { rel: 'preconnect', href: 'https://cdn.jsdelivr.net', crossorigin: '' });
  el('link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' });
  el('link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' });
  el('link', {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700' +
          '&family=JetBrains+Mono:wght@400&display=swap'
  });

  el('link', { rel: 'stylesheet', href: './css/style.css' });

  /* three.module.min.js is self-contained, so it can be fetched before
     the import map exists.  Everything else — the addons and our own
     modules — imports the bare specifier "three", and preloading those
     here would make the browser resolve it with no map in place.  They
     are preloaded by js/preload.js instead, after the map. */
  el('link', { rel: 'modulepreload', crossorigin: '',
    href: 'https://cdn.jsdelivr.net/npm/three@0.169.0/build/three.module.min.js' });

  /* If the app has not signalled ready, surface a plain, usable page
     rather than leaving a black screen — covers a blocked CDN, a WebGL
     failure, or a very slow first load. */
  setTimeout(function () {
    if (!document.documentElement.hasAttribute('data-ready') && document.body) {
      document.body.classList.add('is-stalled');
    }
  }, 7000);
})();
