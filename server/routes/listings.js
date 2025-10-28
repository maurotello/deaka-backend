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

// 🚨 Importar SOLO las funciones del controlador
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
} from '../controllers/listingTypeController.js'; // 🚨 IMPORTAR NUEVO CONTROLADOR


// =======================================================
// --- CONFIGURACIÓN UNIFICADA DE MULTER (Mantenida aquí) ---
// =======================================================

// 1. FILTRO DE ARCHIVOS (Queda aquí)
const fileFilter = (req, file, cb) => {
    // ... (Tu lógica de filtro) ...
    const allowedTypes = /jpeg|jpg|png|webp/;
    const mimetype = allowedTypes.test(file.mimetype);
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Error: Solo se permiten archivos de imagen (jpeg, jpg, png, webp).'));
};

// 2. STORAGE PARA CREAR listados (usa una carpeta temporal)
const createStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      // 🚨 CRÍTICO: req.tempId debe ser un tipo reconocido. Asegúrate que `req` pueda tener esta propiedad.
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

// 3. STORAGE PARA EDITAR listados (guarda directamente en la carpeta final)
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
// =======================================================


// =======================================================
// --- NUEVO: CONFIGURACIÓN DE MULTER PARA ÍCONOS DE CATEGORÍA ---
// =======================================================

// 4. STORAGE PARA ÍCONOS DE CATEGORÍA
const iconStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        // 🚨 Guardamos directamente en la carpeta final 'public/icons'
        // Ajusta el path si tu estructura de proyecto es diferente
        const dest = path.join(process.cwd(), 'public', 'icons');
        fs.ensureDirSync(dest); // Crea la carpeta si no existe
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        // Usamos el slug del formulario + la extensión original
        // El controlador debe usar este slug para el guardado en DB
        const slug = req.body.slug || uuidv4(); // Usar slug o un ID temporal como fallback
        const extension = path.extname(file.originalname).toLowerCase();
        cb(null, slug + extension); 
    }
});

// Middleware de Multer para la subida de un solo campo 'iconFile'
const uploadIconMiddleware = multer({
    storage: iconStorage,
    fileFilter: fileFilter, // Reutilizamos el filtro de imágenes
    limits: { fileSize: 1024 * 1024 } // Límite de 1MB para íconos
}).single('iconFile'); // 🚨 'iconFile' debe coincidir con el nombre del campo en el Frontend

// =======================================================

const router = express.Router();

// =======================================================
// --- RUTAS DE LA API (Conexión) ---
// =======================================================

// PÚBLICAS
router.get('/categories', getCategories); // 👈 Limpio
router.get('/listings', getMapListings);   // 👈 Limpio (Consulta Geoespacial)

// PROTEGIDAS (USUARIO/DUEÑO)
router.get('/my-listings', verifyToken, getMyListings); // 👈 Limpio
router.get('/listings/:id', verifyToken, getListingForEdit); // 👈 Limpio
router.delete('/listings/:id', verifyToken, deleteListing); // 👈 Limpio

// PROTEGIDAS (CON MULTER)
// 🚨 Nota: Multer se ejecuta antes que el controlador.
router.post('/listings', verifyToken, uploadMiddleware, createListing); // 👈 Limpio
router.post('/listings/:id', verifyToken, multerEditUploader, updateListing); // 👈 Limpio

// PROTEGIDAS (ADMIN)
// 🚨 Nota: requireRole se ejecuta después de verifyToken para garantizar que req.user exista.
router.patch('/listings/:id/status', verifyToken, requireRole(['admin']), updateListingStatus); // 👈 Limpio


//router.get('/categories/parents', getMainCategories); // <--- USAR ESTA EN EL FRONTEND
// 2. SUBCATEGORÍAS (Para el segundo selector dependiente)
//router.get('/categories/:parentId/subcategories', getSubcategories); // <--- USAR ESTA EN EL FRONTEND

router.get('/categories', getCategories); // Ahora solo devuelve padres
router.get('/categories/:parentId/subcategories', getSubcategories); // Devuelve hijos


// RUTAS DE CATEGORÍAS (públicas, no protegidas)
//router.get('/categories', getMainCategories);           // Obtener categorías principales
router.get('/categories/all', getAllCategories);        // Obtener todas (principales + subcategorías)
//router.get('/categories/:parentId/subcategories', getSubcategories); // Obtener subcategorías


// RUTAS DE CATEGORÍAS (protegidas, solo admin)

router.post(
    '/categories', 
    verifyToken, 
    requireRole(['admin']), 
    uploadIconMiddleware, // 🚨 APLICAMOS EL NUEVO MIDDLEWARE DE SUBIDA
    createCategory
);

router.patch(
    '/categories/:id', 
    verifyToken, 
    requireRole(['admin']), 
    uploadIconMiddleware, // 🚨 APLICAMOS EL NUEVO MIDDLEWARE DE SUBIDA
    updateCategory
);
router.delete('/categories/:id', verifyToken, requireRole(['admin']), deleteCategory);



// =======================================================
// --- NUEVAS RUTAS DE TIPOS DE LISTADO ---
// =======================================================

// PÚBLICAS (Necesaria para el selector en /submit)
router.get('/listing-types', getAllListingTypes);

// PROTEGIDAS (ADMIN)
router.post('/listing-types', verifyToken, requireRole(['admin']), createListingType);
router.patch('/listing-types/:id', verifyToken, requireRole(['admin']), updateListingType);
router.delete('/listing-types/:id', verifyToken, requireRole(['admin']), deleteListingType);


router.get('/protected-test', verifyToken, (req, res) => {
  res.json({
    message: 'Acceso a ruta protegida exitoso',
    user: req.user,
  });
});

export default router;