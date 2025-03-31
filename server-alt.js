import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeWebSocketServer } from './src/server/server.js';
import net from 'net';

// Obtener el __dirname en ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Función para comprobar si un puerto está disponible
function isPortAvailable(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        
        server.once('error', () => {
            resolve(false); // Puerto en uso
        });
        
        server.once('listening', () => {
            server.close();
            resolve(true); // Puerto disponible
        });
        
        server.listen(port);
    });
}

// Función para encontrar un puerto disponible
async function findAvailablePort(startPort, maxAttempts = 10) {
    let port = startPort;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
        if (await isPortAvailable(port)) {
            return port;
        }
        port++;
        attempts++;
    }
    
    throw new Error(`No se encontró un puerto disponible después de ${maxAttempts} intentos`);
}

// Iniciar el servidor en un puerto disponible
async function startServer() {
    try {
        // Crear app Express
        const app = express();
        const preferredPort = process.env.PORT || 8080;
        
        // Encontrar un puerto disponible
        const PORT = await findAvailablePort(preferredPort);
        
        // Servir archivos estáticos
        app.use(express.static(__dirname));
        
        // Crear servidor HTTP
        const server = http.createServer(app);
        
        // Crear servidor WebSocket usando el mismo servidor HTTP
        const wss = new WebSocketServer({ server });
        
        // Inicializar el servidor WebSocket con nuestro servidor y wss
        initializeWebSocketServer(server, wss);
        
        // Iniciar el servidor combinado
        server.listen(PORT, () => {
            console.log(`Servidor arrancado en puerto ${PORT}`);
            console.log(`Abre http://localhost:${PORT} para jugar`);
        });
    } catch (error) {
        console.error('Error al iniciar el servidor:', error);
    }
}

// Iniciar el servidor
startServer(); 