import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    user: 'postgres.fzcgajwhpoqqdcqxcjfm',
    host: 'aws-1-us-east-1.pooler.supabase.com',
    database: 'postgres',
    password: 'desaTELLO123$%&',
    // ⚠️ Puerto del Transaction Pooler
    port: 6543,
    ssl: {
        rejectUnauthorized: false
    },
    connectionTimeoutMillis: 10000,
});


async function test() {
    try {
        console.log('🔍 Probando conexión...');
        const client = await pool.connect();
        const result = await client.query('SELECT NOW()');
        console.log('✅ ¡CONEXIÓN EXITOSA!');
        console.log('Hora del servidor:', result.rows[0].now);
        client.release();
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

test();