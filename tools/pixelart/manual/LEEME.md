# Arte dibujado a mano

Para reemplazar una unidad generada por un dibujo propio, guarda un PNG (8 bits, RGBA o RGB, sin paleta indexada) aquí con el nombre
`<escenario>-<ranura>.png` y vuelve a ejecutar `node tools/pixelart/generate.mjs` (desde la raíz del proyecto).

- Escenarios: `water`, `pirate`, `land`, `jungle`.
- Ranuras: `2`, `3a`, `3b`, `4`, `5`, `6`, `7` (el número es el largo en casillas; 3a y 3b son las dos unidades de 3).
- Tamaño: **32 × largo** píxeles de ancho y **32** de alto, orientación horizontal con la proa/frente a la derecha.
  Ejemplo: `water-5.png` mide 160×32.
- Ese dibujo se usa como estado «normal»; los demás estados (dañado, humo, explosión, hundido), la versión vertical y el atlas de 16 px se derivan solos.
