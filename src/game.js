import { Engine } from './core/Engine.js';
import { InputManager } from './core/InputManager.js';
import { Terrain } from './world/Terrain.js';
import { CharacterManager } from './managers/CharacterManager.js';
import * as THREE from 'three';
import { DebugUI } from './utils/DebugUI.js';

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
        this.debugUI = new DebugUI();
    }

    setupWorld() {
        // Luz direccional (sol)
        const sun = new THREE.DirectionalLight(0xffffff, 1.0);
        sun.position.set(20, 30, 20);
        sun.castShadow = true;
        
        // Ajustar sombras para que sean más suaves
        sun.shadow.camera.left = -30;
        sun.shadow.camera.right = 30;
        sun.shadow.camera.top = 30;
        sun.shadow.camera.bottom = -30;
        sun.shadow.camera.near = 1;
        sun.shadow.camera.far = 100;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        sun.shadow.bias = -0.001;
        
        // Hacer las sombras más suaves y menos intensas
        sun.shadow.radius = 2;
        sun.shadow.darkness = 0.3;

        this.engine.scene.add(sun);
        
        // Aumentar la luz ambiental para reducir el contraste
        const ambient = new THREE.AmbientLight(0x404040, 0.7);
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
    
        // Crear personaje principal
        const mainCharacter = this.characterManager.createCharacter(
            'main_character',
            'blue',
            0,
            this.terrain
        );
        // Posicionar personaje principal
        const mainTerrainHeight = this.terrain.getHeightAt(0, 0);
        mainCharacter.setPosition(0, mainTerrainHeight + mainCharacter.height / 2, 0);
        this.engine.scene.add(mainCharacter.mesh);
        
        // Asignar el personaje principal como jugador local
        this.localPlayer = this.characterManager.getCharacter('main_character');
        this.engine.setPlayerTarget(this.localPlayer);
    
        // Crear equipo azul
        blueTeamPositions.forEach((pos, index) => {
            const character = this.characterManager.createCharacter(
                `blue_${index}`,
                'blue',
                index,
                this.terrain
            );
            // Importante: Calcular la altura del terreno y posicionar correctamente
            const terrainHeight = this.terrain.getHeightAt(pos.x, pos.z);
            character.setPosition(pos.x, terrainHeight + character.height / 2, pos.z);
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
            // Importante: Calcular la altura del terreno y posicionar correctamente
            const terrainHeight = this.terrain.getHeightAt(pos.x, pos.z);
            character.setPosition(pos.x, terrainHeight + character.height / 2, pos.z);
            this.engine.scene.add(character.mesh);
        });
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

        // Actualizar el debug UI si existe un jugador local
        if (this.localPlayer) {
            this.debugUI.update(this.localPlayer, this.terrain);
        }
    }
}

window.addEventListener('load', () => {
    const game = new Game();
}); 