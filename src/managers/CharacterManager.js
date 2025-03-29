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

    createCharacter() {
        if (!this.scene) {
            console.error("No se ha establecido la escena en CharacterManager");
            return null;
        }
        const character = new Character(this.scene);
        return character;
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
        this.characters.set('player', player);
        
        // Establecer el nombre del jugador
        player.playerName = playerName;
        
        return player;
    }

    removeCharacter(id) {
        const character = this.characters.get(id);
        if (character) {
            // Aquí añadiremos lógica para limpiar recursos
            this.characters.delete(id);
        }
    }

    getCharacter(id) {
        return this.characters.get(id);
    }

    update(deltaTime) {
        this.updateAll(deltaTime);
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