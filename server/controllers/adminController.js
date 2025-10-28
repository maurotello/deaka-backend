import db from '../db.js';
import bcrypt from 'bcryptjs';

const saltRounds = 10; // Nivel de seguridad para el hashing
const ALLOWED_ROLES = ['user', 'admin']; // Roles permitidos para el sistema

// ===============================================
// 1. CREACIÓN (Alta) de Usuario por Admin (POST /api/auth/admin/register)
// ===============================================

export const adminRegisterUser = async (req, res) => {
    const { email, password, role } = req.body;
    
    // 1. Validación de Entrada
    if (!email || !password || password.length < 6) {
        return res.status(400).json({ 
            error: "Faltan campos obligatorios (nombre, email, password) o la contraseña es demasiado corta (mínimo 6 caracteres)." 
        });
    }

    // 2. Validación de Rol (CRÍTICO)
    if (!role || !ALLOWED_ROLES.includes(role)) {
        return res.status(400).json({ error: "Rol no válido. Debe ser 'user' o 'admin'." });
    }
    
    try {
        // 3. Verificar si el usuario ya existe
        const existingUser = await db.query('SELECT email FROM users WHERE email = $1', [email]);
        if (existingUser.rows.length > 0) {
            return res.status(409).json({ error: "El email ya está registrado." });
        }

        // 4. Hashear la Contraseña
        const password_hash = await bcrypt.hash(password, saltRounds);

        // 5. Inserción con Rol Explícito
        const newUser = await db.query(
            `INSERT INTO users (email, password_hash, role)
             VALUES ($1, $2, $3)
             RETURNING id, email, role, created_at`,
            [email, password_hash, role] 
        );

        return res.status(201).json({ 
            message: `Usuario ${email} creado con rol ${role}.`,
            user: newUser.rows[0]
        });

    } catch (error) {
        console.error("Error al registrar usuario por admin:", error);
        return res.status(500).json({ error: "Error interno del servidor." });
    }
};

// ===============================================
// 2. LECTURA (Listado) de Todos los Usuarios (GET /api/auth/admin/users)
// ===============================================

export const getAllUsers = async (req, res) => {
    try {
        // Excluimos password_hash y refresh_token por seguridad y tamaño
        const { rows } = await db.query(
            'SELECT id, email, role, created_at FROM users ORDER BY created_at DESC'
        );
        res.status(200).json(rows);
    } catch (error) {
        console.error("Error al obtener usuarios:", error);
        res.status(500).json({ error: "Error interno del servidor al listar usuarios." });
    }
};

// ===============================================
// 3. MODIFICACIÓN (Actualización de Rol/Nombre) (PATCH /api/auth/admin/users/:id)
// ===============================================

export const updateUserRole = async (req, res) => {
    const { id: targetUserId } = req.params;
    const { email, role } = req.body; 
    
    // 1. Validación
    if (!email || !role) {
        return res.status(400).json({ error: "El email y el rol son obligatorios." });
    }
    if (!ALLOWED_ROLES.includes(role)) {
        return res.status(400).json({ error: "Rol no válido. Debe ser 'user' o 'admin'." });
    }

    try {
        const query = `
            UPDATE users SET email = $1, role = $2 
            WHERE id = $3 
            RETURNING id, email, role;
        `;
        const { rows } = await db.query(query, [email, role, targetUserId]);

        if (rows.length === 0) {
            return res.status(404).json({ error: "Usuario no encontrado." });
        }

        res.status(200).json({ 
            message: `Usuario ${rows[0].email} actualizado. Nuevo rol: ${rows[0].role}.`,
            user: rows[0]
        });
    } catch (error) {
        console.error("Error al actualizar usuario:", error);
        res.status(500).json({ error: "Error interno del servidor al actualizar usuario." });
    }
};

// ===============================================
// 4. BAJA (Eliminación) de Usuario (DELETE /api/auth/admin/users/:id)
// ===============================================

export const deleteUser = async (req, res) => {
    const { id: targetUserId } = req.params;
    const adminId = req.user.id; // ID del administrador logueado desde el JWT (req.user)

    // 1. Seguridad: Impedir que un admin se auto-elimine
    if (parseInt(targetUserId) === adminId) {
        return res.status(403).json({ error: "Un administrador no puede eliminarse a sí mismo." });
    }
    
    try {
        // 2. Eliminación de la DB
        const result = await db.query('DELETE FROM users WHERE id = $1 RETURNING id', [targetUserId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: "Usuario no encontrado para eliminar." });
        }

        res.status(200).json({ message: `Usuario ID ${targetUserId} eliminado exitosamente.` });
    } catch (error) {
        console.error("Error al eliminar usuario:", error);
        // Nota: Si el usuario tiene listados y la FK es restrictiva, la DB lanzará un error 500 aquí.
        // Se recomienda configurar la FK en 'listings' con ON DELETE SET NULL o CASCADE.
        res.status(500).json({ error: "Error interno del servidor al eliminar usuario." });
    }
};