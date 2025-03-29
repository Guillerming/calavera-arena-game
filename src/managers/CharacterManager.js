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
}