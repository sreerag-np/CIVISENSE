// Runs before the page paints so the chosen theme never flashes. Same logic as src/theme.js.
(function () {
  try {
    var raw = localStorage.getItem('cs_theme');
    var mode = 'system', accent = 'road';
    if (raw === 'light' || raw === 'dark') { mode = raw; }
    else if (raw) { var v = JSON.parse(raw); mode = v.mode || mode; accent = v.accent || accent; }
    var dark = mode === 'dark' || (mode === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
    var r = document.documentElement;
    r.setAttribute('data-theme', dark ? 'dark' : 'light');
    r.setAttribute('data-accent', accent);
  } catch (e) { /* storage blocked: defaults apply */ }
})();
