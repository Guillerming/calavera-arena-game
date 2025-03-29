import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';

const server = http.createServer();
const wss = new WebSocketServer({ server });

// Almacenar información de los jugadores conectados
const players = new Map();

// Manejar nuevas conexiones
wss.on('connection', (ws) => {
    // Generar ID único para el jugador
    const playerId = Math.random().toString(36).substring(7);
    
    // Almacenar información del jugador
    players.set(playerId, {
        id: playerId,
        position: { x: 0, y: 0, z: 0 },
        rotation: { y: 0 }
    });

    // Enviar ID al jugador
    ws.send(JSON.stringify({
        type: 'init',
        id: playerId
    }));

    // Enviar lista de jugadores existentes al nuevo jugador
    const existingPlayers = Array.from(players.values())
        .filter(p => p.id !== playerId);
    ws.send(JSON.stringify({
        type: 'players',
        players: existingPlayers
    }));

    // Notificar a otros jugadores sobre el nuevo jugador
    broadcast({
        type: 'newPlayer',
        player: players.get(playerId)
    }, ws);

    // Manejar mensajes del jugador
    ws.on('message', (message) => {
        const data = JSON.parse(message);
        
        switch (data.type) {
            case 'update':
                // Actualizar posición y rotación del jugador
                const player = players.get(playerId);
                if (player) {
                    player.position = data.position;
                    player.rotation = data.rotation;
                    
                    // Broadcast de la actualización a otros jugadores
                    broadcast({
                        type: 'playerUpdate',
                        id: playerId,
                        position: data.position,
                        rotation: data.rotation
                    }, ws);
                }
                break;
        }
    });

    // Manejar desconexión
    ws.on('close', () => {
        players.delete(playerId);
        broadcast({
            type: 'playerLeft',
            id: playerId
        });
    });
});

// Función para enviar mensajes a todos los clientes excepto al remitente
function broadcast(data, exclude = null) {
    wss.clients.forEach(client => {
        if (client !== exclude && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

// Iniciar servidor
const PORT = process.env.PORT || 8050;
server.listen(PORT, () => {
    console.log(`Servidor WebSocket corriendo en el puerto ${PORT}`);
});