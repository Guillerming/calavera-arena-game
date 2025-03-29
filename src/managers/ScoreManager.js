export class ScoreManager {
    constructor() {
        this.scores = new Map(); // playerID -> {kills, deaths, name}
        this.localStorageKey = 'gameScores';
        this.loadScores();
    }
    
    // Inicializar un jugador si no existe
    initPlayer(playerId, playerName) {
        if (!this.scores.has(playerId)) {
            this.scores.set(playerId, {
                id: playerId,
                name: playerName || playerId,
                kills: 0,
                deaths: 0
            });
        }
    }
    
    // Registrar una muerte
    registerKill(killerId, victimId) {
        if (!killerId || !victimId || killerId === victimId) return;
        
        this.initPlayer(killerId);
        this.initPlayer(victimId);
        
        // Incrementar kills del asesino
        const killerScore = this.scores.get(killerId);
        killerScore.kills++;
        
        // Incrementar muertes de la víctima
        const victimScore = this.scores.get(victimId);
        victimScore.deaths++;
        
        // Guardar puntuaciones
        this.saveScores();
        
        console.log(`${killerId} mató a ${victimId}. Kills: ${killerScore.kills}, Deaths: ${victimScore.deaths}`);
    }
    
    // Registrar muerte (sin asesino, por ejemplo, al salir del mapa)
    registerDeath(playerId) {
        if (!playerId) return;
        
        this.initPlayer(playerId);
        
        // Incrementar muertes
        const playerScore = this.scores.get(playerId);
        playerScore.deaths++;
        
        // Guardar puntuaciones
        this.saveScores();
    }
    
    // Establecer nombre para un jugador
    setPlayerName(playerId, name) {
        this.initPlayer(playerId);
        const playerScore = this.scores.get(playerId);
        playerScore.name = name;
        this.saveScores();
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
    
    // Guardar puntuaciones en localStorage
    saveScores() {
        try {
            const scoresData = JSON.stringify(Array.from(this.scores.entries()));
            localStorage.setItem(this.localStorageKey, scoresData);
        } catch (error) {
            console.error('Error al guardar puntuaciones:', error);
        }
    }
    
    // Cargar puntuaciones desde localStorage
    loadScores() {
        try {
            const scoresData = localStorage.getItem(this.localStorageKey);
            if (scoresData) {
                this.scores = new Map(JSON.parse(scoresData));
            }
        } catch (error) {
            console.error('Error al cargar puntuaciones:', error);
            this.scores = new Map();
        }
    }
    
    // Resetear todas las puntuaciones
    resetScores() {
        this.scores.clear();
        localStorage.removeItem(this.localStorageKey);
    }
} 