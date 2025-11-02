// server/middleware/upload.js
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';

// =======================================================
// 🔥 CONFIGURACIÓN PARA CLOUDINARY
// =======================================================
// Ya NO usamos diskStorage, ahora usamos memoryStorage
// porque vamos a subir directamente a Cloudinary desde el buffer

// =======================================================
// 1. MULTER PARA ICONOS DE CATEGORÍAS (si es que los usas)
// =======================================================
const iconStorage = multer.memoryStorage(); // 🔥 CAMBIO: memoria en lugar de disco

const iconFileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Solo se permiten archivos de imagen.'), false);
    }
};

export const uploadIcon = multer({
    storage: iconStorage,
    fileFilter: iconFileFilter,
    limits: { fileSize: 1024 * 1024 * 5 } // 5MB límite
}).single('iconFile');

// =======================================================
// 2. 🔥 MULTER PARA LISTINGS (coverImage + galleryImages)
// =======================================================
const listingStorage = multer.memoryStorage(); // 🔥 Guardamos en memoria (buffer)

const listingFileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de archivo no permitido. Solo JPG, PNG y WEBP.'), false);
    }
};

// 🔥 Middleware para generar tempId ANTES de subir archivos
export const generateTempId = (req, res, next) => {
    req.tempId = uuidv4();
    console.log('📝 TempId generado:', req.tempId);
    next();
};

// 🔥 Middleware principal para listings
export const uploadListingImages = multer({
    storage: listingStorage,
    fileFilter: listingFileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB por archivo
        files: 11 // Máximo 1 cover + 10 galería
    }
}).fields([
    { name: 'coverImage', maxCount: 1 },
    { name: 'galleryImages', maxCount: 10 }
]);

// =======================================================
// 3. EXPORTAR POR DEFECTO (para mantener compatibilidad)
// =======================================================
export default uploadIcon;