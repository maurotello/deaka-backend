// server/middleware/requireRole.js

/**
 * Middleware para restringir el acceso basado en el rol del usuario.
 * @param {string[]} requiredRoles - Array de roles permitidos (e.g., ['admin', 'moderator']).
 */
export const requireRole = (requiredRoles) => {
    return (req, res, next) => {
        // req.user.role ya está disponible gracias a tu modificación en routes/auth.js
        const userRole = req.user && req.user.role;

        if (!userRole) {
            return res.status(403).json({ error: 'Acceso denegado. Información de rol incompleta.' });
        }

        // Comprueba si el rol del usuario está incluido en los roles requeridos
        if (requiredRoles.includes(userRole)) {
            next(); // Autorizado
        } else {
            console.warn(`ATLAS ALERT: Acceso denegado. User ID: ${req.user.id}, Role: ${userRole}`);
            return res.status(403).json({ error: 'Acceso denegado. No tiene los permisos requeridos.' });
        }
    };
};