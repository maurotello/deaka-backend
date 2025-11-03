import db from '../db.js';
import cloudinary from '../config/cloudinary.js'; // 🔥 IMPORTAR CLOUDINARY
import { Readable } from 'stream';

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

// =======================================================
// --- LÓGICA DE DATOS Y GEOESPACIAL (SIN CAMBIOS) ---
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
                        const bbox_start_index = queryParams.length + 1;
                        queryParams.push(minLng, minLat, maxLng, maxLat);
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

export const getMyListings = async (req, res) => {
        if (!req.user || !req.user.id) {
                console.error('❌ ERROR: req.user o req.user.id no está disponible.');
                return res.status(403).json({ error: 'Usuario no autenticado o sesión no válida.' });
        }
        const { id: userId } = req.user;
        try {
                const query = `SELECT l.id, l.title, l.address, l.city, c.name AS category_name, l.status
            FROM listings AS l
            JOIN categories AS c ON l.category_id = c.id
            WHERE l.user_id = $1
            ORDER BY l.created_at DESC;`;
                const { rows } = await db.query(query, [userId]);
                res.status(200).json(rows);
        } catch (error) {
                console.error('Error al obtener mis listados:', error);
                res.status(500).json({ error: 'Error interno del servidor.' });
        }
};

export const getListingForEdit = async (req, res) => {
        const { id } = req.params;
        const { id: userId } = req.user;

        try {
                const query = `SELECT l.title, l.category_id, l.details, l.address, l.cover_image_path,
                        ST_X(l.location::geometry) AS lng, ST_Y(l.location::geometry) AS lat,
                        c.marker_icon_slug,
                        c.icon_original_width,
                        c.icon_original_height
                        FROM listings AS l
                        JOIN categories AS c ON l.category_id = c.id
                        WHERE l.id = $1 AND l.user_id = $2;`;
                const { rows } = await db.query(query, [id, userId]);

                if (rows.length === 0) return res.status(404).json({ error: 'Listado no encontrado o no autorizado.' });

                const listingData = rows[0];
                const coverImagePublicId = listingData.details?.cover_image_public_id || null;

                // 🔥 CAMBIO: Extraer URLs de galería desde details (ya no hay carpeta local)
                const galleryImages = listingData.details?.gallery_urls || [];

                res.json({
                        ...listingData,
                        gallery_images: galleryImages,
                        cover_image_public_id: coverImagePublicId
                });
        } catch (error) {
                console.error('Error al obtener el listado:', error);
                res.status(500).json({ error: 'Error interno del servidor.' });
        }
};

// =======================================================
// 🔥 CREAR LISTING - MODIFICADO PARA CLOUDINARY
// =======================================================
export const createListing = async (req, res) => {
        const { id: userId } = req.user;

        console.log('=================================================');
        console.log('📥 RECIBIENDO DATOS EN createListing CON CLOUDINARY');
        console.log('=================================================');
        console.log('req.body:', req.body);
        console.log('req.files:', req.files);
        console.log('=================================================');

        const {
                title,
                listing_type_id,
                category_id,
                lat,
                lng,
                address,
                province_id,
                city_id,
                province,
                city,
                email,
                description,
                opening_hours,
                amenities
        } = req.body;

        const tempId = req.tempId;

        // ✅ VALIDACIÓN
        if (!title || !category_id || !lat || !lng || !address || !province_id || !city_id || !province || !city || !email) {
                console.error('❌ VALIDACIÓN FALLIDA: Faltan campos obligatorios');
                return res.status(400).json({
                        error: 'Faltan campos obligatorios para el listado o la ubicación.',
                        missing: {
                                title: !title,
                                category_id: !category_id,
                                lat: !lat,
                                lng: !lng,
                                address: !address,
                                province_id: !province_id,
                                city_id: !city_id,
                                province: !province,
                                city: !city,
                                email: !email
                        }
                });
        }

        if (!isValidEmail(email)) { // Usar la función auxiliar
                console.error('❌ VALIDACIÓN FALLIDA: Formato de email inválido');
                return res.status(400).json({
                        error: 'El formato del email proporcionado no es válido.',
                });
        }

        try {
                // 🔥 SUBIR IMAGEN DE PORTADA A CLOUDINARY
                let coverImageUrl = 'https://res.cloudinary.com/demo/image/upload/sample.jpg'; // Default
                let coverImagePublicId = null;

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
                        console.log('ℹ️  Usando imagen de portada por defecto');
                }

                // 🔥 SUBIR IMÁGENES DE GALERÍA A CLOUDINARY
                let galleryUrls = [];
                let galleryPublicIds = [];

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

                // 🏗️ CONSTRUCCIÓN DEL OBJETO DETAILS
                let parsedAmenities = [];
                if (amenities) {
                        try {
                                parsedAmenities = typeof amenities === 'string' ? JSON.parse(amenities) : amenities;
                                console.log('✅ Amenities parseados:', parsedAmenities);
                        } catch (e) {
                                console.error('⚠️  Error al parsear amenities:', e.message);
                        }
                }

                const finalDetails = {
                        provincia_id: province_id,
                        localidad_id: city_id,
                        province_name: province,
                        city_name: city,
                        description: description || '',
                        opening_hours: opening_hours || '',
                        amenities: parsedAmenities,
                        // 🔥 NUEVOS CAMPOS PARA CLOUDINARY
                        cover_image_public_id: coverImagePublicId,
                        gallery_public_ids: galleryPublicIds,
                        gallery_urls: galleryUrls
                };

                console.log('🔍 Objeto finalDetails construido:', JSON.stringify(finalDetails, null, 2));

                // 🗄️ INSERTAR EN BASE DE DATOS
                const query = `
                        INSERT INTO listings
                        (user_id, title, category_id, listing_type_id, location, address, details, cover_image_path, status, city, province, email)
                        VALUES
                        ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326)::geography, $7, $8::jsonb, $9, 'pending', $10, $11, $12)
                        RETURNING id;
                `;
                const values = [
                        userId,
                        title,
                        parseInt(category_id),
                        parseInt(listing_type_id),
                        parseFloat(lng),
                        parseFloat(lat),
                        address,
                        JSON.stringify(finalDetails),
                        coverImageUrl,  // 🔥 AHORA ES LA URL DE CLOUDINARY
                        city,
                        province,
                        email
                ];

                console.log('📤 Ejecutando query SQL...');
                const result = await db.query(query, values);
                const newListingId = result.rows[0].id;

                console.log('✅ ¡LISTADO CREADO EXITOSAMENTE CON ID:', newListingId);

                // 🔥 RENOMBRAR CARPETAS EN CLOUDINARY (cambiar temp por el ID real)
                if (coverImagePublicId) {
                        try {
                                const newPublicId = coverImagePublicId.replace(/\/temp\//, `/${newListingId}/`);
                                await cloudinary.uploader.rename(coverImagePublicId, newPublicId);
                                console.log('✅ Cover image renombrada en Cloudinary');
                        } catch (renameError) {
                                console.warn('⚠️  No se pudo renombrar cover image:', renameError.message);
                        }
                }

                if (galleryPublicIds.length > 0) {
                        for (const publicId of galleryPublicIds) {
                                try {
                                        const newPublicId = publicId.replace(/\/temp\//, `/${newListingId}/`);
                                        await cloudinary.uploader.rename(publicId, newPublicId);
                                } catch (renameError) {
                                        console.warn('⚠️  No se pudo renombrar imagen de galería:', renameError.message);
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
// ACTUALIZAR LISTING (SIN CAMBIOS MAYORES POR AHORA)
// =======================================================
export const updateListing = async (req, res) => {
        const { id: listingId } = req.params;
        const { id: userId } = req.user;

        try {
                // 1. Obtener datos antiguos: cover_image_path (URL) y details (JSONB que contiene public_ids/gallery_urls)
                const listingResult = await db.query(
                        'SELECT cover_image_path, details FROM listings WHERE id = $1 AND user_id = $2',
                        [listingId, userId]
                );
                if (listingResult.rows.length === 0) return res.status(403).json({ error: 'No autorizado o Listado no encontrado.' });

                const { cover_image_path: oldCoverUrl, details: oldDetails } = listingResult.rows[0];

                // Extraer IDs públicos antiguos del JSONB para el borrado
                const oldCoverPublicId = oldDetails?.cover_image_public_id;
                const oldGalleryPublicIds = oldDetails?.gallery_public_ids || [];
                const oldGalleryUrls = oldDetails?.gallery_urls || [];


                // 2. Extraer datos del cuerpo (incluyendo la instrucción de borrado del frontend)
                const {
                        title, categoryId, lat, lng, address, city, province,
                        provinciaId, localidadId, details: updatedDetails, email,
                        // Datos específicos para Cloudinary/Imágenes
                        galleryImagesToDelete, // Array de URLs (Frontend)
                        deleteCoverImagePublicId // ID Público de la portada borrada (Frontend)
                } = req.body;

                if (email && !isValidEmail(email)) {
                        return res.status(400).json({
                                error: 'El formato del email proporcionado no es válido para la actualización.',
                        });
                }


                // 3. Lógica de BORRADO de Portada (Si el usuario presionó el botón rojo)
                let finalCoverUrl = oldCoverUrl;
                let finalCoverPublicId = oldCoverPublicId;

                if (deleteCoverImagePublicId && finalCoverPublicId) {
                        console.log(`🗑️ Borrando cover image de Cloudinary: ${finalCoverPublicId}`);
                        try {
                                await cloudinary.uploader.destroy(finalCoverPublicId);
                                finalCoverUrl = null;        // Borra la URL de la DB
                                finalCoverPublicId = null;   // Borra el Public ID
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
                                // Usamos el ID del listing directamente, no un temporal
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

                // 6. Construir el objeto final details (combinando detalles antiguos, nuevos, y datos de imagen)
                const parsedUpdatedDetails = JSON.parse(updatedDetails || '{}'); // Asegurar que 'details' se parsea si viene como string

                const finalDetails = {
                        ...oldDetails,          // Mantener detalles no modificados
                        ...parsedUpdatedDetails, // Sobrescribir con nuevos detalles
                        provincia_id: provinciaId,
                        localidad_id: localidadId,
                        province_name: province,
                        city_name: city,

                        // Datos persistentes de Cloudinary
                        cover_image_public_id: finalCoverPublicId,
                        gallery_public_ids: finalGalleryPublicIds,
                        gallery_urls: finalGalleryUrls,
                };


                // 7. Actualizar el registro en la base de datos
                await db.query(`
            UPDATE listings SET
                title = $1, category_id = $2, details = $3::jsonb,
                location = ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography,
                address = $6, cover_image_path = $7, updated_at = NOW(),
                city = $8, province = $9, email = $10
                WHERE id = $11 AND user_id = $12
        `, [
                        title,
                        categoryId,
                        JSON.stringify(finalDetails), // Asegurar que sea JSON string
                        parseFloat(lng),
                        parseFloat(lat),
                        address,
                        finalCoverUrl,
                        city,
                        province,
                        email,
                        listingId,
                        userId
                ]);

                console.log(`✅ Listado ${listingId} actualizado con éxito.`);
                res.status(200).json({ message: 'Listado actualizado con éxito.' });

        } catch (error) {
                console.error(`❌ Error al actualizar el listado ${listingId}:`, error);
                res.status(500).json({ error: 'Error interno del servidor.' });
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

// 🔥 ELIMINAR LISTING - MODIFICADO PARA CLOUDINARY
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
                console.log('🗑️  Eliminando imágenes de Cloudinary...');

                if (details?.cover_image_public_id) {
                        try {
                                await cloudinary.uploader.destroy(details.cover_image_public_id);
                                console.log('✅ Cover image eliminada de Cloudinary');
                        } catch (err) {
                                console.warn('⚠️  Error al eliminar cover image:', err.message);
                        }
                }

                if (details?.gallery_public_ids && details.gallery_public_ids.length > 0) {
                        try {
                                await cloudinary.api.delete_resources(details.gallery_public_ids);
                                console.log('✅ Galería eliminada de Cloudinary');
                        } catch (err) {
                                console.warn('⚠️  Error al eliminar galería:', err.message);
                        }
                }

                // 🔥 Eliminar carpeta completa
                try {
                        await cloudinary.api.delete_folder(`listings/${listingId}`);
                        console.log('✅ Carpeta eliminada de Cloudinary');
                } catch (err) {
                        console.warn('⚠️  Error al eliminar carpeta:', err.message);
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