# Clúster de cómputo paralelo (PCs Dell OptiPlex)

Guía para armar el clúster y medir. Todo lo que dice "COMPLETAR" son datos de TU laboratorio que deben ir al informe.

## 1. Arquitectura

```
                    ┌───────────────────────── red local (Ethernet, switch) ─────────────────────────┐
                    │                                                                                │
 ┌─ optiplex-01 (maestro) ─┐   ┌─ optiplex-02 ─┐   ┌─ optiplex-03 ─┐   ┌─ optiplex-04 ─┐
 │ rank 0 · MPI + OpenMP   │   │ rank 1        │   │ rank 2        │   │ rank 3        │   ← CAPA DE CÓMPUTO (bare metal)
 │ hilos = núcleos         │   │ hilos         │   │ hilos         │   │ hilos         │      kernels/montecarlo_mpi
 ├─────────────────────────┤   └───────────────┘   └───────────────┘   └───────────────┘
 │ Docker: backend (Node), │
 │ PostgreSQL, frontend,   │   ┌─ (opcional) nodos de IA en contenedores: ai-node × N ─┐   ← CAPA DE APLICACIÓN
 │ ai-node ×N              │   │ el backend les reparte las jugadas por HTTP           │      docker compose --profile distributed
 └─────────────────────────┘   └────────────────────────────────────────────────────────┘
```

* **Capa de cómputo (medición científica):** `kernels/montecarlo_mpi` corre **directamente en el sistema operativo**
  (sin contenedores). En equipos modestos como los OptiPlex, la virtualización/contenedores añade variabilidad a las
  mediciones; para medir speedup se prefiere el hardware directo.
* **Capa de aplicación (el producto):** el juego (backend, base de datos, frontend) y los **nodos de IA**
  (`npm run ai-node`) van en **contenedores** con `docker compose` (ver README principal). Eso es la "configuración de
  contenedores" del informe.
* **Modelo híbrido recomendado:** **1 proceso MPI por equipo** y tantos **hilos OpenMP como núcleos** tenga. Así hay
  pocos mensajes por la red (uno por equipo en la reducción) y la memoria compartida se aprovecha dentro del equipo.

## 2. Datos del laboratorio (para la sección 4 del informe)

Completa esta tabla con `lscpu`, `free -h` y `ip link`/`ethtool` en cada equipo:

| Equipo | Modelo OptiPlex | CPU (modelo) | Núcleos / hilos | RAM | Red | SO | Rol |
|---|---|---|---|---|---|---|---|
| optiplex-01 | COMPLETAR | COMPLETAR | COMPLETAR | COMPLETAR | COMPLETAR | COMPLETAR | maestro (rank 0) |
| optiplex-02 | COMPLETAR | | | | | | trabajador |

También: marca/modelo del **switch**, velocidad (100 Mb/s, 1 Gb/s), si la red está aislada o compartida con otros
usuarios, y la **latencia** medida (`ping -c 100 optiplex-02`).

## 3. Preparar cada equipo (Linux / Manjaro; Windows: usa WSL2 o instala Linux en los OptiPlex)

```bash
sudo pacman -S base-devel openmpi openssh git        # Ubuntu: sudo apt install build-essential openmpi-bin libopenmpi-dev openssh-server
git clone <tu repo> ~/batalla-naval  &&  cd ~/batalla-naval/kernels  &&  make     # misma ruta en TODOS los equipos
```

Requisitos que más fallan (revisa antes de culpar al código):

1. **Mismo usuario y SSH sin contraseña** desde el maestro a todos: `ssh-keygen` y `ssh-copy-id optiplex-02`.
2. **Misma versión de OpenMPI** en todos (`mpirun --version`) y **el binario en la misma ruta** (o una carpeta NFS).
3. **Nombres que resuelvan:** agrega los equipos a `/etc/hosts` de cada uno, con IPs fijas.
4. **Firewall:** MPI abre puertos dinámicos entre los equipos. En una red de laboratorio aislada, desactiva el
   firewall (`sudo systemctl stop firewalld ufw`) o abre el rango entre ellos.
5. **Reloj y carga:** nadie más debe usar los equipos durante la medición; fuente de poder y modo "rendimiento".
   `sudo cpupower frequency-set -g performance`.

```bash
cd ~/batalla-naval/cluster
cp hostfile.example hostfile      # edita los nombres
./check-cluster.sh hostfile       # debe terminar con "Clúster listo."
```

## 4. Medir

```bash
# prueba rápida en un equipo (modo local)
./run-experiments.sh --samples 400000 --nodes "1" --threads "1 2" --out prueba.csv

# medición real en el clúster (≈ minutos; ajusta --samples para que T1 dure varios segundos)
./run-experiments.sh --hostfile hostfile --size 20 --samples 8000000 --reps 5 \
    --nodes "1 2 3 4" --threads "1 2 4" --out resultados-mpi.csv

# la capa de Node (hilos y nodos de IA) para comparar y para la escalabilidad débil de Gustafson
cd ../backend && npm run bench -- --workers 1,2,4 --samples 400000 --reps 5 --csv ../cluster/resultados-node.csv
```

Recomendaciones para que los resultados sean defendibles:

* `T1` (1 rank × 1 hilo) debe durar **varios segundos**; si dura milisegundos, la medición es ruido. Sube `--samples`.
* Repite en distintos momentos y reporta la **mediana** (el programa ya hace `--reps` repeticiones).
* **No** pidas más hilos que núcleos físicos por equipo sin decirlo: el speedup se aplanará o bajará.
* Anota la salida de `lscpu` y `mpirun --version`: van en el informe.
* Cada fila trae `checksum`: **debe ser igual** para el mismo `samples` y mismo número total de trozos; si no, hay un error.

Con los CSV listos: `node ../informe/results-to-latex.mjs --mpi resultados-mpi.csv --node resultados-node.csv`.

## 5. Contenedores (capa de aplicación)

```bash
cd ~/batalla-naval && node scripts/init-env.mjs
docker compose up --build                                          # juego completo: db + backend + frontend
docker compose --profile distributed up --build --scale ai-node=3  # + nodos de IA en contenedores
```

Reparte los recursos con `deploy.resources.limits` en `docker-compose.yml` (por ejemplo `cpus: "2"`, `memory: 2g` por
nodo de IA) y documéntalo en la tabla de asignación de CPU/RAM del informe.
