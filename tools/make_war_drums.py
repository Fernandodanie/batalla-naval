"""Compone «tambores de guerra» (loop sin costura, ~43 s) para el login de Batalla Naval.

Todo es síntesis propia (sin muestras de terceros → sin derechos de autor):
  - taiko / tom grave (seno con caída de tono + golpe de ruido)
  - bordón grave en Re menor con vaivén lento
  - redoble militar suave (ruido filtrado) y pad de metales graves
  - reverb por convolución; se renderizan 3 vueltas y se toma la del medio para que el loop no se corte.
"""
import sys
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 44100
BPM = 90
BEAT = 60 / BPM
BAR = BEAT * 4
BARS = 16
LOOP = BAR * BARS
rng = np.random.default_rng(7)


def env_exp(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def lowpass(x, fc, order=2):
    sos = signal.butter(order, fc, btype="low", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def bandpass(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], btype="band", fs=SR, output="sos")
    return signal.sosfilt(sos, x)


def drum(freq, dur, vel=1.0, snap=0.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    # el tono cae rápido de ~2.2f a f: el «bum» del taiko
    f = freq * (1 + 1.3 * np.exp(-t / 0.045))
    phase = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(phase) * env_exp(n, 0.28)
    body += 0.35 * np.sin(phase * 1.5) * env_exp(n, 0.12)
    hit = bandpass(rng.standard_normal(n), 900, 4200) * env_exp(n, 0.012) * snap
    skin = lowpass(rng.standard_normal(n), 380) * env_exp(n, 0.05) * 0.8
    return (body + hit + skin) * vel


def place(buf, sig, t0):
    i = int(t0 * SR)
    j = min(len(buf), i + len(sig))
    if i < len(buf):
        buf[i:j] += sig[: j - i]


def render_loop():
    n = int(LOOP * SR)
    L = np.zeros(n)  # canal izquierdo
    R = np.zeros(n)
    big, mid, small = 52.0, 70.0, 98.0  # tamaños de tambor (Hz base)

    def hit(buf_pan, t, freq, vel, dur=1.1, snap=0.5):
        d = drum(freq, dur, vel, snap)
        pan = buf_pan
        place(L, d * (1 - pan) ** 0.5, t)
        place(R, d * pan ** 0.5, t)

    for bar in range(BARS):
        b0 = bar * BAR
        section = bar // 4
        # ---- tambor grande: latido (siempre)
        hit(0.5, b0, big, 1.0)
        # Golpe de apoyo en el compás desde el inicio
        hit(0.5, b0 + BEAT * 2.5, big, 0.85)

        # ---- patrón de marcha activo desde el inicio: DUM . . dum dum . DUM .
        for k, (pos, v, f, p) in enumerate([
            (1.0, 0.55, mid, 0.40), (1.5, 0.45, small, 0.62),
            (3.0, 0.60, mid, 0.40), (3.5, 0.50, small, 0.62),
        ]):
            hit(p, b0 + BEAT * pos, f, v, 0.7, 0.6)

        if section >= 1:
            for pos in (0.5, 2.0, 3.75):
                hit(0.55, b0 + BEAT * pos, small * 1.18, 0.38, 0.5, 0.7)

        # ---- redoble de caja suave (corcheas) presente desde el compás 1
        vel_roll = 0.12 if section == 0 else (0.15 if section == 1 else 0.18)
        for s in range(8):
            t = b0 + BEAT * (s * 0.5) + BEAT * 0.25
            n_s = int(0.09 * SR)
            nz = bandpass(rng.standard_normal(n_s), 1800, 7500) * env_exp(n_s, 0.022)
            a = vel_roll * (1.4 if s % 2 == 0 else 0.8)
            pan = 0.35 if s % 2 == 0 else 0.65
            place(L, nz * a * (1 - pan) ** 0.5, t)
            place(R, nz * a * pan ** 0.5, t)
        # ---- relleno al final de cada frase de 4 compases
        if bar % 4 == 3:
            for k in range(6):
                hit(0.3 + 0.08 * k, b0 + BEAT * (2.5 + k * 0.25), mid * (1 - 0.03 * k), 0.38 + 0.08 * k, 0.5, 0.7)
            hit(0.5, b0 + BEAT * 3.99 - BEAT * 0.01, big, 0.0)  # (sin sonido: mantiene la forma)

    # ---- bordón grave (Re menor): D1 + A1 con vaivén lento; periodo = divisor de LOOP para cerrar sin costura
    t = np.arange(n) / SR
    lfo = 0.5 + 0.5 * np.sin(2 * np.pi * t / (LOOP / 2) - np.pi / 2)  # 2 vaivenes por vuelta
    drone = (np.sin(2 * np.pi * 36.71 * t) + 0.5 * np.sin(2 * np.pi * 73.42 * t + 0.4)
             + 0.35 * np.sin(2 * np.pi * 55.0 * t + 1.1))
    drone *= 0.22 * (0.55 + 0.45 * lfo)
    # ---- pad de metales: saws graves filtrados (D2, F2, A2, D3), aparecen de la sección 2 en adelante
    pad = np.zeros(n)
    for f0, g in ((73.42, 1.0), (87.31, 0.7), (110.0, 0.8), (146.83, 0.45)):
        for det in (-0.35, 0.0, 0.35):
            pad += g * signal.sawtooth(2 * np.pi * (f0 + det) * t + rng.uniform(0, 6.28))
    pad = lowpass(pad, 420, 3)
    swell = np.clip((t - 8 * BAR) / (2 * BAR), 0, 1)  # entra en el compás 9
    fade = np.clip((LOOP - t) / (2 * BAR), 0, 1)  # y se va hacia el final para cerrar el loop
    pad *= 0.045 * swell * fade * (0.6 + 0.4 * lfo)
    # ---- motivo lento de «cuerno» sobre el pad: D – F – E – D, una nota por compás (compases 9-12 y 13-16)
    horn = np.zeros(n)
    notes = [(146.83, 8), (174.61, 9), (164.81, 10), (146.83, 11), (146.83, 12), (196.0, 13), (174.61, 14), (146.83, 15)]
    for f0, bar in notes:
        i0 = int(bar * BAR * SR)
        ln = int(BAR * SR)
        tt = np.arange(ln) / SR
        s = signal.sawtooth(2 * np.pi * f0 * tt) + 0.6 * signal.sawtooth(2 * np.pi * f0 * 1.004 * tt)
        s = lowpass(s, 900, 2)
        e = np.clip(tt / 0.35, 0, 1) * np.clip((BAR - tt) / 0.5, 0, 1)
        horn[i0:i0 + ln] += s * e * 0.05
    L += drone + pad + horn * 0.9
    R += drone + pad + horn * 1.1
    return L, R


def reverb(x, secs=2.4, wet=0.28):
    n = int(secs * SR)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / (0.55 * SR))
    ir = lowpass(ir, 3500)
    ir /= np.sqrt(np.sum(ir ** 2))
    return (1 - wet) * x + wet * signal.fftconvolve(x, ir)[: len(x)]


def main(out_wav):
    L, R = render_loop()
    three = [np.concatenate([c, c, c]) for c in (L, R)]
    three = [reverb(c) for c in three]
    n = len(L)
    L2, R2 = (c[n:2 * n] for c in three)  # la vuelta del medio: ya incluye la cola de la anterior → loop sin corte
    stereo = np.stack([L2, R2], axis=1)
    stereo = np.tanh(stereo * 1.1)  # saturación suave: pega el conjunto
    stereo /= np.max(np.abs(stereo)) / 0.89
    wavfile.write(out_wav, SR, (stereo * 32767).astype(np.int16))
    print(f"ok {out_wav}: {n / SR:.2f} s")


if __name__ == "__main__":
    main(sys.argv[1])
