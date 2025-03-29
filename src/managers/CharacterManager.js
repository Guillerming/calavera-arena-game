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

    async createPlayer(playerName) {
        if (!this.scene) {
            console.error("No se ha establecido la escena en CharacterManager");
            return null;
        }

        // Crear el personaje del jugador
        const player = this.createCharacter();
        if (!player) return null;
        
        // Guardar referencia al personaje del jugador
        this.playerCharacter = player;
        
        // Establecer el nombre del jugador
        player.playerName = playerName;
        
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
}