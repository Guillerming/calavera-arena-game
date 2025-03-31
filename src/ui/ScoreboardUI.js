export class ScoreboardUI {
    constructor(scoreManager, inputManager, networkManager) {
        this.scoreManager = scoreManager;
        this.inputManager = inputManager;
        this.networkManager = networkManager;
        this.isVisible = false;
        this.localPlayerId = null;
        
        if (this.networkManager) {
            this.localPlayerId = this.networkManager.getPlayerId();
        }
        
        this.initializeScoreboard();
    }
    
    initializeScoreboard() {
        // Obtener referencias a los elementos existentes en el HTML
        this.scoreboardContainer = document.getElementById('scoreboard-container');
        this.scoresContainer = document.getElementById('scores-container');
        
        // Verificar que todos los elementos existen
        if (!this.scoreboardContainer || !this.scoresContainer) {
            console.error('Error: No se encontraron los elementos del scoreboard en el HTML');
            return;
        }
    }
    
    update() {
        // Verificar que el InputManager está disponible
        if (!this.inputManager) {
            console.error("[ScoreboardUI] No hay referencia a inputManager");
            return;
        }
        
        // Comprobar si se mantiene pulsada la tecla Shift para mostrar/ocultar el scoreboard
        const isShiftPressed = this.inputManager.isKeyPressed('ShiftLeft') || this.inputManager.isKeyPressed('ShiftRight');
        
        if (isShiftPressed) {
            if (!this.isVisible) {
                this.show();
            }
        } else {
            if (this.isVisible) {
                this.hide();
            }
        }
    }
    
    show() {
        if (this.isVisible || !this.scoreboardContainer) return;
        
        this.isVisible = true;
        this.scoreboardContainer.style.display = 'block';
        
        // Solicitar sincronización de marcadores al servidor antes de mostrar
        if (this.networkManager && this.networkManager.requestScoreSync) {
            this.networkManager.requestScoreSync();
        }
        
        this.updateScores();
    }
    
    hide() {
        if (!this.isVisible || !this.scoreboardContainer) return;
        
        this.isVisible = false;
        this.scoreboardContainer.style.display = 'none';
    }
    
    updateScores() {
        if (!this.scoresContainer) return;
        
        // Limpiar contenedor de puntuaciones
        this.scoresContainer.innerHTML = '';
        
        // Obtener puntuaciones ordenadas
        const scores = this.scoreManager.getScores();
        
        if (scores.length === 0) {
            // Mensaje cuando no hay jugadores
            const emptyMessage = document.createElement('p');
            emptyMessage.textContent = 'No hay jugadores con puntuaciones';
            emptyMessage.className = 'scoreboard-empty';
            this.scoresContainer.appendChild(emptyMessage);
            return;
        }
        
        // Crear encabezado de la tabla
        const headerRow = document.createElement('div');
        headerRow.className = 'scoreboard-row scoreboard-header';
        
        const rankHeader = document.createElement('div');
        rankHeader.textContent = '#';
        rankHeader.className = 'scoreboard-cell scoreboard-rank';
        
        const nameHeader = document.createElement('div');
        nameHeader.textContent = 'Jugador';
        nameHeader.className = 'scoreboard-cell scoreboard-name';
        
        const killsHeader = document.createElement('div');
        killsHeader.textContent = 'Kills';
        killsHeader.className = 'scoreboard-cell scoreboard-kills';
        
        const skullsHeader = document.createElement('div');
        skullsHeader.textContent = '💀';
        skullsHeader.className = 'scoreboard-cell scoreboard-skulls';
        
        headerRow.appendChild(rankHeader);
        headerRow.appendChild(nameHeader);
        headerRow.appendChild(killsHeader);
        headerRow.appendChild(skullsHeader);
        
        this.scoresContainer.appendChild(headerRow);
        
        // Agregar filas de jugadores
        scores.forEach((player, index) => {
            const row = document.createElement('div');
            row.className = 'scoreboard-row';
            
            // Resaltar al jugador local
            if (player.id === this.localPlayerId) {
                row.classList.add('local-player');
            }
            
            const rank = document.createElement('div');
            rank.textContent = (index + 1).toString();
            rank.className = 'scoreboard-cell scoreboard-rank';
            
            const name = document.createElement('div');
            // Asegurarse de que SIEMPRE usamos el nombre del jugador, nunca fallback al ID
            name.textContent = player.name && player.name !== player.id 
                ? player.name 
                : 'Jugador ' + (index + 1);
            name.className = 'scoreboard-cell scoreboard-name';
            
            const kills = document.createElement('div');
            kills.textContent = (player.kills || 0).toString();
            kills.className = 'scoreboard-cell scoreboard-kills';
            
            // Columna de calaveras
            const skulls = document.createElement('div');
            const skullCount = this.scoreManager.getPlayerSkullCount(player.id) || 0;
            skulls.textContent = skullCount.toString();
            skulls.className = 'scoreboard-cell scoreboard-skulls';
            
            row.appendChild(rank);
            row.appendChild(name);
            row.appendChild(kills);
            row.appendChild(skulls);
            
            this.scoresContainer.appendChild(row);
        });
    }
} 