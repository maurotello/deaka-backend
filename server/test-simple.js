import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    user: 'postgres',
    host: 'db.olqrqsshjllxawphctmi.supabase.co',
    database: 'postgres',
    password: 'qo2nS3jmgVcgkuSr',
    port: 5432,
    ssl: {
        rejectUnauthorized: false
    }
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