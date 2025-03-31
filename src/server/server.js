import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';

const server = http.createServer();
const wss = new WebSocketServer({ server });

// Almacenar información de los jugadores conectados
const players = new Map();
const projectiles = new Map();

// Configuraciones del juego
const CONFIG = {
    PROJECTILE_DAMAGE: 25,     // Daño que causa un proyectil
    PLAYER_START_HEALTH: 100,  // Salud inicial del jugador
    RESPAWN_TIME: 3000,        // Tiempo de respawn en ms
    MAX_PROJECTILE_RANGE: 200, // Distancia máxima que puede recorrer un proyectil
    COLLISION_RADIUS: 1.5,     // Radio de colisión de los jugadores
    MAP_LIMITS: {              // Límites del mapa (mismo que en el cliente)
        minX: -195,
        maxX: 195,
        minZ: -195,
        maxZ: 195
    },
    // Configuración del modo calavera
    SKULL_MODE: {
        NORMAL_MODE_DURATION: 60 * 0.5, // 30 segundos (en segundos) - modo normal
        SKULL_MODE_DURATION: 60 * 2,    // 2 minutos (en segundos) - modo calavera
        SKULL_RADIUS: 1                 // Radio de detección (unidades)
    }
};

// Estado del modo calavera
const skullGameState = {
    isSkullModeActive: false,      // Indica si estamos en modo calavera
    countdown: CONFIG.SKULL_MODE.NORMAL_MODE_DURATION, // Contador para el próximo cambio de modo
    lastUpdateTime: Date.now(),    // Tiempo de la última actualización
    skullPosition: { x: 0, y: 3, z: 0 }, // Posición de la calavera
    isSkullCaptured: false,        // Indica si la calavera ya fue capturada
    skullCapturingPlayer: null,     // Jugador que está capturando la calavera
    timeSinceLastBroadcast: 0      // Tiempo desde la última transmisión a clientes
};

// Manejar nuevas conexiones
wss.on('connection', (ws) => {
    // Generar ID único para el jugador
    const playerId = Math.random().toString(36).substring(7);
    
    // Almacenar información del jugador
    players.set(playerId, {
        id: playerId,
        name: playerId, // Inicialmente el nombre es el mismo que el ID
        position: { x: 0, y: 0, z: 0 },
        rotation: { y: 0 },
        health: CONFIG.PLAYER_START_HEALTH,
        isAlive: true,
        lastUpdateTime: Date.now()
    });

    // Guardar referencia al ID en el objeto WebSocket para identificar al jugador
    ws.playerId = playerId;

    // Enviar ID al jugador
    ws.send(JSON.stringify({
        type: 'init',
        id: playerId
    }));

    console.log(`[SERVER] Nuevo jugador conectado: ${playerId}`);

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
        try {
            const data = JSON.parse(message);
            
            if (data.type !== 'update') {
                console.log(`[SERVER] Recibido mensaje de tipo: ${data.type}`);
            }
            
            // Obtener ID del jugador desde el WebSocket
            const playerId = ws.playerId;
            
            // Verificar que el jugador existe
            if (!players.has(playerId)) {
                console.error(`[SERVER] Error: Mensaje recibido de jugador inexistente: ${playerId}`);
                return;
            }
            
            const player = players.get(playerId);
            player.lastUpdateTime = Date.now(); // Actualizar timestamp de actividad
            
            switch (data.type) {
                case 'setName':
                    // Actualizar el nombre del jugador si se proporciona
                    if (data.name) {
                        player.name = data.name;
                        console.log(`[SERVER] Jugador ${playerId} estableció nombre: ${data.name}`);
                        
                        // Actualizar a otros jugadores
                        broadcast({
                            type: 'playerUpdate',
                            id: playerId,
                            name: data.name,
                            position: player.position,
                            rotation: player.rotation
                        });
                    }
                    break;
                    
                case 'update':
                    // Actualizar posición y rotación del jugador
                    // Solo si el jugador está vivo
                    if (player.isAlive) {
                        // Verificar que la posición está dentro de los límites del mapa
                        const isPositionValid = 
                            data.position.x >= CONFIG.MAP_LIMITS.minX && 
                            data.position.x <= CONFIG.MAP_LIMITS.maxX &&
                            data.position.z >= CONFIG.MAP_LIMITS.minZ && 
                            data.position.z <= CONFIG.MAP_LIMITS.maxZ;
                        
                        if (!isPositionValid) {
                            console.log(`[SERVER] Posición inválida para jugador ${playerId}: [${data.position.x.toFixed(2)}, ${data.position.z.toFixed(2)}]`);
                            // No actualizar posición y no propagar
                            return;
                        }
                        
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
                    // Solo permitir disparos si el jugador está vivo
                    if (!player.isAlive) {
                        console.log(`[SERVER] Jugador muerto intentó disparar: ${playerId}`);
                        return;
                    }
                    
                    // Verificar que el proyectil está dentro de los límites del mapa
                    const projectilePos = data.projectile.position;
                    console.log(`[SERVER] Jugador en posición [${player.position.x.toFixed(2)}, ${player.position.z.toFixed(2)}] dispara desde [${projectilePos.x.toFixed(2)}, ${projectilePos.z.toFixed(2)}]`);
                    
                    // Calcular distancia entre jugador y punto de disparo
                    const dx = player.position.x - projectilePos.x;
                    const dz = player.position.z - projectilePos.z;
                    const distancia = Math.sqrt(dx*dx + dz*dz);
                    
                    // Si hay una distancia muy grande entre jugador y proyectil, hay un problema
                    if (distancia > 5) {
                        console.log(`[SERVER] ALERTA: Gran distancia (${distancia.toFixed(2)}) entre jugador y punto de disparo`);
                    }
                    
                    // Verificar si la posición inicial está dentro de los límites
                    const isWithinLimits = 
                        projectilePos.x >= CONFIG.MAP_LIMITS.minX && 
                        projectilePos.x <= CONFIG.MAP_LIMITS.maxX &&
                        projectilePos.z >= CONFIG.MAP_LIMITS.minZ && 
                        projectilePos.z <= CONFIG.MAP_LIMITS.maxZ;
                    
                    if (!isWithinLimits) {
                        console.log(`[SERVER] Proyectil rechazado: posición inicial fuera de límites [${projectilePos.x.toFixed(2)}, ${projectilePos.z.toFixed(2)}]`);
                        return;
                    }
                    
                    // Crear nuevo proyectil
                    const projectile = {
                        id: data.projectile.id,
                        playerId: playerId, // Usar el ID del servidor, no el proporcionado
                        position: data.projectile.position,
                        velocity: data.projectile.velocity,
                        rotationSpeed: data.projectile.rotationSpeed,
                        creationTime: Date.now(),
                        lastPosition: { ...data.projectile.position } // Guardar posición para cálculos de colisión
                    };
                    
                    // Guardar el proyectil
                    projectiles.set(projectile.id, projectile);
                    
                    // Enviar el proyectil a todos los clientes
                    broadcast({
                        type: 'newProjectile',
                        projectile: {
                            id: projectile.id,
                            playerId: playerId,
                            position: projectile.position,
                            velocity: projectile.velocity,
                            rotationSpeed: projectile.rotationSpeed
                        }
                    });
                    break;

                case 'removeProjectile':
                    // Verificar que el proyectil pertenece a este jugador antes de eliminarlo
                    const projectileToRemove = projectiles.get(data.projectileId);
                    if (projectileToRemove && projectileToRemove.playerId === playerId) {
                        projectiles.delete(data.projectileId);
                        
                        // Notificar a todos los clientes
                        broadcast({
                            type: 'removeProjectile',
                            projectileId: data.projectileId,
                            playerId: playerId
                        });
                    }
                    break;
                    
                case 'projectileCollision':
                    // El cliente informa de una colisión, pero el servidor decide si es válida
                    handleProjectileCollision(data);
                    break;
                    
                case 'healthUpdate':
                    // IMPORTANTE: El servidor ahora decide sobre actualizaciones de salud
                    // El cliente solo SOLICITA cambios, el servidor los valida y propaga
                    handleHealthUpdateRequest(data);
                    break;

                case 'skullCaptured':
                    // El cliente informa que ha capturado la calavera
                    handleSkullCapture(playerId);
                    break;
            }
        } catch (error) {
            console.error('[SERVER] Error procesando mensaje:', error);
        }
    });

    // Manejar desconexión
    ws.on('close', () => {
        // Obtener ID del jugador desde el WebSocket
        const playerId = ws.playerId;
        
        console.log(`[SERVER] Jugador desconectado: ${playerId}`);
        
        // Eliminar todos los proyectiles del jugador
        for (const [projectileId, projectile] of projectiles.entries()) {
            if (projectile.playerId === playerId) {
                projectiles.delete(projectileId);
                broadcast({
                    type: 'removeProjectile',
                    projectileId: projectileId,
                    playerId: playerId
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

// Manejar colisión de proyectil reportada por cliente
function handleProjectileCollision(data) {
    // Verificar que el proyectil existe
    const projectile = projectiles.get(data.projectileId);
    if (!projectile) {
        console.log(`[SERVER] Colisión reportada para proyectil no existente: ${data.projectileId}`);
        return;
    }
    
    // Si es colisión con jugador, actualizar la salud del jugador
    if (data.collisionType === 'player' && data.targetPlayerId) {
        const targetPlayer = getPlayerByNameOrId(data.targetPlayerId);
        
        if (targetPlayer && targetPlayer.isAlive) {
            // Aplicar daño al jugador
            applyDamageToPlayer(targetPlayer.id, CONFIG.PROJECTILE_DAMAGE, projectile.playerId);
        }
    }
    
    // Eliminar el proyectil después de la colisión
    projectiles.delete(data.projectileId);
    
    // Notificar a todos sobre la colisión (efectos visuales)
    broadcast({
        type: 'projectileCollision',
        projectileId: data.projectileId,
        playerId: projectile.playerId,
        position: data.position,
        collisionType: data.collisionType,
        targetPlayerId: data.targetPlayerId
    });
    
    // Notificar a todos sobre la eliminación del proyectil
    broadcast({
        type: 'removeProjectile',
        projectileId: data.projectileId,
        playerId: projectile.playerId
    });
}

// Buscar jugador por nombre o ID
function getPlayerByNameOrId(nameOrId) {
    // Primero buscar por ID
    if (players.has(nameOrId)) {
        return players.get(nameOrId);
    }
    
    // Si no se encuentra, buscar por nombre
    for (const player of players.values()) {
        if (player.name === nameOrId) {
            return player;
        }
    }
    
    return null;
}

// Aplicar daño a un jugador
function applyDamageToPlayer(playerId, damage, sourcePlayerId) {
    const player = players.get(playerId);
    if (!player || !player.isAlive) return;
    
    // Calcular nueva salud
    const newHealth = Math.max(0, player.health - damage);
    const wasDead = !player.isAlive;
    const isDead = newHealth <= 0;
    
    // Actualizar estado del jugador
    player.health = newHealth;
    player.isAlive = !isDead;
    
    console.log(`[SERVER] Jugador ${playerId} recibe daño: ${damage}. Nueva salud: ${newHealth}, muerto: ${isDead}`);
    
    // Crear mensaje de actualización
    const healthUpdate = {
        type: 'healthUpdate',
        playerId: playerId,
        health: newHealth,
        isAlive: !isDead
    };
    
    // Si el jugador acaba de morir, añadir información de quién lo mató
    if (!wasDead && isDead && sourcePlayerId) {
        healthUpdate.killedBy = sourcePlayerId;
        console.log(`[SERVER] [KILL] Jugador ${sourcePlayerId} mató a ${playerId}`);
        
        // Programar respawn automático
        scheduleRespawn(playerId);
    }
    
    // Enviar actualización a todos los clientes
    broadcastToAll(healthUpdate);
}

// Programar respawn de jugador
function scheduleRespawn(playerId) {
    setTimeout(() => {
        const player = players.get(playerId);
        if (player) {
            // Generar nueva posición aleatoria para el respawn
            const respawnPosition = {
                x: (Math.random() * 200) - 100,
                y: 0,
                z: (Math.random() * 200) - 100
            };
            
            // Actualizar estado del jugador
            player.health = CONFIG.PLAYER_START_HEALTH;
            player.isAlive = true;
            player.position = respawnPosition;
            
            console.log(`[SERVER] Jugador ${playerId} respawneado`);
            
            // Notificar a todos los clientes
            broadcastToAll({
                type: 'healthUpdate',
                playerId: playerId,
                health: CONFIG.PLAYER_START_HEALTH,
                isAlive: true,
                position: respawnPosition
            });
        }
    }, CONFIG.RESPAWN_TIME);
}

// Manejar solicitud de actualización de salud
function handleHealthUpdateRequest(data) {
    // El servidor es la autoridad sobre la salud de los jugadores
    // No permitimos que los clientes actualicen directamente la salud
    console.log(`[SERVER] Solicitud de actualización de salud recibida de ${data.playerId} (ignorada)`);
    
    // En su lugar, enviamos el estado actual según el servidor
    const player = getPlayerByNameOrId(data.playerId);
    if (player) {
        broadcastToAll({
            type: 'healthUpdate',
            playerId: player.id,
            health: player.health,
            isAlive: player.isAlive,
            position: player.position
        });
    }
}

// Enviar mensaje a todos los clientes excepto al remitente
function broadcast(data, exclude = null) {
    wss.clients.forEach(client => {
        if (client !== exclude && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

// Enviar mensaje a TODOS los clientes sin excepción
function broadcastToAll(data) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(data));
        }
    });
}

// Función de actualización del servidor
function updateServer() {
    const now = Date.now();
    const deltaTime = (now - skullGameState.lastUpdateTime) / 1000; // Convertir a segundos
    skullGameState.lastUpdateTime = now;
    
    updateProjectiles();
    updateSkullGameMode(deltaTime);
    checkTimeouts();
}

// Actualizar posiciones de proyectiles y comprobar colisiones
function updateProjectiles() {
    const now = Date.now();
    const deltaTime = 1/60; // Simulamos 60 FPS
    
    // Iterar sobre todos los proyectiles
    for (const [projectileId, projectile] of projectiles.entries()) {
        // Actualizar posición
        projectile.lastPosition.x = projectile.position.x;
        projectile.lastPosition.y = projectile.position.y;
        projectile.lastPosition.z = projectile.position.z;
        
        projectile.position.x += projectile.velocity.x * deltaTime;
        projectile.position.y += projectile.velocity.y * deltaTime;
        projectile.position.z += projectile.velocity.z * deltaTime;
        
        // Simular gravedad
        projectile.velocity.y -= 9.8 * deltaTime;
        
        // Comprobar colisiones con jugadores
        let hasCollided = false;
        
        // No comprobar colisiones con el jugador que disparó
        for (const [playerId, player] of players.entries()) {
            // Ignorar colisiones con el jugador que disparó o jugadores muertos
            if (playerId === projectile.playerId || !player.isAlive) continue;
            
            // Distancia entre el proyectil y el jugador
            const dx = player.position.x - projectile.position.x;
            const dy = player.position.y - projectile.position.y;
            const dz = player.position.z - projectile.position.z;
            const distanceSquared = dx*dx + dy*dy + dz*dz;
            
            // Si la distancia es menor que el radio de colisión
            if (distanceSquared < CONFIG.COLLISION_RADIUS * CONFIG.COLLISION_RADIUS) {
                console.log(`[SERVER] Colisión detectada: proyectil ${projectileId} impactó a jugador ${playerId}`);
                
                // Aplicar daño al jugador
                applyDamageToPlayer(playerId, CONFIG.PROJECTILE_DAMAGE, projectile.playerId);
                
                // Notificar la colisión para efectos visuales
                broadcastToAll({
                    type: 'projectileCollision',
                    projectileId: projectileId,
                    playerId: projectile.playerId,
                    position: projectile.position,
                    collisionType: 'player',
                    targetPlayerId: playerId
                });
                
                hasCollided = true;
                break;
            }
        }
        
        // Si ha colisionado, eliminar el proyectil
        if (hasCollided) {
            projectiles.delete(projectileId);
            
            // Notificar a todos los clientes
            broadcastToAll({
                type: 'removeProjectile',
                projectileId: projectileId,
                playerId: projectile.playerId
            });
            continue;
        }
        
        // Comprobar si ha salido de los límites del mapa
        const isOutOfBounds = 
            projectile.position.x < CONFIG.MAP_LIMITS.minX ||
            projectile.position.x > CONFIG.MAP_LIMITS.maxX ||
            projectile.position.z < CONFIG.MAP_LIMITS.minZ ||
            projectile.position.z > CONFIG.MAP_LIMITS.maxZ;
            
        if (isOutOfBounds) {
            console.log(`[SERVER] Proyectil ${projectileId} fuera de los límites del mapa: [${projectile.position.x.toFixed(2)}, ${projectile.position.z.toFixed(2)}]`);
            projectiles.delete(projectileId);
            
            // Notificar a todos los clientes
            broadcastToAll({
                type: 'removeProjectile',
                projectileId: projectileId,
                playerId: projectile.playerId
            });
        }
    }
}

// Comprobar tiempo de inactividad de jugadores
function checkTimeouts() {
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutos de inactividad
    
    for (const [playerId, player] of players.entries()) {
        if (now - player.lastUpdateTime > timeout) {
            console.log(`[SERVER] Jugador ${playerId} desconectado por inactividad`);
            
            // Buscar y cerrar la conexión WebSocket
            for (const client of wss.clients) {
                if (client.playerId === playerId) {
                    client.close();
                    break;
                }
            }
            
            // El evento 'close' del WebSocket manejará la limpieza
        }
    }
}

// Función para actualizar el modo calavera
function updateSkullGameMode(deltaTime) {
    // No actualizar si la calavera ha sido capturada (esperamos la transición manual)
    if (skullGameState.isSkullCaptured) return;
    
    // Actualizar countdown
    skullGameState.countdown -= deltaTime;
    
    // Variable para controlar si debemos enviar una actualización
    let shouldBroadcast = false;
    
    // Comprobar cambio de modo
    if (skullGameState.countdown <= 0) {
        if (skullGameState.isSkullModeActive) {
            // Cambiar a modo normal
            startNormalMode();
        } else {
            // Cambiar a modo calavera
            startSkullMode();
        }
        
        shouldBroadcast = true;
    }
    
    // Actualizar el intervalo de broadcast
    skullGameState.timeSinceLastBroadcast = (skullGameState.timeSinceLastBroadcast || 0) + deltaTime;
    
    // Enviar actualizaciones cada segundo para mantener sincronizados los contadores
    if (skullGameState.timeSinceLastBroadcast >= 1) {
        shouldBroadcast = true;
        skullGameState.timeSinceLastBroadcast = 0;
    }
    
    // Enviar actualización a todos los clientes si es necesario
    if (shouldBroadcast) {
        broadcastSkullModeStatus();
    }
    
    // Comprobar colisiones de jugadores con la calavera si está activa
    if (skullGameState.isSkullModeActive && !skullGameState.isSkullCaptured) {
        checkSkullCollisions();
    }
}

// Iniciar modo normal
function startNormalMode() {
    skullGameState.isSkullModeActive = false;
    skullGameState.countdown = CONFIG.SKULL_MODE.NORMAL_MODE_DURATION;
    skullGameState.isSkullCaptured = false;
    console.log(`[SERVER] Modo normal activado. Próximo modo calavera en ${CONFIG.SKULL_MODE.NORMAL_MODE_DURATION} segundos`);
}

// Iniciar modo calavera
function startSkullMode() {
    skullGameState.isSkullModeActive = true;
    skullGameState.countdown = CONFIG.SKULL_MODE.SKULL_MODE_DURATION;
    skullGameState.isSkullCaptured = false;
    
    // Generar posición aleatoria para la calavera (lejos de tierra si es posible)
    generateRandomSkullPosition();
    
    console.log(`[SERVER] ¡MODO CALAVERA ACTIVADO! Calavera spawneada en [${skullGameState.skullPosition.x.toFixed(2)}, ${skullGameState.skullPosition.z.toFixed(2)}]`);
}

// Generar posición aleatoria para la calavera
function generateRandomSkullPosition() {
    const limits = CONFIG.MAP_LIMITS;
    
    // Generar posición aleatoria
    const x = Math.random() * (limits.maxX - limits.minX) + limits.minX;
    const z = Math.random() * (limits.maxZ - limits.minZ) + limits.minZ;
    
    skullGameState.skullPosition = {
        x: x,
        y: 3, // Altura fija de 3 unidades
        z: z
    };
}

// Comprobar colisiones de jugadores con la calavera
function checkSkullCollisions() {
    // Iterar por todos los jugadores
    for (const [playerId, player] of players.entries()) {
        // Ignorar jugadores muertos
        if (!player.isAlive) continue;
        
        // Calcular distancia horizontal (ignorando Y)
        const dx = player.position.x - skullGameState.skullPosition.x;
        const dz = player.position.z - skullGameState.skullPosition.z;
        const distanceSquared = dx * dx + dz * dz;
        
        // Si está dentro del radio
        if (distanceSquared <= (CONFIG.SKULL_MODE.SKULL_RADIUS * CONFIG.SKULL_MODE.SKULL_RADIUS)) {
            // Capturar la calavera
            handleSkullCapture(playerId);
            break;
        }
    }
}

// Manejar la captura de la calavera
function handleSkullCapture(playerId) {
    const player = players.get(playerId);
    if (!player || !skullGameState.isSkullModeActive || skullGameState.isSkullCaptured) return;
    
    // Marcar la calavera como capturada
    skullGameState.isSkullCaptured = true;
    skullGameState.skullCapturingPlayer = playerId;
    
    console.log(`[SERVER] ¡Jugador ${playerId} ha capturado la calavera!`);
    
    // Notificar a todos los clientes
    broadcastToAll({
        type: 'skullCaptured',
        playerId: playerId
    });
    
    // Cambiar inmediatamente a modo normal
    startNormalMode();
    broadcastSkullModeStatus();
}

// Enviar estado del modo calavera a todos los clientes
function broadcastSkullModeStatus() {
    // Log para depuración
    const minutes = Math.floor(skullGameState.countdown / 60);
    const seconds = Math.floor(skullGameState.countdown % 60);
    console.log(`[SERVER] Enviando actualización de modo calavera: ${skullGameState.isSkullModeActive ? 'ACTIVO' : 'NORMAL'}, tiempo: ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`);
    
    broadcastToAll({
        type: 'gameModeStatus',
        mode: 'skull',
        isActive: skullGameState.isSkullModeActive,
        countdown: skullGameState.countdown,
        data: {
            skullPosition: skullGameState.skullPosition,
            isSkullCaptured: skullGameState.isSkullCaptured
        }
    });
}

// Iniciar bucle de actualización del servidor (10 actualizaciones por segundo)
setInterval(updateServer, 100);

// Iniciar servidor
const PORT = process.env.PORT || 8050;
server.listen(PORT, () => {
    console.log(`Servidor WebSocket corriendo en el puerto ${PORT}`);
});