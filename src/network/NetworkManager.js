export class NetworkManager {
    constructor() {
        this.ws = null;
        this.playerId = null;
        this.connected = false;
        this.players = new Map();
        this.projectiles = new Map();
        this.onPlayerUpdate = null;
        this.onPlayerJoin = null;
        this.onPlayerLeave = null;
        this.onProjectileUpdate = null;
        this.onProjectileRemove = null;
    }

    connect() {
        // Conectar al servidor WebSocket
        this.ws = new WebSocket('ws://localhost:8050');

        this.ws.onopen = () => {
            this.connected = true;
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
                case 'init':
                    this.playerId = data.id;
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
                    // Nuevo proyectil
                    if (this.onProjectileUpdate) {
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
                    // Eliminar proyectil
                    if (this.onProjectileRemove) {
                        this.onProjectileRemove({
                            projectileId: data.projectileId,
                            playerId: data.playerId
                        });
                    }
                    break;
            }
        };

        this.ws.onclose = () => {
            this.connected = false;
        };

        this.ws.onerror = (error) => {
            this.connected = false;
        };
    }

    // Enviar actualización de posición al servidor
    sendUpdate(position, rotation) {
        if (this.connected) {
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
    }

    // Añadir método para enviar un proyectil al servidor
    sendProjectile(projectileData) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
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
                    timestamp: performance.now() // Añadir timestamp para sincronización del efecto visual
                }
            };
            this.ws.send(JSON.stringify(message));
        }
    }

    // Añadir método para eliminar un proyectil del servidor
    removeProjectile(projectileId) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const message = {
                type: 'removeProjectile',
                projectileId: projectileId,
                playerId: this.playerId
            };
            this.ws.send(JSON.stringify(message));
        }
    }

    // Modificar el método handleMessage para manejar proyectiles
    handleMessage(event) {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
            case 'playerUpdate':
                if (this.onPlayerUpdate) {
                    this.onPlayerUpdate(message.data);
                }
                break;
                
            case 'playerJoin':
                if (this.onPlayerJoin) {
                    this.onPlayerJoin(message.data);
                }
                break;
                
            case 'playerLeave':
                if (this.onPlayerLeave) {
                    this.onPlayerLeave(message.data);
                }
                break;

            case 'newProjectile':
                if (this.onProjectileUpdate) {
                    this.onProjectileUpdate(message.data);
                }
                break;

            case 'removeProjectile':
                if (this.onProjectileRemove) {
                    this.onProjectileRemove(message.data);
                }
                break;
        }
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
    setCallbacks({ onPlayerUpdate, onPlayerJoin, onPlayerLeave, onProjectileUpdate, onProjectileRemove }) {
        this.onPlayerUpdate = onPlayerUpdate;
        this.onPlayerJoin = onPlayerJoin;
        this.onPlayerLeave = onPlayerLeave;
        this.onProjectileUpdate = onProjectileUpdate;
        this.onProjectileRemove = onProjectileRemove;
    }
}