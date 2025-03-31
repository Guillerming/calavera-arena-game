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
        this.game = null; // Referencia al objeto game
        this.onInit = null; // Callback para cuando se recibe el ID del servidor
    }

    // Asignar el nombre del cliente antes de la conexión
    setClientName(name) {
        this.clientName = name;
    }

    // Asignar la referencia al game
    setGame(game) {
        this.game = game;
    }

    connect() {
        // Conectar al servidor WebSocket
        try {
            // Usar location.hostname para que funcione tanto en desarrollo como en producción
            // En desarrollo, será localhost, en producción, el nombre del servidor
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${protocol}//${window.location.hostname}:8050`;
            
            console.log(`[NetworkManager] Conectando a ${wsUrl}`);
            this.ws = new WebSocket(wsUrl);
        } catch (error) {
            console.error('Error al conectar al servidor:', error);
            return;
        }
        
        // Evento: Conexión establecida
        this.ws.onopen = () => {
            console.log('[NetworkManager] Conectado al servidor WebSocket');
            this.connected = true;
            
            // Si ya tenemos un nombre, enviarlo al servidor
            if (this.clientName) {
                this.setClientName(this.clientName);
            }
        };
        
        // Evento: Conexión cerrada
        this.ws.onclose = () => {
            console.log('[NetworkManager] Desconectado del servidor WebSocket');
            this.connected = false;
            this.playerId = null;
        };
        
        // Evento: Error en la conexión
        this.ws.onerror = (error) => {
            console.error('[NetworkManager] Error WebSocket:', error);
            this.connected = false;
        };
        
        // Evento: Mensaje recibido del servidor
        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);

            //console.log(`[WebSocket] Recibido: ${data.type}`);
            
            switch (data.type) {
                // SERVIDOR -> CLIENTE: Inicialización, recibimos nuestro ID
                case 'init':
                    this.playerId = data.id;
                    console.log(`[NetworkManager] ID asignado por el servidor: ${this.playerId}`);
                    
                    // Llamar al callback de inicialización si existe
                    if (this.onInit) {
                        this.onInit(this.playerId);
                    }
                    break;
                
                // SERVIDOR -> CLIENTE: Lista de jugadores existentes
                case 'players':
                    data.players.forEach(player => {
                        this.players.set(player.id, player);
                        
                        if (this.onPlayerJoin) {
                            this.onPlayerJoin(player);
                        }
                    });
                    break;
                
                // SERVIDOR -> CLIENTE: Nuevo jugador conectado
                case 'newPlayer':
                    this.players.set(data.player.id, data.player);
                    
                    if (this.onPlayerJoin) {
                        this.onPlayerJoin(data.player);
                    }
                    break;
                
                // SERVIDOR -> CLIENTE: Actualización de un jugador existente
                case 'playerUpdate':
                    const player = this.players.get(data.id);
                    if (player) {
                        // Actualizar solo las propiedades que vienen en el mensaje
                        if (data.position) player.position = data.position;
                        if (data.rotation) player.rotation = data.rotation;
                        if (data.name) player.name = data.name;
                        
                        if (this.onPlayerUpdate) {
                            this.onPlayerUpdate(player);
                        }
                    }
                    break;
                
                // SERVIDOR -> CLIENTE: Jugador desconectado
                case 'playerLeft':
                    this.players.delete(data.id);
                    
                    if (this.onPlayerLeave) {
                        this.onPlayerLeave(data.id);
                    }
                    break;
                
                // SERVIDOR -> CLIENTE: Nuevo proyectil disparado
                case 'newProjectile':
                    this.projectiles.set(data.projectile.id, data.projectile);
                    
                    if (this.onProjectileUpdate) {
                        this.onProjectileUpdate(data.projectile);
                    }
                    break;
                
                // SERVIDOR -> CLIENTE: Proyectil eliminado
                case 'removeProjectile':
                    this.projectiles.delete(data.projectileId);
                    
                    if (this.onProjectileRemove) {
                        this.onProjectileRemove(data.projectileId, data.playerId);
                    }
                    break;
                
                // SERVIDOR -> CLIENTE: Colisión de proyectil
                case 'projectileCollision':
                    if (this.onProjectileCollision) {
                        this.onProjectileCollision(data);
                    }
                    break;
                
                // SERVIDOR -> CLIENTE: Actualización de salud de un jugador
                case 'healthUpdate':
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
                    break;
                
                // SERVIDOR -> CLIENTE: Calavera capturada
                case 'skullCaptured':
                    console.log(`[NETWORK] Calavera capturada por jugador ${data.playerId}`);
                    
                    // Actualizar puntuación de calaveras si existe el score manager
                    if (this.scoreManager) {
                        this.scoreManager.registerSkull(data.playerId);
                    }
                    
                    // Actualizar modo de juego si existe
                    if (this.game && this.game.skullGameMode) {
                        this.game.skullGameMode.onSkullCaptured(data.playerId);
                    } else {
                        console.log('[NETWORK] No se puede notificar captura de calavera: no hay referencia al game.skullGameMode');
                    }
                    break;
                
                // SERVIDOR -> CLIENTE: Actualización de estado del modo de juego
                case 'gameModeStatus':
                    console.log(`[NETWORK] Actualización del estado del modo de juego: ${data.mode}`);
                    
                    // Si es modo calavera y existe la instancia del modo
                    if (data.mode === 'skull' && this.game && this.game.skullGameMode) {
                        this.game.skullGameMode.syncWithServer(data);
                    } else if (data.mode === 'skull') {
                        console.log('[NETWORK] No se puede sincronizar modo calavera: no hay referencia al game.skullGameMode');
                    }
                    break;
                
                default:
                    console.log(`[NetworkManager] Tipo de mensaje desconocido: ${data.type}`);
            }
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
                // No registramos muertes en el contador según requisito
                console.log(`[DEBUG] Muerte sin asesino para ${data.playerId} (no se incrementa contador)`);
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
    
    // CLIENTE -> SERVIDOR: Enviar información genérica (para extensiones como el modo calavera)
    send(data) {
        if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }
        
        this.ws.send(JSON.stringify(data));
    }
    
    // CLIENTE -> SERVIDOR: Notificar captura de calavera
    sendSkullCaptured(playerId) {
        if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }
        
        console.log(`[DEBUG] Notificando captura de calavera por jugador ${playerId}`);
        
        const message = {
            type: 'skullCaptured',
            capturedBy: playerId
        };
        
        this.ws.send(JSON.stringify(message));
    }
    
    // CLIENTE -> SERVIDOR: Sincronizar estado del modo de juego
    sendGameModeStatus(modeData) {
        if (!this.connected || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return;
        }
        
        const message = {
            type: 'gameModeStatus',
            mode: modeData.mode,
            isActive: modeData.isActive,
            countdown: modeData.countdown,
            data: modeData.data
        };
        
        this.ws.send(JSON.stringify(message));
    }
}