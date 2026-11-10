/*
 * Núcleo Monte Carlo de la IA Experta en C con OpenMP (memoria compartida, un solo equipo).
 * La lógica vive en mc_core.h y es la misma que usa la versión MPI + OpenMP (montecarlo_mpi.c).
 *
 * Compilar:  make omp
 * Ejecutar:  ./montecarlo_omp --size 10 --samples 400000 --threads 4 --reps 5 [--seed 1]
 */
#include "mc_core.h"

static int cmp_double(const void *a, const void *b) { double x = *(const double *)a, y = *(const double *)b; return (x > y) - (x < y); }

int main(int argc, char **argv) {
  int size = 10, threads = omp_get_max_threads(), reps = 5;
  long samples = 200000;
  uint32_t seed = 1;
  for (int i = 1; i + 1 < argc; i += 2) {
    if (!strcmp(argv[i], "--size")) size = atoi(argv[i + 1]);
    else if (!strcmp(argv[i], "--samples")) samples = atol(argv[i + 1]);
    else if (!strcmp(argv[i], "--threads")) threads = atoi(argv[i + 1]);
    else if (!strcmp(argv[i], "--reps")) reps = atoi(argv[i + 1]);
    else if (!strcmp(argv[i], "--seed")) seed = (uint32_t)strtoul(argv[i + 1], NULL, 10);
  }
  int lengths[32];
  int nships = fleet_for(size, lengths);
  if (!nships || threads < 1 || reps < 1 || samples < 1) { fprintf(stderr, "Parámetros inválidos (tamaños: 8 10 12 15 20)\n"); return 1; }
  qsort(lengths, nships, sizeof(int), cmp_desc);

  int n = size * size;
  uint8_t *shots = malloc(n);
  scenario_init(size, shots);
  int *density = malloc(sizeof(int) * n);
  long accepted = 0;
  double *times = malloc(sizeof(double) * reps);

  compute_chunks(size, shots, lengths, nships, samples, threads, 0, threads, threads, seed, density, &accepted); /* calentamiento */
  for (int r = 0; r < reps; r++) {
    double t0 = omp_get_wtime();
    compute_chunks(size, shots, lengths, nships, samples, threads, 0, threads, threads, seed, density, &accepted);
    times[r] = (omp_get_wtime() - t0) * 1000.0;
  }
  qsort(times, reps, sizeof(double), cmp_double);
  printf("size=%d samples=%ld threads=%d accepted=%ld checksum=%llu median_ms=%.2f\n",
         size, samples, threads, accepted, density_checksum(density, n), times[reps / 2]);
  free(shots); free(density); free(times);
  return 0;
}
