#!/usr/bin/env node
/**
 * Valida el contenido de las campañas (misiones, narración, fuentes, preguntas, logros y láminas) sin levantar el servidor.
 *   npm run validate:content
 * Termina con código 1 si algo está mal, así sirve también en CI. Es el chequeo que conviene correr después de editar
 * `src/content/*.js`, `src/domain/campaigns.js`, `achievements.js` o `laminas.js`.
 */
import { existsSync } from 'node:fs';
import { ACHIEVEMENTS, RENAMED, getAchievement } from '../src/domain/achievements.js';
import { CAMPAIGNS, getMission } from '../src/domain/campaigns.js';
import { STORIES, getStory, storyProblems } from '../src/content/index.js';
import { LAMINAS } from '../src/domain/laminas.js';
import { GLOSSARY } from '../src/content/glosario.js';
import { publicCampaigns } from '../src/domain/campaigns.js';

const problems = [];
const bad = (where, msg) => problems.push(`${where}: ${msg}`);
const text = (v) => typeof v === 'string' && v.trim().length > 0;
const art = (id) => new URL(`../../frontend/public/img/laminas-hd/${id}.png`, import.meta.url);
const thumb = (id) => new URL(`../../frontend/public/img/laminas-hd/min/${id}.webp`, import.meta.url);

// --- campañas y misiones
if (new Set(CAMPAIGNS.map((c) => c.id)).size !== CAMPAIGNS.length) bad('campañas', 'ids repetidos');
for (const c of CAMPAIGNS) {
  c.missions.forEach((m, i) => {
    const where = `${c.id}#${m.id}`;
    if (m.id !== i + 1) bad(where, `las misiones deben numerarse 1..n en orden (esta es la posición ${i + 1})`);
    for (const k of ['title', 'briefing', 'debrief']) if (!text(m[k])) bad(where, `falta «${k}»`);
    for (const p of storyProblems(getStory(c.id, m.id), { fiction: c.fiction })) bad(where, p);
    const st = getStory(c.id, m.id);
    if (!c.fiction && st && typeof st.won === 'boolean' && Boolean(m.fictionalTwist) === st.won) {
      bad(where, st.won ? 'ganó el bando del jugador, pero la misión está marcada como reinterpretación' : 'el bando del jugador perdió en la historia: marca la misión con `fictionalTwist: true`');
    }
  });
}
for (const [campaignId, stories] of Object.entries(STORIES)) {
  for (const id of Object.keys(stories)) if (!getMission(campaignId, id)) bad(`${campaignId}#${id}`, 'hay una historia sin misión');
}

// --- logros
if (new Set(ACHIEVEMENTS.map((a) => a.id)).size !== ACHIEVEMENTS.length) bad('logros', 'ids repetidos');
for (const a of ACHIEVEMENTS) {
  for (const k of ['id', 'category', 'icon', 'name', 'text']) if (!text(a[k])) bad(`logro ${a.id}`, `falta «${k}»`);
  if (a.campaign) {
    for (const mi of a.missions ?? []) if (!getMission(a.campaign, mi)) bad(`logro ${a.id}`, `apunta a una misión que no existe (${a.campaign}#${mi})`);
  }
}
for (const [old, now] of Object.entries(RENAMED)) {
  if (getAchievement(old)) bad('logros', `el id antiguo «${old}» sigue en el catálogo`);
  if (!getAchievement(now)) bad('logros', `«${old}» se renombró a «${now}», que no existe`);
}

// --- láminas
const missions = CAMPAIGNS.flatMap((c) => c.missions.map((m) => `${c.id}-${m.id}`));
for (const id of missions) if (!LAMINAS.some((l) => l.id === id)) bad(`lámina ${id}`, 'falta la lámina de esta misión');
for (const l of LAMINAS) {
  if (!existsSync(art(l.id))) bad(`lámina ${l.id}`, 'falta el PNG en frontend/public/img/laminas-hd/');
  if (!existsSync(thumb(l.id))) bad(`lámina ${l.id}`, 'falta la miniatura WebP en frontend/public/img/laminas-hd/min/');
  for (const k of ['title', 'caption']) if (!text(l[k])) bad(`lámina ${l.id}`, `falta «${k}»`);
}

// --- glosario: sin términos repetidos, definiciones útiles y todo término se usa en alguna misión
if (new Set(GLOSSARY.map((g) => g.term.toLowerCase())).size !== GLOSSARY.length) bad('glosario', 'términos repetidos');
const used = new Set(publicCampaigns().flatMap((c) => c.missions.flatMap((m) => (m.story?.glossary ?? []).map((g) => g.term))));
for (const g of GLOSSARY) {
  if (!text(g.def) || g.def.length < 25) bad(`glosario «${g.term}»`, 'la definición es muy corta');
  if (!used.has(g.term)) bad(`glosario «${g.term}»`, 'no aparece en ninguna misión (bórralo o úsalo)');
}

const total = CAMPAIGNS.reduce((a, c) => a + c.missions.length, 0);
if (problems.length) {
  console.error(`✗ ${problems.length} problema(s) en el contenido:\n  - ${problems.join('\n  - ')}`);
  process.exit(1);
}
console.log(`✓ Contenido correcto: ${CAMPAIGNS.length} campañas, ${total} misiones con narración, ${ACHIEVEMENTS.length} logros, ${LAMINAS.length} láminas.`);
