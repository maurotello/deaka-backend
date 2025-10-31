import 'dotenv/config';
console.log('El valor de JWT_SECRET es:', process.env.JWT_SECRET);

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import fs from 'fs/promises'; 

// 1. Definir los orígenes permitidos
const allowedOrigins = [
    // 1. LOCALHOSTS
    'http://localhost:3000',
    'http://localhost:3001',
    // 2. DOMINIO DE PRODUCCIÓN VERCEL (sin guion)
    'https://deaka-frontend.vercel.app',
];

// 2. Expresión regular para CUALQUIER dominio de preview de Vercel
// Acepta: https://deaka-frontend-lz5ywf373-maurotellos-projects.vercel.app
const VERCEL_PREVIEW_REGEX = /^https:\/\/deaka-frontend-.*\.vercel\.app$/;

const corsOptions = {
    origin: (origin, callback) => {
        // Permitir solicitudes sin origen (como Postman o peticiones del mismo servidor)
        if (!origin) return callback(null, true);

        // 3. Verificar si el origen coincide con la lista estática O el patrón dinámico
        const isAllowed = allowedOrigins.includes(origin) || VERCEL_PREVIEW_REGEX.test(origin);

        if (isAllowed) {
            callback(null, true);
        } else {
            console.log('CORS blocked origin:', origin);
            callback(new Error(`Not allowed by CORS: ${origin}`));
        }
    },
    credentials: true, // CRÍTICO para cookies/refresh token
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
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
// RUTAS PROXY DE GEOREF (LEYENDO ARCHIVOS JSON)
// =======================================================
const georefRouter = express.Router();

georefRouter.get('/georef/provincias', async (req, res) => {
    try {
        // Construimos la ruta absoluta al archivo
        const filePath = path.join(__dirname, 'data', 'provincias.json');
        
        // Leemos el contenido del archivo de forma asíncrona
        const fileContent = await fs.readFile(filePath, 'utf8');
        
        // Parseamos el string a un objeto JSON
        const data = JSON.parse(fileContent);
        
        // Enviamos los datos
        res.status(200).json(data);
    } catch (error) {
        console.error('Error al leer el archivo de provincias:', error);
        res.status(500).json({ message: 'Error interno al leer provincias (Verificar si data/provincias.json existe en Render)', error: (error as Error).message });
    }
});

georefRouter.get('/georef/localidades/:idProvincia', async (req, res) => {
    const { idProvincia } = req.params;
    
    try {
        // Construimos la ruta absoluta al archivo
        const filePath = path.join(__dirname, 'data', 'localidades.json');
        
        // Leemos el contenido del archivo de forma asíncrona
        const fileContent = await fs.readFile(filePath, 'utf8');
        
        // Parseamos el string a un objeto JSON
        const data = JSON.parse(fileContent);
        
        // Filtramos las localidades por el ID de la provincia
        const localidadesFiltradas = data.localidades.filter(localidad => 
            localidad.provincia.id === idProvincia
        );
        
        // Construimos la respuesta con la misma estructura que la API original
        const respuesta = {
            cantidad: localidadesFiltradas.length,
            total: localidadesFiltradas.length,
            inicio: 0,
            parametros: {
                provincia: idProvincia,
                max: 1000,
                campos: ["id", "nombre"]
            },
            localidades: localidadesFiltradas.map(l => ({ id: l.id, nombre: l.nombre }))
        };
        
        // Enviamos los datos filtrados
        res.status(200).json(respuesta);
    } catch (error) {
        console.error('Error al leer el archivo de localidades:', error);
        res.status(500).json({ message: 'Error interno al leer localidades (Verificar si data/localidades.json existe en Render)', error: (error as Error).message });
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
