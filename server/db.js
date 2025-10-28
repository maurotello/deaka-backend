// server/db.js
import 'dotenv/config'; // Asegura que las variables de entorno se carguen (para entorno NO Docker)
import pg from 'pg';
const { Pool } = pg;

// Usamos el operador de coalescencia nulo (??) para preferir las variables de Docker (process.env)
// Si no están (fuera de Docker), usamos los valores por defecto.
const pool = new Pool({
  user: process.env.DB_USER ?? 'user_dev',
  host: process.env.DB_HOST ?? 'localhost', // ⬅️ CRUCIAL: 'db' en Docker, 'localhost' fuera
  database: process.env.DB_NAME ?? 'directorio_local_db',
  password: process.env.DB_PASSWORD ?? 'password_dev',
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 5433, // ⬅️ CRUCIAL: 5432 en Docker, 5433 fuera
});

export default {
  query: (text, params) => pool.query(text, params),
};