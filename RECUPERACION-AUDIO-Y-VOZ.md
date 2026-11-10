# Recuperación audiovisual y narrador militar — 0.9.5

## Recursos restaurados

- `frontend/public/audio/tambores-guerra.mp3`
- `frontend/public/audio/ambiente-puerto.mp3`
- `frontend/public/audio/ambiente-batalla.mp3`
- `frontend/public/video/login/naval.mp4`, `artilleria.mp4`, `jungla.mp4`
- `frontend/public/img/laminas-hd/`: 20 PNG y 20 miniaturas WebP.

Se conservan el arreglo del bloqueo entre rondas, el arrastre con mouse o dedo y las texturas de tropas y biomas.
No se copian `.env`, `.git`, contraseñas ni configuraciones personales del respaldo.

## Narrador

- En nuevas instalaciones **Voz** viene activada. Las preferencias que ya guardó cada usuario **se respetan**.
- Cada aviso de misión comienza con una orden breve del oficial. La información histórica queda igual.
- El lector del navegador elige la mejor voz en español disponible, prefiriendo las naturales/neurales masculinas. Se redujo la alteración del tono: en algunos Android causaba el efecto robótico.
- Los informes largos se dividen por oraciones, evitando que móviles con Web Speech corten la lectura.
- Mientras habla, la música baja de volumen y el avatar mueve la boca.

### Importante: calidad y límites

**Este ZIP no contiene voces neuronales MP3 ya renderizadas.** En este entorno no hubo acceso al servicio de síntesis, y el respaldo original no contenía grabaciones. La voz que el usuario escuchará hasta generarlas es la del sistema/navegador y su naturalidad varía por móvil.

El generador para crear archivos MP3 de voz natural está incluido. Necesita conexión a internet al ejecutarlo en un equipo con Node.js y permiso adecuado para el uso del servicio:

```sh
cd tools/voz
npm install
npm run prueba
npm run generar
```

Eso genera los ~191 MP3 de las escenas y eventos en `frontend/public/audio/voz/`, más `index.json`. Vuelve a desplegar el frontend (por ejemplo `docker compose up --build`) para publicarlos. Después todos oirán las grabaciones iguales, incluso si la voz instalada en su teléfono suena artificial. Para un uso comercial o público, verificar antes las condiciones de licencia del proveedor TTS (o sustituirlo por uno con licencia).

## Verificar en un celular

1. Actualizar el proyecto completo y volver a desplegarlo (no copiar solo `js/`).
2. Abrir el juego y tocar cualquier botón de entrada (iOS/Android no permite audio con autoplay sin gesto).
3. En Ajustes comprobar **Música de fondo**, **Voz del narrador** y que el botón global de sonido esté activo.
4. Si se había desactivado la voz antes, volver a habilitarla (el ajuste persiste por dispositivo).
5. Iniciar una misión para escuchar las órdenes del oficial. En modo aula se oyen también las introducciones.
6. Al actualizar una PWA instalada, cerrarla y reabrirla para cargar la versión de service worker nueva (`bn-0.9.5-audio-mando`).
