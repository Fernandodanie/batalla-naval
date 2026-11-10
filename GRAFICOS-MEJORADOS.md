# Pulido gráfico pixel-art (v0.9.1)

Esta variante aplica una primera mejora visual conservadora, compatible con el sistema de sprites existente.

## Cambios incluidos
- `frontend/public/img/atlas-16.png` y `atlas-32.png`: ajuste moderado de saturación, contraste y nitidez. Se conservan dimensiones, transparencia, coordenadas y nombres de sprites.
- `frontend/public/img/tile-*.png`: mismo ajuste moderado para los cuatro biomas animados.
- `frontend/public/css/style.css`: profundidad del tablero, sombras más limpias para unidades, realce discreto de selección y mejor acabado de la capa de terreno.

## Compatibilidad
No se modificaron `atlas-16.json`, `atlas-32.json`, la lógica de combate, el tamaño de las casillas ni el sistema de animaciones. Los sprites continúan usando `image-rendering: pixelated`.

## Verificación
Se verificó que los atlas y tiles mantienen sus dimensiones originales y que las referencias del JSON permanecen válidas. La suite del frontend no pudo ejecutarse completa en este entorno porque no están instaladas las dependencias de desarrollo (`jsdom`). Al abrir el proyecto en el entorno habitual, ejecutar `npm install` dentro de `frontend` y luego `npm test`.

Esta es una primera pasada visual de bajo riesgo; la siguiente mejora recomendable es redibujar sprites concretos en PNG manuales de exactamente `32 × largo` píxeles, usando `tools/pixelart/manual/`, sin reemplazar el atlas entero de una vez.


## Corrección funcional de campaña (integración)

- Las misiones de campaña ahora crean la partida con `hitKeepsTurn: true`, por lo que un impacto conserva el turno del jugador o de la IA.
- Un fallo entrega el turno al oponente; las casillas repetidas siguen rechazándose por la lógica central de `Game.fire`.
- La interfaz informa «¡Impacto! Tienes otro disparo» cuando el jugador acierta y conserva el turno.
- La partida sigue terminando inmediatamente al hundir la última unidad, sin conceder acciones posteriores.
- Se añadió una prueba de integración para la secuencia impacto → segundo disparo → fallo. Su ejecución requiere las dependencias del backend (`npm install` en `backend`).


## Mejora visual y colocación táctil (v0.9.4)

Esta actualización contiene un segundo rediseño visual y la corrección de la interacción entre rondas:

- **4 biomas**, reconstruidos en `tools/pixelart/fx.mjs`: mar azul profundo menos saturado, aguas corsarias verde azulado, suelo seco con piedrecillas y matas, y selva con vegetación estratificada. Se conservan los cuatro cuadros de animación en cada bioma.
- **Unidades**, refinadas en `tools/pixelart/units.mjs`: volumen por iluminación direccional, sombras de contorno, detalles de botas/equipo y mejor separación con el terreno. Los atlas 16/32 px se han regenerado sin cambiar los identificadores de los sprites.
- **Arrastre para mouse, dedo y lápiz**, incluso desde la lista de unidades, con offset de agarre y previsualización. Un destino inválido no borra la unidad anterior. Tocar para seleccionar/colocar sigue funcionando.
- **Revancha sin bloqueo**: `createBoard()` destruye listeners y observadores anteriores antes de montar otra ronda en el mismo contenedor.
- **Caché actualizada** a `bn-0.9.4-drag` para que usuarios con la PWA instalada reciban nuevas imágenes y scripts.

### Cómo usarlo

En colocación, arrastra una unidad desde la lista hasta una casilla o arrastra una unidad ya colocada a otra posición. Puedes también tocar una unidad y después una casilla. El botón ↻ cambia su orientación. La posición inválida se indica en rojo; suelta en verde para confirmar. La opción **Aleatorio** y la preparación de flota no cambian.

### Verificaciones

`node --test frontend/test/placement.test.js frontend/test/sw.test.js` no necesita dependencias externas. `cd frontend && npm install && npm test` ejecuta las demás pruebas con jsdom. Para regenerar los gráficos: `node tools/pixelart/generate.mjs`.
