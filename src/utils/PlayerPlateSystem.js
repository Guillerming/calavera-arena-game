import * as THREE from 'three';

export class PlayerPlateSystem {
    constructor(scene) {
        this.scene = scene;
        this.camera = null;
        this.playerPlates = new Map(); // Map<playerId, nameSprite>
        this.plateHeight = 5; // Altura del nombre sobre el jugador
        this.playerNames = new Map(); // Map<playerId, nombre>
        this.playerHealth = new Map(); // Map<playerId, salud>
        this.maxHealth = 100; // Salud máxima de un jugador
    }
    
    setCamera(camera) {
        this.camera = camera;
    }
    
    // Actualizar o crear un punto para un jugador
    updatePlayerPlate(playerId, playerPosition, isAlive, playerName, health) {
        // Si el jugador no está vivo, eliminamos su nombre
        if (!isAlive) {
            this.removePlayerPlate(playerId);
            return;
        }
        
        // Almacenar el nombre del jugador si se proporciona
        if (playerName) {
            const oldName = this.playerNames.get(playerId);
            if (oldName !== playerName) {
                console.log(`[PlayerPlateSystem] Actualizando nombre: ${playerId} -> "${playerName}"`);
                this.playerNames.set(playerId, playerName);
                
                // Si ya existe un sprite pero el nombre cambió, recrearlo
                if (this.playerPlates.has(playerId)) {
                    const oldSprite = this.playerPlates.get(playerId);
                    this.scene.remove(oldSprite);
                    this.playerPlates.delete(playerId);
                    this.createPlayerPlate(playerId, playerPosition);
                    return;
                }
            }
        }
        
        // Almacenar la salud del jugador si se proporciona
        if (health !== undefined) {
            const oldHealth = this.playerHealth.get(playerId);
            if (oldHealth !== health) {
                console.log(`[PlayerPlateSystem] Actualizando salud: ${playerId} -> ${health} (antes: ${oldHealth})`);
                this.playerHealth.set(playerId, health);
                
                // Si ya existe un sprite y la salud cambió, recrearlo
                if (this.playerPlates.has(playerId)) {
                    const oldSprite = this.playerPlates.get(playerId);
                    this.scene.remove(oldSprite);
                    this.playerPlates.delete(playerId);
                    this.createPlayerPlate(playerId, playerPosition);
                    return;
                }
            }
        } else {
            console.log(`[PlayerPlateSystem] Advertencia: No se proporcionó salud para el jugador ${playerId}`);
        }
        
        // Si no existe el sprite para este jugador, lo creamos
        if (!this.playerPlates.has(playerId)) {
            this.createPlayerPlate(playerId, playerPosition);
        } else {
            // Si ya existe, actualizamos su posición
            const nameSprite = this.playerPlates.get(playerId);
            
            // Actualizamos la posición del sprite con el nombre
            nameSprite.position.set(
                playerPosition.x,
                playerPosition.y + this.plateHeight,
                playerPosition.z
            );
        }
    }
    
    // Crear un nuevo nombre para un jugador
    createPlayerPlate(playerId, playerPosition) {
        // Crear el sprite con el nombre del jugador
        // Solo usar el nombre real, nunca el ID como fallback
        const playerName = this.playerNames.get(playerId);
        
        // Si no hay nombre disponible, no mostrar nada
        if (!playerName) {
            return null;
        }
        
        // Obtener la salud del jugador, predeterminado a máxima si no se conoce
        const health = this.playerHealth.get(playerId) || this.maxHealth;
        
        // Crear un canvas para el texto y la barra de vida
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 100; // Aumentado para incluir la barra de vida
        
        // Fondo transparente
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        // Establecer el estilo del texto
        context.font = 'Bold 48px Arial';
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // Añadir un borde negro para legibilidad
        context.strokeStyle = 'black';
        context.lineWidth = 6;
        context.strokeText(playerName, canvas.width/2, 32); // Ajustado posición del texto
        
        // Dibujar el texto
        context.fillText(playerName, canvas.width/2, 32); // Ajustado posición del texto
        
        // Dibujar la barra de vida
        const barWidth = 200;
        const barHeight = 20;
        const barX = (canvas.width - barWidth) / 2;
        const barY = 70; // Posición debajo del nombre
        
        // Dibujar fondo de la barra (borde negro)
        context.fillStyle = 'black';
        context.fillRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);
        
        // Dibujar fondo de la barra (gris)
        context.fillStyle = '#444444';
        context.fillRect(barX, barY, barWidth, barHeight);
        
        // Calcular ancho de la barra en función de la salud
        const healthBarWidth = (health / this.maxHealth) * barWidth;
        
        // Elegir color según nivel de salud
        if (health > 70) {
            context.fillStyle = '#00FF00'; // Verde para salud alta
        } else if (health > 30) {
            context.fillStyle = '#FFFF00'; // Amarillo para salud media
        } else {
            context.fillStyle = '#FF0000'; // Rojo para salud baja
        }
        
        // Dibujar barra de vida
        context.fillRect(barX, barY, healthBarWidth, barHeight);
        
        // Crear textura a partir del canvas
        const texture = new THREE.CanvasTexture(canvas);
        
        // Crear material con la textura
        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true
        });
        
        // Crear el sprite
        const nameSprite = new THREE.Sprite(spriteMaterial);
        nameSprite.scale.set(5, 2, 1); // Escala ajustada para incluir la barra de vida
        
        // Posicionar el sprite
        nameSprite.position.set(
            playerPosition.x,
            playerPosition.y + this.plateHeight,
            playerPosition.z
        );
        
        // Añadir a la escena
        this.scene.add(nameSprite);
        
        // Guardar referencia en el mapa
        this.playerPlates.set(playerId, nameSprite);
        
        return nameSprite;
    }
    
    // Eliminar el nombre de un jugador
    removePlayerPlate(playerId) {
        if (!this.playerPlates.has(playerId)) return;
        
        const nameSprite = this.playerPlates.get(playerId);
        
        // Eliminar de la escena
        this.scene.remove(nameSprite);
        
        // Eliminar del mapa
        this.playerPlates.delete(playerId);
        this.playerNames.delete(playerId);
        this.playerHealth.delete(playerId);
    }
    
    // Actualizar todos los nombres
    updateAllPlates() {
        // Los sprites ya tienen un comportamiento de billboarding incorporado
        // por lo que no es necesario ajustar la orientación
    }
    
    // Limpiar todos los nombres
    clearAllPlates() {
        for (const playerId of this.playerPlates.keys()) {
            this.removePlayerPlate(playerId);
        }
    }
} 