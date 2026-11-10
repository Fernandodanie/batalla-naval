# Linux/Manjaro:  sudo pacman -S base-devel openmpi        (gcc ya trae OpenMP)
# Ubuntu/Debian:  sudo apt install build-essential openmpi-bin libopenmpi-dev
# Windows:        usar WSL2 (recomendado) o MSYS2 con mingw-w64-gcc + MS-MPI
CC  ?= gcc
MPICC ?= mpicc
CFLAGS ?= -O2 -fopenmp -Wall -Wextra

all: omp mpi pingpong

omp: montecarlo_omp
mpi: montecarlo_mpi
pingpong: pingpong_mpi

montecarlo_omp: montecarlo_omp.c mc_core.h
	$(CC) $(CFLAGS) -o $@ $< -lm

montecarlo_mpi: montecarlo_mpi.c mc_core.h
	$(MPICC) $(CFLAGS) -o $@ $< -lm

pingpong_mpi: pingpong_mpi.c
	$(MPICC) $(CFLAGS) -o $@ $<

clean:
	rm -f montecarlo_omp montecarlo_omp.exe montecarlo_mpi pingpong_mpi
