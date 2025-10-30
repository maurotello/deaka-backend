import 'dotenv/config';
console.log('El valor de JWT_SECRET es:', process.env.JWT_SECRET);

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser'; // Importado correctamente
import fetch from 'node-fetch'; // <--- 1. IMPORTACIÓN NECESARIA PARA LAS RUTAS PROXY


// 1. Definir los orígenes permitidos
const allowedOrigins = [
    'https://deaka-frontend.vercel.app', // <-- OK: Dominio de Producción de Vercel
    'http://localhost:3000',             // <-- OK: Mantener: Para desarrollo local del frontend
    'http://localhost:3001',             // <-- OK: Agregado para tu otro puerto local (si aplica)
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
// RUTAS
// =======================================================
app.use('/api/auth', authRoutes);
app.use('/api', listingRoutes);

// ******* NUEVO *******
// Ruta de prueba simple para la raíz del servidor
app.get('/', (req, res) => {
    res.status(200).json({ message: "Atlas Backend API v1.0 running successfully!" });
});
// ******* FIN NUEVO *******


// =======================================================
// RUTAS PROXY PARA API GEOREF ARGENTINA (AÑADIDAS AQUÍ)
// =======================================================

// PROXY 1: Obtener Provincias
app.get('/api/georef/provincias', async (req, res) => { // Endpoint nuevo y fácil de recordar
    const externalApiUrl = 'https://apis.datos.gob.ar/georef/api/provincias?campos=id,nombre';

    try {
        // Petición de SERVIDOR a SERVIDOR (no hay CORS)
        const response = await fetch(externalApiUrl);
        
        if (!response.ok) {
            console.error(`External API responded with status: ${response.status}`);
            return res.status(response.status).json({ 
                error: 'Fallo al obtener datos de la API externa de Provincias',
            });
        }
        
        const data = await response.json();
        // Devolvemos la data al frontend (Render->Vercel, permitido por corsOptions)
        res.status(200).json(data);

    } catch (error) {
        console.error("Error en la ruta proxy de Provincias:", error.message);
        res.status(500).json({ error: 'Error interno del servidor al procesar la solicitud de provincias' });
    }
});

// PROXY 2: Obtener Localidades
app.get('/api/georef/localidades/:idProvincia', async (req, res) => {
    const idProvincia = req.params.idProvincia;

    // Se reconstruye la URL externa con el parámetro dinámico
    const externalApiUrl = `https://apis.datos.gob.ar/georef/api/localidades?provincia=${idProvincia}&max=1000&campos=id,nombre`;

    try {
        // Petición de SERVIDOR a SERVIDOR (no hay CORS)
        const response = await fetch(externalApiUrl);
        
        if (!response.ok) {
             console.error(`External API responded with status: ${response.status}`);
            return res.status(response.status).json({ 
                error: 'Fallo al obtener datos de la API externa de Localidades',
            });
        }
        
        const data = await response.json();
        // Devolvemos la data al frontend (Render->Vercel, permitido por corsOptions)
        res.status(200).json(data);

    } catch (error) {
        console.error(`Error en la ruta proxy de Localidades para provincia ${idProvincia}:`, error.message);
        res.status(500).json({ error: 'Error interno del servidor al procesar la solicitud de localidades' });
    }
});


app.listen(PORT, () => {
  console.log('El valor de JWT_SECRET es:', process.env.JWT_SECRET ? 'Cargado correctamente' : 'UNDEFINED');
});

// Recordatorio: Debes instalar 'node-fetch' si aún no lo tienes: npm install node-fetch
