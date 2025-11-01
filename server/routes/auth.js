import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db.js';
import verifyToken from '../middleware/auth.js';
import verifyAdminRole from '../middleware/verifyAdminRole.js';
import {
    adminRegisterUser,
    getAllUsers,
    updateUserRole,
    deleteUser
} from '../controllers/adminController.js';

const router = express.Router();

// =======================================================
// --- RUTAS DE AUTENTICACIÓN PÚBLICAS ---
// =======================================================

// REGISTRO
router.post('/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña son requeridos.' });
    try {
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);
        const { rows } = await db.query(
            'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
            [email, password_hash]
        );
        res.status(201).json(rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'El email ya está en uso o hubo un error en el servidor.' });
    }
});

// LOGIN
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña son requeridos.' });

    try {
        const { rows } = await db.query('SELECT *, role FROM users WHERE email = $1', [email]);
        if (rows.length === 0) return res.status(401).json({ error: 'Credenciales inválidas.' });

        const user = rows[0];
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) return res.status(401).json({ error: 'Credenciales inválidas.' });

        // Generar Tokens
        const accessToken = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );

        const refreshToken = jwt.sign(
            { id: user.id },
            process.env.JWT_REFRESH_SECRET,
            { expiresIn: '7d' }
        );

        // Guardar Refresh Token en DB
        await db.query('UPDATE users SET refresh_token = $1 WHERE id = $2', [refreshToken, user.id]);

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        console.log('✅ LOGIN EXITOSO - Cookie refreshToken configurada');

        res.json({
            accessToken,
            user: { id: user.id, email: user.email, role: user.role }
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
});

// REFRESH TOKEN
router.get('/refresh', async (req, res) => {
    const refreshToken = req.cookies.refreshToken;

    console.log('REQ COOKIES:', req.cookies);
    console.log('REQ HEADERS cookie:', req.headers.cookie);

    if (!refreshToken) {
        return res.status(401).json({ error: 'No autorizado, no se proporcionó token' });
    }

    try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

        const userResult = await db.query('SELECT id, email, refresh_token, role FROM users WHERE id = $1', [decoded.id]);

        if (userResult.rows.length === 0 || userResult.rows[0].refresh_token !== refreshToken) {
            return res.status(403).json({ error: 'Acceso prohibido' });
        }

        const user = userResult.rows[0];

        const accessToken = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );

        res.json({
            accessToken,
            user: { id: user.id, email: user.email, role: user.role }
        });

    } catch (err) {
        console.error("Error en /refresh:", err.message);
        res.clearCookie('refreshToken', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        });
        return res.status(403).json({ message: 'Token inválido o expirado' });
    }
});

// LOGOUT
router.post('/logout', async (req, res) => {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
        return res.sendStatus(204);
    }

    await db.query('UPDATE users SET refresh_token = NULL WHERE refresh_token = $1', [refreshToken]);

    res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    });

    res.status(200).json({ message: 'Sesión cerrada exitosamente.' });
});

// =======================================================
// --- RUTAS DE ADMINISTRACIÓN (PROTEGIDAS) ---
// =======================================================

const adminMiddlewares = [verifyToken, verifyAdminRole];

// ALTA (Creación de nuevos usuarios/admins)
router.post('/admin/register', adminMiddlewares, adminRegisterUser);

// LECTURA (Listar todos los usuarios)
router.get('/admin/users', adminMiddlewares, getAllUsers); // 🔥 RUTA CORREGIDA

// MODIFICACIÓN (Actualizar rol o nombre)
router.patch('/admin/users/:id', adminMiddlewares, updateUserRole);

// BAJA (Eliminar usuario)
router.delete('/admin/users/:id', adminMiddlewares, deleteUser);

export default router;