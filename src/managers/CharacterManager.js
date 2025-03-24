import { Character } from '../entities/Character.js';

export class CharacterManager {
    constructor() {
        this.characters = new Map();
        this.playerCharacter = null;
        this.scene = null; // Referencia a la escena
        this.terrain = null; // Referencia al terreno
    }

    setScene(scene) {
        this.scene = scene;
    }
    
    setTerrain(terrain) {
        this.terrain = terrain;
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
        player.mesh.position.set(0, 1, 0); // Y=1 para asegurar que está sobre el agua
        
        // Añadir el barco a la escena
        this.scene.add(player.mesh);
        
        console.log(`Jugador '${playerName}' creado en posición:`, player.mesh.position);
        
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
            character.update(deltaTime);
        }
    }
}