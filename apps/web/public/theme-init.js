/* eslint-disable no-var -- ES5 syntax is deliberate: this runs before the bundle. */
/* global window */
/*
 * Apply the saved colour theme before first paint.
 *
 * Kept as an external file rather than an inline script so the page can run under a
 * strict Content-Security-Policy without 'unsafe-inline'. Plain ES5-era syntax is
 * used because this executes before the module bundle loads.
 */
(function () {
  try {
    var stored = window.localStorage.getItem('qb-theme');
    var theme =
      stored === 'light' || stored === 'dark'
        ? stored
        : window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light';
    window.document.documentElement.dataset.theme = theme;
  } catch (error) {
    /* Theme preference is optional. */
    void error;
  }
})();
