import dotenv from 'dotenv';
import pg from 'pg';

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

async function verifyData() {
    try {
        console.log('🔍 VERIFICANDO DATOS EN SUPABASE\n');
        console.log('='.repeat(80));

        // 1. Verificar Tipos de Listado
        console.log('\n📋 TIPOS DE LISTADO (listing_types):');
        console.log('-'.repeat(80));
        const typesResult = await pool.query(
            'SELECT id, name, slug FROM listing_types ORDER BY id'
        );

        if (typesResult.rows.length === 0) {
            console.log('❌ NO HAY TIPOS DE LISTADO EN LA BASE DE DATOS');
        } else {
            console.table(typesResult.rows);
            console.log(`✅ Total: ${typesResult.rows.length} tipos de listado`);
        }

        // 2. Verificar Categorías Principales
        console.log('\n📂 CATEGORÍAS PRINCIPALES (parent_id IS NULL):');
        console.log('-'.repeat(80));
        const mainCatsResult = await pool.query(
            'SELECT id, name, slug, marker_icon_slug FROM categories WHERE parent_id IS NULL ORDER BY name'
        );

        if (mainCatsResult.rows.length === 0) {
            console.log('❌ NO HAY CATEGORÍAS PRINCIPALES EN LA BASE DE DATOS');
        } else {
            console.table(mainCatsResult.rows);
            console.log(`✅ Total: ${mainCatsResult.rows.length} categorías principales`);
        }

        // 3. Verificar Subcategorías
        console.log('\n📁 SUBCATEGORÍAS (parent_id IS NOT NULL):');
        console.log('-'.repeat(80));
        const subCatsResult = await pool.query(`
            SELECT 
                c.id, 
                c.name, 
                c.slug, 
                c.marker_icon_slug,
                c.parent_id,
                p.name as parent_name
            FROM categories c
            LEFT JOIN categories p ON c.parent_id = p.id
            WHERE c.parent_id IS NOT NULL
            ORDER BY p.name, c.name
        `);

        if (subCatsResult.rows.length === 0) {
            console.log('⚠️  NO HAY SUBCATEGORÍAS EN LA BASE DE DATOS');
        } else {
            console.table(subCatsResult.rows);
            console.log(`✅ Total: ${subCatsResult.rows.length} subcategorías`);
        }

        // 4. Verificar Total de Categorías
        console.log('\n📊 RESUMEN:');
        console.log('-'.repeat(80));
        const totalCatsResult = await pool.query('SELECT COUNT(*) as total FROM categories');
        console.log(`Total de categorías (principales + subcategorías): ${totalCatsResult.rows[0].total}`);

        // 5. Verificar endpoint del backend
        console.log('\n🌐 VERIFICANDO ENDPOINTS DEL BACKEND:');
        console.log('-'.repeat(80));
        console.log('El frontend llama a estos endpoints:');
        console.log('  - GET /api/listing-types');
        console.log('  - GET /api/categories (categorías principales)');
        console.log('  - GET /api/categories/:id/subcategories');
        console.log('\nVerifica que el backend esté devolviendo estos datos correctamente.');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await pool.end();
    }
}

verifyData();
