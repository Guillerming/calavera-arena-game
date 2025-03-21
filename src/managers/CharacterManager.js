import { Character } from '../entities/Character.js';

export class CharacterManager {
    constructor() {
        this.characters = new Map();
    }

    createCharacter(id, team, modelVariant, terrain) {
        const character = new Character(team, modelVariant, terrain);
        this.characters.set(id, character);
        
        // No modificamos la posición aquí, lo dejaremos para el método que llama a createCharacter
        // para que tenga un control más explícito de la ubicación
        
        return character;
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

    updateAll(deltaTime) {
        for (const character of this.characters.values()) {
            character.update(deltaTime);
        }
    }
}