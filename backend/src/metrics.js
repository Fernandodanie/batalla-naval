import { monitorEventLoopDelay } from 'node:perf_hooks';

/**
 * Retraso del event loop: cuánto tarda el hilo principal en atender un temporizador DESPUÉS de cuando debía.
 * Es la medida directa de "¿se congeló el servidor?". Si un cálculo pesado corre en el hilo principal,
 * este número sube para TODAS las salas; si corre en los workers, se mantiene bajo.
 *
 * El histograma de Node mide el intervalo completo entre ticks (≈ la resolución en reposo), por eso se
 * resta la resolución: lo que queda es el retraso real.
 */
export function createMetrics({ resolution = 10 } = {}) {
  const h = monitorEventLoopDelay({ resolution });
  h.enable();
  const lag = (ns) => Math.max(0, Math.round((ns / 1e6 - resolution) * 100) / 100);
  return {
    /** Percentiles del retraso en milisegundos desde el último `reset()`. */
    snapshot() {
      return { p50: lag(h.percentile(50)), p99: lag(h.percentile(99)), max: lag(h.max), samples: h.count };
    },
    reset() { h.reset(); },
    close() { h.disable(); },
  };
}

/** Formato de texto de Prometheus (para Grafana). Solo gauges numéricos. */
export function prometheusText({ counts, ai, eventLoop, uptime }) {
  const lines = [];
  const gauge = (name, help, value) => {
    if (typeof value !== 'number' || Number.isNaN(value)) return;
    lines.push(`# HELP ${name} ${help}`, `# TYPE ${name} gauge`, `${name} ${value}`);
  };
  for (const [k, v] of Object.entries(counts)) gauge(`batalla_${k}`, `Cantidad de ${k}`, v);
  gauge('batalla_ai_workers', 'Hilos de IA', ai.workers);
  gauge('batalla_ai_busy', 'Hilos de IA ocupados', ai.busy);
  gauge('batalla_ai_queue_live', 'Tareas en vivo esperando un hilo', ai.queuedLive);
  gauge('batalla_ai_queue_batch', 'Tareas por lotes esperando un hilo', ai.queuedBatch);
  gauge('batalla_ai_completed_total', 'Tareas completadas por el pool', ai.completed);
  gauge('batalla_ai_inline_total', 'Decisiones calculadas en el hilo principal', ai.inlineRuns);
  gauge('batalla_ai_degraded_total', 'Decisiones con menos muestras por sobrecarga', ai.degraded);
  gauge('batalla_ai_rejected_total', 'Decisiones rechazadas por cola saturada', ai.rejected);
  gauge('batalla_ai_cancelled_total', 'Tareas canceladas', ai.cancelled);
  gauge('batalla_eventloop_lag_p50_ms', 'Retraso del event loop, mediana', eventLoop.p50);
  gauge('batalla_eventloop_lag_p99_ms', 'Retraso del event loop, percentil 99', eventLoop.p99);
  gauge('batalla_eventloop_lag_max_ms', 'Retraso máximo del event loop', eventLoop.max);
  gauge('batalla_uptime_seconds', 'Segundos en línea', uptime);
  return lines.join('\n') + '\n';
}
