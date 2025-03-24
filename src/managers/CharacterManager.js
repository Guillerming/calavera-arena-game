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

    createCharacter(id, team, modelVariant, terrain) {
        const character = new Character(team, modelVariant, terrain || this.terrain);
        this.characters.set(id, character);
        return character;
    }

    async createPlayer(playerName) {
        if (!this.scene) {
            console.error("No se ha establecido la escena en CharacterManager");
            return null;
        }

        // Crear el personaje del jugador con el terreno
        const player = this.createCharacter('player', 'blue', 0, this.terrain);
        
        // Guardar referencia al personaje del jugador
        this.playerCharacter = player;
        
        // Establecer el nombre del jugador
        player.playerName = playerName;
        
        // Posicionar el barco en una posición inicial visible
        // El agua está a nivel y=0.05, posicionamos el barco para que flote correctamente
        player.mesh.position.set(0, 0.3, 0);
        
        // Añadir el barco a la escena
        this.scene.add(player.mesh);
        
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

    update() {
        // Redirigir al método updateAll para mantener compatibilidad
        this.updateAll();
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