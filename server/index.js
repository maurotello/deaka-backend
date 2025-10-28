import 'dotenv/config';
console.log('El valor de JWT_SECRET es:', process.env.JWT_SECRET);

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser'; // Importado correctamente

// 1. Definición ÚNICA y CLARA de las Opciones CORS
const corsOptions = {
    origin: 'http://localhost:3000', 
    credentials: true,    // NECESARIO para enviar y recibir cookies (refresh token)
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


app.listen(PORT, () => {
  console.log('El valor de JWT_SECRET es:', process.env.JWT_SECRET ? 'Cargado correctamente' : 'UNDEFINED');
  console.log(`🚀 Servidor backend corriendo en http://localhost:${PORT}`);
});