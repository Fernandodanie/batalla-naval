# make        → compila main.pdf (requiere latexmk y TeX Live con IEEEtran: texlive-publishers en Debian/Ubuntu,
#                texlive-publishers en Arch/Manjaro). Sin LaTeX local: sube esta carpeta a Overleaf.
# make datos  → regenera generado/ desde tus CSV (rutas en variables MPI, NODE, NET)
MPI  ?= ../cluster/resultados-mpi.csv
NODE ?= ../cluster/resultados-node.csv
NET  ?= ../cluster/red.csv

main.pdf: main.tex refs.bib $(wildcard generado/*.tex)
	latexmk -pdf -interaction=nonstopmode main.tex

datos:
	node results-to-latex.mjs --mpi $(MPI) $(if $(wildcard $(NODE)),--node $(NODE)) $(if $(wildcard $(NET)),--net $(NET))

clean:
	latexmk -C
