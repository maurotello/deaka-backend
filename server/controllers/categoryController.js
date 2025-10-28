import db from '../db.js';
import fs from 'fs/promises'; // Importamos para borrar archivos
import path from 'path';
import sharp from 'sharp';

// ===============================================
// 1. LECTURA: Obtener TODAS las categorías (principales + subcategorías)
// ===============================================
export const getAllCategories = async (req, res) => {
    try {
        // 🚨 PASO DE DEBUG: Quitamos las columnas de dimensión (icon_original_width/height)
        const { rows } = await db.query(
            'SELECT id, name, slug, parent_id, marker_icon_slug FROM categories ORDER BY parent_id, name'
        );
        
        // 🚨 CRÍTICO: Imprime para ver si la DB devuelve datos antes de enviarlos.
        console.log('DEBUG: Categorías devueltas:', rows.length, 'filas.'); 
        
        res.status(200).json(rows);
    } catch (error) {
        // Asegúrate de que este log esté activo para capturar el error SQL.
        console.error('ERROR CRÍTICO SQL AL OBTENER CATEGORÍAS:', error); 
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};
// ===============================================
// 2. LECTURA: Obtener SOLO categorías principales (parent_id = NULL)
// ===============================================
export const getMainCategories = async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT id, name, slug, parent_id, marker_icon_slug FROM categories WHERE parent_id IS NULL ORDER BY name'
        );
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error al obtener categorías principales:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

// ===============================================
// 3. LECTURA: Obtener subcategorías de una categoría
// ===============================================
export const getSubcategories = async (req, res) => {
    const { parentId } = req.params;
    try {
        const { rows } = await db.query(
            'SELECT id, name, slug, parent_id, marker_icon_slug FROM categories WHERE parent_id = $1 ORDER BY name',
            [parentId]
        );
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error al obtener subcategorías:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};



// ===============================================
// 4. CREACIÓN: Crear una nueva categoría
// ===============================================
export const createCategory = async (req, res) => {
    const { name, slug, parent_id } = req.body;
    const file = req.file; // Archivo subido por Multer

    console.log('🔷 CREATE CATEGORY - Datos recibidos:', { name, slug, parent_id, file: file?.filename });

    // Validación básica
    if (!name || !slug) {
        if (file) await fs.unlink(file.path).catch(e => console.error(e));
        return res.status(400).json({ error: 'El nombre y slug son obligatorios.' });
    }

    // Valores por defecto
    let finalSlug = 'default-pin';
    let finalWidth = 38;
    let finalHeight = 38;
    let fileToDelete = null;

    try {
        // Si hay archivo, procesamos con Sharp
        if (file) {
            fileToDelete = file.path;
            
            // Leer dimensiones originales
            const metadata = await sharp(file.path).metadata();
            finalWidth = metadata.width || 38;
            finalHeight = metadata.height || 38;

            // 🔥 CRÍTICO: El slug del ícono ES el slug de la categoría
            finalSlug = slug;

            // Renombrar el archivo para que coincida con el slug
            const ext = path.extname(file.filename);
            const newFilename = `${slug}${ext}`;
            const newPath = path.join(path.dirname(file.path), newFilename);

            await fs.rename(file.path, newPath);
            console.log(`✅ Archivo renombrado: ${file.filename} → ${newFilename}`);
        }

        // Insertar en la base de datos
        const { rows } = await db.query(
            `INSERT INTO categories (name, slug, parent_id, marker_icon_slug, icon_original_width, icon_original_height) 
             VALUES ($1, $2, $3, $4, $5, $6) 
             RETURNING id, name, slug, parent_id, marker_icon_slug`,
            [name, slug, parent_id || null, finalSlug, finalWidth, finalHeight]
        );

        console.log('✅ Categoría creada:', rows[0]);
        res.status(201).json(rows[0]);

    } catch (error) {
        console.error('❌ Error al crear categoría:', error);
        if (fileToDelete) await fs.unlink(fileToDelete).catch(e => console.error(e));
        
        if (error.code === '23505') { // Código de error de Postgres para duplicados
            res.status(400).json({ error: 'El slug ya existe. Elige uno diferente.' });
        } else {
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    }
};



// server/controllers/categoryController.js

// ... (imports: db, fs, path, sharp) ...

// ===============================================
// 5. MODIFICACIÓN: Actualizar una categoría
// ===============================================
export const updateCategory = async (req, res) => {
    const { id } = req.params;
    const { name, slug, parent_id, marker_icon_slug } = req.body;
    const file = req.file;

    console.log('🔶 UPDATE CATEGORY - ID:', id);
    console.log('🔶 Datos recibidos:', { name, slug, marker_icon_slug, file: file?.filename });

    if (!name || !slug) {
        if (file) await fs.unlink(file.path).catch(e => console.error(e));
        return res.status(400).json({ error: 'El nombre y slug son obligatorios.' });
    }

    let fileToDelete = null;

    try {
        // 1. Obtener datos actuales de la categoría
        const { rows: currentCat } = await db.query(
            'SELECT marker_icon_slug, icon_original_width, icon_original_height FROM categories WHERE id = $1',
            [id]
        );

        if (currentCat.length === 0) {
            if (file) await fs.unlink(file.path).catch(e => console.error(e));
            return res.status(404).json({ error: 'Categoría no encontrada.' });
        }

        const currentData = currentCat[0];
        console.log('📋 Datos actuales:', currentData);

        // 2. Preparar valores de actualización
        let finalSlug = marker_icon_slug || currentData.marker_icon_slug;
        let finalWidth = currentData.icon_original_width;
        let finalHeight = currentData.icon_original_height;
        let shouldDeleteOldFile = false;

        // 3. Si hay un nuevo archivo
        if (file) {
            fileToDelete = file.path;

            // Leer dimensiones del nuevo archivo
            const metadata = await sharp(file.path).metadata();
            finalWidth = metadata.width || 38;
            finalHeight = metadata.height || 38;

            // 🔥 CRÍTICO: El nuevo slug del ícono ES el slug de la categoría
            finalSlug = slug;

            // Renombrar el nuevo archivo
            const ext = path.extname(file.filename);
            const newFilename = `${slug}${ext}`;
            const newPath = path.join(path.dirname(file.path), newFilename);

            await fs.rename(file.path, newPath);
            console.log(`✅ Nuevo archivo renombrado: ${file.filename} → ${newFilename}`);

            // Marcar para borrar el archivo antiguo si el slug cambió
            if (currentData.marker_icon_slug !== finalSlug && currentData.marker_icon_slug !== 'default-pin') {
                shouldDeleteOldFile = true;
            }
        }

        console.log('📤 Valores finales a actualizar:', { finalSlug, finalWidth, finalHeight });

        // 4. Actualizar en la base de datos
        const { rows } = await db.query(
            `UPDATE categories 
             SET name = $1, slug = $2, parent_id = $3, marker_icon_slug = $4, icon_original_width = $5, icon_original_height = $6
             WHERE id = $7 
             RETURNING id, marker_icon_slug`,
            [name, slug, parent_id || null, finalSlug, finalWidth, finalHeight, id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Categoría no encontrada.' });
        }

        console.log('✅ Categoría actualizada:', rows[0]);

        // 5. Borrar el archivo antiguo si es necesario
        if (shouldDeleteOldFile) {
            const oldIconName = currentData.marker_icon_slug;
            const publicPath = path.join(process.cwd(), 'public', 'icons');
            const extensions = ['.png', '.jpg', '.jpeg', '.webp'];

            for (const ext of extensions) {
                const oldFilePath = path.join(publicPath, `${oldIconName}${ext}`);
                await fs.unlink(oldFilePath).catch(() => {}); // Ignorar errores
            }
            console.log(`🗑️ Archivo antiguo eliminado: ${oldIconName}`);
        }

        res.status(200).json(rows[0]);

    } catch (error) {
        console.error('❌ Error al actualizar categoría:', error);
        if (fileToDelete) await fs.unlink(fileToDelete).catch(e => console.error(e));

        if (error.code === '23505') {
            res.status(400).json({ error: 'El slug ya existe. Elige uno diferente.' });
        } else {
            res.status(500).json({ error: 'Error interno del servidor.' });
        }
    }
};

// ===============================================
// 6. BAJA: Eliminar una categoría
// ===============================================
export const deleteCategory = async (req, res) => {
    const { id } = req.params;

    try {
        // Verificar si la categoría tiene subcategorías
        const { rows: subcats } = await db.query(
            'SELECT id FROM categories WHERE parent_id = $1',
            [id]
        );

        if (subcats.length > 0) {
            return res.status(400).json({ 
                error: 'No puedes eliminar una categoría que tiene subcategorías. Elimínalas primero.' 
            });
        }

        const result = await db.query(
            'DELETE FROM categories WHERE id = $1 RETURNING id',
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Categoría no encontrada.' });
        }

        res.status(200).json({ message: 'Categoría eliminada exitosamente.' });
    } catch (error) {
        console.error('Error al eliminar categoría:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};