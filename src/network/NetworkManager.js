export class NetworkManager {
    constructor() {
        this.ws = null;
        this.playerId = null;
        this.connected = false;
        this.players = new Map();
        this.onPlayerUpdate = null;
        this.onPlayerJoin = null;
        this.onPlayerLeave = null;
    }

    connect() {
        // Conectar al servidor WebSocket
        this.ws = new WebSocket('ws://localhost:8050');

        this.ws.onopen = () => {
            console.log('Conectado al servidor');
            this.connected = true;
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
                case 'init':
                    this.playerId = data.id;
                    console.log('ID de jugador asignado:', this.playerId);
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
            }
        };

        this.ws.onclose = () => {
            console.log('Desconectado del servidor');
            this.connected = false;
        };

        this.ws.onerror = (error) => {
            console.error('Error de WebSocket:', error);
            this.connected = false;
        };
    }

    // Enviar actualización de posición/rotación al servidor
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

    // Obtener lista de jugadores conectados
    getPlayers() {
        return Array.from(this.players.values());
    }

    // Obtener ID del jugador local
    getPlayerId() {
        return this.playerId;
    }

    // Establecer callbacks para eventos
    setCallbacks({ onPlayerUpdate, onPlayerJoin, onPlayerLeave }) {
        this.onPlayerUpdate = onPlayerUpdate;
        this.onPlayerJoin = onPlayerJoin;
        this.onPlayerLeave = onPlayerLeave;
    }
}