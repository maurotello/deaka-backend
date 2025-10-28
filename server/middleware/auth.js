import jwt from 'jsonwebtoken';

function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.status(401).json({ error: 'Acceso denegado.' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Token no válido.' });
        req.user = user;
        next();
    });
}

export default verifyToken;
/*
const jwt = require('jsonwebtoken');

function verifyToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Formato "Bearer TOKEN"

    if (token == null) return res.sendStatus(401); // No hay token, no autorizado

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403); // Token no es válido, prohibido
        
        // El token es válido, guardamos el payload (que contiene el id) en el objeto 'req'
        req.user = user; 
        next(); // Continuamos a la siguiente función (el controlador de la ruta)
    });
}

module.exports = verifyToken;
*/