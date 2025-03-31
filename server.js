import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeWebSocketServer } from './src/server/server.js';

// Obtener el __dirname en ES module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Crear app Express
const app = express();
const PORT = process.env.PORT || 8081;

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