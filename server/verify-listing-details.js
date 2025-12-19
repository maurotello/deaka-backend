
import pg from 'pg';
import 'dotenv/config';

const pool = new pg.Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: { rejectUnauthorized: false }
});

async function checkListing() {
    try {
        const res = await pool.query("SELECT slug, details FROM listings WHERE title ILIKE '%Bari%'");
        console.log('Listing found:', res.rows.length);
        if (res.rows.length > 0) {
            console.log('Slug:', res.rows[0].slug);
            console.log('Details:', JSON.stringify(res.rows[0].details, null, 2));
        }
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkListing();
