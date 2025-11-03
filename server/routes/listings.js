import express from 'express';
import verifyToken from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs-extra';
import * as listingController from '../controllers/listingController.js';
import {
    getMainCategories,
    getAllCategories,
    getSubcategories,
    createCategory,
    updateCategory,
    deleteCategory
} from '../controllers/categoryController.js';

/*
import {
    getCategories,
    getMapListings,
    getMyListings,
    updateListingStatus,
    deleteListing,
    getListingForEdit,
    createListing,
    updateListing
} from '../controllers/listingController.js';
*/
import {
    getAllListingTypes,
    createListingType,
    updateListingType,
    deleteListingType
} from '../controllers/listingTypeController.js';

// =======================================================
// 🔥 CONFIGURACIÓN DE MULTER PARA CLOUDINARY
// =======================================================

const fileFilter = (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|webp/;
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
        return cb(null, true);
    }
    cb(new Error('Error: Solo se permiten archivos de imagen (jpeg, jpg, png, webp).'));
};

// 🔥 MIDDLEWARE: Generar tempId antes de subir
const generateTempId = (req, res, next) => {
    req.tempId = uuidv4();
    console.log('📝 TempId generado:', req.tempId);
    next();
};

// 🔥 MULTER PARA LISTINGS - AHORA USA MEMORIA (no disco)
const listingStorage = multer.memoryStorage(); // 🔥 CAMBIO CRÍTICO

const uploadListingMiddleware = multer({
    storage: listingStorage, // 🔥 Ahora guardamos en memoria (buffer)
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB por archivo
}).fields([
    { name: 'coverImage', maxCount: 1 },
    { name: 'galleryImages', maxCount: 10 }
]);

// 🔥 MULTER PARA EDICIÓN - TAMBIÉN USA MEMORIA
const uploadEditMiddleware = multer({
    storage: listingStorage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
}).fields([
    { name: 'coverImage', maxCount: 1 },
    { name: 'galleryImages', maxCount: 10 }
]);

// =======================================================
// 🔥 MULTER PARA ICONOS DE CATEGORÍAS
// =======================================================
// ESTOS TODAVÍA USAN DISCO LOCAL (public/icons)
// Si quieres, después los puedes migrar a Cloudinary también

const iconStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dest = path.join(process.cwd(), 'public', 'icons');
        fs.ensureDirSync(dest);
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        const slug = req.body.slug || uuidv4();
        const extension = path.extname(file.originalname).toLowerCase();
        cb(null, slug + extension);
    }
});

const uploadIconMiddleware = multer({
    storage: iconStorage,
    fileFilter: fileFilter,
    limits: { fileSize: 1024 * 1024 }
}).single('iconFile');

// =======================================================
// --- ROUTER ---
// =======================================================

const router = express.Router();

// =======================================================
// --- RUTAS DE LISTINGS (PÚBLICAS Y PROTEGIDAS) ---
// =======================================================

// PÚBLICAS
router.get('/listings', getMapListings);

// PROTEGIDAS (USUARIO/DUEÑO)
router.get('/my-listings', verifyToken, getMyListings);
router.get('/listings/:id', verifyToken, getListingForEdit);
router.delete('/listings/:id', verifyToken, deleteListing);

// 🔥 PROTEGIDAS (CON MULTER CLOUDINARY)
router.post(
    '/listings',
    verifyToken,
    generateTempId,              // 🔥 NUEVO: Genera ID temporal
    uploadListingMiddleware,     // 🔥 ACTUALIZADO: Usa memoryStorage
    createListing
);

router.post(
    '/listings/:id',
    verifyToken,
    uploadEditMiddleware,        // 🔥 ACTUALIZADO: Usa memoryStorage
    updateListing
);

// PROTEGIDAS (ADMIN)
router.patch('/listings/:id/status', verifyToken, requireRole(['admin']), updateListingStatus);

// =======================================================
// --- RUTAS DE CATEGORÍAS ---
// =======================================================

// PÚBLICAS (Para el formulario de submit)
router.get('/categories', getCategories);
router.get('/categories/all', getAllCategories);
router.get('/categories/:parentId/subcategories', getSubcategories);

// PROTEGIDAS (ADMIN)
router.post(
    '/categories',
    verifyToken,
    requireRole(['admin']),
    uploadIconMiddleware,
    createCategory
);

router.patch(
    '/categories/:id',
    verifyToken,
    requireRole(['admin']),
    uploadIconMiddleware,
    updateCategory
);

router.delete('/categories/:id', verifyToken, requireRole(['admin']), deleteCategory);

// =======================================================
// --- RUTAS DE TIPOS DE LISTADO ---
// =======================================================

// PÚBLICAS (Para el selector en /submit)
router.get('/listing-types', getAllListingTypes);

// PROTEGIDAS (ADMIN)
router.post('/listing-types', verifyToken, requireRole(['admin']), createListingType);
router.patch('/listing-types/:id', verifyToken, requireRole(['admin']), updateListingType);
router.delete('/listing-types/:id', verifyToken, requireRole(['admin']), deleteListingType);


// 🔥 NUEVA RUTA: Obtener el esquema de campos dinámicos
// No requiere autenticación si solo devuelve datos de configuración, pero la añadimos por consistencia.
router.get('/listing-types/:id/schema', listingController.getListingSchema);

// =======================================================
// --- RUTA DE PRUEBA ---
// =======================================================

router.get('/protected-test', verifyToken, (req, res) => {
    res.json({
        message: 'Acceso a ruta protegida exitoso',
        user: req.user,
    });
});

export default router;