#!/usr/bin/env bash
# Corre los experimentos de escalabilidad del núcleo MPI+OpenMP y guarda un CSV para el informe.
#
#   ./run-experiments.sh [--hostfile hostfile] [--size 20] [--samples 4000000] [--reps 5] \
#                        [--nodes "1 2 3 4"] [--threads "1 2 4"] [--out resultados-mpi.csv]
#
#  strong: mismo trabajo (--samples) con más recursos  → speedup, eficiencia, Amdahl
#  weak:   trabajo proporcional a los recursos          → eficiencia débil, Gustafson
# Cada fila es una configuración  nodos(ranks) × hilos_por_rank  = p recursos de cómputo.
# La línea base T1 (1 rank × 1 hilo) se mide primero. Sin --hostfile corre en este equipo (modo local).
set -eu
HOSTFILE=""; SIZE=20; SAMPLES=4000000; REPS=5; NODES="1 2 3 4"; THREADS="1 2 4"; OUT="resultados-mpi.csv"
while [ $# -gt 0 ]; do
  case "$1" in
    --hostfile) HOSTFILE="$2";; --size) SIZE="$2";; --samples) SAMPLES="$2";; --reps) REPS="$2";;
    --nodes) NODES="$2";; --threads) THREADS="$2";; --out) OUT="$2";; *) echo "Opción desconocida: $1"; exit 1;;
  esac; shift 2
done
BIN="${BIN:-../kernels/montecarlo_mpi}"
[ -x "$BIN" ] || { echo "Falta compilar: (cd ../kernels && make mpi)"; exit 1; }
MPIOPTS=(--bind-to none)                          # los hilos OpenMP se reparten por todos los núcleos del equipo
[ "$(id -u)" = 0 ] && MPIOPTS+=(--allow-run-as-root)
[ -n "$HOSTFILE" ] && MPIOPTS+=(--hostfile "$HOSTFILE" --map-by node -x OMP_NUM_THREADS) || MPIOPTS+=(--oversubscribe)

echo "experimento,size,samples,hosts,ranks,threads,accepted,checksum,total_ms,compute_ms,comm_ms,imbalance" > "$OUT"
run() { # etiqueta ranks hilos muestras
  local row
  row=$(OMP_NUM_THREADS="$3" mpirun "${MPIOPTS[@]}" -np "$2" "$BIN" --size "$SIZE" --samples "$4" --threads "$3" --reps "$REPS" --csv 1)
  echo "$1,$row" | tee -a "$OUT"
}
echo ">> Línea base (1 rank × 1 hilo) y escalabilidad fuerte: $SAMPLES muestras"
run strong 1 1 "$SAMPLES"
for t in $THREADS; do for n in $NODES; do
  [ "$n" = 1 ] && [ "$t" = 1 ] && continue
  run strong "$n" "$t" "$SAMPLES"
done; done
echo ">> Escalabilidad débil: $((SAMPLES / 4)) muestras por unidad de cómputo"
PER=$((SAMPLES / 4))
run weak 1 1 "$PER"
for t in $THREADS; do for n in $NODES; do
  [ "$n" = 1 ] && [ "$t" = 1 ] && continue
  run weak "$n" "$t" $((PER * n * t))
done; done
echo ">> Listo: $OUT   (siguiente: node ../informe/results-to-latex.mjs --mpi $OUT)"
