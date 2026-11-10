// Crea .env a partir de .env.example con secretos aleatorios.   Uso:  node scripts/init-env.mjs
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, '.env');

if (existsSync(target)) {
  console.log('.env ya existe: no lo toco. (Bórralo si quieres generarlo de nuevo.)');
  process.exit(0);
}
const hex = (n) => randomBytes(n).toString('hex'); // solo 0-9a-f: seguro dentro de una URL de conexión
const text = readFileSync(join(root, '.env.example'), 'utf8')
  .replace(/^POSTGRES_PASSWORD=.*$/m, `POSTGRES_PASSWORD=${hex(16)}`)
  .replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${hex(32)}`)
  .replace(/^AI_NODE_TOKEN=.*$/m, `AI_NODE_TOKEN=${hex(24)}`);
writeFileSync(target, text);
console.log('.env creado con una contraseña de base de datos, un JWT_SECRET y un AI_NODE_TOKEN aleatorios.');
console.log('Siguiente paso:  docker compose up --build');
