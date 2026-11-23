/* Theme toggle, shared by both pages. The choice persists in
   localStorage and is applied before first paint where possible. */

'use strict';

const Theme = (() => {
  const KEY = 'cths-theme';
  const root = document.documentElement;

  function apply(mode) {
    root.setAttribute('data-theme', mode);
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      const dark = mode === 'dark';
      btn.setAttribute('aria-pressed', String(dark));
      btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      btn.querySelector('.icon-sun').style.display = dark ? 'none' : '';
      btn.querySelector('.icon-moon').style.display = dark ? '' : 'none';
    }
    // Charts read their colours from CSS variables, so redraw after the swap.
    if (window.Charts) {
      requestAnimationFrame(() => Charts.redrawAll());
    }
  }

  function current() {
    return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function toggle() {
    const next = current() === 'dark' ? 'light' : 'dark';
    apply(next);
    try { localStorage.setItem(KEY, next); } catch (e) { /* private mode */ }
  }

  function init() {
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) { /* ignore */ }
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    apply(saved || (prefersDark ? 'dark' : 'light'));
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.addEventListener('click', toggle);
  }

  return { init, toggle, apply, current };
})();

document.addEventListener('DOMContentLoaded', Theme.init);
