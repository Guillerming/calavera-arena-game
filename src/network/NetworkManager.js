export class NetworkManager {
    constructor() {
        this.ws = null;
        this.playerId = null;
        this.clientName = null; // Nombre proporcionado por el cliente
        this.connected = false;
        this.players = new Map();
        this.projectiles = new Map();
        this.onPlayerUpdate = null;
        this.onPlayerJoin = null;
        this.onPlayerLeave = null;
        this.onProjectileUpdate = null;
        this.onProjectileRemove = null;
        this.onProjectileCollision = null;
        this.onHealthUpdate = null;
        this.onKill = null;
        this.scoreManager = null;
        this.onInit = null; // Callback para cuando se recibe el ID del servidor
    }

    // Asignar el nombre del cliente antes de la conexión
    setClientName(name) {
        this.clientName = name;
    }

    connect() {
        // Conectar al servidor WebSocket
        this.ws = new WebSocket('ws://localhost:8050');

        this.ws.onopen = () => {
            this.connected = true;
            console.log("[DEBUG] Conexión WebSocket establecida");
            
            // Enviar nombre del jugador al iniciar conexión
            if (this.clientName) {
                this.ws.send(JSON.stringify({
                    type: 'setName',
                    name: this.clientName
                }));
            }
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
                case 'init':
                    this.playerId = data.id;
                    console.log(`[DEBUG] ID asignado por el servidor: ${this.playerId}, nombre del cliente: ${this.clientName}`);
                    
                    // Notificar que se ha recibido el ID del servidor
                    if (this.onInit) {
                        this.onInit(data.id);
                    }
                    break;
                    
                case 'players':
                    // Recibir lista inicial de jugadores
                    data.players.forEach(player => {
                        this.players.set(player.id, player);
                        if (this.onPlayerJoin) {
                            this.onPlayerJoin(player);
                        }
                    });
                    break;
                    
                case 'newPlayer':
                    // Nuevo jugador se ha unido
                    this.players.set(data.player.id, data.player);
                    if (this.onPlayerJoin) {
                        this.onPlayerJoin(data.player);
                    }
                    break;
                    
                case 'playerUpdate':
                    // Actualización de posición/rotación de un jugador
                    const player = this.players.get(data.id);
                    if (player) {
                        player.position = data.position;
                        player.rotation = data.rotation;
                        if (this.onPlayerUpdate) {
                            this.onPlayerUpdate(player);
                        }
                    }
                    break;
                    
                case 'playerLeft':
                    // Jugador se ha desconectado
                    this.players.delete(data.id);
                    if (this.onPlayerLeave) {
                        this.onPlayerLeave(data.id);
                    }
                    break;

                case 'newProjectile':
                    // Nuevo proyectil desde el servidor
                    if (this.onProjectileUpdate) {
                        // Verificar que el proyectil tiene todos los datos necesarios
                        if (!data.projectile || !data.projectile.position || !data.projectile.velocity) {
                            console.error('Datos de proyectil incompletos:', data.projectile);
                            break;
                        }
                        
                        this.onProjectileUpdate({
                            id: data.projectile.id,
                            playerId: data.projectile.playerId,
                            position: {
                                x: data.projectile.position.x,
                                y: data.projectile.position.y,
                                z: data.projectile.position.z
                            },
                            velocity: {
                                x: data.projectile.velocity.x,
                                y: data.projectile.velocity.y,
                                z: data.projectile.velocity.z
                            },
                            rotationSpeed: data.projectile.rotationSpeed || {
                                x: (Math.random() - 0.5) * 0.3,
                                y: (Math.random() - 0.5) * 0.3,
                                z: (Math.random() - 0.5) * 0.3
                            }
                        });
                    }
                    break;

                case 'removeProjectile':
                    // Eliminar proyectil por orden del servidor
                    if (this.onProjectileRemove) {
                        this.onProjectileRemove({
                            projectileId: data.projectileId,
                            playerId: data.playerId
                        });
                    }
                    break;
                    
                case 'projectileCollision':
                    // Manejar colisión de proyectil determinada por el servidor
                    console.log(`[DEBUG] Colisión de proyectil recibida del servidor: tipo=${data.collisionType}`);
                    
                    if (this.onProjectileCollision) {
                        this.onProjectileCollision({
                            projectileId: data.projectileId,
                            playerId: data.playerId,
                            position: data.position,
                            collisionType: data.collisionType,
                            targetPlayerId: data.targetPlayerId
                        });
                    }
                    break;
                    
                case 'healthUpdate':
                    // IMPORTANTE: Esta es la actualización de salud desde el servidor
                    // Todos los clientes deben obedecer estrictamente este estado
                    console.log(`[DEBUG] Actualización de salud desde servidor: jugador=${data.playerId}, salud=${data.health}, vivo=${data.isAlive}`);
                    
                    // Si la actualización es para el jugador local
                    if (data.playerId === this.playerId) {
                        // Crear objeto con los datos recibidos
                        const localPlayer = {
                            id: this.playerId,
                            health: data.health,
                            isAlive: data.isAlive,
                            position: data.position,
                            killedBy: data.killedBy
                        };
                        
                        // Procesar kills/muertes en el scoreboard
                        this._processKillData(data);
                        
                        // Notificar la actualización
                        if (this.onHealthUpdate) {
                            this.onHealthUpdate(localPlayer);
                        }
                    } 
                    // Actualización para otro jugador
                    else {
                        // Buscar el jugador en nuestra lista local
                        let updatedPlayer = this.players.get(data.playerId);
                        
                        // Si no existe en nuestra lista, podría ser un jugador que acaba de unirse
                        if (!updatedPlayer) {
                            console.warn(`[DEBUG] Recibida actualización de salud para jugador desconocido: ${data.playerId}`);
                            updatedPlayer = {
                                id: data.playerId,
                                name: data.name || data.playerId,
                                health: data.health,
                                isAlive: data.isAlive,
                                position: data.position || { x: 0, y: 0, z: 0 }
                            };
                            this.players.set(data.playerId, updatedPlayer);
                        } else {
                            // Actualizar los datos del jugador remoto
                            updatedPlayer.health = data.health;
                            updatedPlayer.isAlive = data.isAlive;
                            
                            // Actualizar posición si está incluida
                            if (data.position) {
                                updatedPlayer.position = data.position;
                            }
                        }
                        
                        // Procesar datos de kills/muertes
                        this._processKillData(data);
                        
                        // Notificar la actualización
                        if (this.onHealthUpdate) {
                            this.onHealthUpdate(updatedPlayer);
                        }
                    }
                    break;
                
                default:
                    console.log(`[DEBUG] Mensaje desconocido recibido: ${data.type}`);
            }
        };

        this.ws.onclose = () => {
            this.connected = false;
            console.log("[DEBUG] Conexión WebSocket cerrada");
        };

        this.ws.onerror = (error) => {
            this.connected = false;
            console.error("[DEBUG] Error en WebSocket:", error);
        };
    }

    // Método auxiliar para procesar datos de kills
    _processKillData(data) {
        // Verificar si es un evento de muerte (health = 0)
        if (data.health === 0 && !data.isAlive && this.scoreManager) {
            // Si hay un killedBy, registrar kill
            if (data.killedBy) {
                this.scoreManager.registerKill(data.killedBy, data.playerId);
                
                // Notificar kill/muerte a través del callback
                if (this.onKill) {
                    this.onKill(data.killedBy, data.playerId);
                }
            } else {
                // Muerte sin killer (p. ej. suicidio o causa ambiental)
                this.scoreManager.registerDeath(data.playerId);
            }
        }
    }

    // CLIENTE -> SERVIDOR: Enviar actualización de posición
    sendUpdate(position, rotation) {
        if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }
        
        this.ws.send(JSON.stringify({
            type: 'update',
            position: {
                x: position.x,
                y: position.y,
                z: position.z
            },
            rotation: {
                y: rotation.y
            }
        }));
    }

    // CLIENTE -> SERVIDOR: Solicitar disparo de proyectil
    sendProjectile(projectileData) {
        if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }
        
        console.log(`[DEBUG] Enviando solicitud de disparo de proyectil`);
        
        // Solo enviamos información básica, el servidor calculará todo lo demás
        const message = {
            type: 'fireProjectile',
            projectile: {
                id: projectileData.id,
                playerId: this.playerId,
                position: {
                    x: projectileData.initialPosition.x,
                    y: projectileData.initialPosition.y,
                    z: projectileData.initialPosition.z
                },
                velocity: {
                    x: projectileData.velocity.x,
                    y: projectileData.velocity.y,
                    z: projectileData.velocity.z
                },
                rotationSpeed: projectileData.rotationSpeed,
                timestamp: performance.now()
            }
        };
        
        this.ws.send(JSON.stringify(message));
    }

    // CLIENTE -> SERVIDOR: Notificar que un proyectil fue eliminado (fuera del rango)
    removeProjectile(projectileId) {
        if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }
        
        const message = {
            type: 'removeProjectile',
            projectileId: projectileId,
            playerId: this.playerId
        };
        
        this.ws.send(JSON.stringify(message));
    }

    // CLIENTE -> SERVIDOR: Notificar una colisión (solo para depuración, el servidor decide las colisiones)
    sendProjectileCollision(collisionData) {
        if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }
        
        console.log(`[DEBUG] Enviando datos de colisión: tipo=${collisionData.collisionType}, targetPlayer=${collisionData.targetPlayerId || 'ninguno'}`);
        
        const message = {
            type: 'projectileCollision',
            playerId: this.playerId,
            projectileId: collisionData.projectileId,
            position: collisionData.position,
            collisionType: collisionData.collisionType,
            targetPlayerId: collisionData.targetPlayerId,
            timestamp: performance.now()
        };
        
        this.ws.send(JSON.stringify(message));
    }

    // CLIENTE -> SERVIDOR: Solicitar una actualización de salud
    // (Esta función ahora SOLO envía información, no determina nada)
    sendHealthUpdate(health, isAlive, killedBy = null, playerName = null) {
        if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }
        
        // El ID a enviar es siempre el playerName o el ID local
        const idToSend = playerName || this.playerId;
        
        console.log(`[DEBUG] Solicitando actualización de salud: ID=${idToSend}, salud=${health}, vivo=${isAlive}`);
        
        const message = {
            type: 'healthUpdate',
            playerId: idToSend,
            health: health,
            isAlive: isAlive
        };
        
        // Información adicional que puede ser útil para el servidor
        if (health === 0 && !isAlive && killedBy) {
            message.killedBy = killedBy;
        }
        
        if (health === 100 && isAlive === true) {
            // Solo incluir posición en caso de respawn
            const player = Array.from(this.players.values()).find(p => p.id === this.playerId);
            if (player && player.position) {
                message.position = player.position;
            }
        }
        
        this.ws.send(JSON.stringify(message));
    }

    // Obtener lista de jugadores conectados
    getPlayers() {
        return Array.from(this.players.values());
    }

    // Obtener lista de proyectiles activos
    getProjectiles() {
        return Array.from(this.projectiles.values());
    }

    // Obtener ID del jugador local
    getPlayerId() {
        return this.playerId;
    }

    // Establecer callbacks para eventos
    setCallbacks({ onPlayerUpdate, onPlayerJoin, onPlayerLeave, onProjectileUpdate, onProjectileRemove, onProjectileCollision, onHealthUpdate, onKill }) {
        this.onPlayerUpdate = onPlayerUpdate;
        this.onPlayerJoin = onPlayerJoin;
        this.onPlayerLeave = onPlayerLeave;
        this.onProjectileUpdate = onProjectileUpdate;
        this.onProjectileRemove = onProjectileRemove;
        this.onProjectileCollision = onProjectileCollision;
        this.onHealthUpdate = onHealthUpdate;
        this.onKill = onKill;
    }

    // Configurar ScoreManager
    setScoreManager(scoreManager) {
        this.scoreManager = scoreManager;
    }
}