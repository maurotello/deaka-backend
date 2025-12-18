// Script para verificar qué devuelven los endpoints del backend

const API_BASE_URL = 'http://localhost:3001';

async function verifyBackendEndpoints() {
    console.log('🌐 VERIFICANDO ENDPOINTS DEL BACKEND\n');
    console.log('='.repeat(80));

    try {
        // 1. Verificar /api/listing-types
        console.log('\n📋 GET /api/listing-types:');
        console.log('-'.repeat(80));
        const typesResponse = await fetch(`${API_BASE_URL}/api/listing-types`);
        const typesData = await response.json();

        if (!typesResponse.ok) {
            console.log(`❌ Error ${typesResponse.status}: ${typesResponse.statusText}`);
        } else {
            console.log('✅ Respuesta exitosa');
            console.table(typesData);
            console.log(`Total: ${typesData.length} tipos`);
        }

        // 2. Verificar /api/categories (principales)
        console.log('\n📂 GET /api/categories:');
        console.log('-'.repeat(80));
        const catsResponse = await fetch(`${API_BASE_URL}/api/categories`);
        const catsData = await catsResponse.json();

        if (!catsResponse.ok) {
            console.log(`❌ Error ${catsResponse.status}: ${catsResponse.statusText}`);
        } else {
            console.log('✅ Respuesta exitosa');
            console.table(catsData);
            console.log(`Total: ${catsData.length} categorías principales`);
        }

        // 3. Verificar subcategorías de Gastronomía (ID=1)
        console.log('\n📁 GET /api/categories/1/subcategories (Gastronomía):');
        console.log('-'.repeat(80));
        const subCatsResponse = await fetch(`${API_BASE_URL}/api/categories/1/subcategories`);
        const subCatsData = await subCatsResponse.json();

        if (!subCatsResponse.ok) {
            console.log(`❌ Error ${subCatsResponse.status}: ${subCatsResponse.statusText}`);
        } else {
            console.log('✅ Respuesta exitosa');
            console.table(subCatsData);
            console.log(`Total: ${subCatsData.length} subcategorías`);
        }

        console.log('\n' + '='.repeat(80));
        console.log('✅ Verificación completada');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

verifyBackendEndpoints();
