import assert from 'node:assert/strict';
import { test } from 'node:test';
import { publicCampaigns } from '../../backend/src/domain/campaigns.js';
import { getStory } from '../../backend/src/content/index.js';
import { esc, guideFileName, guideMarkdown, worksheetHtml } from '../public/js/guide.js';

const catalog = publicCampaigns();
const chaco = catalog.find((c) => c.id === 'chaco');
const m1 = chaco.missions[0];

test('la guía en Markdown trae contexto, datos, glosario, preguntas, fuentes y la nota de reinterpretación', () => {
  const md = guideMarkdown(chaco, m1);
  assert.match(md, /^# Guía didáctica: Guerra del Chaco · 1\. Boquerón/);
  assert.match(md, /\*\*Fecha y lugar:\*\* 9 al 29 de septiembre de 1932/);
  assert.match(md, /\*\*Qué pasó de verdad:\*\* victoria paraguaya/);
  assert.ok(!/Qué pasó de verdad:\*\* Resultado histórico/.test(md), 'sin frase repetida');
  assert.match(md, /Reinterpretación/);
  assert.match(md, /## Datos clave/);
  assert.match(md, /## Glosario\n\n- \*\*fortín:\*\*/);
  assert.match(md, /## Preguntas de comprensión\n\n1\. .*\n   a\) /);
  assert.match(md, /## Fuentes consultadas\n\n- \[.*\]\(https:\/\//);
  assert.match(md, /Tablero 8×8, IA fácil/);
  assert.ok(!/\bnull\b|\bundefined\b/.test(md));
});

test('la guía no revela las respuestas ni las explicaciones de las preguntas', () => {
  for (const c of catalog.filter((x) => !x.fiction)) for (const m of c.missions) {
    const md = guideMarkdown(c, m);
    for (const q of getStory(c.id, m.id).quiz) assert.ok(!md.includes(q.why), `${c.id}#${m.id}: explicación filtrada`);
    assert.match(md, /las da el juego/i);
  }
});

test('una misión sin reinterpretación no lleva la nota; la de ficción no necesita fuentes', () => {
  const strongest = chaco.missions[4];
  assert.ok(!/Reinterpretación/.test(guideMarkdown(chaco, strongest)));
  const corso = catalog.find((c) => c.id === 'corso');
  const md = guideMarkdown(corso, corso.missions[0]);
  assert.ok(!/## Fuentes/.test(md) && !/## Preguntas/.test(md));
  assert.throws(() => guideMarkdown(chaco, { ...m1, story: null }), /no tiene historia/);
});

test('la hoja de trabajo es un HTML completo, con las secciones y los espacios para escribir', () => {
  const html = worksheetHtml(chaco, m1);
  assert.match(html, /^<!doctype html>/);
  for (const t of ['Nombre:', '1. Lee', '2. Vocabulario', '3. Ordena el hecho', '4. Responde', '5. Reflexiona', 'Antes', 'Durante', 'Después']) assert.ok(html.includes(t), t);
  assert.ok((html.match(/class="line"/g) ?? []).length >= 8);
  assert.ok((html.match(/☐/g) ?? []).length >= 6, 'opciones con casilla');
});

test('la hoja de trabajo escapa todo el texto (no se puede inyectar HTML)', () => {
  const evil = { ...m1, title: '<script>alert(1)</script>', briefing: '<img src=x onerror=alert(2)>', story: { ...m1.story, place: '"><b>x</b>', real: '<i>mal</i>', facts: ['<u>x</u>'], glossary: [{ term: '<s>t</s>', def: '&"\'' }], sources: [{ title: '<a href=x>', url: 'https://e.org/?a=1&b=2' }], quiz: [{ q: '<q>', options: ['<o>', 'b'] }] } };
  const html = worksheetHtml({ ...chaco, title: '<h1>c</h1>' }, evil);
  assert.ok(!/<script>alert|<img src=x|<b>x<\/b>|<i>mal|<u>x|<s>t|<q>|<o>|<h1>c/.test(html), 'nada de HTML sin escapar');
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /https:\/\/e\.org\/\?a=1&amp;b=2/);
  assert.equal(esc(null), '');
  assert.equal(esc(`<>&"'`), '&lt;&gt;&amp;&quot;&#39;');
});

test('nombres de archivo', () => {
  assert.equal(guideFileName(chaco, m1), 'guia-chaco-1.md');
  assert.equal(guideFileName(chaco, m1, 'hoja'), 'hoja-chaco-1.html');
});
