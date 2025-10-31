import db from '../db.js';
import fs from 'fs-extra'; // Para manejo de archivos (copy, remove)
import path from 'path';    // Para manejo de rutas de archivos
import { v4 as uuidv4 } from 'uuid'; // Solo si lo necesitas para la lógica interna

// =======================================================
// --- LÓGICA DE DATOS Y GEOESPACIAL ---
// =======================================================

// OBTENER CATEGORÍAS PRINCIPALES (MODIFICADA)
// Esta función ahora responderá a /api/categories
export const getCategories = async (req, res) => {
    try {
        // 🚨 CAMBIO CRÍTICO: Consulta SQL para OBTENER SOLO CATEGORÍAS PADRE
        const query="SELECT id, name, marker_icon_slug, parent_id FROM categories WHERE parent_id IS NULL ORDER BY name";
        const { rows } = await db.query(query);
        res.status(200).json(rows);
    } catch (error) {
        // Renombrado el mensaje para reflejar el propósito
        console.error('Error al obtener las categorías principales:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// OBTENER SUBCATEGORÍAS POR ID DE PADRE (Ajustada para usar req.params.parentId)
// Esta función responderá a /api/categories/:parentId/subcategories
export const getSubcategories = async (req, res) => { // Renombramos a getSubcategories si quieres mantener la ruta.
    const parentId = req.params.parentId; // Debería llamarse 'parentId' según tu ruta del frontend

    // 🚨 SEGURIDAD: Validación básica
    if (!parentId || isNaN(parseInt(parentId))) {
        return res.status(400).json({ error: 'ID de categoría padre inválido.' });
    }
    try {
        const query = `
            SELECT id, name, marker_icon_slug, parent_id
            FROM categories
            WHERE parent_id = $1
            ORDER BY name
        `;
        const { rows } = await db.query(query, [parentId]);
        res.status(200).json(rows);
    } catch (error) {
        console.error(`Error al obtener subcategorías para ID ${parentId}:`, error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};


// OBTENER listings públicos para el mapa (Filtros PostGIS, Búsqueda y Cálculo de Ícono Proporcional)
export const getMapListings = async (req, res) => {
        const FIXED_ICON_HEIGHT = 38;
        try {
                const { search, bbox, categoryIds, listingTypeIds } = req.query;
                let queryParams = [];
                let whereClauses = ["l.status = 'published'"];
                queryParams.push(FIXED_ICON_HEIGHT);
                if (search && search.length > 2) {
                        queryParams.push(`%${search}%`);
                        whereClauses.push(`l.title ILIKE $${queryParams.length}`);
                }
                if (categoryIds) {
                        const ids = categoryIds.split(',').map(id => id.trim()).filter(id => id);
                        if (ids.length > 0) {
                                queryParams.push(ids);
                                whereClauses.push(`l.category_id = ANY($${queryParams.length})`);
                        }
                }
                if (listingTypeIds) {
                        const ids = listingTypeIds.split(',').map(id => id.trim()).filter(id => id);
                        if (ids.length > 0) {
                                queryParams.push(ids);
                                whereClauses.push(`l.listing_type_id = ANY($${queryParams.length})`);
                        }
                }
                if (bbox) {
                        const [minLng, minLat, maxLng, maxLat] = bbox.split(',').map(parseFloat);

                        // 🚨 CORRECCIÓN CRÍTICA: Guardar el índice ANTES de empujar los nuevos parámetros
                        const bbox_start_index = queryParams.length + 1; // El índice del primer nuevo parámetro ($N)
                        // Empujamos los 4 valores de BBOX al final de los parámetros
                        queryParams.push(minLng, minLat, maxLng, maxLat);

                        // Los parámetros serán $N, $N+1, $N+2, $N+3
                        whereClauses.push(`l.location && ST_MakeEnvelope($${bbox_start_index}, $${bbox_start_index + 1}, $${bbox_start_index + 2}, $${bbox_start_index + 3}, 4326)`);
                }
                const query = `
                SELECT
                        l.id,
                        l.title,
                        ST_Y(l.location::geometry) AS latitude,
                        ST_X(l.location::geometry) AS longitude,
                        COALESCE(c.marker_icon_slug, 'default-pin') AS marker_icon_slug,
                        ROUND((COALESCE(c.icon_original_width, 38)::numeric / COALESCE(c.icon_original_height, 38)::numeric) * $1) AS icon_calculated_width,
                        $1 AS icon_calculated_height
                FROM listings AS l
                LEFT JOIN categories AS c ON l.category_id = c.id
                WHERE ${whereClauses.join(' AND ')};`;
                const { rows } = await db.query(query, queryParams);
                res.status(200).json(rows);
        } catch (error) {
        console.error('Error al obtener los listings:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};


// OBTENER los listados del usuario logueado (PROTEGIDA)
export const getMyListings = async (req, res) => {
    const { id: userId } = req.user;
    try {
        const query = `
            SELECT l.id, l.title, l.address, l.details->>'city' AS city, c.name AS category_name, l.status
            FROM listings AS l
            JOIN categories AS c ON l.category_id = c.id
            WHERE l.user_id = $1
            ORDER BY l.created_at DESC;
        `;
        const { rows } = await db.query(query, [userId]);
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error al obtener mis listados:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};


// OBTENER los datos de un listado específico para editarlo (PROTEGIDA - solo dueño)
export const getListingForEdit = async (req, res) => {
    const { id } = req.params;
    const { id: userId } = req.user;
    // 🚨 Asegúrate de importar path y fs/promises si están definidos en otro lugar
    // import fs from 'fs/promises';
    // import path from 'path';
    try {
        // 🚨 CAMBIO CRÍTICO: Unimos con categories para obtener el marker_icon_slug de la categoría.
        const query = `
            SELECT l.title, l.category_id, l.details, l.address, l.cover_image_path,
                   ST_X(l.location::geometry) AS lng, ST_Y(l.location::geometry) AS lat,
                   c.marker_icon_slug,
                   c.icon_original_width,
                   c.icon_original_height
            FROM listings AS l
            JOIN categories AS c ON l.category_id = c.id
            WHERE l.id = $1 AND l.user_id = $2;
        `;
        const { rows } = await db.query(query, [id, userId]);

        if (rows.length === 0) return res.status(404).json({ error: 'Listado no encontrado o no autorizado.' });
        const listingData = rows[0];
        let galleryImages = [];
        // --- Manejo de archivos de galería ---
        try {
            // Asegúrate que el path.join y fs.readdir usen las ubicaciones correctas.
            // Necesitas path y fs/promises importados en este archivo.
            galleryImages = await fs.readdir(path.join('uploads', id, 'galleryImages'));
        } catch (fsError) {
            console.log(`No se encontró directorio de galería para el listado ${id}, se asume vacío.`);
        }
        res.json({ ...listingData, gallery_images: galleryImages });
    } catch (error) {
        console.error('Error al obtener el listado:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};



// =======================================================
// --- LÓGICA DE CREACIÓN Y ACTUALIZACIÓN (MULTER + DB) ---
// =======================================================

// CREAR un nuevo listado (Con Multer y PostGIS)
export const createListing = async (req, res) => {
    const { id: userId } = req.user;
    // 🚨 LOG PARA DEPURACIÓN: Imprimir todo lo que se recibe
    console.log('--- RECIBIENDO DATOS EN EL BACKEND ---');
    console.log('req.body:', req.body);
    console.log('req.files:', req.files);
    console.log('------------------------------------');
    // Extraer campos
    const {
        title,
        listing_type_id, // 🚨 CRÍTICO: Debe coincidir con el body
        category_id,     // 🚨 Recomendación: Cambiar a guiones bajos para consistencia
        lat, lng, address,
        details,
        provinciaId, localidadId,
        province, city
        } = req.body;

    const tempId = req.tempId;

    // 🚨 CORRECCIÓN 2: Asegurar que los campos cruciales estén presentes (incluyendo province y city)
    if (!title || !category_id || !lat || !lng || !address || !provinciaId || !localidadId || !province || !city) {
        if (tempId) await fs.remove(path.join('uploads', tempId));
        return res.status(400).json({ error: 'Faltan campos obligatorios para el listado o la ubicación.' });
    }

    try {
        let coverImagePath;

        if (req.files && req.files.coverImage && req.files.coverImage.length > 0) {
            // Si el usuario subió una imagen, usamos su nombre de archivo
            coverImagePath = req.files.coverImage[0].filename;
        } else {
            // Si NO subió ninguna, usamos la imagen por defecto
            coverImagePath = 'default-cover.jpg';
        }
        // 🚨 CORRECCIÓN DE ROBUSTEZ: Manejo de JSON del campo 'details'
        let parsedDetails = {};
        if (typeof details === 'string' && details.trim() !== '') {
            try {
                parsedDetails = JSON.parse(details);
            } catch (e) {
                console.error("Error al parsear details JSON:", e);
                // Si falla el parseo, el listado no debería crearse
                if (tempId) await fs.remove(path.join('uploads', tempId));
                return res.status(400).json({ error: 'El campo de detalles es un JSON inválido.' });
            }
        } else if (typeof details === 'object' && details !== null) {
            // Si Express ya lo parseó (es el caso más común con axios JSON), úsalo directamente.
            parsedDetails = details;
        }

        // Agregamos los IDs y nombres al campo 'details' para facilitar la edición
        const finalDetails = {
            ...parsedDetails,
            provincia_id: provinciaId,
            localidad_id: localidadId,
            province_name: province, // Usamos 'province' del body
            city_name: city, // Usamos 'city' del body
        };
        // 🚨 Inserción con PostGIS (GEOGRAPHY type)
        const query = `
            INSERT INTO listings
                (user_id, title, category_id, listing_type_id, location, address, details, cover_image_path, status, city, province)
            VALUES
                ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography, $7, $8, $9, 'pending', $10, $11)
            RETURNING id;
        `;

        // 🚨 CORRECCIÓN 3: Actualizamos los valores para usar 'city' y 'province'
        const values = [
            userId,
            title,
            category_id,
            listing_type_id,
            lng, // Longitud (ST_MakePoint espera Longitud primero)
            lat, // Latitud
            address,
            finalDetails, // El objeto JSON se guarda en PostgreSQL
            coverImagePath,
            city,     // <-- Usamos la variable 'city'
            province // <-- Usamos la variable 'province'
        ];

        const result = await db.query(query, values);
        const newListingId = result.rows[0].id;
        // 🚨 Lógica de Archivos: Mover archivos temporales a la carpeta permanente (newListingId)
        if (tempId) {
            const tempPath = path.join('uploads', tempId);
            const finalPath = path.join('uploads', newListingId.toString()); // Convertir a string para path
            if (await fs.pathExists(tempPath)) {
                await fs.copy(tempPath, finalPath);
                await fs.remove(tempPath);
            }
        }

        res.status(201).json({ message: 'Listado creado con éxito', id: newListingId });
    } catch (error) {
        // 🚨 Lógica de Archivos: Limpiar archivos temporales en caso de fallo de DB
        if (tempId) await fs.remove(path.join('uploads', tempId));
        console.error('Error al crear el listado:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};


// ACTUALIZAR un listado existente (Con Multer y PostGIS)
export const updateListing = async (req, res) => {
    const { id: listingId } = req.params;
    const { id: userId } = req.user;
    try {
        // 1. Verificar propiedad y obtener cover_image_path
        const listingResult = await db.query('SELECT cover_image_path FROM listings WHERE id = $1 AND user_id = $2', [listingId, userId]);
        if (listingResult.rows.length === 0) return res.status(403).json({ error: 'No autorizado o Listado no encontrado.' });

        const { cover_image_path: oldCoverFilename } = listingResult.rows[0];

        // 🚨 Obtención de datos del body, incluyendo los campos de texto
        const {
            title, categoryId, details, lat, lng, address,
            city, province, galleryImagesToDelete, deleteCoverImage,
            provinciaId, localidadId // <-- Necesitamos los IDs para mantener la estructura en details
        } = req.body;

        // 2. Lógica de Archivos: Eliminación de archivos viejos (galería y portada)
        if (galleryImagesToDelete) {
            // 🚨 MEJORA DE ROBUSTEZ: Manejo de parseo de JSON
            let filesToDelete = [];
            try {
                filesToDelete = JSON.parse(galleryImagesToDelete);
            } catch (e) {
                console.warn('galleryImagesToDelete no es JSON válido o es vacío.');
            }

            for (const filename of filesToDelete) {
                // Usamos fs.remove que maneja si el archivo no existe
                await fs.remove(path.join('uploads', listingId.toString(), 'galleryImages', filename));
            }
        }

        let finalCoverFilename = oldCoverFilename;
        if (deleteCoverImage === 'true' && oldCoverFilename) {
            await fs.remove(path.join('uploads', listingId, 'coverImage', oldCoverFilename));
            finalCoverFilename = null;
        }

        if (req.files && req.files.coverImage) {
            if (oldCoverFilename) {
                await fs.remove(path.join('uploads', listingId, 'coverImage', oldCoverFilename));
            }
            finalCoverFilename = req.files.coverImage[0].filename;
        }

        // 3. Preparar datos para UPDATE (Geoespacial y Details)
        let parsedDetails = {};
        if (typeof details === 'string' && details.trim() !== '') {
            try {
                parsedDetails = JSON.parse(details);
            } catch (e) {
                return res.status(400).json({ error: 'El campo de detalles es un JSON inválido.' });
            }
        } else if (typeof details === 'object' && details !== null) {
            parsedDetails = details;
        }

        // Añadimos los IDs y nombres al campo 'details' para la edición
        const finalDetails = {
            ...parsedDetails,
            provincia_id: provinciaId,
            localidad_id: localidadId,
            province_name: province,
            city_name: city,
        };

        // 4. Actualización con PostGIS y nuevos campos
        await db.query(`
            UPDATE listings SET
                title = $1, category_id = $2, details = $3,
                location = ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography,
                address = $6, cover_image_path = $7, updated_at = NOW(),
                city = $8, province = $9 -- 🚨 Incluir city y province en las columnas dedicadas
            WHERE id = $10 AND user_id = $11
        `, [
            title,
            categoryId,
            finalDetails,
            lng,
            lat,
            address,
            finalCoverFilename,
            city,             // $8
            province,         // $9
            listingId,        // $10
            userId            // $11
        ]);

        res.status(200).json({ message: 'Listado actualizado con éxito.' });

    } catch (error) {
        console.error(`Error al actualizar el listado ${listingId}:`, error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

// ---------------------------------------------
// Función 9: MODERACIÓN (Actualizar Estado - Admin Only)
// ---------------------------------------------
export const updateListingStatus = async (req, res) => {
    const { id: listingId } = req.params;
    const { status } = req.body;

    if (!['published', 'rejected', 'pending'].includes(status)) {
        return res.status(400).json({ error: 'Estado inválido proporcionado.' });
    }

    try {
        const query = `
            UPDATE listings SET status = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2
            RETURNING id, status;
        `;
        const result = await db.query(query, [status, listingId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Listado no encontrado.' });
        }

        res.status(200).json({ message: `Estado del listado ${listingId} actualizado a ${status}` });

    } catch (error) {
        console.error('Error al actualizar el estado:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

// ---------------------------------------------
// Función 10: ELIMINAR listado (PROTEGIDA)
// ---------------------------------------------
export const deleteListing = async (req, res) => {
    const { id: listingId } = req.params;
    const { id: userId } = req.user;

    try {
        // 1. Verificar propiedad
        const checkQuery = await db.query(
            'SELECT id FROM listings WHERE id = $1 AND user_id = $2',
            [listingId, userId]
        );

        if (checkQuery.rowCount === 0) {
            return res.status(403).json({ error: 'Acceso prohibido. No eres el dueño de este listado.' });
        }

        // 2. Eliminar de la Base de Datos
        const deleteQuery = await db.query('DELETE FROM listings WHERE id = $1', [listingId]);

        if (deleteQuery.rowCount === 0) {
             return res.status(404).json({ error: 'Listado no encontrado para eliminar.' });
        }

        // 3. Eliminar archivos del disco (fs-extra)
        const folderPath = path.join('uploads', listingId.toString());
        if (await fs.pathExists(folderPath)) {
             await fs.remove(folderPath);
        }

        res.status(200).json({ message: 'Listado y archivos asociados eliminados con éxito.' });

    } catch (error) {
        console.error(`Error al eliminar el listado ${listingId}:`, error);
        res.status(500).json({ error: 'Error interno del servidor al eliminar el listado.' });
    }
};

// ... Puedes añadir otras funciones como getListingDetailsPublic, etc.
