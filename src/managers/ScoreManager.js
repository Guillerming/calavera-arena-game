export class ScoreManager {
    constructor() {
        this.scores = new Map(); // playerID -> {kills, deaths, name}
        this.localStorageKey = 'gameScores';
        this.knownPlayers = new Set(); // Conjunto para seguimiento de jugadores activos
        this.skullScores = new Map(); // playerID -> número de calaveras capturadas
        
        // Cargar puntuaciones solo para la sesión actual
        // No usamos localStorage para evitar mezclar jugadores de sesiones anteriores
        this.resetScores();
    }
    
    // Inicializar un jugador si no existe
    initPlayer(playerId, playerName) {
        if (!playerId) {
            return;
        }
        
        if (!this.scores.has(playerId)) {
            this.scores.set(playerId, {
                id: playerId,
                name: playerName || playerId,
                kills: 0,
                deaths: 0
            });
            this.knownPlayers.add(playerId);
            
            // Inicializar puntuación de calaveras
            if (!this.skullScores.has(playerId)) {
                this.skullScores.set(playerId, 0);
            }
        } else if (playerName && this.scores.get(playerId).name !== playerName) {
            // Actualizar nombre si ha cambiado
            this.scores.get(playerId).name = playerName;
        }
    }
    
    // Registrar una muerte
    registerKill(killerId, victimId) {
        if (!killerId || !victimId) {
            return;
        }
        
        if (killerId === victimId) {
            // Es un suicidio, pero no incrementamos nada por ahora
            return;
        }
        
        this.initPlayer(killerId);
        this.initPlayer(victimId);
        
        // Incrementar kills del asesino SOLAMENTE
        const killerScore = this.scores.get(killerId);
        killerScore.kills++;
        
        // NO incrementamos muertes de la víctima según el requisito
    }
    
    // Registrar muerte (sin asesino, por ejemplo, al salir del mapa)
    registerDeath(playerId) {
        if (!playerId) {
            return;
        }
        
        this.initPlayer(playerId);
        
        // Incrementar muertes
        const playerScore = this.scores.get(playerId);
        playerScore.deaths++;
    }
    
    // Establecer nombre para un jugador
    setPlayerName(playerId, name) {
        if (!playerId || !name) {
            return;
        }
        
        this.initPlayer(playerId, name);
    }
    
    // Obtener las puntuaciones ordenadas (mayor número de kills primero)
    getScores() {
        return Array.from(this.scores.values())
            .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    }
    
    // Obtener puntuación de un jugador específico
    getPlayerScore(playerId) {
        return this.scores.get(playerId) || null;
    }
    
    // Resetear puntuaciones para la sesión actual
    resetScores() {
        this.scores.clear();
        this.skullScores.clear();
        this.knownPlayers.clear();
    }
    
    // Añadir un jugador por su ID del servidor
    addPlayerById(playerId, playerName) {
        this.initPlayer(playerId, playerName);
    }
    
    // Eliminar jugador (cuando se desconecta)
    removePlayer(playerId) {
        if (this.scores.has(playerId)) {
            this.scores.delete(playerId);
            this.knownPlayers.delete(playerId);
        }
    }
    
    // Obtener número de jugadores activos
    getPlayerCount() {
        return this.scores.size;
    }
    
    // Eliminar todos los jugadores excepto los IDs proporcionados
    syncPlayers(activePlayerIds) {
        // Convertir a Set para operaciones más eficientes
        const activeIds = new Set(activePlayerIds);
        
        // Eliminar jugadores que ya no están activos
        for (const playerId of this.knownPlayers) {
            if (!activeIds.has(playerId)) {
                this.scores.delete(playerId);
                this.knownPlayers.delete(playerId);
            }
        }
    }
    
    // Registrar captura de calavera
    registerSkull(playerId) {
        // Verificar que exista la estructura de datos
        if (!this.skullScores) {
            this.skullScores = new Map();
        }
        
        // Incrementar contador de calaveras
        const current = this.skullScores.get(playerId) || 0;
        this.skullScores.set(playerId, current + 1);
    }
    
    // Obtener el número de calaveras capturadas por un jugador
    getPlayerSkullCount(playerId) {
        return this.skullScores.get(playerId) || 0;
    }
    
    // Obtener todas las puntuaciones de calaveras ordenadas
    getSkullScores() {
        const result = [];
        
        for (const [playerId, skullCount] of this.skullScores.entries()) {
            // Obtener información del jugador
            const playerInfo = this.scores.get(playerId);
            if (playerInfo) {
                result.push({
                    id: playerId,
                    name: playerInfo.name,
                    skulls: skullCount
                });
            }
        }
        
        // Ordenar por número de calaveras (descendente)
        return result.sort((a, b) => b.skulls - a.skulls);
    }
} 