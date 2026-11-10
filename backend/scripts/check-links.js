#!/usr/bin/env node
/**
 * Comprueba que los enlaces de «fuentes» de las misiones respondan (necesita internet; Node 18+).
 *   npm run check:links
 * Los enlaces se escribieron a partir de búsquedas reales, pero las páginas cambian: corre esto de vez en cuando y antes de
 * entregar. Un 403/429 suele ser un bloqueo a robots y no un enlace roto: ábrelo en el navegador antes de quitarlo.
 */
import { CAMPAIGNS } from '../src/domain/campaigns.js';
import { getStory } from '../src/content/index.js';

const links = new Map();
for (const c of CAMPAIGNS) for (const m of c.missions) for (const s of getStory(c.id, m.id)?.sources ?? []) {
  if (s.url) links.set(s.url, [...(links.get(s.url) ?? []), `${c.id}#${m.id}`]);
}

const check = async (url) => {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15_000);
  try {
    const r = await fetch(url, { redirect: 'follow', signal: ctl.signal, headers: { 'user-agent': 'batalla-naval-link-check/0.7' } });
    return { ok: r.ok, status: r.status };
  } catch (e) { return { ok: false, status: e.name === 'AbortError' ? 'tiempo agotado' : (e.cause?.code ?? e.message) }; } finally { clearTimeout(t); }
};

let bad = 0;
for (const [url, where] of links) {
  const r = await check(url);
  if (!r.ok) bad += 1;
  console.log(`${r.ok ? '✓' : '✗'} ${r.status}  ${url}  (${where.join(', ')})`);
}
console.log(`\n${links.size - bad} de ${links.size} enlaces responden.`);
process.exit(bad ? 1 : 0);
