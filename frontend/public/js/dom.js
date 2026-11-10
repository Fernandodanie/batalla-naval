/** Utilidades mínimas para construir DOM sin innerHTML (así los nombres de otros jugadores no pueden inyectar HTML). */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/**
 * Agrega hijos a un nodo ignorando null/undefined/false. Úsalo en lugar de `node.append(...)` cuando algún hijo sea
 * condicional: el `append` nativo escribe el texto «null» en pantalla.
 */
export function add(node, ...children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    node.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === false || value == null) continue;
    if (key === 'class') node.className = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  return add(node, ...children);
}

export const clear = (node) => { node.replaceChildren(); return node; };

let toastTimer = null;
export function toast(message, ms = 3600) {
  const node = document.getElementById('toast');
  if (!node) return;
  node.textContent = message;
  node.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { node.hidden = true; }, ms);
}
