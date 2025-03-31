import { Engine } from './core/Engine.js';
import { InputManager } from './core/InputManager.js';
import { Terrain } from './world/Terrain.js';
import { Water } from './world/Water.js';
import { CharacterManager } from './managers/CharacterManager.js';
import { NetworkManager } from './network/NetworkManager.js';
import { ScoreManager } from './managers/ScoreManager.js';
import { ScoreboardUI } from './ui/ScoreboardUI.js';
import * as THREE from 'three';
import { DebugUI } from './utils/DebugUI.js';
import { LoadingScreen } from './ui/LoadingScreen.js';
import { Logger } from './utils/Logger.js';
import { PlayerPlateSystem } from './utils/PlayerPlateSystem.js';
import { SkullGameMode } from './modes/SkullGameMode.js';

export class Game {
    constructor() {
        this.logger = new Logger();
        this.logger.start('constructor');
        
        this.engine = new Engine();
        this.inputManager = new InputManager();
        this.terrain = new Terrain();
        this.water = new Water();
        this.characterManager = new CharacterManager();
        this.characterManager.setScene(this.engine.scene);
        this.characterManager.setTerrain(this.terrain);
        this.characterManager.setInputManager(this.inputManager);
        
        // Asignar el characterManager a la escena para que otros componentes puedan acceder a él
        this.engine.scene.characterManager = this.characterManager;
        
        this.debugUI = new DebugUI();
        this.networkManager = new NetworkManager();
        
        // Asignar referencia al juego en el NetworkManager
        this.networkManager.setGame(this);
        
        // Inicializar el sistema de puntuaciones
        this.scoreManager = new ScoreManager();
        
        // Inicializar el sistema de playerPlates (puntos sobre jugadores)
        this.playerPlateSystem = new PlayerPlateSystem(this.engine.scene);
        
        // Configurar el CharacterManager
        this.characterManager.setNetworkManager(this.networkManager);
        this.characterManager.setScoreManager(this.scoreManager);
        
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

        // Configurar el sistema de puntuaciones para el jugador actual
        if (this.scoreManager) {
            this.scoreManager.initPlayer(this.networkManager.playerId, this.playerName);
        }
        
        // Inicializar la UI del scoreboard
        this.scoreboardUI = new ScoreboardUI(
            this.scoreManager,
            this.inputManager,
            this.networkManager
        );
        this.characterManager.setScoreboardUI(this.scoreboardUI);
        
        // Inicializar el modo de juego Calavera
        this.skullGameMode = new SkullGameMode(this);

        // Configurar el jugador
        this.player.setNetworkManager(this.networkManager);
        this.player.setCameraController(this.engine.getCameraController());

        // Posicionar la cámara para seguir al jugador
        this.engine.setPlayerTarget(this.player);
        this.engine.camera.position.set(0, 10, 15);
        this.engine.camera.lookAt(0, 0, 0);

        // Configurar la cámara para el sistema de playerPlates
        this.playerPlateSystem.setCamera(this.engine.camera);

        // Configurar callbacks de red
        this.networkManager.onPlayerUpdate = (playerData) => {
            if (playerData.id !== this.networkManager.playerId) {
                this.characterManager.updatePlayerPosition(playerData);
                
                // Actualizar la posición del playerPlate para este jugador
                if (playerData && playerData.id) {
                    this.playerPlateSystem.updatePlayerPlate(
                        playerData.id,
                        playerData.position,
                        true, // Asumimos que está vivo si recibimos actualizaciones
                        playerData.name // Pasar el nombre del jugador
                    );
                }
            }
        };

        this.networkManager.onPlayerJoin = (playerData) => {
            if (playerData.id !== this.networkManager.playerId) {
                // Inicializar el jugador en el sistema de puntuaciones
                if (this.scoreManager) {
                    this.scoreManager.initPlayer(playerData.id, playerData.name || playerData.id);
                }
                this.characterManager.createOtherPlayer(playerData);
                
                // Crear un playerPlate para este jugador
                if (playerData && playerData.id && playerData.position) {
                    this.playerPlateSystem.updatePlayerPlate(
                        playerData.id,
                        playerData.position,
                        true, // El jugador está vivo al unirse
                        playerData.name // Pasar el nombre del jugador
                    );
                }
            }
        };

        this.networkManager.onPlayerLeave = (playerId) => {
            this.characterManager.removePlayer(playerId);
            
            // Eliminar el playerPlate de este jugador
            this.playerPlateSystem.removePlayerPlate(playerId);
        };

        // Añadir callbacks para proyectiles
        this.networkManager.onProjectileUpdate = (projectileData) => {
            this.characterManager.handleProjectileUpdate(projectileData);
        };

        this.networkManager.onProjectileRemove = (projectileData) => {
            this.characterManager.handleProjectileRemove(projectileData);
        };

        // Añadir callback para colisiones de proyectiles
        this.networkManager.onProjectileCollision = (collisionData) => {
            this.characterManager.handleProjectileCollision(collisionData);
        };

        // Añadir callback para actualizaciones de salud
        this.networkManager.onHealthUpdate = (playerData) => {
            this.characterManager.handleHealthUpdate(playerData);
            
            // Actualizar el playerPlate según el estado de vida del jugador
            if (playerData && playerData.id) {
                // Si el jugador es remoto (no el jugador local)
                if (playerData.id !== this.networkManager.playerId) {
                    const character = this.characterManager.getCharacter(playerData.id);
                    if (character) {
                        this.playerPlateSystem.updatePlayerPlate(
                            playerData.id,
                            character.position,
                            playerData.isAlive,
                            character.name // Usar el nombre del personaje
                        );
                    }
                }
            }
        };
        
        // Añadir callback para kills
        this.networkManager.onKill = (killerId, victimId) => {
            // Mostrar mensaje de kill en la consola y posiblemente en la UI
            console.log(`¡${killerId} eliminó a ${victimId}!`);
        };

        // Conectar al servidor
        this.networkManager.connect();
        
        // Iniciar el modo de juego Calavera
        this.skullGameMode.start();

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
        if (!this.lastTime) this.lastTime = now;
        const deltaTime = (now - this.lastTime) / 1000; // Convertir a segundos
        this.lastTime = now;
        
        // Actualizar el motor con inputManager
        this.engine.update(deltaTime, this.inputManager);
        
        // Actualizar inputManager
        this.inputManager.update();
        
        // Actualizar los personajes
        this.characterManager.updateAll(deltaTime);
        
        // Actualizar el agua
        this.water.update(deltaTime);
        
        // Obtener el personaje del jugador
        const player = this.characterManager.getPlayerCharacter();
        
        // Actualizar el debugUI con el personaje del jugador
        if (player) {
            this.debugUI.update(player);
        }
        
        // Enviar actualizaciones al servidor
        if (player && this.networkManager.connected) {
            this.networkManager.sendUpdate(player.position, player.rotation);
        }
        
        // Actualizar el sistema de playerPlates
        if (this.playerPlateSystem) {
            this.playerPlateSystem.updateAllPlates();
            
            // Actualizar el playerPlate para cada personaje en la escena excepto el jugador local
            for (const [characterId, character] of this.characterManager.characters.entries()) {
                // No crear un punto sobre el jugador local
                if (character.isLocalPlayer) continue;
                
                this.playerPlateSystem.updatePlayerPlate(
                    characterId,
                    character.position,
                    character.isAlive,
                    character.name // Pasar el nombre del personaje
                );
            }
        }
        
        // Actualizar el ScoreboardUI para detectar la tecla Shift
        if (this.scoreboardUI) {
            this.scoreboardUI.update();
        }
        
        // Actualizar el modo de juego Calavera
        if (this.skullGameMode) {
            this.skullGameMode.update(deltaTime);
        }
        
        // Renderizar la escena
        this.engine.render();
    }
}