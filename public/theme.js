// Runs before the stylesheet to avoid a flash of the wrong theme.
(function () {
  try {
    var g = localStorage.getItem("theme");
    var s = matchMedia("(prefers-color-scheme: dark)").matches;
    if (g === "dark" || ((!g || g === "system") && s)) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
