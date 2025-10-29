// server/db.js
import 'dotenv/config'; // Asegura que las variables de entorno se carguen (para entorno NO Docker)
import pg from 'pg';
const { Pool } = pg;

// 🔍 LOGS DE DEPURACIÓN - Agrega esto
console.log('=== VARIABLES DE ENTORNO ===');
console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? '***oculta***' : 'NO DEFINIDA');
console.log('============================\n');


// 1. Usamos process.env para obtener los valores de Supabase (o Docker).
// 2. Si las variables no existen (como en el entorno local antes de Docker), usamos los valores del .env.
//    Esto significa que si no estás en Docker, usará los valores que pusiste en el Canvas.
const pool = new Pool({
    user: process.env.DB_USER ?? process.env.DB_USER_DEFAULT, // Asumo que tienes una variable de usuario en .env
    host: process.env.DB_HOST ?? process.env.DB_HOST_DEFAULT,
    database: process.env.DB_NAME ?? process.env.DB_NAME_DEFAULT,
    password: process.env.DB_PASSWORD ?? process.env.DB_PASSWORD_DEFAULT,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : (process.env.DB_PORT_DEFAULT ? parseInt(process.env.DB_PORT_DEFAULT) : 5432),
    
    // 🔥 CONFIGURACIÓN SSL CRÍTICA PARA SUPABASE 🔥
    // Supabase requiere SSL. Si estás en producción, debes asegurarte que sea true.
    // Usamos un condicional para asegurar que solo se active si la conexión es externa (Supabase).
    ssl: process.env.DB_HOST && !process.env.DB_HOST.includes('localhost') ? {
        rejectUnauthorized: false, // Usar 'false' en desarrollo local para evitar problemas de certificado.
    } : false, // No usar SSL para conexiones locales (ej: la DB de Docker)
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
        console.error('Verifica que tu archivo .env tenga las credenciales correctas de Supabase.');
        // Puedes considerar lanzar un error o terminar la aplicación si la DB es crítica
    }
}

// Ejecutamos la prueba de conexión al iniciar
testConnection();


export default {
    query: (text, params) => pool.query(text, params),
};