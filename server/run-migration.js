
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new pg.Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

async function runMigration() {
    try {
        console.log("Checking and adding missing columns...");

        // 1. cover_image_public_id
        await pool.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'listings' AND column_name = 'cover_image_public_id') THEN
                    ALTER TABLE listings ADD COLUMN cover_image_public_id VARCHAR(255);
                    RAISE NOTICE 'Added cover_image_public_id column';
                ELSE
                    RAISE NOTICE 'cover_image_public_id column already exists';
                END IF;
            END $$;
        `);

        // 2. tags
        await pool.query(`
             DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'listings' AND column_name = 'tags') THEN
                    ALTER TABLE listings ADD COLUMN tags JSONB DEFAULT '[]'::jsonb;
                     RAISE NOTICE 'Added tags column';
                ELSE
                    RAISE NOTICE 'tags column already exists';
                END IF;
            END $$;
        `);

        // 3. gallery_images
        await pool.query(`
             DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'listings' AND column_name = 'gallery_images') THEN
                    ALTER TABLE listings ADD COLUMN gallery_images JSONB DEFAULT '[]'::jsonb;
                    RAISE NOTICE 'Added gallery_images column';
                ELSE
                    RAISE NOTICE 'gallery_images column already exists';
                END IF;
            END $$;
        `);

        console.log("Migration completed successfully.");

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await pool.end();
    }
}

runMigration();
