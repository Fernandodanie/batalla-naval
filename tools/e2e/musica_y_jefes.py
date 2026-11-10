#!/usr/bin/env python3
"""
Prueba de punta a punta (Chromium real) de la música por pantalla y de los nombres de los jefes en las misiones.

  python3 tools/e2e/musica_y_jefes.py http://localhost:4010 [carpeta_de_capturas]

Comprueba: entrada = «tambores» fuertes · inicio y campañas = ambiente suave · partida = ambiente más suave todavía · el ajuste de música
apaga y enciende · en la misión del Chaco los jefes son Marzana y Estigarribia (sin «Almirante IA» ni el nombre de la cuenta) · en una
campaña de ficción los nombres son inventados y llevan la etiqueta «ficción» · una partida libre sigue mostrando «Almirante IA».
Arranca Chromium con el autoplay permitido (en un navegador normal el primer toque desbloquea el audio).
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:4010'
OUT = Path(sys.argv[2] if len(sys.argv) > 2 else '/tmp/bn-e2e'); OUT.mkdir(parents=True, exist_ok=True)
errors, checks = [], []


def check(ok, msg):
    checks.append((ok, msg)); print(('  ✓ ' if ok else '  ✗ ') + msg)


def music(page):
    return page.evaluate('__bnMusic.state')


def wait_track(page, track, secs=6):
    for _ in range(int(secs * 10)):
        if music(page)['track'] == track: return True
        page.wait_for_timeout(100)
    return False


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
        page = browser.new_context(viewport={'width': 1100, 'height': 900}).new_page()
        page.on('pageerror', lambda e: errors.append(f'js: {e}'))
        page.on('console', lambda m: errors.append(f'consola: {m.text}') if m.type == 'error' else None)

        # --- entrada
        page.goto(BASE); page.wait_for_timeout(1200)
        check(wait_track(page, 'login'), 'entrada: suena «tambores de guerra»')
        page.wait_for_timeout(3200)
        g_login = music(page)['gain']
        check(abs(g_login - 0.5) < 0.02, f'entrada: volumen fuerte ({g_login:.3f})')

        # --- cuenta e inicio
        page.evaluate("""async () => {
          const r = await fetch('/api/auth/register', { method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email: 'e2e' + Math.floor(Math.random() * 99999) + '@ejemplo.com', username: 'cuentaxyz' + Math.floor(Math.random() * 99999), password: 'secreto123' }) });
          localStorage.setItem('bn.token', (await r.json()).token);
        }""")
        page.reload(); page.wait_for_timeout(1500)
        check(wait_track(page, 'puerto'), 'inicio: pasa al ambiente suave')
        page.wait_for_timeout(4500)
        g_home = music(page)['gain']
        check(0.09 < g_home < 0.13 and g_home < g_login / 3, f'inicio: volumen suave ({g_home:.3f}, mucho menos que la entrada)')
        page.screenshot(path=str(OUT / 'm1-inicio.png'))

        # --- campaña del Chaco, misión 1: jefes reales
        page.click('#tab-campanas'); page.wait_for_timeout(500)
        check(wait_track(page, 'puerto', 2), 'campañas: sigue el mismo ambiente (no se reinicia)')
        page.locator('.camp-card').nth(0).click()
        page.locator('.mission-row button').first.click(); page.wait_for_timeout(400)
        cmd = page.inner_text('#md-command')
        check('Manuel Marzana' in cmd and 'Estigarribia' in cmd, 'ficha: «Al mando» muestra a los dos jefes reales')
        page.screenshot(path=str(OUT / 'm2-ficha.png'))
        page.click('#md-start'); page.wait_for_selector('#players .pcard', timeout=10000); page.wait_for_timeout(500)
        players = page.inner_text('#players')
        check('Manuel Marzana' in players and 'José Félix Estigarribia' in players, 'partida: se ven Marzana y Estigarribia')
        check('Almirante' not in players and 'cuentaxyz' not in players.lower(), 'partida: no sale «Almirante IA» ni el nombre de la cuenta')
        check('(tú)' in players, 'partida: el jugador sigue marcado con «(tú)»')
        check(wait_track(page, 'batalla', 6), 'partida: pasa al ambiente de batalla')
        page.wait_for_timeout(3800)
        g_bat = music(page)['gain']
        check(0.06 < g_bat < g_home, f'partida: más suave que el inicio ({g_bat:.3f})')
        page.screenshot(path=str(OUT / 'm3-partida.png'))

        # --- ajustes: apagar y encender la música sin salir
        page.locator('.js-settings:visible').first.click()
        page.wait_for_timeout(300)
        page.uncheck('#set-music'); page.wait_for_timeout(300)
        check(music(page)['track'] is None, 'ajustes: «Música de fondo» desactivada la apaga')
        check(page.is_disabled('#set-music-vol'), 'ajustes: el volumen se deshabilita sin música')
        page.check('#set-music'); page.wait_for_timeout(800)
        check(music(page)['track'] == 'batalla', 'ajustes: al reactivarla vuelve la de batalla')
        page.screenshot(path=str(OUT / 'm4-ajustes.png'))
        page.click('#set-close')

        # --- salir y probar la campaña de ficción
        page.click('#btn-leave'); page.wait_for_timeout(900)
        check(wait_track(page, 'puerto', 6), 'al salir de la partida vuelve el ambiente suave')
        page.click('#camp-back'); page.wait_for_timeout(300)
        page.click('#tab-campanas'); page.wait_for_timeout(300)
        cards = page.locator('.camp-card'); n = cards.count()
        fiction = [i for i in range(n) if 'ficción' in cards.nth(i).inner_text().lower()]
        cards.nth(fiction[-1]).click()
        page.locator('.mission-row button').first.click(); page.wait_for_timeout(300)
        check(page.locator('#md-command').is_hidden(), 'ficha de ficción: no muestra jefes reales')
        page.click('#md-start'); page.wait_for_selector('#players .pcard', timeout=10000); page.wait_for_timeout(400)
        pf = page.inner_text('#players')
        check('Almirante IA' not in pf and 'ficción' in pf and 'inventado' in pf.lower(), 'ficción: nombres inventados con etiqueta «ficción» y cargo «(inventado)»')
        page.screenshot(path=str(OUT / 'm5-ficcion.png'))
        page.click('#btn-leave'); page.wait_for_timeout(600)

        # --- partida libre contra la IA: igual que siempre
        page.click('#camp-back'); page.wait_for_timeout(300)
        page.click('#tab-jugar'); page.wait_for_timeout(300)
        page.click('label:has(input[name=mode][value=ai])'); page.click('#btn-create'); page.wait_for_selector('#players .pcard', timeout=10000)
        pl = page.inner_text('#players')
        check('Almirante IA' in pl, 'partida libre: sigue apareciendo «Almirante IA»')
        stray = page.evaluate('document.body.innerText')
        check('undefined' not in stray and '[object' not in stray, 'sin textos sueltos «undefined» / «[object …]»')
        browser.close()
    bad = [m for ok, m in checks if not ok] + errors
    print('\n✓ todo bien; capturas en', OUT) if not bad else print('\n✗ fallos:', *bad, sep='\n  - ')
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
