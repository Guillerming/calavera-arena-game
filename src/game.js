import { Engine } from './core/Engine.js';
import { InputManager } from './core/InputManager.js';
import { Terrain } from './world/Terrain.js';
import { Water } from './world/Water.js';
import { CharacterManager } from './managers/CharacterManager.js';
import { NetworkManager } from './network/NetworkManager.js';
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
        this.networkManager = new NetworkManager();
        
        // Proporcionar referencias al CharacterManager
        this.characterManager.setScene(this.engine.scene);
        this.characterManager.setInputManager(this.inputManager);
        
        this.logger.end('constructor');
        
        // Inicializar el juego solo cuando se complete la pantalla de carga
        this.initialized = false;
        this.worldInitialized = false;
        
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
        
        // Añadir el terreno a la escena para que sea accesible
        this.engine.scene.terrain = this.terrain;
        
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
        // Asegurarnos de que el terreno está disponible
        if (!this.terrain) {
            console.error('El terreno no está inicializado');
            return;
        }

        // Asegurarnos de que el terreno está en la escena
        if (!this.engine.scene.terrain) {
            this.engine.scene.terrain = this.terrain;
        }

        // Crear el personaje del jugador
        this.player = this.characterManager.createPlayer(this.playerName);
        if (!this.player) {
            console.error('No se pudo crear el jugador');
            return;
        }

        // Configurar el jugador
        this.player.setNetworkManager(this.networkManager);
        this.player.setCameraController(this.engine.getCameraController());

        // Posicionar la cámara para seguir al jugador
        this.engine.setPlayerTarget(this.player);
        this.engine.camera.position.set(0, 10, 15);
        this.engine.camera.lookAt(0, 0, 0);

        // Configurar callbacks de red
        this.networkManager.onPlayerUpdate = (playerData) => {
            if (playerData.id !== this.networkManager.playerId) {
                this.characterManager.updatePlayerPosition(playerData);
            }
        };

        this.networkManager.onPlayerJoin = (playerData) => {
            if (playerData.id !== this.networkManager.playerId) {
                this.characterManager.createOtherPlayer(playerData);
            }
        };

        this.networkManager.onPlayerLeave = (playerId) => {
            this.characterManager.removePlayer(playerId);
        };

        // Conectar al servidor
        this.networkManager.connect();

        // Iniciar el bucle del juego
        this.gameLoop();
    }

    async start() {
        // Inicializar el mundo
        await this.setupWorld();
        this.worldInitialized = true;
        
        // Si el jugador ya ha introducido su nombre, iniciar el juego
        if (this.initialized) {
            this.startGame();
        }
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
        this.characterManager.updateAll(deltaTime);
        
        // Actualizar el agua - asegurando que se pasa el deltaTime correcto
        this.water.update(deltaTime);

        // Enviar actualización de posición al servidor
        const player = this.characterManager.getPlayerCharacter();
        if (player && this.networkManager.connected) {
            this.networkManager.sendUpdate(player.position, player.rotation);
        }
        
        // Renderizar
        this.engine.render();
    }
}