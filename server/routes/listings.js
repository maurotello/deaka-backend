import express from 'express';
import verifyToken from '../middleware/auth.js';
import { requireRole } from '../middleware/requireRole.js';
import fs from 'fs-extra';
import path from 'path';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import {
    getMainCategories,
    getAllCategories,
    getSubcategories,
    createCategory,
    updateCategory,
    deleteCategory
} from '../controllers/categoryController.js';

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

import {
    getAllListingTypes,
    createListingType,
    updateListingType,
    deleteListingType
} from '../controllers/listingTypeController.js';

// =======================================================
// --- CONFIGURACIÓN UNIFICADA DE MULTER ---
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

const createStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (!req.tempId) req.tempId = uuidv4();
        const dest = path.join('uploads', req.tempId, file.fieldname);
        fs.mkdirsSync(dest);
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const uploadMiddleware = multer({
    storage: createStorage,
    fileFilter: fileFilter,
    limits: { fileSize: 2 * 1024 * 1024 }
}).fields([
    { name: 'coverImage', maxCount: 1 },
    { name: 'galleryImages', maxCount: 6 }
]);

const editStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const listingId = req.params.id;
        const dest = path.join('uploads', listingId, file.fieldname);
        fs.mkdirsSync(dest);
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const multerEditUploader = multer({
    storage: editStorage,
    fileFilter: fileFilter,
    limits: { fileSize: 2 * 1024 * 1024 }
}).fields([
    { name: 'coverImage', maxCount: 1 },
    { name: 'galleryImages', maxCount: 6 }
]);

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
router.get('/my-listings', verifyToken, getMyListings); // 🔥 DESCOMENTADA
router.get('/listings/:id', verifyToken, getListingForEdit);
router.delete('/listings/:id', verifyToken, deleteListing);

// PROTEGIDAS (CON MULTER)
router.post('/listings', verifyToken, uploadMiddleware, createListing);
router.post('/listings/:id', verifyToken, multerEditUploader, updateListing);

// PROTEGIDAS (ADMIN)
router.patch('/listings/:id/status', verifyToken, requireRole(['admin']), updateListingStatus);

// =======================================================
// --- RUTAS DE CATEGORÍAS ---
// =======================================================

// PÚBLICAS (Para el formulario de submit)
router.get('/categories', getCategories); // 🔥 Devuelve solo padres
router.get('/categories/all', getAllCategories); // 🔥 DESCOMENTADA - Devuelve todas
router.get('/categories/:parentId/subcategories', getSubcategories); // 🔥 DESCOMENTADA

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
router.get('/listing-types', getAllListingTypes); // 🔥 DESCOMENTADA

// PROTEGIDAS (ADMIN)
router.post('/listing-types', verifyToken, requireRole(['admin']), createListingType);
router.patch('/listing-types/:id', verifyToken, requireRole(['admin']), updateListingType);
router.delete('/listing-types/:id', verifyToken, requireRole(['admin']), deleteListingType);

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