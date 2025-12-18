// =========================================================
// VERIFICAR DATOS EN LA BASE DE DATOS
// =========================================================
import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
    ssl: {
        rejectUnauthorized: false,
    },
});

console.log('='.repeat(70));
console.log('🔍 VERIFICACIÓN DE DATOS EN SUPABASE');
console.log('='.repeat(70));
console.log('');

async function verificarDatos() {
    try {
        const client = await pool.connect();

        // 1. Verificar usuarios
        console.log('👤 USUARIOS:');
        const usuarios = await client.query('SELECT id, email, role FROM users ORDER BY id');
        console.log(`   Total: ${usuarios.rows.length}`);
        usuarios.rows.forEach(u => {
            console.log(`   - ${u.email} (${u.role})`);
        });
        console.log('');

        // 2. Verificar categorías principales
        console.log('📁 CATEGORÍAS PRINCIPALES:');
        const categoriasMain = await client.query(
            'SELECT id, name, slug FROM categories WHERE parent_id IS NULL ORDER BY id'
        );
        console.log(`   Total: ${categoriasMain.rows.length}`);
        categoriasMain.rows.forEach(c => {
            console.log(`   - ${c.name} (${c.slug})`);
        });
        console.log('');

        // 3. Verificar subcategorías
        console.log('📂 SUBCATEGORÍAS:');
        const subcategorias = await client.query(
            `SELECT c.id, c.name, c.slug, p.name as categoria_padre 
             FROM categories c 
             JOIN categories p ON c.parent_id = p.id 
             WHERE c.parent_id IS NOT NULL 
             ORDER BY p.name, c.name`
        );
        console.log(`   Total: ${subcategorias.rows.length}`);
        subcategorias.rows.forEach(c => {
            console.log(`   - ${c.name} (${c.categoria_padre})`);
        });
        console.log('');

        // 4. Verificar tipos de listado
        console.log('🏷️  TIPOS DE LISTADO:');
        const tipos = await client.query('SELECT id, name, slug FROM listing_types ORDER BY id');
        console.log(`   Total: ${tipos.rows.length}`);
        tipos.rows.forEach(t => {
            console.log(`   - ${t.name} (${t.slug})`);
        });
        console.log('');

        // 5. Verificar listings
        console.log('📍 LISTINGS:');
        const listings = await client.query(
            `SELECT l.id, l.title, l.city, c.name as categoria, l.status 
             FROM listings l 
             JOIN categories c ON l.category_id = c.id 
             ORDER BY l.id`
        );
        console.log(`   Total: ${listings.rows.length}`);

        if (listings.rows.length > 0) {
            console.log('');
            console.log('   Ejemplos:');
            listings.rows.slice(0, 5).forEach(l => {
                console.log(`   - ${l.title} (${l.categoria}) - ${l.status}`);
            });

            if (listings.rows.length > 5) {
                console.log(`   ... y ${listings.rows.length - 5} más`);
            }
        }
        console.log('');

        // 6. Verificar listings por ciudad
        console.log('🏙️  LISTINGS POR CIUDAD:');
        const porCiudad = await client.query(
            `SELECT city, COUNT(*) as cantidad 
             FROM listings 
             GROUP BY city 
             ORDER BY cantidad DESC`
        );
        porCiudad.rows.forEach(c => {
            console.log(`   - ${c.city}: ${c.cantidad} listings`);
        });
        console.log('');

        // 7. Verificar listings por categoría
        console.log('📊 LISTINGS POR CATEGORÍA:');
        const porCategoria = await client.query(
            `SELECT c.name, COUNT(l.id) as cantidad 
             FROM categories c 
             LEFT JOIN listings l ON c.id = l.category_id 
             GROUP BY c.name 
             HAVING COUNT(l.id) > 0
             ORDER BY cantidad DESC`
        );
        porCategoria.rows.forEach(c => {
            console.log(`   - ${c.name}: ${c.cantidad} listings`);
        });
        console.log('');

        // 8. Verificar ubicaciones geográficas
        console.log('🗺️  VERIFICACIÓN GEOESPACIAL:');
        const geoCheck = await client.query(
            `SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN location IS NOT NULL THEN 1 END) as con_ubicacion
             FROM listings`
        );
        const geo = geoCheck.rows[0];
        console.log(`   Listings con ubicación: ${geo.con_ubicacion}/${geo.total}`);
        console.log('');

        // Resumen final
        console.log('='.repeat(70));
        console.log('📋 RESUMEN:');
        console.log('='.repeat(70));
        console.log(`✅ Usuarios:           ${usuarios.rows.length}`);
        console.log(`✅ Categorías:         ${categoriasMain.rows.length + subcategorias.rows.length}`);
        console.log(`✅ Tipos de Listado:   ${tipos.rows.length}`);
        console.log(`✅ Listings:           ${listings.rows.length}`);
        console.log('');

        if (usuarios.rows.length > 0 &&
            categoriasMain.rows.length > 0 &&
            tipos.rows.length > 0 &&
            listings.rows.length > 0) {
            console.log('🎉 ¡Base de datos configurada correctamente!');
            console.log('');
            console.log('Próximos pasos:');
            console.log('  1. Inicia el backend: npm run dev:backend');
            console.log('  2. Inicia el frontend: npm run dev:frontend');
            console.log('  3. Prueba hacer login con: admin@deaka.com');
        } else {
            console.log('⚠️  Faltan datos. Verifica los scripts SQL.');
        }
        console.log('='.repeat(70));

        client.release();
        await pool.end();

    } catch (error) {
        console.error('❌ Error:', error.message);
        await pool.end();
        process.exit(1);
    }
}

verificarDatos();
