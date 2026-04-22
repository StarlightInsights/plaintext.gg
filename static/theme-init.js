// Theme bootstrap. Loaded synchronously in <head> before app.js so the first
// paint already has the user's saved theme applied — no FOUC. Kept in its own
// file so the page CSP can be script-src 'self' (no 'unsafe-inline').
(function () {
  var theme = 'light';
  try { theme = localStorage.getItem('plaintext:theme') === 'dark' ? 'dark' : 'light'; } catch (e) {}
  var color = theme === 'dark' ? '#38342e' : '#fffdf7';
  var root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  root.style.backgroundColor = color;
  document.querySelectorAll('meta[name="theme-color"]').forEach(function (el) { el.content = color; });
})();
