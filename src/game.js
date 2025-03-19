import { Engine } from './core/Engine.js';
import { InputManager } from './core/InputManager.js';
import { Terrain } from './world/Terrain.js';
import { CharacterManager } from './managers/CharacterManager.js';
import * as THREE from 'three';

class Game {
    constructor() {
        this.engine = new Engine();
        this.input = new InputManager();
        this.characterManager = new CharacterManager();
        this.lastTime = 0;
        this.localPlayer = null;
        
        this.setupWorld();
        this.setupTestCharacters();
        this.startGameLoop();
    }

    setupWorld() {
        // Añadir iluminación básica
        const light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(0, 10, 5);
        this.engine.scene.add(light);
        
        // Añadir luz ambiental
        const ambient = new THREE.AmbientLight(0x404040);
        this.engine.scene.add(ambient);

        // Crear y añadir el terreno
        this.terrain = new Terrain();
        this.engine.scene.add(this.terrain.mesh);
    }

    setupTestCharacters() {
        // Crear algunos personajes de prueba
        const blueTeamPositions = [
            { x: -5, z: -5 },
            { x: -5, z: -3 },
            { x: -5, z: -1 },
            { x: -5, z: 1 }
        ];

        const redTeamPositions = [
            { x: 5, z: -5 },
            { x: 5, z: -3 },
            { x: 5, z: -1 },
            { x: 5, z: 1 }
        ];

        // Crear equipo azul
        blueTeamPositions.forEach((pos, index) => {
            const character = this.characterManager.createCharacter(
                `blue_${index}`,
                'blue',
                index,
                this.terrain
            );
            character.setPosition(pos.x, 1.5, pos.z);
            this.engine.scene.add(character.mesh);
        });

        // Crear equipo rojo
        redTeamPositions.forEach((pos, index) => {
            const character = this.characterManager.createCharacter(
                `red_${index}`,
                'red',
                index,
                this.terrain
            );
            character.setPosition(pos.x, 1.5, pos.z);
            this.engine.scene.add(character.mesh);
        });

        // Asignar el primer personaje del equipo azul como jugador local
        this.localPlayer = this.characterManager.getCharacter('blue_0');
        this.engine.setPlayerTarget(this.localPlayer);
    }

    startGameLoop() {
        const gameLoop = (currentTime) => {
            requestAnimationFrame(gameLoop);
            
            // Calcular delta time para animaciones suaves
            const deltaTime = (currentTime - this.lastTime) / 1000;
            this.lastTime = currentTime;
            
            this.update(deltaTime);
        };
        requestAnimationFrame(gameLoop);
    }

    update(deltaTime) {
        // Actualizar el jugador local
        if (this.localPlayer) {
            this.localPlayer.update(deltaTime, this.input);
        }

        // Actualizar otros personajes y verificar colisiones
        const characters = Array.from(this.characterManager.characters.values());
        for (let i = 0; i < characters.length; i++) {
            if (characters[i] !== this.localPlayer) {
                characters[i].update(deltaTime, null);
            }
            
            // Verificar colisiones con otros personajes
            for (let j = i + 1; j < characters.length; j++) {
                characters[i].checkCollision(characters[j]);
            }
        }

        this.engine.update(deltaTime, this.input);
    }
}

window.addEventListener('load', () => {
    const game = new Game();
}); 