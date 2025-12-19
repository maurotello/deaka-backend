
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar .env desde la raíz del backend
dotenv.config({ path: path.join(__dirname, '../.env') });

const API_URL = 'http://localhost:3001/api';

async function verifyTags() {
    try {
        // 1. Obtener un listing público (por slug) - necesitamos un slug valido.
        // Asumimos que hay al menos un listing. Si no, esto fallará.
        // Pero podemos chequear el endpoint de mapa que devuelve todos.
        console.log('🔍 Fetching map listings to find a slug...');
        // Usamos una query básica bbox grande para traer algo, o sin parametros si el backend lo permite (la funcion getMapListings requiere query params por defecto para bbox? No, pero search, etc son opcionales. Bbox es opcional).
        // Sin embargo getMapListings filtra por status published.

        // Mejor intentemos obtener listings recientes del mapa
        const mapRes = await axios.get(`${API_URL}/listings`); // getMapListings

        if (!mapRes.data || mapRes.data.length === 0) {
            console.log('⚠️ No listings found to verify.');
            return;
        }

        const listing = mapRes.data[0];
        console.log(`✅ Found listing: ${listing.title} (${listing.slug})`);

        // Verificar si 'tags' está en la respuesta del mapa
        if (listing.hasOwnProperty('tags')) {
            console.log('✅ "tags" field is present in getMapListings response.');
            console.log('Current tags:', listing.tags);
        } else {
            console.error('❌ "tags" field is MISSING in getMapListings response.');
        }

        // 2. Verificar getPublicListing
        if (listing.slug) {
            console.log(`🔍 Fetching public listing details for slug: ${listing.slug}...`);
            const detailRes = await axios.get(`${API_URL}/listings/${listing.slug}/public`);

            if (detailRes.data.hasOwnProperty('tags')) {
                console.log('✅ "tags" field is present in getPublicListing response.');
                console.log('Current tags:', detailRes.data.tags);
            } else {
                console.error('❌ "tags" field is MISSING in getPublicListing response.');
            }
        }

    } catch (error) {
        console.error('❌ Verification failed:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

verifyTags();
