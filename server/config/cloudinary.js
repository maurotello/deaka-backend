// ============================================
// PASO 1: Instalar dependencias
// ============================================
// npm install cloudinary multer-storage-cloudinary

// ============================================
// PASO 2: Crear config/cloudinary.js
// ============================================
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';

// Configurar Cloudinary
const cloudConfig = {
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
};

console.log('🔧 [Cloudinary Config] Cloud Name:', cloudConfig.cloud_name || 'MISSING');
console.log('🔧 [Cloudinary Config] API Key:', cloudConfig.api_key ? '***' + cloudConfig.api_key.slice(-4) : 'MISSING');
console.log('🔧 [Cloudinary Config] API Secret:', cloudConfig.api_secret ? 'EXISTS' : 'MISSING');

cloudinary.config(cloudConfig);

// Storage para la imagen de portada
export const coverImageStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: (req, file) => `listings/${req.tempId || 'temp'}/coverImage`,
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [
            { width: 1200, height: 800, crop: 'limit' }, // Redimensionar
            { quality: 'auto' } // Calidad automática
        ],
    },
});

// Storage para la galería de imágenes
export const galleryStorage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: (req, file) => `listings/${req.tempId || 'temp'}/gallery`,
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [
            { width: 1200, height: 800, crop: 'limit' },
            { quality: 'auto' }
        ],
    },
});

export default cloudinary;