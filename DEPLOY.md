# Despliegue y actualización en VPS compartido

Guía rápida de operaciones para el proyecto Batalla Naval en el VPS.

## Ubicación del proyecto en el VPS
```bash
cd /opt/proyectos/daniel/batalla-naval
```

## Reglas obligatorias de compose
Todo comando de Docker Compose debe incluir el proyecto, el archivo compose específico y el archivo de entorno:
```bash
docker compose -p daniel-batalla-naval -f docker-compose.vps.yml --env-file .env <comando>
```

> [!WARNING]
> **Persistencia de datos**: NUNCA ejecutes `docker compose down -v` ni elimines la carpeta `./db-data`. Los datos de la base de datos PostgreSQL residen allí.

---

## Cómo actualizar el proyecto (Nueva versión)

1. Conectarse por SSH al VPS con tu llave personal:
   ```bash
   ssh daniel@187.41.117.126
   ```
2. Ir a la carpeta del proyecto:
   ```bash
   cd /opt/proyectos/daniel/batalla-naval
   ```
3. Descargar los últimos cambios del repositorio usando el alias de la deploy key:
   ```bash
   git pull origin main
   ```
4. Reconstruir y reiniciar los contenedores (sin afectar la base de datos):
   ```bash
   docker compose -p daniel-batalla-naval -f docker-compose.vps.yml --env-file .env up -d --build
   ```

---

## Comandos de diagnóstico y monitoreo

- **Ver estado de los contenedores**:
  ```bash
  docker compose -p daniel-batalla-naval -f docker-compose.vps.yml --env-file .env ps
  ```
- **Ver logs del backend (migraciones y eventos)**:
  ```bash
  docker compose -p daniel-batalla-naval -f docker-compose.vps.yml --env-file .env logs -f backend
  ```
- **Ver logs del frontend (Nginx)**:
  ```bash
  docker compose -p daniel-batalla-naval -f docker-compose.vps.yml --env-file .env logs -f frontend
  ```
- **Verificar salud interna del backend (desde el VPS)**:
  ```bash
  curl -i http://127.0.0.1:3005/healthz
  ```
- **Acceso público**:
  - Web y WebSocket: `http://187.41.117.126:8085`
