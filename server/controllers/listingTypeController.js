import db from '../db.js';

// Definición de la interfaz del tipo de listado
// NOTE: Solo tiene id, name, y slug.

// ===============================================
// 1. LECTURA: Obtener TODOS los tipos de listado
// ===============================================
export const getAllListingTypes = async (req, res) => {
    try {
        const { rows } = await db.query(
            'SELECT id, name, slug FROM listing_types ORDER BY name'
        );
        res.status(200).json(rows);
    } catch (error) {
        console.error('Error al obtener tipos de listado:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

// ===============================================
// 2. CREACIÓN: Crear un nuevo tipo de listado
// ===============================================
export const createListingType = async (req, res) => {
    const { name, slug } = req.body;

    // Validación
    if (!name || !slug) {
        return res.status(400).json({ error: 'El nombre y slug son obligatorios para el Tipo de Listado.' });
    }

    try {
        const { rows } = await db.query(
            `INSERT INTO listing_types (name, slug) 
             VALUES ($1, $2) 
             RETURNING id, name, slug`,
            [name, slug]
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        // Asume un error de duplicado (ej. slug único)
        const errorMessage = error.code === '23505' ? 'El slug o nombre ya existe.' : 'Error al crear el tipo de listado.';
        console.error('Error al crear tipo de listado:', error);
        res.status(500).json({ error: errorMessage });
    }
};

// ===============================================
// 3. MODIFICACIÓN: Actualizar un tipo de listado
// ===============================================
export const updateListingType = async (req, res) => {
    const { id } = req.params;
    const { name, slug } = req.body;

    if (!name || !slug) {
        return res.status(400).json({ error: 'El nombre y slug son obligatorios.' });
    }

    try {
        const { rows } = await db.query(
            `UPDATE listing_types 
             SET name = $1, slug = $2 
             WHERE id = $3 
             RETURNING id, name, slug`,
            [name, slug, id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Tipo de Listado no encontrado.' });
        }

        res.status(200).json(rows[0]);
    } catch (error) {
        console.error('Error al actualizar tipo de listado:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

// ===============================================
// 4. BAJA: Eliminar un tipo de listado
// ===============================================
export const deleteListingType = async (req, res) => {
    const { id } = req.params;

    try {
        // Opcional: Verificar si hay listings que dependen de este tipo antes de borrar
        const dependencyCheck = await db.query(
            'SELECT COUNT(*) FROM listings WHERE listing_type_id = $1',
            [id]
        );
        
        if (dependencyCheck.rows[0].count > 0) {
            return res.status(400).json({ 
                error: 'No puedes eliminar este tipo de listado; hay listados que lo utilizan.' 
            });
        }
        
        const result = await db.query(
            'DELETE FROM listing_types WHERE id = $1 RETURNING id',
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Tipo de Listado no encontrado.' });
        }

        res.status(200).json({ message: 'Tipo de Listado eliminado exitosamente.' });
    } catch (error) {
        console.error('Error al eliminar tipo de listado:', error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};