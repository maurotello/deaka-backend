// server/middleware/verifyAdminRole.js

const verifyAdminRole = (req, res, next) => {
    // El objeto 'req.user' fue adjuntado por el middleware verifyToken
    // y contiene la información del payload JWT (id, email, role).
    
    // 1. Verificación: ¿El usuario existe y tiene el rol 'admin'?
    if (req.user && req.user.role === 'admin') {
        // El usuario es un administrador, continuar con la ruta
        next();
    } else {
        // El usuario no es un administrador
        // Seguridad: 403 Forbidden - El servidor entiende, pero se niega a autorizar.
        res.status(403).json({ 
            error: "Acceso denegado. Se requiere rol de Administrador." 
        });
    }
};

export default verifyAdminRole;