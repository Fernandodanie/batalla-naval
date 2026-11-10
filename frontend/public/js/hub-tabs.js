/**
 * Pestañas de la pantalla principal: «Salas y ranking», «Crear o unirse» y «Campañas».
 * Accesibles con teclado (flechas, Inicio y Fin) y con roles ARIA (tablist / tab / tabpanel).
 * Recuerda la pestaña abierta mientras la página sigue abierta (al volver de una campaña se queda donde estaba).
 */
import { $, $$ } from './dom.js';

export class HubTabs {
  /** @param {{onSelect?:(name:string)=>void}} [opts] */
  constructor({ onSelect = () => {} } = {}) {
    this.onSelect = onSelect;
    this.current = 'salas';
    const nav = $('.hub-tabs');
    nav.addEventListener('click', (e) => {
      const tab = e.target.closest('.hub-tab');
      if (tab) this.select(tab.dataset.tab);
    });
    nav.addEventListener('keydown', (e) => {
      const keys = ['ArrowRight', 'ArrowLeft', 'Home', 'End'];
      if (!keys.includes(e.key)) return;
      const tabs = $$('.hub-tab');
      const i = tabs.findIndex((t) => t.dataset.tab === this.current);
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      e.preventDefault();
      this.select(tabs[next].dataset.tab, { focus: true });
    });
  }

  /** Muestra la pestaña `name` y oculta las demás. */
  select(name, { focus = false } = {}) {
    const tabs = $$('.hub-tab');
    if (!tabs.some((t) => t.dataset.tab === name)) return;
    this.current = name;
    for (const t of tabs) {
      const on = t.dataset.tab === name;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      $(`#pane-${t.dataset.tab}`).hidden = !on;
      if (on && focus) t.focus();
    }
    this.onSelect(name);
  }
}
