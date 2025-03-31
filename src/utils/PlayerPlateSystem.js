import * as THREE from 'three';

export class PlayerPlateSystem {
    constructor(scene) {
        this.scene = scene;
        this.camera = null;
        this.playerPlates = new Map(); // Map<playerId, nameSprite>
        this.plateHeight = 5; // Altura del nombre sobre el jugador
        this.playerNames = new Map(); // Map<playerId, nombre>
    }
    
    setCamera(camera) {
        this.camera = camera;
    }
    
    // Actualizar o crear un punto para un jugador
    updatePlayerPlate(playerId, playerPosition, isAlive, playerName) {
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
        
        // Crear un canvas para el texto
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 64;
        
        // Establecer el estilo del texto
        context.font = 'Bold 48px Arial';
        context.fillStyle = 'white';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // Añadir un borde negro para legibilidad
        context.strokeStyle = 'black';
        context.lineWidth = 6;
        context.strokeText(playerName, canvas.width/2, canvas.height/2);
        
        // Dibujar el texto
        context.fillText(playerName, canvas.width/2, canvas.height/2);
        
        // Crear textura a partir del canvas
        const texture = new THREE.CanvasTexture(canvas);
        
        // Crear material con la textura
        const spriteMaterial = new THREE.SpriteMaterial({
            map: texture,
            transparent: true
        });
        
        // Crear el sprite
        const nameSprite = new THREE.Sprite(spriteMaterial);
        nameSprite.scale.set(5, 1.25, 1);
        
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