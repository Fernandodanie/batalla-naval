# Voz del narrador

La voz del navegador suena robótica y cambia según el dispositivo. Este script crea **audios .mp3 con una voz neural masculina**
(por defecto `es-BO-MarceloNeural`, español de Bolivia) para que la narración suene igual en todas partes.
Es gratis y no necesita clave; solo necesita internet **al ejecutarlo**. El juego después usa los .mp3 ya creados.

## Pasos (una sola vez, y de nuevo cuando cambies un texto)

```bash
cd tools/voz
npm install
npm run prueba      # 3 muestras en tools/voz/prueba/ (mando · grave · neutro): escúchalas y elige
npm run generar     # crea todos los audios en frontend/public/audio/voz/ (solo los que falten)
```

Opciones: `node generar.mjs --estilo grave` · `--voz es-MX-JorgeNeural` · `--rate=-12% --pitch=-10%` · `--forzar` (rehacer todos).

Después reconstruye el frontend (`docker compose up --build`) y activa **Ajustes → Voz**.

## Cómo funciona

- Cada escena de apertura y frase de partida (`backend/src/content/`) tiene un id calculado con su texto (`clipId` en `frontend/public/js/voice.js`).
- El script guarda `frontend/public/audio/voz/<id>.mp3` y una lista `index.json`. El juego carga la lista al abrir.
- Si un texto no tiene audio (por ejemplo, lo cambiaste y aún no regeneraste), se lee con la voz del navegador: nada se queda mudo.
- Cambias una frase → vuelve a ejecutar `npm run generar`: crea el audio nuevo y borra el viejo.
- Voces masculinas en español: `es-BO-MarceloNeural` · `es-MX-JorgeNeural` · `es-CO-GonzaloNeural` · `es-AR-TomasNeural` · `es-ES-AlvaroNeural` · `es-CL-LorenzoNeural` · `es-US-AlonsoNeural`.

> Los audios usan el servicio «Read Aloud» de Microsoft Edge, pensado para uso personal y educativo. Si el proyecto fuera comercial, conviene una voz con licencia (por ejemplo ElevenLabs o Azure Speech) usando el mismo mecanismo: basta con dejar los .mp3 en la misma carpeta.
