# Núcleo Monte Carlo en C + OpenMP

Reescritura de `backend/src/ai/montecarlo.js` para **comparar modelos de programación paralela**:
Node (`worker_threads`, memoria compartida con `Atomics` o paso de mensajes) frente a **C con OpenMP**.

La lógica es la misma, instrucción por instrucción: mismo generador (`mulberry32`), mismas semillas por trozo y mismo
orden de llamadas al generador. Por eso, con los mismos parámetros, **ambas versiones dan exactamente el mismo
número de muestras válidas y la misma suma de control**. Eso se verifica así:

```bash
# Linux / Manjaro (Windows: MSYS2 con mingw-w64-gcc, o WSL)
cd kernels && make
./montecarlo_omp --size 10 --samples 200000 --threads 4 --reps 5
cd ../backend && node scripts/mc-checksum.js --size 10 --samples 200000 --threads 4
# deben coincidir "accepted=" y "checksum="
```

## Versión para clúster: MPI + OpenMP

`montecarlo_mpi.c` usa MPI entre equipos (memoria distribuida) y OpenMP dentro de cada uno (memoria compartida). Con
`ranks × hilos` trozos, el resultado es **idéntico** al de Node con ese mismo número de trozos:

```bash
make mpi
mpirun -np 2 --bind-to none ./montecarlo_mpi --size 10 --samples 40000 --threads 2   # 4 trozos
cd ../backend && node scripts/mc-checksum.js --size 10 --samples 40000 --threads 4   # mismo accepted= y checksum=
```

Imprime por separado **cómputo**, **comunicación** (la reducción) y el **desbalance** entre procesos: son los datos del
análisis de cuellos de botella. Para armar y medir el clúster ver `../cluster/README.md`.

## Medir la aceleración de C (OpenMP, un solo equipo) (misma escena que `npm run bench`):

```bash
for p in 1 2 4 8; do ./montecarlo_omp --size 20 --samples 400000 --threads $p --reps 5; done
```

**Para el informe:** el speedup de OpenMP y el de `worker_threads` se calculan igual (`S = T1/Tp`), pero C parte de
un `T1` mucho menor, así que su sobrecarga fija (crear hilos, volcar resultados) pesa más y la eficiencia cae antes.
Compara las **curvas** (S y E contra p), no los milisegundos absolutos.
