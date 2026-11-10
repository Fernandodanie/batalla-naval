# Batalla Naval 0.9.6 — mejoras visuales seguras y rápidas

Base: `batalla-naval-v0_9_5-completa-audio-video-arrastre.zip`.

## Aplicadas

1. **Tableros**: marco táctico con profundidad, coordenadas más legibles, selección de disparo más clara (solo dispositivos con mouse), contraste de aciertos/fallos/hundimientos y mejores colores para posiciones válidas/inválidas.
2. **Unidades y flota**: separación visual frente al terreno mediante sombras controladas, vista previa de arrastre más contrastada, fichas de la flota más cómodas para el dedo y estado seleccionado claramente marcado.
3. **Cuatro biomas**: microdetalles de olas de baja saturación, suelo y vegetación sobre los 16 PNG originales. Se conserva el tamaño 32×32 y la duración y estructura de la animación. Los tonos del agua no se vuelven saturados.
4. **Interfaz de combate**: paneles de jugadores, marcador, avisos y temporizador con mejor contraste, jerarquía y profundidad.
5. **Campañas**: tarjetas con una indicación cromática del bioma y mejor estado de selección/lectura.
6. **Narrador (presentación)**: panel de órdenes y texto más legibles, avatar con ligera sombra; sin sustituir la voz ni el guion.
7. **Login**: tarjeta y título con contraste más equilibrado sobre el video, sin alterar reproducción ni controles.
8. **Móvil y accesibilidad**: botones de flota >=48 px, foco visible, menos efectos de desenfoque pesados en pantallas pequeñas, hover restringido a punteros precisos, y respeto por reducción de movimiento.
9. **Actualización PWA**: versión de caché cambiada para publicar los nuevos CSS/PNG, y el CSS nuevo incluido en la precaché.

## Garantías y límites

- **NO** se modifica lógica de servidor, disparos, partidas, aleatoriedad, eventos táctiles, voz, música, video, registro, reglas, campaña ni progreso.
- Los cambios de diseño se concentran en `frontend/public/css/pulido-visual.css` (se puede revertir retirando su `<link>` del HTML), `frontend/public/img/tile-*.png` (16 imágenes), `frontend/public/index.html` y `frontend/public/sw.js`.
- No se añaden bibliotecas JS o imágenes de gran tamaño.
- Los recursos multimedia están copiados sin modificaciones de la versión 0.9.5; no se generaron voces neurales grabadas.
- Al actualizar una PWA instalada, puede ser necesario cerrarla y volver a abrirla para que use el nuevo service worker.

## Comprobación

```sh
cd frontend
npm ci
npm test
```

Las pruebas de assets/CSS y de lógica se pueden ejecutar sin `jsdom` con `node --test test/pulido-visual.test.js test/sw.test.js test/placement.test.js`.
Las pruebas de interfaz que usan `jsdom` necesitan instalar las dependencias.
