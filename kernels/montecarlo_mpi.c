/*
 * Núcleo Monte Carlo de la IA Experta en C con MPI + OpenMP (modelo HÍBRIDO para un clúster).
 *
 *   MPI    → entre equipos (memoria DISTRIBUIDA, paso de mensajes por la red)
 *   OpenMP → dentro de cada equipo (memoria COMPARTIDA, hilos)
 *
 * Particionamiento: el total de trozos es parts = ranks × hilos_por_rank. El rank r calcula los trozos
 * [r·T, (r+1)·T); cada trozo es independiente (no hay comunicación durante el cálculo). Al final una reducción
 * colectiva (MPI_Reduce) suma las densidades parciales en el rank 0. Es el patrón "map-reduce" clásico.
 * Como la descomposición coincide con la de Node (split + chunkSeed), el resultado es idéntico al de
 * `node scripts/mc-checksum.js --threads <ranks×T>`.
 *
 * Mide por separado CÓMPUTO y COMUNICACIÓN (la reducción) y el desbalance entre ranks, que son los datos del
 * análisis de cuellos de botella: tiempo total = cómputo (el rank más lento) + comunicación.
 *
 * Compilar:  make mpi
 * Ejecutar:  mpirun -np 4 --bind-to none ./montecarlo_mpi --size 20 --samples 4000000 --threads 4 --reps 5
 *            (en varios equipos: mpirun --hostfile ../cluster/hostfile -np 4 ...; ver cluster/README.md)
 * Salida (rank 0): una línea clave=valor; con --csv 1 imprime solo una fila CSV (para results-to-latex.js).
 */
#include <mpi.h>
#include "mc_core.h"

static int cmp_double(const void *a, const void *b) { double x = *(const double *)a, y = *(const double *)b; return (x > y) - (x < y); }
static double median(double *v, int n) { qsort(v, n, sizeof(double), cmp_double); return v[n / 2]; }

int main(int argc, char **argv) {
  int provided;
  MPI_Init_thread(&argc, &argv, MPI_THREAD_FUNNELED, &provided); /* MPI se llama solo desde el hilo principal */
  int rank, ranks;
  MPI_Comm_rank(MPI_COMM_WORLD, &rank);
  MPI_Comm_size(MPI_COMM_WORLD, &ranks);

  int size = 10, threads = 1, reps = 5, csv = 0;
  long samples = 200000;
  uint32_t seed = 1;
  for (int i = 1; i + 1 < argc; i += 2) {
    if (!strcmp(argv[i], "--size")) size = atoi(argv[i + 1]);
    else if (!strcmp(argv[i], "--samples")) samples = atol(argv[i + 1]);
    else if (!strcmp(argv[i], "--threads")) threads = atoi(argv[i + 1]);
    else if (!strcmp(argv[i], "--reps")) reps = atoi(argv[i + 1]);
    else if (!strcmp(argv[i], "--seed")) seed = (uint32_t)strtoul(argv[i + 1], NULL, 10);
    else if (!strcmp(argv[i], "--csv")) csv = atoi(argv[i + 1]);
  }
  int lengths[32];
  int nships = fleet_for(size, lengths);
  if (!nships || threads < 1 || reps < 1 || samples < 1) {
    if (rank == 0) fprintf(stderr, "Parámetros inválidos (tamaños: 8 10 12 15 20)\n");
    MPI_Finalize();
    return 1;
  }
  qsort(lengths, nships, sizeof(int), cmp_desc);

  int n = size * size, parts = ranks * threads;
  uint8_t *shots = malloc(n);
  scenario_init(size, shots);                     /* cada rank arma la misma escena: no hay que enviarla */
  int *local = malloc(sizeof(int) * n), *global = malloc(sizeof(int) * n);
  long local_acc = 0, global_acc = 0;
  double *t_total = malloc(sizeof(double) * reps), *t_comp = malloc(sizeof(double) * reps);
  double *t_comm = malloc(sizeof(double) * reps), *t_imb = malloc(sizeof(double) * reps);

  for (int r = -1; r < reps; r++) {               /* r = -1: calentamiento */
    MPI_Barrier(MPI_COMM_WORLD);
    double t0 = MPI_Wtime();
    compute_chunks(size, shots, lengths, nships, samples, parts, rank * threads, threads, threads, seed, local, &local_acc);
    double t1 = MPI_Wtime();
    MPI_Reduce(local, global, n, MPI_INT, MPI_SUM, 0, MPI_COMM_WORLD);        /* reducción de la densidad */
    MPI_Reduce(&local_acc, &global_acc, 1, MPI_LONG, MPI_SUM, 0, MPI_COMM_WORLD);
    double t2 = MPI_Wtime();
    if (r < 0) continue;

    double comp = (t1 - t0) * 1000.0, comm = (t2 - t1) * 1000.0, tot = (t2 - t0) * 1000.0;
    double comp_max, comp_sum, comm_max, tot_max;
    MPI_Reduce(&comp, &comp_max, 1, MPI_DOUBLE, MPI_MAX, 0, MPI_COMM_WORLD);
    MPI_Reduce(&comp, &comp_sum, 1, MPI_DOUBLE, MPI_SUM, 0, MPI_COMM_WORLD);
    MPI_Reduce(&comm, &comm_max, 1, MPI_DOUBLE, MPI_MAX, 0, MPI_COMM_WORLD);
    MPI_Reduce(&tot, &tot_max, 1, MPI_DOUBLE, MPI_MAX, 0, MPI_COMM_WORLD);
    t_total[r] = tot_max; t_comp[r] = comp_max; t_comm[r] = comm_max;
    t_imb[r] = comp_max / (comp_sum / ranks);      /* 1.00 = reparto perfecto; >1 = algún rank espera a otro */
  }

  /* Equipos distintos que participan (para el informe: cuántos nodos físicos hubo) */
  char name[MPI_MAX_PROCESSOR_NAME] = {0};
  int len = 0;
  MPI_Get_processor_name(name, &len);
  char *all = rank == 0 ? calloc((size_t)ranks, MPI_MAX_PROCESSOR_NAME) : NULL;
  MPI_Gather(name, MPI_MAX_PROCESSOR_NAME, MPI_CHAR, all, MPI_MAX_PROCESSOR_NAME, MPI_CHAR, 0, MPI_COMM_WORLD);

  if (rank == 0) {
    int hosts = 0;
    for (int i = 0; i < ranks; i++) {
      int seen = 0;
      for (int j = 0; j < i; j++) if (!strcmp(all + (size_t)i * MPI_MAX_PROCESSOR_NAME, all + (size_t)j * MPI_MAX_PROCESSOR_NAME)) { seen = 1; break; }
      if (!seen) hosts++;
    }
    double total = median(t_total, reps), comp = median(t_comp, reps), comm = median(t_comm, reps), imb = median(t_imb, reps);
    if (csv) {
      printf("%d,%ld,%d,%d,%d,%ld,%llu,%.3f,%.3f,%.3f,%.3f\n", size, samples, hosts, ranks, threads, global_acc,
             density_checksum(global, n), total, comp, comm, imb);
    } else {
      printf("size=%d samples=%ld hosts=%d ranks=%d threads_per_rank=%d accepted=%ld checksum=%llu "
             "total_ms=%.2f compute_ms=%.2f comm_ms=%.3f imbalance=%.3f\n",
             size, samples, hosts, ranks, threads, global_acc, density_checksum(global, n), total, comp, comm, imb);
    }
    free(all);
  }
  free(shots); free(local); free(global); free(t_total); free(t_comp); free(t_comm); free(t_imb);
  MPI_Finalize();
  return 0;
}
