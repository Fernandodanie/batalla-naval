/*
 * Núcleo Monte Carlo compartido por montecarlo_omp.c (OpenMP) y montecarlo_mpi.c (MPI + OpenMP).
 *
 * Es la MISMA lógica que backend/src/ai/montecarlo.js (generador mulberry32, semillas por trozo y orden de llamadas
 * al generador idénticos). Con los mismos parámetros las tres versiones (Node, OpenMP, MPI) producen el MISMO
 * conteo de muestras válidas y la MISMA suma de control: así se verifica que son correctas y comparables.
 *
 * Reparto de datos (particionamiento): las `samples` muestras se cortan en `parts` trozos casi iguales, como
 * split() en pool.js (los primeros `samples % parts` trozos llevan una muestra más). El trozo k usa la semilla
 * chunk_seed(seed, k). Cada trozo es independiente de los demás: no hay comunicación hasta la reducción final.
 */
#ifndef MC_CORE_H
#define MC_CORE_H
#include <omp.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>

enum { UNKNOWN = 0, MISS = 1, HIT = 2, SUNK = 3 };

/* ---------------------------------------------------------------- generador (idéntico a rng.js) */
static inline double rng_next(uint32_t *a) {
  *a += 0x6d2b79f5u;
  uint32_t t = *a;
  t = (t ^ (t >> 15)) * (t | 1u);
  t ^= t + (t ^ (t >> 7)) * (t | 61u);
  return (double)(t ^ (t >> 14)) / 4294967296.0;
}
static inline uint32_t chunk_seed(uint32_t seed, uint32_t k) { return seed + (k + 1u) * 0x9e3779b1u; }

/* ---------------------------------------------------------------- posiciones posibles de un barco */
typedef struct { int n; int *start; int *step; } List;
typedef struct { List all, hit; } Placements;

static void list_push(List *l, int cap, int s, int st) { l->start[l->n] = s; l->step[l->n] = st; l->n++; (void)cap; }

static Placements build_placements(int size, const uint8_t *shots, int length) {
  int cap = size * size * 2;
  Placements p;
  p.all.n = p.hit.n = 0;
  p.all.start = malloc(sizeof(int) * cap); p.all.step = malloc(sizeof(int) * cap);
  int hitcap = cap * 512; /* una posición puede repetirse hasta 512 veces en la lista de "cubre impactos" */
  p.hit.start = malloc(sizeof(int) * hitcap); p.hit.step = malloc(sizeof(int) * hitcap);
  for (int h = 0; h < (length == 1 ? 1 : 2); h++) {
    int horizontal = (h == 0), step = horizontal ? 1 : size;
    for (int r = 0; r < size; r++) for (int c = 0; c < size; c++) {
      if (horizontal ? c + length > size : r + length > size) continue;
      int s = r * size + c, blocked = 0, covers = 0;
      for (int k = 0; k < length; k++) {
        uint8_t v = shots[s + k * step];
        if (v == MISS || v == SUNK) { blocked = 1; break; }
        if (v == HIT) covers++;
      }
      if (blocked) continue;
      list_push(&p.all, cap, s, step);
      if (covers > 0) {
        int copies = 1;
        for (int e = 1; e < covers && copies < 512; e++) copies *= 8;
        if (copies > 512) copies = 512;
        for (int c2 = 0; c2 < copies; c2++) list_push(&p.hit, hitcap, s, step);
      }
    }
  }
  return p;
}

/* ---------------------------------------------------------------- una tanda de muestras (= sampleDensity) */
static void sample_density(int size, const uint8_t *shots, const int *lengths, int nships, const Placements *plan,
                           int hit_count, long samples, uint32_t seed, int *density, long *accepted) {
  int n = size * size;
  uint32_t rng = seed;
  int *occupied = calloc(n, sizeof(int));
  int *cs = malloc(sizeof(int) * nships), *cst = malloc(sizeof(int) * nships);
  (void)lengths;
  long acc = 0;
  for (long sample = 1; sample <= samples; sample++) {
    int covered = 0, failed = 0;
    for (int s = 0; s < nships && !failed; s++) {
      const Placements *pl = &plan[s];
      int len = lengths[s], placed = 0;
      for (int attempt = 0; attempt < 40 && !placed; attempt++) {
        const List *list = &pl->all;
        if (covered < hit_count && pl->hit.n > 0) { if (rng_next(&rng) < 0.9) list = &pl->hit; }
        int k = (int)(rng_next(&rng) * list->n);
        int start = list->start[k], step = list->step[k], free_ = 1;
        for (int j = 0; j < len; j++) if (occupied[start + j * step] == (int)sample) { free_ = 0; break; }
        if (!free_) continue;
        for (int j = 0; j < len; j++) {
          int i = start + j * step;
          occupied[i] = (int)sample;
          if (shots[i] == HIT) covered++;
        }
        cs[s] = start; cst[s] = step;
        placed = 1;
      }
      if (!placed) failed = 1;
    }
    if (failed || covered != hit_count) continue;
    acc++;
    for (int s = 0; s < nships; s++) for (int j = 0; j < lengths[s]; j++) {
      int i = cs[s] + j * cst[s];
      if (shots[i] == UNKNOWN) density[i]++;
    }
  }
  free(occupied); free(cs); free(cst);
  *accepted = acc;
}

static int cmp_desc(const void *a, const void *b) { return *(const int *)b - *(const int *)a; }

/* Flotas por tamaño de tablero (las mismas que backend/src/domain/fleet.js). */
static int fleet_for(int size, int *out) {
  static const int f8[] = {4, 3, 3, 2}, f10[] = {5, 4, 3, 3, 2}, f12[] = {5, 4, 4, 3, 3, 2, 2},
                   f15[] = {6, 5, 5, 4, 4, 3, 3, 3, 2, 2}, f20[] = {7, 6, 6, 5, 5, 4, 4, 4, 3, 3, 3, 2, 2, 2};
  const int *src = NULL; int n = 0;
  switch (size) {
    case 8: src = f8; n = 4; break;
    case 10: src = f10; n = 5; break;
    case 12: src = f12; n = 7; break;
    case 15: src = f15; n = 10; break;
    case 20: src = f20; n = 14; break;
    default: return 0;
  }
  memcpy(out, src, sizeof(int) * n);
  return n;
}


/* Escena de referencia (la misma que scripts/bench-parallel.js): dos impactos juntos y cuatro casillas de agua. */
static void scenario_init(int size, uint8_t *shots) {
  int n = size * size;
  memset(shots, 0, n);
  shots[size * 3 + 4] = HIT; shots[size * 3 + 5] = HIT;
  shots[1] = MISS; shots[size + 7] = MISS; shots[n - 1] = MISS; shots[n - 2] = MISS;
}

/*
 * Calcula los trozos [first, first + count) de un total de `parts`, repartidos entre `threads` hilos OpenMP.
 * Deja en `density` la densidad PARCIAL (suma de esos trozos) y en `accepted` sus muestras válidas.
 *   - OpenMP solo:        first = 0,         count = parts = hilos
 *   - MPI + OpenMP:       first = rank * T,  count = T,  parts = ranks * T
 * Cada iteración del `parallel for` es un trozo: el resultado no depende de cuántos hilos reales haya.
 */
static void compute_chunks(int size, const uint8_t *shots, const int *lengths, int nships, long samples, int parts,
                           int first, int count, int threads, uint32_t seed, int *density, long *accepted) {
  int n = size * size, hit_count = 0;
  for (int i = 0; i < n; i++) if (shots[i] == HIT) hit_count++;

  Placements plan[32];
  for (int s = 0; s < nships; s++) plan[s] = build_placements(size, shots, lengths[s]);
  memset(density, 0, sizeof(int) * n);

  long base = samples / parts, extra = samples % parts, total_acc = 0;
  #pragma omp parallel for schedule(static, 1) num_threads(threads) reduction(+ : total_acc)
  for (int i = 0; i < count; i++) {
    int k = first + i;                                  /* índice GLOBAL del trozo */
    long chunk = base + (k < extra ? 1 : 0);
    if (chunk <= 0) continue;
    int *local = calloc(n, sizeof(int));
    long acc = 0;
    sample_density(size, shots, lengths, nships, plan, hit_count, chunk, chunk_seed(seed, (uint32_t)k), local, &acc);
    for (int j = 0; j < n; j++) if (local[j]) {          /* volcado único con poca contención (como Atomics.add en Node) */
      #pragma omp atomic
      density[j] += local[j];
    }
    total_acc += acc;
    free(local);
  }
  *accepted = total_acc;
  for (int s = 0; s < nships; s++) { free(plan[s].all.start); free(plan[s].all.step); free(plan[s].hit.start); free(plan[s].hit.step); }
}

/* Suma de control: igual que scripts/mc-checksum.js. */
static unsigned long long density_checksum(const int *density, int n) {
  uint64_t sum = 0;
  for (int i = 0; i < n; i++) sum += (uint64_t)density[i] * (uint64_t)(i + 1);
  return (unsigned long long)(sum % 4294967296ULL);
}

#endif
