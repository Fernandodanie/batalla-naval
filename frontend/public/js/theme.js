/* Aplica el modo y la paleta guardados antes de pintar (evita el parpadeo). */
(() => {
  'use strict';
  const MODES = ['auto', 'light', 'dark'];
  const PALETTES = ['azul', 'verde', 'morado', 'atardecer', 'rosa'];
  const get = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const put = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
  const root = document.documentElement;

  const state = {
    mode: MODES.includes(get('bn.mode')) ? get('bn.mode') : 'auto',
    palette: PALETTES.includes(get('bn.palette')) ? get('bn.palette') : 'azul',
  };

  function apply() {
    if (state.mode === 'auto') root.removeAttribute('data-mode'); else root.dataset.mode = state.mode;
    root.dataset.palette = state.palette;
  }
  apply();

  window.BnTheme = {
    get: () => ({ ...state }),
    set(next) {
      if (MODES.includes(next.mode)) { state.mode = next.mode; put('bn.mode', state.mode); }
      if (PALETTES.includes(next.palette)) { state.palette = next.palette; put('bn.palette', state.palette); }
      apply();
    },
  };
})();
