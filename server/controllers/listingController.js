import db from '../db.js';
import cloudinary from '../config/cloudinary.js';
import { Readable } from 'stream';
import { listingSchemas } from '../data/listingSchemas.js';

// =======================================================
// 🔥 HELPER: Subir buffer a Cloudinary
// =======================================================
const uploadToCloudinary = (buffer, folder) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: folder,
                resource_type: 'image',
                transformation: [
                    { width: 1200, height: 800, crop: 'limit' },
                    { quality: 'auto' }
                ]
            },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );
        Readable.from(buffer).pipe(uploadStream);
    });
};

const isValidEmail = (email) => {
    // Regex estricta pero simple para el MVP
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(String(email).toLowerCase());
};

const validateDetails = (typeId, details) => {
    // Convierte typeId a string para que coincida con las claves de listingSchemas
    const typeIdString = String(typeId);
    const schema = listingSchemas[typeIdString];

    if (!schema || schema.length === 0) {
        return { isValid: true, errors: [] };
    }

    const errors = [];

    // Iterar sobre los campos requeridos en el esquema (que están en el objeto 'details')
    for (const field of schema) {
        if (field.required) {
            const value = details[field.name];

            // Si el valor es undefined, null, o una cadena vacía/array vacío
            const isMissing = value === undefined || value === null || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0);

            if (isMissing) {
                errors.push(`El campo requerido "${field.label}" (${field.name}) está ausente.`);
            }
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
};
// =======================================================
// --- LÓGICA DE CATEGORÍAS Y GEOESPACIAL ---
// =======================================================

export const getCategories = async (req, res) => {
    try {
        const query = "SELECT id, name, marker_icon_slug, parent_id FROM categories WHERE parent_id IS NULL ORDER BY name";
        const { rows } = await db.query(query);
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error al obtener las categorías principales:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

export const getSubcategories = async (req, res) => {
    const parentId = req.params.parentId;
    if (!parentId || isNaN(parseInt(parentId))) {
        return res.status(400).json({ error: 'ID de categoría padre inválido.' });
    }
    try {
        const query = `SELECT id, name, marker_icon_slug, parent_id
            FROM categories
            WHERE parent_id = $1
            ORDER BY name`;
        const { rows } = await db.query(query, [parentId]);
        res.status(200).json(rows);
    } catch (error) {
        console.error(`Error al obtener subcategorías para ID ${parentId}:`, error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

export const getMapListings = async (req, res) => {
    const FIXED_ICON_HEIGHT = 38;
    try {
        const { search, bbox, categoryIds, listingTypeIds } = req.query;
        let queryParams = [];
        let whereClauses = ["l.status = 'published'"];

        // $1 es FIXED_ICON_HEIGHT
        queryParams.push(FIXED_ICON_HEIGHT);

        // 1. Manejo de Búsqueda
        if (search && search.length > 2) {
            queryParams.push(`%${search.trim()}%`);
            whereClauses.push(`l.title ILIKE $${queryParams.length}`);
        }

        // 2. Manejo de Filtro por Categorías
        if (categoryIds) {
            const ids = String(categoryIds).split(',').map(id => id.trim()).filter(id => id);
            if (ids.length > 0) {
                queryParams.push(ids);
                whereClauses.push(`l.category_id = ANY($${queryParams.length})`);
            }
        }

        // 3. Manejo de Filtro por Tipo de Listado
        if (listingTypeIds) {
            const ids = String(listingTypeIds).split(',').map(id => id.trim()).filter(id => id);
            if (ids.length > 0) {
                queryParams.push(ids);
                whereClauses.push(`l.listing_type_id = ANY($${queryParams.length})`);
            }
        }

        // 4. Manejo de Bounding Box (BBOX)
        if (bbox) {
            const parts = bbox.split(',').map(parseFloat).filter(p => !isNaN(p));
            if (parts.length === 4) {
                const [minLng, minLat, maxLng, maxLat] = parts;
                const bbox_start_index = queryParams.length + 1;
                queryParams.push(minLng, minLat, maxLng, maxLat);
                whereClauses.push(`l.location && ST_MakeEnvelope($${bbox_start_index}, $${bbox_start_index + 1}, $${bbox_start_index + 2}, $${bbox_start_index + 3}, 4326)`);
            } else {
                console.warn('⚠️ Bbox proporcionado en formato incorrecto:', bbox);
            }
        }

        const query = `
            SELECT
                l.id,
                l.title,
                l.slug,
                ST_Y(l.location::geometry) AS latitude,
                ST_X(l.location::geometry) AS longitude,
                COALESCE(c.marker_icon_slug, 'default-pin') AS marker_icon_slug,
                ROUND((COALESCE(c.icon_original_width, 38)::numeric / COALESCE(c.icon_original_height, 38)::numeric) * $1) AS icon_calculated_width,
                $1 AS icon_calculated_height,
                l.cover_image_path,
                lt.name AS listing_type_name,
                CASE 
                    WHEN c.parent_id IS NOT NULL THEN parent_cat.name
                    ELSE c.name
                END AS category_name,
                CASE 
                    WHEN c.parent_id IS NOT NULL THEN c.name
                    ELSE NULL
                END AS subcategory_name,
                l.address,
                l.phone,
                l.email,
                l.whatsapp,
                l.website
            FROM listings AS l
            LEFT JOIN categories AS c ON l.category_id = c.id
            LEFT JOIN categories AS parent_cat ON c.parent_id = parent_cat.id
            LEFT JOIN listing_types AS lt ON l.listing_type_id = lt.id
            WHERE ${whereClauses.join(' AND ')};`;

        const { rows } = await db.query(query, queryParams);
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error al obtener los listings:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// ========================================
// OBTENER LISTING PÚBLICO POR ID
// ========================================
export const getPublicListing = async (req, res) => {
    try {
        const { slug } = req.params;

        const query = `
            SELECT
                l.id,
                l.title,
                l.slug,
                l.description,
                ST_Y(l.location::geometry) AS latitude,
                ST_X(l.location::geometry) AS longitude,
                COALESCE(c.marker_icon_slug, 'default-pin') AS marker_icon_slug,
                COALESCE(c.icon_original_width, 38) AS icon_calculated_width,
                COALESCE(c.icon_original_height, 38) AS icon_calculated_height,
                l.cover_image_path,
                l.details,
                lt.name AS listing_type_name,
                CASE 
                    WHEN c.parent_id IS NOT NULL THEN parent_cat.name
                    ELSE c.name
                END AS category_name,
                CASE 
                    WHEN c.parent_id IS NOT NULL THEN c.name
                    ELSE NULL
                END AS subcategory_name,
                l.address,
                l.phone,
                l.email,
                l.whatsapp,
                l.website
            FROM listings AS l
            LEFT JOIN categories AS c ON l.category_id = c.id
            LEFT JOIN categories AS parent_cat ON c.parent_id = parent_cat.id
            LEFT JOIN listing_types AS lt ON l.listing_type_id = lt.id
            WHERE l.slug = $1;
        `;

        const { rows } = await db.query(query, [slug]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Listing no encontrado' });
        }

        res.status(200).json(rows[0]);
    } catch (error) {
        console.error('Error al obtener el listing público:', error);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

// =======================================================
// 🔥 ENDPOINT PARA OBTENER ESQUEMA DINÁMICO
// =======================================================

export const getListingSchema = (req, res) => {
    const { id } = req.params;
    const typeIdString = String(id);
    const schema = listingSchemas[typeIdString] || [];
    if (schema.length > 0) {
        return res.json(schema);
    } else {
        return res.json([]);
    }
};


// =======================================================
// 🔥 VISTAS DE USUARIO (MY LISTINGS)
// =======================================================

export const getMyListings = async (req, res) => {
    if (!req.user || !req.user.id) {
        console.error('❌ ERROR: req.user o req.user.id no está disponible.');
        return res.status(403).json({ error: 'Usuario no autenticado o sesión no válida.' });
    }
    const { id: userId } = req.user;

    try {
        // CORREGIDO: Incluye province y el nombre del tipo de listado
        const query = `
            SELECT
                l.id,
                l.title,
                l.address,
                l.city,
                l.province,
                c.name AS category_name,
                lt.name AS listing_type_name,
                l.status
            FROM listings AS l
            JOIN categories AS c ON l.category_id = c.id
            LEFT JOIN listing_types AS lt ON l.listing_type_id = lt.id
            WHERE l.user_id = $1
            ORDER BY l.created_at DESC;`;

        const { rows } = await db.query(query, [userId]);

        res.status(200).json(rows);

    } catch (error) {
        console.error('Error al obtener mis listados:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

// =======================================================
// 🔥 OBTENER LISTADO PARA EDICIÓN (REFECTORIZADO)
// =======================================================

export const getListingForEdit = async (req, res) => {
    const { id } = req.params;
    const { id: userId } = req.user;

    try {
        const query = `
            SELECT
                l.id,                   -- Agregué ID
                l.title,
                l.category_id,
                l.listing_type_id,
                l.description,
                l.address,
                l.city,
                l.province,
                l.email,
                l.whatsapp,
                l.phone,
                l.website,
                l.cover_image_path,
                l.details,
                ST_X(l.location::geometry) AS lng,
                ST_Y(l.location::geometry) AS lat,
                c.marker_icon_slug,
                c.icon_original_width,
                c.icon_original_height
            FROM listings AS l
            JOIN categories AS c ON l.category_id = c.id
            WHERE l.id = $1 AND l.user_id = $2;
        `;
        const { rows } = await db.query(query, [id, userId]);

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Listado no encontrado o no autorizado.' });
        }

        const listingData = rows[0];
        const { details, ...fixedData } = listingData;

        // Extracción de metadatos del JSONB
        const coverImagePublicId = details?.cover_image_public_id || null;
        const galleryUrls = details?.gallery_urls || [];

        const provinciaId = details?.provincia_id || null;
        const localidadId = details?.localidad_id || null;
        const openingHours = details?.opening_hours || '';
        const amenities = details?.amenities || [];
        const dynamicFields = details?.dynamic_fields || {};

        // 3. Respuesta final: Consolidamos todos los metadatos y dinámicos para el frontend
        const combinedDetailsForFrontend = {
            provincia_id: provinciaId,
            localidad_id: localidadId,
            opening_hours: openingHours,
            amenities: amenities,
            ...dynamicFields
        };

        res.json({
            ...fixedData,
            details: combinedDetailsForFrontend,
            gallery_images: galleryUrls,
            cover_image_public_id: coverImagePublicId
        });

    } catch (error) {
        console.error('Error al obtener el listado para edición:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

// =======================================================
// 🔥 CREAR LISTING (REFECTORIZADO)
// =======================================================
export const createListing = async (req, res) => {
    const { id: userId } = req.user;

    console.log('=================================================');
    console.log('📥 RECIBIENDO DATOS EN createListing CON CLOUDINARY');
    console.log('=================================================');

    const {
        title,
        listing_type_id,
        category_id,
        lat,
        lng,
        address,
        province,        // Columna Fija
        city,            // Columna Fija
        email,           // Columna Fija
        description,     // Columna Fija
        provincia_id,
        city_id,
        opening_hours,
        amenities,
        dynamic_details, // 🔥 JSON string de campos variables
        phone,
        whatsapp,
        website
    } = req.body;

    const tempId = req.tempId;

    // ✅ VALIDACIÓN DE CAMPOS PRINCIPALES
    if (!title || !category_id || !lat || !lng || !address || !province || !city || !email) {
        console.error('❌ VALIDACIÓN FALLIDA: Faltan campos obligatorios fijos');
        return res.status(400).json({
            error: 'Faltan campos obligatorios para el listado o la ubicación.',
            // ... (Detalles de campos faltantes)
        });
    }

    // 🛑 VALIDACIÓN DE dynamic_details
    let parsedDynamicDetails = {};
    if (dynamic_details) {
        try {
            parsedDynamicDetails = JSON.parse(dynamic_details);
        } catch (e) {
            console.error('❌ Error al parsear dynamic_details JSON:', e.message);
            return res.status(400).json({ error: 'Formato de detalles dinámicos inválido.' });
        }
    }

    const validationResult = validateDetails(listing_type_id, parsedDynamicDetails);

    if (!validationResult.isValid) {
        return res.status(400).json({
            error: 'Faltan campos requeridos para este tipo de listado.',
            details: validationResult.errors
        });
    }

    // Asumo que isValidEmail está disponible

    try {
        // 🔥 SUBIDA DE IMÁGENES A CLOUDINARY
        let coverImageUrl = 'https://res.cloudinary.com/demo/image/upload/sample.jpg'; // Default
        let coverImagePublicId = null;
        let galleryUrls = [];
        let galleryPublicIds = [];

        // Lógica de subida de coverImage
        if (req.files && req.files.coverImage && req.files.coverImage.length > 0) {
            console.log('📤 Subiendo imagen de portada a Cloudinary...');
            const coverFile = req.files.coverImage[0];
            const result = await uploadToCloudinary(
                coverFile.buffer,
                `listings/${tempId || 'temp'}/coverImage`
            );
            coverImageUrl = result.secure_url;
            coverImagePublicId = result.public_id;
            console.log('✅ Imagen de portada subida:', coverImageUrl);
        } else {
            console.log('ℹ️ Usando imagen de portada por defecto');
        }

        // Lógica de subida de galería
        if (req.files && req.files.galleryImages && req.files.galleryImages.length > 0) {
            console.log(`📤 Subiendo ${req.files.galleryImages.length} imágenes de galería...`);
            for (const file of req.files.galleryImages) {
                const result = await uploadToCloudinary(
                    file.buffer,
                    `listings/${tempId || 'temp'}/gallery`
                );
                galleryUrls.push(result.secure_url);
                galleryPublicIds.push(result.public_id);
            }
            console.log('✅ Galería subida:', galleryUrls.length, 'imágenes');
        }

        // 2. 🏗️ CONSTRUCCIÓN DEL OBJETO DETAILS (JSONB)
        let parsedAmenities = [];
        if (amenities) {
            parsedAmenities = typeof amenities === 'string' ? JSON.parse(amenities) : amenities;
        }

        const finalDetailsJSONB = {
            // Metadatos que van al JSONB
            provincia_id: provincia_id,
            localidad_id: city_id,
            opening_hours: opening_hours || '',
            amenities: parsedAmenities,

            // Metadatos de Cloudinary
            cover_image_public_id: coverImagePublicId,
            gallery_public_ids: galleryPublicIds,
            gallery_urls: galleryUrls,

            // 🔥 CAMPOS DINÁMICOS ESPECÍFICOS
            dynamic_fields: parsedDynamicDetails,
        };

        const detailsToStore = JSON.stringify(finalDetailsJSONB);
        console.log('🔍 Objeto finalDetailsJSONB construido:', detailsToStore);

        // 3. 🗄️ INSERTAR EN BASE DE DATOS
        const query = `
            INSERT INTO listings
            (user_id, title, category_id, listing_type_id, location, address, details, cover_image_path, status, city, province, email, description, phone, whatsapp, website)
            VALUES
            ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography, $7, $8::jsonb, $9, 'pending', $10, $11, $12, $13, $14, $15, $16)
            RETURNING id;
        `;

        const values = [
            userId,                     // $1
            title,                      // $2
            parseInt(category_id),      // $3
            parseInt(listing_type_id),  // $4
            parseFloat(lng),            // $5 lng
            parseFloat(lat),            // $6 lat
            address,                    // $7
            detailsToStore,             // $8 JSONB
            coverImageUrl,              // $9 cover_image_path
            city,                       // $10
            province,                   // $11
            email,                      // $12
            description || null,        // $13
            phone || null,              // $14
            whatsapp || null,           // $15
            website || null             // $16
        ];

        console.log('📤 Ejecutando query SQL...');
        const result = await db.query(query, values);
        const newListingId = result.rows[0].id;

        // 4. 🔥 RENOMBRAR CARPETAS EN CLOUDINARY
        if (coverImagePublicId) {
            try {
                const newPublicId = coverImagePublicId.replace(/\/temp\//, `/${newListingId}/`);
                await cloudinary.uploader.rename(coverImagePublicId, newPublicId);
                console.log('✅ Cover image renombrada en Cloudinary');
            } catch (renameError) {
                console.warn('⚠️ No se pudo renombrar cover image:', renameError.message);
            }
        }

        if (galleryPublicIds.length > 0) {
            for (const publicId of galleryPublicIds) {
                try {
                    const newPublicId = publicId.replace(/\/temp\//, `/${newListingId}/`);
                    await cloudinary.uploader.rename(publicId, newPublicId);
                } catch (renameError) {
                    console.warn('⚠️ No se pudo renombrar imagen de galería:', renameError.message);
                }
            }
            console.log('✅ Galería renombrada en Cloudinary');
        }

        console.log('=================================================');
        console.log('✅ PROCESO COMPLETADO CON ÉXITO');
        console.log('=================================================');

        res.status(201).json({
            message: 'Listado creado con éxito',
            id: newListingId,
            coverImageUrl,
            galleryUrls
        });

    } catch (error) {
        console.error('=================================================');
        console.error('❌ ERROR AL CREAR EL LISTADO');
        console.error('=================================================');
        console.error('Error completo:', error);
        console.error('Mensaje:', error.message);
        console.error('Stack:', error.stack);
        console.error('=================================================');

        res.status(500).json({
            error: 'Error interno del servidor al crear el listado.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// =======================================================
// ACTUALIZAR LISTING (REFECTORIZADO)
// =======================================================
export const updateListing = async (req, res) => {
    const { id: listingId } = req.params;
    const { id: userId } = req.user;

    try {
        // 1. Obtener datos antiguos y listado existente
        const listingResult = await db.query(
            'SELECT listing_type_id, cover_image_path, details FROM listings WHERE id = $1 AND user_id = $2',
            [listingId, userId]
        );

        if (listingResult.rows.length === 0) return res.status(403).json({ error: 'No autorizado o Listado no encontrado.' });

        const {
            listing_type_id: old_listing_type_id,
            cover_image_path: oldCoverUrl,
            details: oldDetails
        } = listingResult.rows[0];

        // Extraer IDs públicos antiguos del JSONB para el borrado de Cloudinary
        const oldCoverPublicId = oldDetails?.cover_image_public_id;
        const oldGalleryPublicIds = oldDetails?.gallery_public_ids || [];
        const oldGalleryUrls = oldDetails?.gallery_urls || [];

        // 2. Extraer datos del cuerpo (incluyendo la instrucción de borrado del frontend)
        const {
            title, category_id, lat, lng, address, city, province, description, // Columna fija
            phone, whatsapp, website, // Columna fija
            provincia_id, localidad_id, opening_hours, amenities, // Metadata
            dynamic_details, // 🔥 JSON String con los campos dinámicos
            galleryImagesToDelete, deleteCoverImagePublicId, // Cloudinary
            listingTypeId // 👈 NUEVO: ID del tipo de listado nuevo (opcional)
        } = req.body;

        // Determinar el listing_type_id con el que vamos a trabajar (nuevo o viejo)
        let current_listing_type_id = old_listing_type_id;
        if (listingTypeId && listingTypeId !== 'undefined' && listingTypeId !== '') {
            const parsedId = parseInt(listingTypeId);
            if (!isNaN(parsedId)) {
                current_listing_type_id = parsedId;
            }
        }

        console.log(`🔍 [UPDATE] Listing ID: ${listingId}`);
        console.log(`🔍 [UPDATE] Old Type ID: ${old_listing_type_id}`);
        console.log(`🔍 [UPDATE] Requested Type ID: ${listingTypeId}`);
        console.log(`🔍 [UPDATE] Final Type ID to use: ${current_listing_type_id}`);

        // 🛑 VALIDACIÓN DE dynamic_details
        let parsedDynamicDetails = {};
        if (dynamic_details) {
            try {
                parsedDynamicDetails = JSON.parse(dynamic_details);
            } catch (e) {
                console.error('❌ Error al parsear dynamic_details JSON en updateListing:', e.message);
                return res.status(400).json({ error: 'Formato de detalles dinámicos inválido.', details: e.message });
            }
        }

        const validationResult = validateDetails(current_listing_type_id, parsedDynamicDetails);
        if (!validationResult.isValid) {
            return res.status(400).json({
                error: 'Faltan campos requeridos para este tipo de listado.',
                details: validationResult.errors
            });
        }

        if (email && !isValidEmail(email)) {
            return res.status(400).json({
                error: 'El formato del email proporcionado no es válido para la actualización.',
            });
        }

        // 3. Lógica de BORRADO, SUBIDA y REEMPLAZO de Portada (Mantenemos tu lógica existente)
        let finalCoverUrl = oldCoverUrl;
        let finalCoverPublicId = oldCoverPublicId;

        // 3a. Borrado explícito
        if (deleteCoverImagePublicId && finalCoverPublicId) {
            console.log(`🗑️ Borrando cover image de Cloudinary: ${finalCoverPublicId}`);
            try {
                await cloudinary.uploader.destroy(finalCoverPublicId);
                finalCoverUrl = null;
                finalCoverPublicId = null;
            } catch (err) {
                console.warn('⚠️ Error al eliminar portada antigua de Cloudinary:', err.message);
            }
        }

        // 4. Lógica de SUBIDA/REEMPLAZO de Portada (Si el usuario subió una nueva)
        if (req.files && req.files.coverImage && req.files.coverImage.length > 0) {
            // Si hay un archivo nuevo, borramos el antiguo si aún existe (y no fue borrado antes)
            if (finalCoverPublicId) {
                try {
                    await cloudinary.uploader.destroy(finalCoverPublicId);
                    console.log('✅ Portada antigua reemplazada y eliminada de Cloudinary.');
                } catch (err) {
                    console.warn('⚠️ Error al eliminar portada antigua para reemplazo:', err.message);
                }
            }

            // Subir la nueva imagen
            const coverFile = req.files.coverImage[0];
            const result = await uploadToCloudinary(
                coverFile.buffer,
                `listings/${listingId}/coverImage/${Date.now()}`
            );

            finalCoverUrl = result.secure_url;
            finalCoverPublicId = result.public_id;
            console.log('✅ Nueva portada subida:', finalCoverUrl);
        }

        // 5. Lógica de Galería
        let finalGalleryUrls = [...oldGalleryUrls];
        let finalGalleryPublicIds = [...oldGalleryPublicIds];
        const deletedGalleryUrls = JSON.parse(galleryImagesToDelete || '[]');

        // 5a. Borrar imágenes de galería existentes (del frontend)
        if (deletedGalleryUrls.length > 0) {
            const publicIdsToDelete = oldGalleryPublicIds.filter((id, index) => deletedGalleryUrls.includes(oldGalleryUrls[index]));

            if (publicIdsToDelete.length > 0) {
                try {
                    await cloudinary.api.delete_resources(publicIdsToDelete);
                    console.log(`🗑️ Galería eliminada de Cloudinary: ${publicIdsToDelete.length} imágenes.`);
                } catch (err) {
                    console.warn('⚠️ Error al eliminar galería de Cloudinary:', err.message);
                }
            }

            // Actualizar arrays locales para remover las borradas
            finalGalleryUrls = finalGalleryUrls.filter(url => !deletedGalleryUrls.includes(url));
            finalGalleryPublicIds = finalGalleryPublicIds.filter((id, index) => !deletedGalleryUrls.includes(oldGalleryUrls[index]));
        }

        // 5b. Subir nuevas imágenes de galería
        if (req.files && req.files.galleryImages && req.files.galleryImages.length > 0) {
            for (const file of req.files.galleryImages) {
                const result = await uploadToCloudinary(
                    file.buffer,
                    `listings/${listingId}/gallery`
                );
                finalGalleryUrls.push(result.secure_url);
                finalGalleryPublicIds.push(result.public_id);
            }
            console.log('✅ Galería nueva subida:', req.files.galleryImages.length, 'imágenes');
        }

        // 6. Construir el objeto final details (JSONB)
        let parsedAmenities = [];
        if (amenities) {
            parsedAmenities = typeof amenities === 'string' ? JSON.parse(amenities) : amenities;
        }

        const finalDetailsJSONB = {
            // Metadatos que van al JSONB
            provincia_id: provincia_id,
            localidad_id: localidad_id,
            opening_hours: opening_hours || '',
            amenities: parsedAmenities,

            // Datos persistentes de Cloudinary
            cover_image_public_id: finalCoverPublicId,
            gallery_public_ids: finalGalleryPublicIds,
            gallery_urls: finalGalleryUrls,

            // 🔥 CAMPOS DINÁMICOS ESPECÍFICOS
            dynamic_fields: parsedDynamicDetails,
        };

        const detailsToStore = JSON.stringify(finalDetailsJSONB);


        // 7. Actualizar el registro en la base de datos
        await db.query(`
            UPDATE listings SET
                title = $1,
                category_id = $2,
                description = $3,
                phone = $4,
                whatsapp = $5,
                website = $6,
                details = $7::jsonb,
                location = ST_SetSRID(ST_MakePoint($8, $9), 4326)::geography,
                address = $10,
                cover_image_path = $11,
                city = $12,
                province = $13,
                email = $14,
                listing_type_id = $17,
                updated_at = NOW()
            WHERE id = $15 AND user_id = $16
        `, [
            title,                          // $1
            parseInt(category_id) || null,  // $2 (Robust Parse)
            description || null,            // $3 (Columna Fija)
            phone || null,                  // $4 (Columna Fija)
            whatsapp || null,               // $5 (Columna Fija)
            website || null,                // $6 (Columna Fija)
            detailsToStore,                 // $7 (JSONB)
            parseFloat(lng),                // $8 (para ST_MakePoint)
            parseFloat(lat),                // $9 (para ST_MakePoint)
            address,                        // $10
            finalCoverUrl,                  // $11
            city,                           // $12
            province,                       // $13
            email,                          // $14
            listingId,                      // $15
            userId,                         // $16
            current_listing_type_id         // $17 (Nuevo Tipo de Listado)
        ]);

        console.log(`✅ Listado ${listingId} actualizado con éxito.`);
        res.status(200).json({ message: 'Listado actualizado con éxito.' });

    } catch (error) {
        console.error(`❌ Error al actualizar el listado ${listingId}:`, error);
        res.status(500).json({ error: 'Error interno del servidor.', details: error.message });
    }
};

export const updateListingStatus = async (req, res) => {
    const { id: listingId } = req.params;
    const { status } = req.body;

    if (!['published', 'rejected', 'pending'].includes(status)) {
        return res.status(400).json({ error: 'Estado inválido proporcionado.' });
    }

    try {
        const query = `UPDATE listings SET status = $1, updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 RETURNING id, status;`;
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

// =======================================================
// 🔥 ELIMINAR LISTING (VALIDADO)
// =======================================================
export const deleteListing = async (req, res) => {
    const { id: listingId } = req.params;
    const { id: userId } = req.user;

    try {
        // 1. Verificar propiedad y obtener details
        const checkQuery = await db.query(
            'SELECT details FROM listings WHERE id = $1 AND user_id = $2',
            [listingId, userId]
        );

        if (checkQuery.rowCount === 0) {
            return res.status(403).json({ error: 'Acceso prohibido. No eres el dueño de este listado.' });
        }

        const details = checkQuery.rows[0].details;

        // 2. 🔥 ELIMINAR IMÁGENES DE CLOUDINARY
        console.log('🗑️ Eliminando imágenes de Cloudinary...');

        // Eliminar Cover Image (si existe)
        if (details?.cover_image_public_id) {
            try {
                await cloudinary.uploader.destroy(details.cover_image_public_id);
                console.log('✅ Cover image eliminada de Cloudinary');
            } catch (err) {
                console.warn('⚠️ Error al eliminar cover image:', err.message);
            }
        }

        // Eliminar Galería (si existen)
        if (details?.gallery_public_ids && details.gallery_public_ids.length > 0) {
            try {
                await cloudinary.api.delete_resources(details.gallery_public_ids);
                console.log('✅ Galería eliminada de Cloudinary');
            } catch (err) {
                console.warn('⚠️ Error al eliminar galería:', err.message);
            }
        }

        // 🔥 Eliminar carpeta completa (limpieza)
        try {
            await cloudinary.api.delete_folder(`listings/${listingId}`);
            console.log('✅ Carpeta eliminada de Cloudinary');
        } catch (err) {
            console.warn('⚠️ Error al eliminar carpeta:', err.message);
        }

        // 3. Eliminar de la Base de Datos
        const deleteQuery = await db.query('DELETE FROM listings WHERE id = $1', [listingId]);

        if (deleteQuery.rowCount === 0) {
            return res.status(404).json({ error: 'Listado no encontrado para eliminar.' });
        }

        console.log('✅ Listado eliminado de la base de datos');
        res.status(200).json({ message: 'Listado y archivos asociados eliminados con éxito.' });

    } catch (error) {
        console.error(`Error al eliminar el listado ${listingId}:`, error);
        res.status(500).json({ error: 'Error interno del servidor al eliminar el listado.' });
    }
};