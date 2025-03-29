import { Character } from '../entities/Character.js';

export class CharacterManager {
    constructor() {
        this.characters = new Map();
        this.playerCharacter = null;
        this.scene = null; // Referencia a la escena
        this.terrain = null; // Referencia al terreno
        this.inputManager = null; // Referencia al inputManager
    }

    setScene(scene) {
        this.scene = scene;
    }
    
    setTerrain(terrain) {
        this.terrain = terrain;
    }
    
    setInputManager(inputManager) {
        this.inputManager = inputManager;
    }

    createCharacter(id = null) {
        if (!this.scene) {
            console.error("No se ha establecido la escena en CharacterManager");
            return null;
        }

        const character = new Character(this.scene);
        if (!character) return null;

        // Si se proporciona un ID, usarlo; si no, generar uno
        const characterId = id || Math.random().toString(36).substring(7);
        this.characters.set(characterId, character);

        return character;
    }

    getCharacter(id) {
        return this.characters.get(id);
    }

    removeCharacter(id) {
        const character = this.characters.get(id);
        if (character) {
            if (character.parent) {
                character.parent.remove(character);
            }
            this.characters.delete(id);
        }
    }

    createPlayer(playerName) {
        // Crear el personaje
        const player = this.createCharacter(playerName);
        if (!player) {
            console.error('No se pudo crear el personaje');
            return null;
        }

        // Configurar el personaje
        player.setTerrain(this.scene.terrain);
        player.setCameraController(this.scene.cameraController);
        
        // Añadir el personaje a la escena
        this.scene.add(player);
        
        // Guardar referencia al personaje del jugador
        this.playerCharacter = player;
        
        return player;
    }

    getPlayerCharacter() {
        return this.playerCharacter;
    }

    updateAll(deltaTime) {
        for (const character of this.characters.values()) {
            // Pasar el inputManager solo al personaje del jugador
            if (character === this.playerCharacter && this.inputManager) {
                character.update(deltaTime, this.inputManager);
            } else {
                character.update(deltaTime);
            }
        }
    }

    // Añadir método para actualizar la posición de un jugador
    updatePlayerPosition(playerData) {
        const player = this.characters.get(playerData.id);
        if (player) {
            player.position.set(
                playerData.position.x,
                playerData.position.y,
                playerData.position.z
            );
            player.rotation.y = playerData.rotation.y;
        }
    }

    // Añadir método para crear un jugador remoto
    createOtherPlayer(playerData) {
        const player = this.createCharacter(playerData.id);
        if (player) {
            player.position.set(
                playerData.position.x,
                playerData.position.y,
                playerData.position.z
            );
            player.rotation.y = playerData.rotation.y;
            
            // Asegurarnos de que el jugador remoto tiene el radio de colisión correcto
            player.radius = 1.5; // Radio de colisión del barco
            player.height = 2;   // Altura de colisión del barco
        }
    }

    // Añadir método para eliminar un jugador
    removePlayer(playerId) {
        const player = this.characters.get(playerId);
        if (player) {
            // Eliminar todos los proyectiles del jugador
            player.projectiles.forEach(projectile => {
                if (projectile.mesh.parent) {
                    projectile.mesh.parent.remove(projectile.mesh);
                }
            });
            player.projectiles = [];

            // Eliminar el jugador de la escena
            if (player.parent) {
                player.parent.remove(player);
            }
            this.characters.delete(playerId);
        }
    }

    // Añadir método para manejar proyectiles de otros jugadores
    handleProjectileUpdate(projectileData) {
        // Verificar que tenemos los datos necesarios
        if (!projectileData || !projectileData.playerId) {
            console.error('Datos de proyectil incompletos:', projectileData);
            return;
        }

        // Ignorar los proyectiles del jugador local (ya los manejamos localmente)
        if (projectileData.playerId === this.playerCharacter?.name) {
            return;
        }

        // Encontrar el jugador que disparó el proyectil
        const player = this.characters.get(projectileData.playerId);
        if (player) {
            // Crear el proyectil remoto con todos los datos necesarios
            player.createOtherPlayerProjectile({
                ...projectileData,
                initialPosition: { 
                    x: projectileData.position.x,
                    y: projectileData.position.y,
                    z: projectileData.position.z
                }
            });
        } else {
            console.warn(`No se encontró el jugador con ID: ${projectileData.playerId} para crear el proyectil`);
        }
    }

    // Añadir método para eliminar proyectiles
    handleProjectileRemove(projectileData) {
        // Verificar que tenemos los datos necesarios
        if (!projectileData || !projectileData.projectileId || !projectileData.playerId) {
            console.error('Datos de eliminación de proyectil incompletos:', projectileData);
            return;
        }

        // Encontrar el jugador que disparó el proyectil
        const player = this.characters.get(projectileData.playerId);
        if (player) {
            player.removeProjectile(projectileData.projectileId);
        }
    }
}