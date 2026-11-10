/*
 * Ping-pong MPI: mide la latencia (α) y el ancho de banda (β) de la red entre DOS procesos.
 * Con el modelo de Hockney, enviar m bytes cuesta  T(m) = α + m/β  (un solo sentido).
 *
 *   mpirun --hostfile ../cluster/hostfile -np 2 --map-by node ./pingpong_mpi > red.csv
 *   (--map-by node coloca un proceso en cada equipo: así se mide la RED y no la memoria compartida)
 *
 * Salida CSV: bytes,one_way_us.  Úsalo con:  node informe/results-to-latex.mjs --net red.csv ...
 * En modo local (los dos procesos en el mismo equipo) mide la mensajería por memoria compartida, no la red.
 */
#include <mpi.h>
#include <stdio.h>
#include <stdlib.h>

int main(int argc, char **argv) {
  MPI_Init(&argc, &argv);
  int rank, ranks;
  MPI_Comm_rank(MPI_COMM_WORLD, &rank);
  MPI_Comm_size(MPI_COMM_WORLD, &ranks);
  if (ranks != 2) { if (rank == 0) fprintf(stderr, "Usa exactamente 2 procesos (-np 2)\n"); MPI_Finalize(); return 1; }

  const int max_bytes = 4 * 1024 * 1024;
  char *buf = calloc(max_bytes, 1);
  if (rank == 0) printf("bytes,one_way_us\n");
  for (int bytes = 1; bytes <= max_bytes; bytes *= (bytes < 64 ? 2 : 4)) {
    int reps = bytes <= 1024 ? 2000 : (bytes <= 65536 ? 400 : 40);
    for (int pass = 0; pass < 2; pass++) {           /* pasada 0: calentamiento */
      MPI_Barrier(MPI_COMM_WORLD);
      double t0 = MPI_Wtime();
      for (int i = 0; i < reps; i++) {
        if (rank == 0) { MPI_Send(buf, bytes, MPI_CHAR, 1, 0, MPI_COMM_WORLD); MPI_Recv(buf, bytes, MPI_CHAR, 1, 0, MPI_COMM_WORLD, MPI_STATUS_IGNORE); }
        else           { MPI_Recv(buf, bytes, MPI_CHAR, 0, 0, MPI_COMM_WORLD, MPI_STATUS_IGNORE); MPI_Send(buf, bytes, MPI_CHAR, 0, 0, MPI_COMM_WORLD); }
      }
      double rtt = (MPI_Wtime() - t0) / reps;
      if (rank == 0 && pass == 1) printf("%d,%.3f\n", bytes, rtt / 2.0 * 1e6);
    }
  }
  free(buf);
  MPI_Finalize();
  return 0;
}
