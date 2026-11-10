# Informe técnico (IEEE) y Hito 1

| Archivo | Qué es |
|---|---|
| `hito1.tex` → `hito1.pdf` | Hito 1: perfil técnico de **1 página** (problema regional, modelo matemático, arquitectura de clúster) |
| `main.tex` + `refs.bib` → `main.pdf` | Entregable A: informe en formato **IEEE** (`IEEEtran`), 8 secciones, **máx. 10 páginas** (hoy ≈ 5 con marcadores) |
| `results-to-latex.mjs` | Convierte tus CSV medidos en tablas, figuras y números del informe (`generado/`) |
| `generado/` | Salida del script. Mientras esté vacía el informe muestra marcadores rojos `[...]` |

## Flujo de trabajo

```bash
# 1. Medir (ver ../cluster/README.md)
cd cluster
./check-cluster.sh hostfile
./run-experiments.sh --hostfile hostfile --size 20 --samples 8000000 --out resultados-mpi.csv
mpirun --hostfile hostfile -np 2 --map-by node ../kernels/pingpong_mpi > red.csv          # latencia y ancho de banda
(cd ../backend && npm run bench -- --workers 1,2,4 --csv ../cluster/resultados-node.csv)  # capa Node (opcional)

# 2. Generar tablas, figuras y números
cd ../informe
node results-to-latex.mjs --mpi ../cluster/resultados-mpi.csv --node ../cluster/resultados-node.csv --net ../cluster/red.csv

# 3. Compilar (o subir la carpeta informe/ a Overleaf)
latexmk -pdf main.tex        # Manjaro: sudo pacman -S texlive texlive-publishers texlive-langextra
```

Después **reemplaza cada marcador rojo** `\TODO{...}`: hay de dos tipos: datos de TU laboratorio (modelo de CPU, RAM, switch,
versiones) y párrafos de **análisis** que solo puedes escribir viendo tus números. Búscalos con `grep -n TODO main.tex`.

## Cómo interpretar tus resultados (para la sección 6)

| Si observas… | Probable causa | Dónde mirarlo |
|---|---|---|
| `e` (Karp–Flatt) casi constante al subir `p` | Fracción serial fija (construir listas de posiciones, reducción) → Amdahl | tabla fuerte, `\AmdahlF` |
| `e` crece con `p` | Sobrecarga que aumenta con los recursos: comunicación, contención, desbalance, más hilos que núcleos | columnas Com. (%) y Desb. |
| Eficiencia cae al pasar de 1 a 2 equipos | Entra la red: compara con `α + m/β` del ping-pong | `\AlphaUs`, `\BetaMBps`, Com. (%) |
| Speedup se aplana al llegar a los núcleos lógicos | Hyper-threading no duplica el cómputo; ancho de banda de memoria / caché | filas con `p` > núcleos físicos |
| Desbalance > 1,1 | Frecuencia de CPU distinta, procesos de fondo, equipos no idénticos | columna Desb. |
| Eficiencia débil ≈ 100 % pero la fuerte baja | El problema escala bien con más trabajo (Gustafson) aunque no con trabajo fijo (Amdahl) | tabla débil |
| `checksum` distinto para el mismo `samples` y `p` | **Error**: no compares tiempos hasta corregirlo | CSV |

## Lista de verificación contra los requisitos

| Requisito | Dónde | Estado |
|---|---|---|
| Hito 1 (1 página) | `hito1.tex` | ✅ listo; completa los datos del laboratorio |
| Resumen y Abstract | `main.tex` (cifras vienen de `datos.tex`) | ✅ texto; ⬜ cifras tras medir |
| Introducción y contexto regional (Yacuiba / Chaco) | Sec. I, con fuentes | ✅ ; ⬜ constancia institucional si existe |
| Flynn, modelo de memoria, redes | Sec. II (incluye tabla de clasificación y modelo de Hockney) | ✅ |
| Diagrama del clúster, CPU/RAM, contenedores | Sec. III, Fig. 1, Tabla de equipos | 🟡 estructura lista; ⬜ datos de los OptiPlex |
| OpenMP / MPI, particionamiento, balanceo | Sec. IV con fragmentos de código | ✅ |
| Tablas, Speedup, Eficiencia, Amdahl/Gustafson, cuellos de botella | Sec. V | ⬜ requiere tus mediciones |
| Conclusiones e impacto | Sec. VI | 🟡 redactado con prudencia; ⬜ cifras |
| Referencias | `refs.bib` | ✅ **verifica cada una** (volumen, páginas) antes de entregar |

## Honestidad del informe

* No cites resultados que no mediste. Las cifras del resumen salen de `datos.tex`; si no existe, quedan marcadores.
* El informe dice que es un **prototipo académico**. Si hay un acuerdo con una institución, cámbialo y cita la constancia.
* Las referencias regionales son: INE (Gran Chaco, Censo 2012), Banco Central de Bolivia (descripción de Yacuiba) y la revista
  IYARAKUAA de la UAJMS. **Verifica volumen y año** del artículo de Choque Gonzales; el buscador solo dio la URL.
* La IA "Experta" no juega mejor que la "Difícil": el informe lo declara como limitación (está medido en `npm run quality`).
