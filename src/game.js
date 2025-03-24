import { Engine } from './core/Engine.js';
import { InputManager } from './core/InputManager.js';
import { Terrain } from './world/Terrain.js';
import { Water } from './world/Water.js';
import { CharacterManager } from './managers/CharacterManager.js';
import * as THREE from 'three';
import { DebugUI } from './utils/DebugUI.js';
import { LoadingScreen } from './ui/LoadingScreen.js';
import { Logger } from './utils/Logger.js';

export class Game {
    constructor() {
        this.logger = new Logger();
        this.logger.start('constructor');
        
        this.engine = new Engine();
        this.inputManager = new InputManager();
        this.terrain = new Terrain();
        this.water = new Water();
        this.characterManager = new CharacterManager();
        this.debugUI = new DebugUI();
        
        // Proporcionar la referencia a la escena al CharacterManager
        this.characterManager.setScene(this.engine.scene);
        
        this.logger.end('constructor');
        
        // Inicializar el juego solo cuando se complete la pantalla de carga
        this.initialized = false;
        this.worldInitialized = false;
        
        // Comenzar a cargar el mundo inmediatamente
        this.setupWorld().then(() => {
            this.worldInitialized = true;
            console.log("Mundo cargado, esperando al jugador...");
            
            // Si el jugador ya ha introducido su nombre, iniciar el juego
            if (this.initialized) {
                this.startGame();
            }
        });
        
        // Crear pantalla de carga
        this.loadingScreen = new LoadingScreen((playerName) => {
            // Cuando el usuario completa la pantalla de carga
            this.playerName = playerName;
            this.initialized = true;
            
            // Si el mundo ya está cargado, iniciar el juego
            if (this.worldInitialized) {
                this.startGame();
            }
        });
        this.loadingScreen.show();
    }

    async setupWorld() {
        this.logger.start('setupWorld');
        
        // Cargar el terreno
        const terrainGroup = await this.terrain.initialize();
        this.engine.scene.add(terrainGroup);
        
        // Cargar el agua
        const waterGroup = await this.water.initialize();
        this.engine.scene.add(waterGroup);
        
        // Configurar la cámara
        this.engine.camera.position.set(0, 20, 20);
        this.engine.camera.lookAt(0, 0, 0);
        
        // Configurar luces
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.engine.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 5, 5);
        directionalLight.castShadow = true;
        this.engine.scene.add(directionalLight);
        
        this.logger.end('setupWorld');
    }

    async startGame() {
        // Pasar el terreno al crear el jugador
        this.characterManager.setTerrain(this.terrain);
        
        // Crear el barco con el nombre del jugador
        const player = await this.characterManager.createPlayer(this.playerName);
        
        if (player) {
            // Posicionar la cámara para seguir al jugador
            this.engine.setPlayerTarget(player);
            
            // Mover la cámara más cerca del barco y con un buen ángulo
            this.engine.camera.position.set(
                player.mesh.position.x, 
                player.mesh.position.y + 5,  // 5 unidades sobre el barco
                player.mesh.position.z + 10  // 10 unidades detrás del barco
            );
            this.engine.camera.lookAt(player.mesh.position);
            
            console.log("Juego iniciado con jugador:", this.playerName);
        } else {
            console.error("No se pudo crear el jugador");
        }
        
        // Iniciar el bucle de juego
        this.gameLoop();
    }

    async start() {
        // Este método ahora solo espera hasta que ambos (jugador y mundo) estén listos
        await new Promise(resolve => {
            const checkInitialization = () => {
                if (this.initialized && this.worldInitialized) {
                    resolve();
                } else {
                    setTimeout(checkInitialization, 100);
                }
            };
            checkInitialization();
        });
    }

    gameLoop() {
        requestAnimationFrame(() => this.gameLoop());
        
        // Calcular delta time
        const now = performance.now();
        const deltaTime = (now - (this.lastTime || now)) / 1000;
        this.lastTime = now;
        
        // Actualizar el mundo
        this.engine.update(deltaTime, this.inputManager);
        this.inputManager.update();
        this.characterManager.update(deltaTime);
        
        // Actualizar el agua - asegurando que se pasa el deltaTime correcto
        this.water.update(deltaTime);
        
        // Renderizar
        this.engine.render();
    }
}