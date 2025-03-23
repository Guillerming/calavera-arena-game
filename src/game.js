import { Engine } from './core/Engine.js';
import { InputManager } from './core/InputManager.js';
import { Terrain } from './world/Terrain.js';
import { Water } from './world/Water.js';  // Importar la nueva clase Water
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

    async setupWorld() {
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

        // Añadir una luz hemisférica para mejorar la iluminación global
        const hemiLight = new THREE.HemisphereLight(0xffffbb, 0x080820, 0.5);
        this.engine.scene.add(hemiLight);

        // Crear y añadir el terreno
        this.terrain = new Terrain();
        const terrainGroup = await this.terrain.initialize();
        if (terrainGroup) {
            this.engine.scene.add(terrainGroup);
        }

        this.water = new Water(this.terrain.size, -0.1); // Un poco por debajo de la línea de costa
        this.engine.scene.add(this.water.mesh);
        // Continuar con el resto de la inicialización
        this.setupTestCharacters();
    }

    setupTestCharacters() {
        // Crear solo la barca del jugador
        const boat = this.characterManager.createCharacter(
            'player',
            'blue',
            0,
            this.terrain
        );
        
        // Posicionar la barca en el agua, siempre a y = 0
        boat.mesh.position.set(0, 0, 40);
        this.engine.scene.add(boat.mesh);
        this.localPlayer = boat;
        
        // Asignar la barca como objetivo de la cámara
        this.engine.cameraController.setTarget(boat);
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

        // Actualizar el agua (animación de olas)
        if (this.water) {
            this.water.update(deltaTime);
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