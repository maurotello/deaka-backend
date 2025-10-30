import 'dotenv/config';
console.log('El valor de JWT_SECRET es:', process.env.JWT_SECRET);

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser'; 


// 1. Definir los orígenes permitidos
const allowedOrigins = [
    'https://deaka-frontend.vercel.app', 
    'http://localhost:3000', 
    'http://localhost:3001', 
];


const corsOptions = {
    // Usar una función para verificar si el "origin" que llega está en la lista de permitidos
    origin: (origin, callback) => {
        // Permitir solicitudes sin origen (como Postman o peticiones del mismo servidor)
        // O si el origen está en la lista blanca
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            // Opcional: registrar el origen bloqueado para debug
            console.log('CORS blocked origin:', origin); 
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true, // CRÍTICO para cookies/refresh token
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], 
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

// 1. Cookie Parser (DEBE IR PRIMERO para leer req.cookies)
app.use(cookieParser()); 

// 2. CORS (Aplicamos la configuración ÚNICA y estricta)
app.use(cors(corsOptions)); 

// 3. Body Parser para JSON
app.use(express.json());

// 4. Servir archivos estáticos (uploads)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// =======================================================
// RUTAS PROXY DE GEOREF (DEFINICIÓN)
// Usamos un Router para agrupar las rutas de Georef
// =======================================================
const georefRouter = express.Router();

// Ruta: /georef/provincias
georefRouter.get('/georef/provincias', async (req, res) => {
    // Usamos fetch nativo de Node.js (v18+)
    try {
        const response = await fetch('https://apis.datos.gob.ar/georef/api/provincias?campos=id,nombre');
        const data = await response.json();
        res.status(200).json(data);
    } catch (error) {
        console.error('Error fetching provincias:', error);
        res.status(500).json({ message: 'Error interno al buscar provincias', error: error.message });
    }
});

// Ruta: /georef/localidades/:idProvincia
georefRouter.get('/georef/localidades/:idProvincia', async (req, res) => {
    const { idProvincia } = req.params;
    
    // Usamos fetch nativo de Node.js (v18+)
    try {
        const url = `https://apis.datos.gob.ar/georef/api/localidades?provincia=${idProvincia}&max=1000&campos=id,nombre`;
        const response = await fetch(url);
        
        if (!response.ok) {
            // Manejar errores de la API externa
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

// Montamos el router de Georef bajo el prefijo /api
// Las rutas ahora serán /api/georef/provincias
app.use('/api', georefRouter);

// Ruta de prueba simple para la raíz del servidor
app.get('/', (req, res) => {
    res.status(200).json({ message: "Atlas Backend API v1.0 running successfully!" });
});


app.listen(PORT, () => {
    console.log('El valor de JWT_SECRET es:', process.env.JWT_SECRET ? 'Cargado correctamente' : 'UNDEFINED');
});
