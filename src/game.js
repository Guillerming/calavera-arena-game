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
import { AudioManager } from './utils/AudioManager.js';
import { PortalManager } from './utils/PortalManager.js';

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
        this.characterManager.setGame(this);
        
        // Sistema de audio
        this.audioManager = new AudioManager();
        
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
        
        // Inicializar sistema de portales
        this.portalManager = new PortalManager(this);
        
        this.logger.end('setupWorld');
    }

    async startGame() {
        // Asegurarnos de que el terreno está disponible
        if (!this.terrain) {
            console.error('Terrain is not initialized');
            return;
        }

        // Asegurarnos de que el terreno está en la escena
        if (!this.engine.scene.terrain) {
            this.engine.scene.terrain = this.terrain;
        }

        // Crear el personaje del jugador
        this.player = this.characterManager.createPlayer(this.playerName);
        if (!this.player) {
            console.error('Could not create player');
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
        
        // Asegurarse de que el sistema de audio esté inicializado
        if (!this.audioManager.initialized) {
            await this.audioManager.init();
        }
        
        // La música de intro (osd.mp3) ya debería estar sonando desde initialize()
        // Programar el cambio a la música del juego después de 10 segundos
        // para dar tiempo a escuchar la intro
        if (this.audioManager.currentMusic === 'osd') {
            setTimeout(() => {
                this.audioManager.playMusic('sailing');
            }, 10000); // 10 segundos para escuchar la intro
        } else {
            // Si por alguna razón no está sonando osd, reproducir sailing directamente
            this.audioManager.playMusic('sailing');
        }
        
        // Programar una verificación periódica de la música si no se ha hecho ya
        if (!this._audioCheckScheduled) {
            this.scheduleAudioCheck();
        }
        
        // Iniciar el modo de juego Calavera
        this.skullGameMode = new SkullGameMode(this);
        
        // Inicializar portales después de que el jugador esté listo
        if (this.portalManager) {
            this.portalManager.init();
        }

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
                // Actualizar posición y datos en el character manager
                this.characterManager.updatePlayerPosition(playerData);
                
                // Actualizar el nombre en el character si está disponible
                const character = this.characterManager.getCharacter(playerData.id);
                if (character && playerData.name && character.name !== playerData.name) {
                    character.name = playerData.name;
                }
                
                // Actualizar la posición y el nombre del playerPlate para este jugador
                if (playerData && playerData.id) {
                    this.playerPlateSystem.updatePlayerPlate(
                        playerData.id,
                        playerData.position,
                        true, // Asumimos que está vivo si recibimos actualizaciones
                        playerData.name, // Pasar el nombre del jugador
                        playerData.health // Pasar la salud del jugador
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
                        playerData.name, // Pasar el nombre del jugador
                        playerData.health // Pasar la salud del jugador
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
        this.networkManager.onProjectileFired = (projectileData) => {
            // Solo reproducir el sonido si no es el jugador local quien disparó
            if (projectileData.playerId !== this.networkManager.playerId) {
                // Siempre reproducir el sonido, independientemente de si tenemos posición o no
                // Usar volumen alto para asegurar que se escuche
                this.audioManager.playSound('canon', 1.0);
            }
        };

        this.networkManager.onProjectileUpdate = (projectileData) => {
            console.log('Game recibió projectileUpdate:', {
                projectileId: projectileData.id,
                playerId: projectileData.playerId,
                networkPlayerId: this.networkManager.playerId
            });
            this.characterManager.handleProjectileUpdate(projectileData);
        };

        // Añadir callback para colisiones de proyectiles
        this.networkManager.onProjectileCollision = (collisionData) => {
            this.characterManager.handleProjectileCollision(collisionData);
            
            // Reproducir sonido según el tipo de colisión
            if (collisionData.collisionType === 'water') {
                // Reproducir sonido de splash para impactos en agua
                this.audioManager.playSound('splash');
            } else {
                // Reproducir sonido de impacto para otros tipos de colisión
                this.audioManager.playSound('impact');
            }
        };

        // Añadir callback para actualizaciones de salud
        this.networkManager.onHealthUpdate = (playerData) => {
            // Log para depuración
            
            this.characterManager.handleHealthUpdate(playerData);
            
            // Actualizar el playerPlate según el estado de vida del jugador
            if (playerData && playerData.id) {
                // Si el jugador es remoto (no el jugador local)
                if (playerData.id !== this.networkManager.playerId) {
                    const character = this.characterManager.getCharacter(playerData.id);
                    if (character) {
                        // Actualizar la salud del character para mantener sincronizada la información
                        if (playerData.health !== undefined) {
                            character.health = playerData.health;
                        }
                        
                        this.playerPlateSystem.updatePlayerPlate(
                            playerData.id,
                            character.position,
                            playerData.isAlive,
                            character.name, // Usar el nombre del personaje
                            playerData.health // Pasar la salud del jugador
                        );
                    }
                }
            }
        };
        
        // Añadir callback para kills
        this.networkManager.onKill = (killerId, victimId) => {
            // Mostrar mensaje de kill en la consola y posiblemente en la UI
        };

        // Conectar al servidor
        this.networkManager.connect();
        
        // Añadir un timeout para solicitar nombres de usuario actualizados después de la conexión
        setTimeout(() => {
            this.requestAllPlayerNames();
        }, 2000); // 2 segundos después de conectarse
        
        // Iniciar el modo de juego Calavera
        this.skullGameMode.start();

        // Iniciar el bucle del juego
        this.lastTime = performance.now(); // Inicializar tiempo para el primer frame
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
        // Obtener tiempo delta para animaciones suaves
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastTime) / 1000; // en segundos
        this.lastTime = currentTime;
        
        // Limitar deltaTime para evitar saltos grandes cuando la pestaña está inactiva
        const boundedDeltaTime = Math.min(deltaTime, 0.1);
        
        // Actualizar el agua
        if (this.water) {
            this.water.update(boundedDeltaTime);
        }
        
        // Actualizar el sistema de playerPlates
        if (this.playerPlateSystem) {
            this.playerPlateSystem.updateAllPlates();
        }
        
        // Si no hay jugador, no continuar con las actualizaciones dependientes
        if (!this.player) {
            requestAnimationFrame(this.gameLoop.bind(this));
            return;
        }
        
        // Enviar actualizaciones de posición por red solo para el jugador local
        if (this.networkManager) {
            this.networkManager.sendUpdate(
                this.player.position,
                { y: this.player.rotation.y }
            );
        }
        
        // Actualizar el gestor de personajes
        if (this.characterManager) {
            console.log('Llamando a characterManager.update()');
            this.characterManager.update(boundedDeltaTime);
        }
        
        // Actualizar el modo de juego Calavera
        if (this.skullGameMode) {
            this.skullGameMode.update(boundedDeltaTime);
        }
        
        // Actualizar los portales
        if (this.portalManager) {
            this.portalManager.update(boundedDeltaTime);
        }
        
        // Actualizar el motor gráfico (incluye actualización de cámara)
        this.engine.update(boundedDeltaTime, this.inputManager);
        
        // Renderizar escena
        this.engine.render();
        
        // Continuar el bucle
        requestAnimationFrame(this.gameLoop.bind(this));
    }

    // Solicitar nombres actualizados de todos los jugadores
    requestAllPlayerNames() {
        if (this.networkManager && this.networkManager.connected) {
            this.networkManager.requestPlayerNames();
            
            // Actualizar los playerPlates con los nombres actuales
            const players = this.networkManager.getPlayers();
            players.forEach(player => {
                if (player.id !== this.networkManager.playerId) {
                    const character = this.characterManager.getCharacter(player.id);
                    if (character && player.name) {
                        // Actualizar el nombre en el character
                        character.name = player.name;
                        
                        // Actualizar el playerPlate
                        this.playerPlateSystem.updatePlayerPlate(
                            player.id,
                            character.position,
                            true,
                            player.name,
                            player.health || character.health
                        );
                    }
                }
            });
        }
    }

    async initialize(playerName) {
        if (this.initialized) return;
        
        // Guardar nombre del jugador
        this.playerName = playerName;
        this.initialized = true;
        
        // Establecer referencia al game en el engine
        this.engine.setGame(this);
        
        // Inicializar sistema de audio de forma asíncrona
        try {
            await this.audioManager.init();
            
            // Forzar la reproducción de la música de intro con un volumen alto
            const osdMusic = this.audioManager.music.get('osd');
            if (osdMusic) {
                // Asegurar un volumen alto para osd también
                osdMusic.volume = this.audioManager.musicVolume * this.audioManager.masterVolume * 1.2;
            }
            
            // Reproducir con manejo de promesa para detectar posibles errores
            const playPromise = this.audioManager.playMusic('osd');
            if (playPromise && playPromise.catch) {
                playPromise.catch(error => {
                    console.error('[Game] Error al reproducir osd.mp3:', error);
                    // Si falla, intentar reproducirlo de nuevo después de un momento
                    setTimeout(() => {
                        this.audioManager.playMusic('osd');
                    }, 1000);
                });
            }
            
            // Añadir un evento de interacción al documento para ayudar con la política de autoplay
            const startAudio = () => {
                this.audioManager.playMusic(this.audioManager.currentMusic || 'osd');
                document.removeEventListener('click', startAudio);
                document.removeEventListener('keydown', startAudio);
            };
            
            document.addEventListener('click', startAudio);
            document.addEventListener('keydown', startAudio);
            
            // Prueba de sonidos para debug
            this.testAudioSystem();
        } catch (error) {
            console.error('[Game] Error al inicializar el audio:', error);
        }
        
        // Si el mundo ya está inicializado, iniciar el juego
        if (this.worldInitialized) {
            this.startGame();
        }
    }
    
    // Programar verificación periódica del sistema de audio
    scheduleAudioCheck() {
        this._audioCheckScheduled = true;
        
        // Primera verificación después de 3 segundos
        setTimeout(async () => {
            await this.checkAudioPlayback();
        }, 3000);
        
        // Verificaciones periódicas cada 15 segundos
        setInterval(async () => {
            await this.checkAudioPlayback();
        }, 15000);
        
    }
    
    // Verificar si el audio está reproduciéndose correctamente
    async checkAudioPlayback() {
        if (!this.audioManager) return;
        
        
        // Si el audio no está inicializado, intentar inicializarlo
        if (!this.audioManager.initialized) {
            console.warn('[Game] El sistema de audio no está inicializado. Inicializando...');
            try {
                await this.audioManager.init();
            } catch (error) {
                console.error('[Game] Error al inicializar el audio:', error);
                return;
            }
        }
        
        // Verificar reproducción de música
        if (this.audioManager.currentMusic) {
            const currentMusic = this.audioManager.music.get(this.audioManager.currentMusic);
            
            if (currentMusic) {
                // Verificar si la música está en pausa o ha terminado
                if (currentMusic.paused || currentMusic.ended) {
                    console.warn(`[Game] La música ${this.audioManager.currentMusic} se ha detenido. Reiniciando...`);
                    
                    // Volver a reproducir la música actual
                    this.audioManager.playMusic(this.audioManager.currentMusic);
                } else {
                }
                
                // Verificar el volumen actual
                
                // Si el volumen es demasiado bajo, aumentarlo
                if (currentMusic.volume < 0.3) {
                    console.warn(`[Game] Volumen demasiado bajo. Aumentando...`);
                    
                    // Reproducir con mayor volumen
                    if (this.audioManager.currentMusic === 'sailing') {
                        currentMusic.volume = 0.72; // 0.6 * 0.8 * 1.5
                    } else {
                        currentMusic.volume = 0.48; // 0.6 * 0.8
                    }
                }
            } else {
                console.warn(`[Game] Música ${this.audioManager.currentMusic} no encontrada en el mapa. Reintentando carga...`);
                try {
                    // Volver a cargar la música
                    if (this.audioManager.currentMusic === 'sailing') {
                        await this.audioManager.verifyAndLoadMusic('sailing', 'assets/audio/fx/sailing.mp3');
                        this.audioManager.playMusic('sailing');
                    } else if (this.audioManager.currentMusic === 'osd') {
                        await this.audioManager.verifyAndLoadMusic('osd', 'assets/audio/osd/osd.mp3');
                        this.audioManager.playMusic('osd');
                    }
                } catch (error) {
                    console.error('[Game] Error al recargar la música:', error);
                }
            }
        } else {
            console.warn('[Game] No hay música reproduciéndose. Iniciando música de fondo...');
            
            // Determinar qué música reproducir basado en el estado del juego
            if (this.player) {
                // Si el juego ya comenzó, reproducir música del juego
                this.audioManager.playMusic('sailing');
            } else {
                // Si estamos en la pantalla de intro, reproducir música de intro
                this.audioManager.playMusic('osd');
            }
        }
    }
    
    // Método para probar todos los sonidos del sistema
    testAudioSystem() {
        
        // Intentar reproducir cada sonido una vez para asegurar que están cargados correctamente
        setTimeout(() => {
            this.audioManager.playSound('canon');
        }, 1000);
        
        setTimeout(() => {
            this.audioManager.playSound('impact');
        }, 2000);
    }
}