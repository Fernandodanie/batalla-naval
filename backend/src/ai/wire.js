/**
 * Serialización de tareas y respuestas para viajar por la red (JSON sobre HTTP).
 * Los arreglos tipados (la densidad Int32Array) no sobreviven a JSON.stringify, así que se envían en base64.
 * Nota: se asume el mismo orden de bytes (little-endian) en ambos extremos: es el caso de x86 y ARM actuales.
 */
export function encode(value) {
  return JSON.stringify(value, (_k, v) => (v instanceof Int32Array
    ? { $i32: Buffer.from(v.buffer, v.byteOffset, v.byteLength).toString('base64') }
    : v));
}

export function decode(text) {
  return JSON.parse(text, (_k, v) => {
    if (v && typeof v === 'object' && typeof v.$i32 === 'string') {
      const b = Buffer.from(v.$i32, 'base64');
      return new Int32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); // copia: asegura alineación a 4 bytes
    }
    return v;
  });
}
