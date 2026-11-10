#!/usr/bin/env bash
# Verifica que el clúster esté listo ANTES de medir:  ./check-cluster.sh hostfile
# Comprueba, por cada equipo: SSH sin contraseña, misma versión de MPI, binario presente, núcleos y RAM.
set -u
HOSTFILE="${1:-hostfile}"
BIN="${BIN:-$HOME/batalla-naval/kernels/montecarlo_mpi}"   # misma RUTA en todos los equipos (o una carpeta compartida por NFS)
[ -f "$HOSTFILE" ] || { echo "No existe $HOSTFILE (copia hostfile.example)"; exit 1; }
ok=1
mpirun --version | head -1
while read -r host _; do
  case "$host" in ''|\#*) continue;; esac
  printf '%-18s' "$host"
  out=$(ssh -o BatchMode=yes -o ConnectTimeout=5 "$host" \
    "echo \$(nproc) nucleos, \$(free -g | awk '/Mem:/{print \$2}') GB RAM, \$(mpirun --version | head -1 | awk '{print \$NF}') mpi, \$( [ -x $BIN ] && echo binario-OK || echo SIN-BINARIO)" 2>&1) \
    && echo "$out" || { echo "FALLO SSH: $out"; ok=0; }
done < "$HOSTFILE"
[ "$ok" = 1 ] && echo "Clúster listo." || { echo "Hay equipos con problemas: revisa cluster/README.md"; exit 1; }
