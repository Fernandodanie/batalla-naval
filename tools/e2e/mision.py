#!/usr/bin/env python3
"""
Prueba de punta a punta en un navegador real (Chromium): juega la misión 1 de la campaña del Chaco en modo aula, contesta las
preguntas (las corrige el servidor), descarga la guía, recorre la galería y descarga una lámina vertical y el ZIP de láminas.

  pip install playwright && playwright install chromium
  python3 tools/e2e/mision.py http://localhost:4010 [carpeta_de_capturas]

Necesita el servidor en marcha (por ejemplo: cd backend && NODE_ENV=development PORT=4010 STORAGE=memory node src/index.js).
No forma parte de `npm test`: es una revisión visual y de humo. Falla (código 1) si hay errores de consola/JS o textos sueltos
«null»/«undefined»/«[object …]» en pantalla. Si la IA gana la partida, reintenta la misión (hasta 5 veces).
"""
import re
import sys
import zipfile
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:4010'
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else '/tmp/bn-e2e')
OUT.mkdir(parents=True, exist_ok=True)
errors = []


def play_round(page, shot_name=None):
    """Coloca la flota, dispara casilla por casilla (esperando su turno) y espera el fin de la partida."""
    page.wait_for_selector('#panel-placing:not([hidden])', timeout=10000)
    page.click('#btn-random'); page.click('#btn-ready')
    page.wait_for_selector('#panel-battle:not([hidden])', timeout=15000)
    for i in range(64):
        if page.locator('#panel-over:not([hidden])').count():
            break
        cell = page.locator('#board-right .cell').nth(i)
        if cell.locator('.mark').count():
            continue
        for _ in range(40):
            if 'tu turno' in page.inner_text('#banner').lower():
                break
            page.wait_for_timeout(150)
        try:
            cell.click(timeout=1500)
        except Exception:
            continue
        if shot_name and i == 3:
            page.wait_for_timeout(140); page.screenshot(path=str(OUT / shot_name))
        page.wait_for_timeout(900)
    page.wait_for_selector('#panel-over:not([hidden])', timeout=20000)
    page.wait_for_timeout(1200)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={'width': 1100, 'height': 950}, accept_downloads=True)
        page = ctx.new_page()
        page.on('pageerror', lambda e: errors.append(f'js: {e}'))
        page.on('console', lambda m: errors.append(f'consola: {m.text}') if m.type == 'error' else None)
        page.goto(BASE)
        page.evaluate("""async () => {
          const r = await fetch('/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email: 'e2e' + Math.floor(Math.random() * 99999) + '@ejemplo.com', username: 'e2e' + Math.floor(Math.random() * 99999), password: 'secreto123' }) });
          localStorage.setItem('bn.token', (await r.json()).token);
          localStorage.setItem('bn.settings', JSON.stringify({ aula: true }));
        }""")
        page.reload(); page.wait_for_timeout(800)

        page.click('#tab-campanas'); page.locator('.camp-card').nth(0).click()
        page.locator('.mission-row button').first.click(); page.wait_for_timeout(300)
        assert page.locator('#md-context-body .story-gloss dt').count() >= 3, 'falta el glosario en la ficha'
        page.click('#md-context summary')  # el contexto histórico está en un desplegable
        with page.expect_download() as g:
            page.get_by_text('Guía didáctica (.md)').click()
        guide = OUT / g.value.suggested_filename; g.value.save_as(str(guide))
        text = guide.read_text(encoding='utf-8')
        assert '## Preguntas de comprensión' in text and 'Reinterpretación' in text, 'guía incompleta'
        page.screenshot(path=str(OUT / '1-ficha-aula.png'))
        page.click('#md-next'); page.click('#md-start')

        for attempt in range(5):
            play_round(page, '2-disparo-en-vuelo.png' if attempt == 0 else None)
            if 'Misión cumplida' in page.inner_text('#mission-result'):
                break
            print(f'  la IA ganó el intento {attempt + 1}; se reintenta la misión')
            page.click('#btn-rematch')
        else:
            raise AssertionError('no se ganó la misión en 5 intentos')
        page.screenshot(path=str(OUT / '3-resultado.png'), full_page=True)
        assert page.locator('#mission-result .lam-reward').count() == 1, 'falta la lámina de recompensa'
        assert page.locator('#mission-result .quiz .quiz-q').count() == 2, 'faltan las preguntas del modo aula'

        # el cuestionario se corrige en el servidor: contesta lo primero de cada pregunta y comprueba
        for fs in page.locator('#mission-result .quiz .quiz-q').all():
            fs.locator('input').first.check()
        page.get_by_role('button', name='Comprobar').click()
        page.wait_for_selector("#mission-result .quiz-result:has-text('correctas')", timeout=10000)
        assert 'guardado' in page.inner_text('#mission-result .quiz-result'), 'el resultado no se guardó en la cuenta'
        page.screenshot(path=str(OUT / '3b-preguntas.png'), full_page=True)

        # galería, lámina vertical y ZIP
        page.click('#btn-leave-over'); page.wait_for_timeout(900)
        page.locator('#btn-gallery:visible, #camp-gallery:visible').first.click(); page.wait_for_timeout(800)
        page.screenshot(path=str(OUT / '4-galeria.png'))
        with page.expect_download() as z:
            page.click('#gal-zip')
        zpath = OUT / 'laminas.zip'; z.value.save_as(str(zpath))
        assert zipfile.ZipFile(zpath).testzip() is None and len(zipfile.ZipFile(zpath).namelist()) >= 1, 'ZIP inválido'
        page.locator('.gal-item:not(.locked)').first.click()
        page.wait_for_selector('#lam-view canvas', timeout=8000)
        page.select_option('#lam-format', 'story'); page.wait_for_timeout(600)
        page.screenshot(path=str(OUT / '5-lamina-vertical.png'))
        with page.expect_download() as d:
            page.click('#lam-download')
        d.value.save_as(str(OUT / d.value.suggested_filename))
        assert d.value.suggested_filename.endswith('-vertical.png'), d.value.suggested_filename

        stray = re.findall(r'\bnull\b|\bundefined\b|\[object [A-Za-z]+\]', page.evaluate('document.body.innerText'))
        browser.close()
    problems = errors + [f'texto suelto: {s}' for s in stray]
    print('✓ misión completada, preguntas corregidas, guía, ZIP y lámina vertical descargados; capturas en', OUT) if not problems else print('✗', *problems, sep='\n  - ')
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
