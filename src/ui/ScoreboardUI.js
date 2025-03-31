export class ScoreboardUI {
    constructor(scoreManager, inputManager, networkManager) {
        this.scoreManager = scoreManager;
        this.inputManager = inputManager;
        this.networkManager = networkManager;
        this.isVisible = false;
        this.scoreboardContainer = null;
        this.localPlayerId = null;
        
        if (this.networkManager) {
            this.localPlayerId = this.networkManager.getPlayerId();
        }
        
        this.createScoreboardUI();
    }
    
    createScoreboardUI() {
        // Crear el contenedor principal (inicialmente oculto)
        this.scoreboardContainer = document.createElement('div');
        this.scoreboardContainer.style.position = 'fixed';
        this.scoreboardContainer.style.top = '50%';
        this.scoreboardContainer.style.left = '50%';
        this.scoreboardContainer.style.transform = 'translate(-50%, -50%)';
        this.scoreboardContainer.style.width = '80%';
        this.scoreboardContainer.style.maxWidth = '600px';
        this.scoreboardContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        this.scoreboardContainer.style.color = 'white';
        this.scoreboardContainer.style.padding = '20px';
        this.scoreboardContainer.style.borderRadius = '5px';
        this.scoreboardContainer.style.fontFamily = 'Arial, sans-serif';
        this.scoreboardContainer.style.zIndex = '1000';
        this.scoreboardContainer.style.display = 'none';
        
        // Título
        const title = document.createElement('h2');
        title.textContent = 'Tabla de Puntuaciones';
        title.style.textAlign = 'center';
        title.style.margin = '0 0 20px 0';
        title.style.color = '#ffcc00';
        this.scoreboardContainer.appendChild(title);
        
        // Contenedor para las filas de puntuaciones
        this.scoresContainer = document.createElement('div');
        this.scoreboardContainer.appendChild(this.scoresContainer);
        
        document.body.appendChild(this.scoreboardContainer);
    }
    
    update() {
        // Verificar que el InputManager está disponible
        if (!this.inputManager) {
            console.error("[ScoreboardUI] No hay referencia a inputManager");
            return;
        }
        
        // Comprobar si se mantiene pulsada la tecla Shift para mostrar/ocultar el scoreboard
        const isShiftPressed = this.inputManager.isKeyPressed('ShiftLeft') || this.inputManager.isKeyPressed('ShiftRight');
        
        // Log para depuración (comentar en producción)
        
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
        if (this.isVisible) return;
        
        this.isVisible = true;
        this.scoreboardContainer.style.display = 'block';
        
        // Solicitar sincronización de marcadores al servidor antes de mostrar
        if (this.networkManager && this.networkManager.requestScoreSync) {
            this.networkManager.requestScoreSync();
        }
        
        this.updateScores();
    }
    
    hide() {
        if (!this.isVisible) return;
        
        this.isVisible = false;
        this.scoreboardContainer.style.display = 'none';
    }
    
    updateScores() {
        // Limpiar contenedor de puntuaciones
        this.scoresContainer.innerHTML = '';
        
        // Obtener puntuaciones ordenadas
        const scores = this.scoreManager.getScores();
        
        if (scores.length === 0) {
            const emptyMessage = document.createElement('p');
            emptyMessage.textContent = 'No hay jugadores con puntuaciones';
            emptyMessage.style.textAlign = 'center';
            emptyMessage.style.color = '#999';
            this.scoresContainer.appendChild(emptyMessage);
            return;
        }
        
        // Crear encabezado de la tabla
        const headerRow = document.createElement('div');
        headerRow.style.display = 'grid';
        headerRow.style.gridTemplateColumns = '1fr 4fr 1fr 1fr';
        headerRow.style.padding = '8px 0';
        headerRow.style.borderBottom = '1px solid #555';
        headerRow.style.fontWeight = 'bold';
        headerRow.style.color = '#aaa';
        
        const rankHeader = document.createElement('div');
        rankHeader.textContent = '#';
        rankHeader.style.textAlign = 'center';
        
        const nameHeader = document.createElement('div');
        nameHeader.textContent = 'Jugador';
        nameHeader.style.paddingLeft = '10px';
        
        const killsHeader = document.createElement('div');
        killsHeader.textContent = 'Kills';
        killsHeader.style.textAlign = 'center';
        
        const skullsHeader = document.createElement('div');
        skullsHeader.textContent = '💀';
        skullsHeader.style.textAlign = 'center';
        skullsHeader.style.fontSize = '1.2em'; // Aumentar tamaño para mejor visibilidad
        
        headerRow.appendChild(rankHeader);
        headerRow.appendChild(nameHeader);
        headerRow.appendChild(killsHeader);
        headerRow.appendChild(skullsHeader);
        
        this.scoresContainer.appendChild(headerRow);
        
        // Agregar filas de jugadores
        scores.forEach((player, index) => {
            const row = document.createElement('div');
            row.style.display = 'grid';
            row.style.gridTemplateColumns = '1fr 4fr 1fr 1fr';
            row.style.padding = '8px 0';
            row.style.borderBottom = '1px solid #333';
            
            // Resaltar al jugador local
            if (player.id === this.localPlayerId) {
                row.style.backgroundColor = 'rgba(255, 255, 0, 0.2)';
                row.style.borderRadius = '3px';
            }
            
            const rank = document.createElement('div');
            rank.textContent = (index + 1).toString();
            rank.style.textAlign = 'center';
            
            const name = document.createElement('div');
            // Asegurarse de que SIEMPRE usamos el nombre del jugador, nunca fallback al ID
            name.textContent = player.name && player.name !== player.id 
                ? player.name 
                : 'Jugador ' + (index + 1);
            name.style.paddingLeft = '10px';
            name.style.overflow = 'hidden';
            name.style.textOverflow = 'ellipsis';
            name.style.whiteSpace = 'nowrap';
            
            const kills = document.createElement('div');
            kills.textContent = (player.kills || 0).toString();
            kills.style.textAlign = 'center';
            kills.style.fontWeight = 'bold';
            kills.style.color = '#55ff55';
            
            // Columna de calaveras
            const skulls = document.createElement('div');
            const skullCount = this.scoreManager.getPlayerSkullCount(player.id) || 0;
            skulls.textContent = skullCount.toString();
            skulls.style.textAlign = 'center';
            skulls.style.fontWeight = 'bold';
            skulls.style.color = '#ffff55'; // Color amarillo para calaveras
            
            row.appendChild(rank);
            row.appendChild(name);
            row.appendChild(kills);
            row.appendChild(skulls);
            
            this.scoresContainer.appendChild(row);
        });
    }
} 