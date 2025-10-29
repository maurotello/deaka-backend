import pg from 'pg';
import dns from 'dns';

// Forzar IPv4
dns.setDefaultResultOrder('ipv4first');

const { Pool } = pg;

console.log('🔍 Probando conexión...');

const pool = new Pool({
    user: 'postgres.olqrqsshjllxawphctmi', 
    host: 'aws-1-us-east-1.pooler.supabase.com', 
    database: 'postgres',
    password: 'qo2nS3jmgVcgkuSr', 
    // ⚠️ Puerto del Transaction Pooler
    port: 6543, 
    ssl: {
        rejectUnauthorized: false
    },
    connectionTimeoutMillis: 10000,
});


async function test() {
    try {
        console.log('Conectando...');
        const client = await pool.connect();
        const result = await client.query('SELECT NOW() as now, version() as version');
        console.log('✅ ¡CONEXIÓN EXITOSA!');
        console.log('📅 Hora del servidor:', result.rows[0].now);
        console.log('🗄️  Versión:', result.rows[0].version.split('\n')[0]);
        client.release();
        await pool.end();
        process.exit(0);
    } catch (err) {
        console.error('❌ Error de conexión:', err.message);
        console.error('Código:', err.code);
        process.exit(1);
    }
}

test();