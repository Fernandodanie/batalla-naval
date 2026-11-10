"""Compone la música de fondo de Batalla Naval (dos bucles de 64 s, sin costura) fuera del login.

  ambiente-puerto.mp3    menús, campañas y láminas: pad cálido en Re menor, notas sueltas tipo «caja de música» y mar lejano.
  ambiente-batalla.mp3   en partida: bordón grave, oleaje, tambores muy lejanos y un cuerno apenas insinuado. Más oscuro, casi sin melodía,
                         para que los efectos de disparo y la narración sigan siendo lo importante.

Todo es síntesis propia (sin muestras de terceros → sin derechos de autor), en la misma tonalidad que los «tambores de guerra» del login
(Re menor) para que el paso de una pista a otra por fundido suene natural.

SIN COSTURA: cada nota se coloca «en círculo» (lo que se pasa del final vuelve al principio) y la reverb es una convolución circular,
así que el final enlaza con el inicio sin saltos ni silencio. Todos los ciclos lentos (oleaje, vaivenes) dan un número entero de vueltas.

Uso:  python3 tools/make_ambient.py <carpeta de salida>      (necesita numpy, scipy y ffmpeg con libmp3lame)
"""
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 44100
BPM = 60
BEAT = 60 / BPM
BAR = BEAT * 4
BARS = 16
LOOP = BAR * BARS            # 64 s
N = int(LOOP * SR)
T = np.arange(N) / SR


def lowpass(x, fc, order=2):
    return signal.sosfilt(signal.butter(order, fc, btype="low", fs=SR, output="sos"), x)


def highpass(x, fc, order=2):
    return signal.sosfilt(signal.butter(order, fc, btype="high", fs=SR, output="sos"), x)


def bandpass(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, hi], btype="band", fs=SR, output="sos"), x)


def place(buf, sig, t0):
    """Suma `sig` en `buf` desde t0 (s), dando la vuelta al llegar al final (bucle sin costura)."""
    i = int(round(t0 * SR)) % N
    n = len(sig)
    first = min(n, N - i)
    buf[i:i + first] += sig[:first]
    rest = n - first
    while rest > 0:                       # lo que se pasa del final entra por el principio
        k = min(rest, N)
        buf[:k] += sig[first:first + k]
        first += k
        rest -= k


def circular_reverb(x, secs, wet, seed, damp=3200):
    """Reverb de convolución CIRCULAR: la cola del final se mezcla con el principio."""
    rng = np.random.default_rng(seed)
    n = int(secs * SR)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / (0.42 * secs * SR))
    ir = lowpass(ir, damp)
    ir /= np.sqrt(np.sum(ir ** 2))
    y = np.fft.irfft(np.fft.rfft(x) * np.fft.rfft(ir, N), N)
    return (1 - wet) * x + wet * y


def smooth_env(n, attack, release):
    t = np.arange(n) / SR
    up = np.clip(t / attack, 0, 1)
    down = np.clip((n / SR - t) / release, 0, 1)
    up, down = up * up * (3 - 2 * up), down * down * (3 - 2 * down)   # curvas suaves (sin clics)
    return up * down


def pad_note(freq, dur, attack=1.8, release=2.6, bright=0.35, drift=0.0, phase=0.0):
    """Nota de pad: fundamental + armónicos suaves, dos voces apenas desafinadas y un vaivén lento."""
    n = int((dur + release) * SR)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for det, g in ((-0.0018, 1.0), (0.0018, 0.9)):
        f = freq * (1 + det) + drift
        ph = 2 * np.pi * f * t + phase
        out += g * (np.sin(ph) + bright * 0.5 * np.sin(2 * ph + 0.4) + bright * 0.18 * np.sin(3 * ph + 1.1))
    wob = 1 + 0.06 * np.sin(2 * np.pi * 0.11 * t + phase)
    return out * wob * smooth_env(n, attack, release) * 0.5


def pluck(freq, dur=3.2, tau=0.9, bell=0.42):
    """Nota suelta tipo caja de música / arpa lejana: ataque corto, caída larga."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    e = np.exp(-t / tau) * np.clip(t / 0.006, 0, 1)
    s = np.sin(2 * np.pi * freq * t) + bell * np.sin(2 * np.pi * freq * 2.0 * t) * np.exp(-t / (tau * 0.5)) \
        + 0.14 * np.sin(2 * np.pi * freq * 3.01 * t) * np.exp(-t / (tau * 0.3))
    return lowpass(s * e, 5200, 2)


def taiko(freq, vel=1.0, dur=2.2):
    """Tambor grave y lejano (sin golpe seco: solo el «bum»)."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = freq * (1 + 1.1 * np.exp(-t / 0.05))
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / 0.32) + 0.3 * np.sin(ph * 1.5) * np.exp(-t / 0.14)
    skin = lowpass(np.random.default_rng(int(freq * 10)).standard_normal(n), 300) * np.exp(-t / 0.06) * 0.5
    tom = np.sin(2 * np.pi * freq * 2.2 * t) * np.exp(-t / 0.2) * 0.45     # armónico audible en parlantes pequeños
    return lowpass(body + skin + tom, 900) * vel


def periodic_noise(seed, lo=None, hi=None, order=2):
    """Ruido con espectro dado y EXACTAMENTE periódico en la vuelta (se genera en frecuencia: no hay salto al cerrar el bucle)."""
    rng = np.random.default_rng(seed)
    X = np.fft.rfft(rng.standard_normal(N))
    f = np.fft.rfftfreq(N, 1 / SR)
    H = np.ones_like(f)
    if lo is not None:   # pasa-altos
        H *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-9)) ** (2 * order))
    if hi is not None:   # pasa-bajos
        H *= 1 / np.sqrt(1 + (f / hi) ** (2 * order))
    x = np.fft.irfft(X * H, N)
    return x / x.std()


def sea(seed, depth=0.5, cycles=4, lo=None, hi=420, level=1.0):
    """Oleaje: ruido filtrado cuyo volumen sube y baja un número ENTERO de veces por vuelta (cierra sin costura)."""
    swell = (1 - depth) + depth * (0.5 + 0.5 * np.sin(2 * np.pi * cycles * T / LOOP - np.pi / 2)) ** 1.5
    return periodic_noise(seed, lo, hi) * swell * level


def finish(L, R, wet, secs, seed, peak=0.8, damp=3200):
    L, R = circular_reverb(L, secs, wet, seed, damp), circular_reverb(R, secs, wet, seed + 1, damp)
    st = np.stack([L, R], axis=1)
    st = np.tanh(st * 0.9)
    st -= st.mean(axis=0)                                  # sin componente continua
    st /= np.max(np.abs(st)) / peak
    return st


# ============================================================== PUERTO (menús y campañas)
# Re menor: 8 acordes de 2 compases (8 s). Notas en Hz.
ACORDES_PUERTO = [
    ("Dm9",    [73.42, 146.83, 174.61, 220.00, 329.63]),
    ("Bbmaj7", [58.27, 116.54, 146.83, 174.61, 220.00]),
    ("F",      [87.31, 130.81, 174.61, 220.00, 261.63]),
    ("Asus4",  [55.00, 110.00, 146.83, 164.81, 220.00]),
    ("Dm",     [73.42, 146.83, 174.61, 220.00, 293.66]),
    ("Gm7",    [49.00, 98.00, 146.83, 174.61, 233.08]),
    ("Bb",     [58.27, 116.54, 174.61, 233.08, 293.66]),
    ("Asus4",  [55.00, 110.00, 146.83, 164.81, 220.00]),
]
# Notas de la «caja de música» (pentatónica de Re menor, registro medio-agudo) que encajan con cada acorde
MELODIA_PUERTO = [
    [(0.0, 440.00), (1.5, 349.23), (3.0, 293.66), (5.5, 329.63)],
    [(0.5, 349.23), (2.0, 440.00), (4.5, 293.66), (6.0, 349.23)],
    [(0.0, 523.25), (2.5, 440.00), (4.0, 349.23), (6.5, 440.00)],
    [(1.0, 329.63), (3.0, 440.00), (5.0, 587.33), (7.0, 440.00)],
    [(0.0, 293.66), (2.0, 349.23), (4.5, 440.00)],
    [(0.5, 466.16), (3.0, 349.23), (5.5, 293.66), (7.0, 392.00)],
    [(0.0, 349.23), (2.5, 466.16), (4.0, 587.33), (6.0, 466.16)],
    [(1.0, 440.00), (3.5, 329.63), (6.0, 293.66)],
]


def puerto():
    L = np.zeros(N)
    R = np.zeros(N)
    seg = 2 * BAR
    rng = np.random.default_rng(11)
    for k, (_, notas) in enumerate(ACORDES_PUERTO):
        t0 = k * seg
        for j, f in enumerate(notas):
            # cada nota entra un poco antes y se solapa con el acorde siguiente → cambios sin cortes
            note = pad_note(f, seg + 1.2, attack=2.0, release=3.0, bright=0.30 + 0.05 * j, phase=rng.uniform(0, 6.28))
            g = 0.30 if f < 100 else (0.42 if f < 300 else 0.34)
            pan = 0.5 + 0.18 * np.sin(1.7 * j + k)
            place(L, note * g * (1 - pan) ** 0.5, t0 - 0.6)
            place(R, note * g * pan ** 0.5, t0 - 0.6)
        for off, f in MELODIA_PUERTO[k]:
            n = pluck(f) * 0.55
            pan = 0.35 + 0.3 * rng.random()
            place(L, n * (1 - pan) ** 0.5, t0 + off)
            place(R, n * pan ** 0.5, t0 + off)
    # «brillo» del pad: una segunda capa una octava arriba, muy suave, para que se oiga también en parlantes pequeños
    for k, (_, notas) in enumerate(ACORDES_PUERTO):
        for j, f in enumerate(notas[1:4]):
            note = pad_note(f * 2, seg + 1.2, attack=2.4, release=3.2, bright=0.25, phase=rng.uniform(0, 6.28))
            pan = 0.5 + 0.28 * np.sin(2.1 * j + 1.3 * k)
            place(L, note * 0.20 * (1 - pan) ** 0.5, k * seg - 0.6)
            place(R, note * 0.20 * pan ** 0.5, k * seg - 0.6)
    # mar lejano, apenas audible
    L += sea(21, depth=0.55, cycles=4, lo=120, hi=900, level=0.05) + sea(31, depth=0.6, cycles=4, lo=2500, hi=7000, level=0.012)
    R += sea(22, depth=0.55, cycles=4, lo=120, hi=900, level=0.05) + sea(32, depth=0.6, cycles=4, lo=2500, hi=7000, level=0.012)
    return finish(L, R, wet=0.42, secs=3.2, seed=5, peak=0.8)


# ============================================================== BATALLA (en partida)
def batalla():
    L = np.zeros(N)
    R = np.zeros(N)
    rng = np.random.default_rng(31)
    # bordón: Re1 + La1 con un batido lento (0,35 Hz); 4 respiraciones por vuelta
    resp = 0.62 + 0.38 * (0.5 + 0.5 * np.sin(2 * np.pi * 4 * T / LOOP - np.pi / 2))
    # (frecuencias = múltiplos de 1/64 Hz: así cada una da un número entero de ciclos por vuelta y el bordón cierra sin salto de fase)
    drone = (np.sin(2 * np.pi * 36.703125 * T) + 0.8 * np.sin(2 * np.pi * 37.015625 * T)
             + 0.5 * np.sin(2 * np.pi * 55.0 * T + 0.8) + 0.2 * np.sin(2 * np.pi * 73.40625 * T + 1.3)) * resp
    # armónicos del bordón (Re2, La2, Re3): lo que se oye en parlantes de portátil o celular, donde el grave puro no suena
    drone += (0.55 * np.sin(2 * np.pi * 73.40625 * T + 0.3) + 0.42 * np.sin(2 * np.pi * 110.0 * T + 1.9)
              + 0.30 * np.sin(2 * np.pi * 146.8125 * T + 0.7) + 0.16 * np.sin(2 * np.pi * 220.0 * T + 2.4)) * (0.5 + 0.5 * resp)
    L += drone * 0.20
    R += drone * 0.20
    # pad oscuro que sube y baja despacio: Re–Fa–La–Mi, sin brillo
    seg = 4 * BAR
    for k, notas in enumerate(([146.83, 220.00, 349.23, 440.00], [116.54, 174.61, 293.66, 349.23],
                               [130.81, 196.00, 261.63, 392.00], [110.00, 164.81, 220.00, 329.63])):
        for j, f in enumerate(notas):
            note = lowpass(pad_note(f, seg + 2, attack=5.0, release=6.0, bright=0.22, phase=rng.uniform(0, 6.28)), 1100, 2)
            pan = 0.5 + 0.2 * np.sin(2.3 * j + k)
            place(L, note * 0.40 * (1 - pan) ** 0.5, k * seg - 3.0)
            place(R, note * 0.40 * pan ** 0.5, k * seg - 3.0)
    # tambores muy lejanos: uno cada dos compases, el grande en el compás 1 de cada frase
    for bar in range(0, BARS, 2):
        f = 49.0 if bar % 8 == 0 else 58.0
        v = 0.9 if bar % 8 == 0 else 0.55
        d = taiko(f, v)
        pan = 0.5 + 0.12 * (-1) ** (bar // 2)
        place(L, d * 0.42 * (1 - pan) ** 0.5, bar * BAR)
        place(R, d * 0.42 * pan ** 0.5, bar * BAR)
        if bar % 4 == 2:   # eco más pequeño medio compás después
            d2 = taiko(f * 1.5, v * 0.5, 1.4)
            place(L, d2 * 0.30, bar * BAR + BEAT * 2.5)
            place(R, d2 * 0.30, bar * BAR + BEAT * 2.5)
    # cuerno lejano: dos notas por vuelta (compases 7 y 15), muy suaves
    for bar, f in ((6, 146.83), (14, 130.81)):
        s = signal.sawtooth(2 * np.pi * f * np.arange(int(BAR * 1.5 * SR)) / SR) \
            + 0.6 * signal.sawtooth(2 * np.pi * f * 1.004 * np.arange(int(BAR * 1.5 * SR)) / SR)
        s = lowpass(s, 700, 2) * smooth_env(len(s), 1.4, 2.4) * 0.07
        place(L, s * 0.8, bar * BAR)
        place(R, s * 1.1, bar * BAR)
    # oleaje y viento (en los medios, para que se note en cualquier parlante)
    L += sea(41, depth=0.65, cycles=4, lo=90, hi=700, level=0.09) + sea(51, depth=0.7, cycles=2, lo=500, hi=2600, level=0.025)
    R += sea(42, depth=0.65, cycles=4, lo=90, hi=700, level=0.09) + sea(52, depth=0.7, cycles=2, lo=500, hi=2600, level=0.025)
    return finish(L, R, wet=0.5, secs=3.8, seed=9, peak=0.8, damp=2400)


def to_mp3(stereo, out_mp3, kbps=96):
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "t.wav"
        wavfile.write(str(wav), SR, (stereo * 32767).astype(np.int16))
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-codec:a", "libmp3lame", "-b:a", f"{kbps}k",
                        "-joint_stereo", "1", str(out_mp3)], check=True)


def main(out_dir):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    for name, fn in (("ambiente-puerto", puerto), ("ambiente-batalla", batalla)):
        st = fn()
        to_mp3(st, out / f"{name}.mp3")
        wavfile.write(str(out / f"{name}.check.wav"), SR, (st * 32767).astype(np.int16))   # copia sin comprimir para medir (se borra después)
        print(f"ok {name}.mp3: {len(st) / SR:.2f} s")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else ".")
