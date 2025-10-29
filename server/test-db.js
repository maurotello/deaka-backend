// backend/server/test-db.js
import db from './db.js';

console.log('🔍 Probando conexión a la base de datos...');

// Espera un poco para que la función testConnection() se ejecute
setTimeout(() => {
    console.log('Test completado. Revisa los mensajes arriba.');
    process.exit(0);
}, 3000);