import 'dotenv/config';
console.log('El valor de JWT_SECRET es:', process.env.JWT_SECRET);

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser'; 

// CAMBIO 1: Hacemos la lista de orígenes más robusta y flexible.
// Ya no necesitamos un array estático, lo manejaremos en la función.
// const allowedOrigins = [...]; // Ya no es necesario

// CAMBIO 2: Mejoramos la lógica de corsOptions para aceptar cualquier subdominio de Vercel.
const corsOptions = {
    origin: (origin, callback) => {
        // Permitir solicitudes sin origen (como Postman, apps móviles, etc.)
        if (!origin) return callback(null, true);

        // Verificar si el origen es localhost O si pertenece a tu dominio de Vercel
        const isLocalhost = origin.startsWith('http://localhost:');
        const isVercel = origin.startsWith('https://deaka-frontend-') && origin.endsWith('.vercel.app');

        if (isLocalhost || isVercel) {
            callback(null, true);
        } else {
            console.log('CORS blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true, // CRÍTICO para cookies/refresh token
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], // Añadimos OPTIONS
};

import authRoutes from './routes/auth.js';
import listingRoutes from './routes/listings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// =======================================================
// MIDDLEWARES LIMPIOS Y ORDENADOS
// =======================================================

// CAMBIO 3: Reordenamos los middlewares para mayor robustez.
// 1. CORS (DEBE IR PRIMERO para manejar la política de seguridad)
app.use(cors(corsOptions));

// 2. Habilitar las peticiones pre-flight (OPTIONS) para todas las rutas
app.options('*', cors(corsOptions));

// 3. Body Parser para JSON
app.use(express.json());

// 4. Cookie Parser (para leer req.cookies)
app.use(cookieParser()); 

// 5. Servir archivos estáticos (uploads)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// =======================================================
// RUTAS PROXY DE GEOREF (DEFINICIÓN)
// =======================================================
const georefRouter = express.Router();

georefRouter.get('/georef/provincias', async (req, res) => {
    try {
        const response = await fetch('https://apis.datos.gob.ar/georef/api/provincias?campos=id,nombre');
        const data = await response.json();
        res.status(200).json(data);
    } catch (error) {
        console.error('Error fetching provincias:', error);
        res.status(500).json({ message: 'Error interno al buscar provincias', error: error.message });
    }
});

georefRouter.get('/georef/localidades/:idProvincia', async (req, res) => {
    const { idProvincia } = req.params;
    try {
        const url = `https://apis.datos.gob.ar/georef/api/localidades?provincia=${idProvincia}&max=1000&campos=id,nombre`;
        const response = await fetch(url);
        
        if (!response.ok) {
            return res.status(response.status).json({ message: 'Error de la API de Georef', url: url });
        }
        
        const data = await response.json();
        res.status(200).json(data);
    } catch (error) {
        console.error('Error fetching localidades:', error);
        res.status(500).json({ message: 'Error interno al buscar localidades', error: error.message });
    }
});

// =======================================================
// USO DE RUTAS
// =======================================================
app.use('/api/auth', authRoutes);
app.use('/api', listingRoutes);
app.use('/api', georefRouter);

app.get('/', (req, res) => {
    res.status(200).json({ message: "Atlas Backend API v1.0 running successfully!" });
});

app.listen(PORT, () => {
    console.log('El valor de JWT_SECRET es:', process.env.JWT_SECRET ? 'Cargado correctamente' : 'UNDEFINED');
});