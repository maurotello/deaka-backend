// server/db.js
import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

// Los logs de depuración son CRUCIALES en el entorno de Render
//console.log('=== VARIABLES DE ENTORNO EN db.js ===');
//console.log('DB_HOST:', process.env.DB_HOST);
//console.log('DB_PORT:', process.env.DB_PORT);
//console.log('DB_USER:', process.env.DB_USER);
//console.log('DB_NAME:', process.env.DB_NAME);
//console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***DEFINIDA***' : '❌ NO DEFINIDA');
//console.log('=====================================\n');


// ⚠️ IMPORTANTE: Este Pool ahora depende COMPLETAMENTE de que las variables
// de entorno estén configuradas correctamente en Render (o en tu .env local).

const pool = new Pool({
    // Utilizamos las variables que configuraremos en Render
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    // Convertimos el puerto a número, usando 5432 como fallback si no se define.
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,

    // 🔥 CONFIGURACIÓN SSL CRÍTICA PARA SUPABASE 🔥
    // Asumimos que si hay un host definido, NO estamos en localhost y necesitamos SSL.
    ssl: (process.env.DB_HOST &&
        !process.env.DB_HOST.includes('localhost') &&
        process.env.DB_HOST !== 'db') ? {
        rejectUnauthorized: false,
    } : false,

    connectionTimeoutMillis: 10000,
});

// Función de prueba para verificar la conexión
async function testConnection() {
    try {
        console.log(`Intentando conectar a DB en host: ${pool.options.host}:${pool.options.port}`);
        const client = await pool.connect();
        const result = await client.query('SELECT NOW() as now');
        console.log('✅ Conexión a la base de datos exitosa. Hora del servidor:', result.rows[0].now);
        client.release();
    } catch (err) {
        console.error('❌ ERROR de conexión a la base de datos:', err.message);
        console.error('Verifica que las variables de entorno de Render sean las correctas del Pooler.');
        // Terminamos el proceso en producción si la conexión a la DB falla
        if (process.env.NODE_ENV === 'production') {
            process.exit(1);
        }
    }
}

// Ejecutamos la prueba de conexión al iniciar
testConnection();


export default {
    query: (text, params) => pool.query(text, params),
};