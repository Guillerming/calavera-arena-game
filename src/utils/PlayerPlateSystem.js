import * as THREE from 'three';

export class PlayerPlateSystem {
    constructor(scene) {
        this.scene = scene;
        this.camera = null;
        this.playerPlates = new Map(); // Map<playerId, playerPlate>
        this.plateHeight = 10; // Altura del punto sobre el jugador
        
        // Configuramos el material y la geometría que compartirán todos los puntos
        this.plateGeometry = new THREE.CircleGeometry(0.5, 16);
        this.plateMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x000000,
            side: THREE.DoubleSide // Visible desde ambos lados
        });
    }
    
    setCamera(camera) {
        this.camera = camera;
    }
    
    // Actualizar o crear un punto para un jugador
    updatePlayerPlate(playerId, playerPosition, isAlive) {
        // Si el jugador no está vivo, eliminamos su punto si existe
        if (!isAlive) {
            this.removePlayerPlate(playerId);
            return;
        }
        
        // Si no existe el punto para este jugador, lo creamos
        if (!this.playerPlates.has(playerId)) {
            this.createPlayerPlate(playerId, playerPosition);
        } else {
            // Si ya existe, actualizamos su posición
            const plate = this.playerPlates.get(playerId);
            plate.position.set(
                playerPosition.x,
                playerPosition.y + this.plateHeight,
                playerPosition.z
            );
        }
        
        // Orientar el punto hacia la cámara
        this.updatePlateLookAt(playerId);
    }
    
    // Crear un nuevo punto para un jugador
    createPlayerPlate(playerId, playerPosition) {
        const plate = new THREE.Mesh(this.plateGeometry, this.plateMaterial);
        
        // Posicionar el punto sobre el jugador
        plate.position.set(
            playerPosition.x,
            playerPosition.y + this.plateHeight,
            playerPosition.z
        );
        
        // Añadir a la escena
        this.scene.add(plate);
        
        // Guardar referencia en el mapa
        this.playerPlates.set(playerId, plate);
        
        return plate;
    }
    
    // Actualizar la orientación de un punto hacia la cámara
    updatePlateLookAt(playerId) {
        if (!this.playerPlates.has(playerId) || !this.camera) return;
        
        const plate = this.playerPlates.get(playerId);
        
        // Restaurar la rotación para empezar desde cero
        plate.rotation.set(0, 0, 0);
        
        // Hacer que el punto mire hacia la cámara
        plate.lookAt(this.camera.position);
        
        // Rotar 90 grados en el eje X para que el disco sea perpendicular a la dirección de la cámara
        plate.rotation.x += Math.PI / 2;
    }
    
    // Eliminar el punto de un jugador
    removePlayerPlate(playerId) {
        if (!this.playerPlates.has(playerId)) return;
        
        const plate = this.playerPlates.get(playerId);
        
        // Eliminar de la escena
        this.scene.remove(plate);
        
        // Eliminar del mapa
        this.playerPlates.delete(playerId);
    }
    
    // Actualizar todos los puntos
    updateAllPlates() {
        if (!this.camera) return;
        
        // Actualizar la orientación de todos los puntos
        for (const playerId of this.playerPlates.keys()) {
            this.updatePlateLookAt(playerId);
        }
    }
    
    // Limpiar todos los puntos
    clearAllPlates() {
        for (const playerId of this.playerPlates.keys()) {
            this.removePlayerPlate(playerId);
        }
    }
} 