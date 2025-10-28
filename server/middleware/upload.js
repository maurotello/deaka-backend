// server/middleware/upload.js
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

// 🚨 Define __dirname para módulos ES6
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuración de almacenamiento: guardamos en public/icons
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        // Asume que la carpeta 'public/icons' existe en la raíz del proyecto Next.js
        // Ajusta la ruta si es necesario (ej: path.join(__dirname, '..', '..', 'public', 'icons'))
        cb(null, path.join(process.cwd(), 'public', 'icons')); 
    },
    filename: (req, file, cb) => {
        // Usamos el slug de la categoría como nombre de archivo para evitar colisiones
        // y para que el nombre coincida con el marker_icon_slug
        //const slug = req.body.slug || 'temp'; 
        const tempFilename = `${uuidv4()}`;
        const extension = path.extname(file.originalname).toLowerCase();
        cb(null, tempFilename + extension);
    }
});

// Filtro para aceptar solo imágenes
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        cb(new Error('Solo se permiten archivos de imagen.'), false);
    }
};

// Middleware de Multer
const uploadIcon = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 1024 * 1024 * 5 } // 5MB límite
}).single('iconFile'); // 'iconFile' debe coincidir con el nombre de campo en el Frontend

export default uploadIcon;