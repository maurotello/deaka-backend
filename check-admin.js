import dotenv from 'dotenv';
import pg from 'pg';
import bcrypt from 'bcryptjs';

dotenv.config();
const { Pool } = pg;

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT || 5432,
    ssl: {
        rejectUnauthorized: false
    }
});

async function checkAdmin() {
    try {
        console.log('🔍 Verificando usuario admin...\n');

        // Buscar el usuario admin
        const result = await pool.query(
            'SELECT id, email, password_hash, role FROM users WHERE email = $1',
            ['admin@deaka.com']
        );

        if (result.rows.length === 0) {
            console.log('❌ Usuario admin NO existe en la base de datos');
            console.log('\n📝 Necesitas ejecutar este SQL en Supabase:');
            const newHash = await bcrypt.hash('admin123', 10);
            console.log(`
INSERT INTO users (email, password_hash, role)
VALUES (
    'admin@deaka.com',
    '${newHash}',
    'admin'
);
            `);
        } else {
            const user = result.rows[0];
            console.log('✅ Usuario admin encontrado:');
            console.log(`   ID: ${user.id}`);
            console.log(`   Email: ${user.email}`);
            console.log(`   Role: ${user.role}`);
            console.log(`   Password Hash: ${user.password_hash.substring(0, 20)}...`);

            // Verificar si la contraseña coincide
            console.log('\n🔐 Verificando contraseña "admin123"...');
            const isValid = await bcrypt.compare('admin123', user.password_hash);

            if (isValid) {
                console.log('✅ La contraseña "admin123" es CORRECTA');
            } else {
                console.log('❌ La contraseña "admin123" NO coincide');
                console.log('\n📝 Generando nuevo hash para "admin123"...');
                const newHash = await bcrypt.hash('admin123', 10);
                console.log('\nEjecuta este SQL en Supabase para actualizar la contraseña:');
                console.log(`
UPDATE users 
SET password_hash = '${newHash}'
WHERE email = 'admin@deaka.com';
                `);
            }
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

checkAdmin();
