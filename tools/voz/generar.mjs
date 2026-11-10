#!/usr/bin/env node
/**
 * Genera los audios de la narración (mp3) con una voz neural masculina de Microsoft Edge («Read Aloud»: gratis, sin clave).
 * Necesita internet SOLO al ejecutarlo; el juego usa después los .mp3 ya creados y no depende de ningún servicio.
 *
 *   cd tools/voz
 *   npm install
 *   npm run prueba                      # 3 muestras con distintos estilos en tools/voz/prueba/ para elegir la voz
 *   npm run generar                     # todos los audios en frontend/public/audio/voz/ (solo los que falten)
 *   node generar.mjs --estilo grave     # usa otro estilo (mando · grave · neutro)
 *   node generar.mjs --voz es-MX-JorgeNeural --rate=-12% --pitch=-10%
 *   node generar.mjs --forzar           # vuelve a crear todos (por ejemplo, después de cambiar la voz)
 *
 * Voces masculinas en español: es-BO-MarceloNeural (Bolivia) · es-MX-JorgeNeural · es-CO-GonzaloNeural · es-AR-TomasNeural ·
 * es-ES-AlvaroNeural · es-CL-LorenzoNeural · es-US-AlonsoNeural.
 */
import { mkdirSync, readdirSync, rmSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { collectTexts } from './textos.mjs';

const ESTILOS = {
  mando: { rate: '-10%', pitch: '-6%' },   // pausado y firme (por defecto)
  grave: { rate: '-14%', pitch: '-12%' },  // más lento y profundo
  neutro: { rate: '-4%', pitch: '+0%' },   // casi como habla la voz sin ajustes
};
const OUT = fileURLToPath(new URL('../../frontend/public/audio/voz/', import.meta.url));
const PRUEBA = fileURLToPath(new URL('./prueba/', import.meta.url));

// La librería rechaza una promesa interna cuando falla la conexión; el error ya llega por el flujo de audio y se reintenta ahí.
process.on('unhandledRejection', () => {});

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=');
  return [k, v ?? true];
}));
const voz = typeof args.voz === 'string' ? args.voz : 'es-BO-MarceloNeural';
const estilo = ESTILOS[args.estilo] ?? ESTILOS.mando;
const prosody = { rate: typeof args.rate === 'string' ? args.rate : estilo.rate, pitch: typeof args.pitch === 'string' ? args.pitch : estilo.pitch };
const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function synth(text, opts, intentos = 4) {
  for (let i = 1; i <= intentos; i += 1) {
    try {
      const tts = new MsEdgeTTS();
      await tts.setMetadata(opts.voz, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const { audioStream } = tts.toStream(esc(text), opts.prosody);
      const chunks = await new Promise((resolve, reject) => {
        const parts = [];
        audioStream.on('data', (d) => parts.push(d));
        audioStream.on('error', reject);
        audioStream.on('close', () => resolve(parts));
      });
      const buf = Buffer.concat(chunks);
      if (buf.length < 1000) throw new Error('audio vacío');
      return buf;
    } catch (err) {
      if (i === intentos) throw err;
      await sleep(1500 * i);
    }
  }
  return null;
}

async function prueba() {
  mkdirSync(PRUEBA, { recursive: true });
  const frase = collectTexts().find((t) => t.where.endsWith('start'))?.text ?? 'Soldado, la batalla comienza. Cada disparo cuenta. Adelante.';
  console.log(`Frase de prueba: «${frase}»`);
  for (const [nombre, p] of Object.entries(ESTILOS)) {
    const archivo = `${PRUEBA}${voz.replace(/Neural$/, '')}-${nombre}.mp3`;
    writeFileSync(archivo, await synth(frase, { voz, prosody: p }));
    console.log(`  ${nombre.padEnd(7)} (${p.rate}, ${p.pitch}) → ${archivo}`);
  }
  console.log('\nEscúchalos, elige el estilo y ejecuta:  node generar.mjs --estilo mando|grave|neutro');
}

async function generar() {
  mkdirSync(OUT, { recursive: true });
  const textos = collectTexts();
  const vivos = new Set(textos.map((t) => t.id));
  let nuevos = 0; let fallidos = 0;
  console.log(`${textos.length} textos · voz ${voz} · velocidad ${prosody.rate} · tono ${prosody.pitch}`);
  for (const [i, t] of textos.entries()) {
    const file = `${OUT}${t.id}.mp3`;
    if (!args.forzar && existsSync(file) && statSync(file).size > 1000) continue;
    try {
      writeFileSync(file, await synth(t.text, { voz, prosody }));
      nuevos += 1;
      console.log(`  [${i + 1}/${textos.length}] ${t.where}`);
    } catch (err) {
      fallidos += 1;
      console.error(`  ✗ ${t.where}: ${err.message}`);
    }
    await sleep(250); // sin saturar el servicio
  }
  // audios de textos que ya no existen
  for (const f of readdirSync(OUT)) if (f.endsWith('.mp3') && !vivos.has(f.slice(0, -4))) { rmSync(`${OUT}${f}`); console.log(`  - sobrante ${f}`); }
  const ids = readdirSync(OUT).filter((f) => f.endsWith('.mp3') && statSync(`${OUT}${f}`).size > 1000).map((f) => f.slice(0, -4)).sort();
  writeFileSync(`${OUT}index.json`, `${JSON.stringify({ voz, generado: new Date().toISOString(), clips: ids })}\n`);
  console.log(`\nListo: ${nuevos} nuevos, ${ids.length}/${textos.length} disponibles${fallidos ? `, ${fallidos} con error (vuelve a ejecutar para reintentar)` : ''}.`);
  if (fallidos) process.exitCode = 1;
}

try {
  await (args.prueba ? prueba() : generar());
} catch (err) {
  console.error(`\nNo se pudo generar el audio: ${err.message}\nRevisa tu conexión a internet y vuelve a ejecutar (los audios ya creados se conservan).`);
  process.exitCode = 1;
}
