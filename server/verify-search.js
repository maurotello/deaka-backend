
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const API_URL = 'http://localhost:3001/api';

async function verifySearch() {
    try {
        console.log('🔍 Testing Title Search...');
        const titleRes = await axios.get(`${API_URL}/listings?search=parrilla`);
        if (titleRes.data.length > 0) {
            console.log(`✅ Title search found ${titleRes.data.length} results.`);
        } else {
            console.warn('⚠️ Title search found 0 results (expected some).');
        }

        console.log('🔍 Testing Category Search...');
        const catRes = await axios.get(`${API_URL}/listings?search=gastronomia`); // "Gastronomía" or similar
        if (catRes.data.length > 0) {
            console.log(`✅ Category search found ${catRes.data.length} results.`);
        } else {
            console.warn('⚠️ Category search found 0 results.');
        }

        console.log('🔍 Testing Tag Search...');
        // First, check if we have any listings with tags
        const mapRes = await axios.get(`${API_URL}/listings`);
        const taggedListing = mapRes.data.find(l => l.tags && l.tags.length > 0);

        if (taggedListing) {
            const tag = taggedListing.tags[0];
            console.log(`Trying to search for tag: "${tag}"...`);
            const tagRes = await axios.get(`${API_URL}/listings?search=${encodeURIComponent(tag)}`);
            if (tagRes.data.length > 0) {
                console.log(`✅ Tag search found ${tagRes.data.length} results.`);
            } else {
                console.error('❌ Tag search found 0 results (FAILED).');
            }
        } else {
            console.warn('⚠️ No listings with tags found in db to test tag search.');
        }

    } catch (error) {
        console.error('❌ Verification failed:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

verifySearch();
