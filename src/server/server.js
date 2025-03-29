import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';

const server = http.createServer();
const wss = new WebSocketServer({ server });

// Almacenar información de los jugadores conectados
const players = new Map();
const projectiles = new Map();

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

            case 'fireProjectile':
                // Crear nuevo proyectil
                const projectile = {
                    id: data.projectile.id,
                    playerId: data.projectile.playerId,
                    position: data.projectile.position,
                    velocity: data.projectile.velocity,
                    rotationSpeed: data.projectile.rotationSpeed
                };
                
                // Guardar el proyectil
                projectiles.set(projectile.id, projectile);
                
                // Enviar el proyectil a todos los clientes
                broadcast({
                    type: 'newProjectile',
                    projectile: projectile
                });
                break;

            case 'removeProjectile':
                // Eliminar proyectil
                projectiles.delete(data.projectileId);
                
                // Notificar a todos los clientes
                broadcast({
                    type: 'removeProjectile',
                    projectileId: data.projectileId,
                    playerId: data.playerId
                });
                break;
                
            case 'projectileCollision':
                // Reenviar información de colisión a todos los clientes
                broadcast({
                    type: 'projectileCollision',
                    projectileId: data.projectileId,
                    playerId: data.playerId,
                    position: data.position,
                    collisionType: data.collisionType
                });
                break;
        }
    });

    // Manejar desconexión
    ws.on('close', () => {
        // Eliminar todos los proyectiles del jugador
        for (const [projectileId, projectile] of projectiles.entries()) {
            if (projectile.playerId === playerId) {
                projectiles.delete(projectileId);
                broadcast({
                    type: 'removeProjectile',
                    projectileId: projectileId
                });
            }
        }

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