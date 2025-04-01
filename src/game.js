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
import { FogControls } from './ui/FogControls.js';

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
        this.loadingScreen = new LoadingScreen(async (playerName) => {
            // Cuando el usuario completa la pantalla de carga
            this.playerName = playerName;
            
            // Precargar archivos de audio mientras se muestra la pantalla de carga
            this.loadingScreen.showLoadingMessage('Precargando archivos de audio...');
            
            if (this.audioManager) {
                try {
                    await this.audioManager.preloadAudioAssets();
                    this.loadingScreen.showLoadingMessage('Archivos de audio cargados con éxito');
                    
                    // Breve pausa para mostrar mensaje de éxito
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // Continuar con la inicialización normal
                    this.loadingScreen.showLoadingMessage('Preparando el juego...');
                } catch (error) {
                    console.warn('[Game] Error en precarga de audio:', error);
                    this.loadingScreen.showLoadingMessage('Error en precarga de audio, continuando...');
                    
                    // Breve pausa para mostrar mensaje de error
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }
            
            this.initialized = true;
            
            // Si el mundo ya está cargado, iniciar el juego
            if (this.worldInitialized) {
                this.loadingScreen.hide();
                this.startGame();
            } else {
                this.loadingScreen.showLoadingMessage('Cargando mundo del juego...');
            }
        });
        this.loadingScreen.show();

        // Inicializar controles de niebla
        this.fogControls = new FogControls(this);
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
        
        // Inicializar la niebla volumétrica
        this.initializeVolumetricFog();
        
        // Inicializar sistema de portales
        this.portalManager = new PortalManager(this);
        
        this.logger.end('setupWorld');
    }

    // Inicializar la niebla volumétrica con configuraciones específicas para el juego
    initializeVolumetricFog() {
        // Configurar opciones de niebla adaptadas al estilo del juego
        const fogOptions = {
            fogColor: new THREE.Color(0xadc3db), // Color azulado para ambiente marino
            fogDensity: 0.01,                    // Densidad inicial más ligera
            noiseScale: 0.06,                    // Escala de ruido para que la niebla sea más suave
            noiseSpeed: 0.03,                    // Velocidad de animación
            fogStart: 30,                        // Distancia donde comienza la niebla
            fogEnd: 150                          // Distancia donde termina la niebla
        };
        
        // La niebla ya se inicializa en el motor, solo necesitamos configurarla
        if (this.engine && this.engine.fog) {
            this.engine.setFogColor(fogOptions.fogColor);
            this.engine.setFogDensity(fogOptions.fogDensity);
            
            // Inicializar los controles de niebla (ocultos por defecto)
            this.fogControls = new FogControls(this);
            
            // DESACTIVADO PARA PRODUCCIÓN
            // this.showFogControlsMessage();
        } else {
            console.warn('[Game] No se pudo inicializar la niebla volumétrica - motor no disponible');
        }
    }
    
    // Mostrar mensaje temporal sobre los controles de niebla
    showFogControlsMessage() {
        const message = document.createElement('div');
        message.style.position = 'absolute';
        message.style.top = '20px';
        message.style.left = '50%';
        message.style.transform = 'translateX(-50%)';
        message.style.background = 'rgba(0, 0, 0, 0.7)';
        message.style.color = 'white';
        message.style.padding = '10px 20px';
        message.style.borderRadius = '5px';
        message.style.fontFamily = 'Arial, sans-serif';
        message.style.fontSize = '16px';
        message.style.zIndex = '1001';
        message.style.textAlign = 'center';
        message.style.pointerEvents = 'none';
        message.textContent = 'Pulsa Ctrl+F para controlar la niebla volumétrica';
        
        document.body.appendChild(message);
        
        // Desvanecer y eliminar después de 5 segundos
        setTimeout(() => {
            message.style.transition = 'opacity 1s ease-out';
            message.style.opacity = '0';
            setTimeout(() => {
                document.body.removeChild(message);
            }, 1000);
        }, 5000);
    }

    async startGame() {
        if (!this.worldInitialized) {
            console.warn('Intentando iniciar el juego sin tener el mundo inicializado');
            return;
        }
        
        // Ya no es necesario ocultar la pantalla de carga aquí, se hace en initialize
        
        // Cambiar la música a "sailing" al iniciar el juego real
        if (this.audioManager && this.audioManager.initialized) {
            // Intentar cambiar la música a sailing (música de navegación)
            try {
                await this.audioManager.playMusic('sailing');
            } catch (error) {
                console.warn('[Game] Error al iniciar música de navegación:', error);
            }
        }

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
            // Primero, asegurarse de que tenemos un AudioListener válido
            if (!this.audioListener && this.engine && this.engine.camera) {
                this.audioListener = new THREE.AudioListener();
                this.engine.camera.add(this.audioListener);
                console.log('[Game] Creado nuevo AudioListener para la inicialización');
            }
            
            // Inicializar el AudioManager con el listener
            await this.audioManager.init(this.audioListener);
        }
        
        // La música de intro (osd.mp3) ya debería estar sonando desde initialize()
        // Programar el cambio a la música del juego después de 10 segundos
        // para dar tiempo a escuchar la intro
        // if (this.audioManager.currentMusic === 'osd') {
        //     setTimeout(() => {
        //         this.audioManager.playMusic('sailing');
        //     }, 10000); // 10 segundos para escuchar la intro
        // } else {
            // Si por alguna razón no está sonando osd, reproducir sailing directamente
            this.audioManager.playMusic('sailing');
        // }
        
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
        
        // Actualizar el listener de audio para posicionamiento correcto
        this.updateAudioListener();
        
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
        
        // Actualizar efectos ambientales como la niebla
        this.updateEnvironmentalEffects(boundedDeltaTime);
        
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

    async initialize() {
        // Mostrar mensajes en pantalla de carga si está visible
        if (this.loadingScreen) {
            this.loadingScreen.showLoadingMessage('Configurando mundo del juego...');
        }
        
        // Configurar escenario del juego
        await this.setupWorld();
        
        if (this.loadingScreen) {
            this.loadingScreen.showLoadingMessage('Inicializando sistema de audio...');
        }
        
        // Inicializar el sistema de audio
        await this.initializeAudio();
        
        // Reproducir música de inicio al cargar
        if (this.audioManager && this.audioManager.initialized) {
            const osdMusic = this.audioManager.music.get('osd');
            if (osdMusic) {
                // Aumentar volumen para la intro
                osdMusic.volume = this.audioManager.musicVolume * this.audioManager.masterVolume * 1.2;
            }
            
            try {
                // const playPromise = this.audioManager.playMusic('osd');
                // if (playPromise) {
                //     await playPromise;
                // }
            } catch (e) {
                console.warn('[Game] Error al reproducir música de intro, intentando reproducir directamente:', e);
                // this.audioManager.playMusic('osd');
            }
        }
        
        // Marcar como initializado una vez que el mundo esté listo
        this.worldInitialized = true;
        
        if (this.loadingScreen) {
            this.loadingScreen.showLoadingMessage('¡Listo para jugar!');
            // Breve pausa para mostrar mensaje final
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Si el usuario ya completó la pantalla de carga, iniciar el juego
        if (this.initialized) {
            // Ocultar pantalla de carga
            if (this.loadingScreen) {
                this.loadingScreen.hide();
            }
            this.startGame();
        }
    }

    // Inicializar el sistema de audio
    async initializeAudio() {
        try {
            if (!this.audioManager) {
                console.warn('[Game] AudioManager no disponible, no se puede inicializar audio');
                return;
            }
            
            // Asegurarnos de que THREE está disponible
            if (!window.THREE) {
                console.error('[Game] THREE no está disponible, el audio posicional no funcionará');
                return;
            }

            
            // Crear un AudioListener de Three.js para audio posicional
            this.audioListener = new window.THREE.AudioListener();
            
            // Guardar una referencia en la ventana para depuración
            window.gameAudioListener = this.audioListener;
            
            // Añadir el AudioListener a la cámara del juego
            if (this.engine && this.engine.camera) {
                this.engine.camera.add(this.audioListener);
                console.log('[Game] AudioListener añadido a la cámara principal');
            } else {
                console.warn('[Game] No se pudo añadir el AudioListener - cámara no disponible aún');
                
                // Programar un reintento para cuando la cámara esté disponible
                setTimeout(() => {
                    if (this.engine && this.engine.camera && this.audioListener) {
                        console.log('[Game] Intentando añadir AudioListener a la cámara (reintento)');
                        this.engine.camera.add(this.audioListener);
                    }
                }, 1000);
            }
            
            // Inicializar el AudioManager con el listener
            if (!this.audioManager.initialized) {
                await this.audioManager.init(this.audioListener);
                console.log('[Game] AudioManager inicializado con éxito');
            }
            
            // Iniciar el sistema de "arr" aleatorio
            this._startPirateArrSystem();
            
            // Programar una verificación periódica del listener
            this._scheduleListenerCheck();
        } catch (error) {
            console.error('[Game] Error durante la inicialización del audio:', error);
        }
    }
    
    // Actualizar la posición del listener (debe llamarse en cada frame)
    updateAudioListener() {
        // Si no tenemos listener o no está inicializado el audio, no hacer nada
        if (!this.audioListener || !this.audioManager) return;
        
        // Verificar que la cámara existe
        if (!this.engine || !this.engine.camera) return;
        
        // Verificar si el listener está conectado a la cámara
        let needsUpdate = false;
        
        // Si no está en la lista de hijos de la cámara, reconectar
        if (!this.engine.camera.children.includes(this.audioListener)) {
            console.log('[Game] Reconectando AudioListener a la cámara');
            this.engine.camera.add(this.audioListener);
            needsUpdate = true;
            
            // Actualizar la referencia en el AudioManager
            this.audioManager.setListener(this.audioListener);
        }
        
        // Forzar actualización de la matriz del listener para asegurar que tenga la posición correcta
        if (this.audioListener) {
            this.audioListener.updateMatrixWorld(true);
            
            // Verificar que la posición mundial sea correcta (debug)
            const listenerWorldPos = new THREE.Vector3();
            this.audioListener.getWorldPosition(listenerWorldPos);
            
            // Si la posición del listener difiere mucho de la cámara, algo está mal
            if (this.engine.camera.position.distanceTo(listenerWorldPos) > 1) {
                console.warn('[Game] Posición incorrecta del AudioListener:', 
                    listenerWorldPos.x.toFixed(2), listenerWorldPos.y.toFixed(2), listenerWorldPos.z.toFixed(2),
                    'Cámara:', 
                    this.engine.camera.position.x.toFixed(2), 
                    this.engine.camera.position.y.toFixed(2), 
                    this.engine.camera.position.z.toFixed(2));
                
                // Reconectar listener de emergencia
                this.engine.camera.remove(this.audioListener);
                this.engine.camera.add(this.audioListener);
                this.audioListener.updateMatrixWorld(true);
                this.audioManager.setListener(this.audioListener);
            }
        }
    }
    
    // Verificar periódicamente que el listener sigue conectado a la cámara
    _scheduleListenerCheck() {
        // Verificar cada 5 segundos
        setInterval(() => {
            if (!this.audioListener) {
                console.warn('[Game] AudioListener no disponible - recreando');
                this.audioListener = new THREE.AudioListener();
            }
            
            // Verificar que está conectado a la cámara actual
            if (this.engine && this.engine.camera) {
                // Si la cámara ha cambiado o el listener no está conectado, reconectar
                if (!this.engine.camera.children.includes(this.audioListener)) {
                    console.log('[Game] Reconectando AudioListener a la cámara');
                    this.engine.camera.add(this.audioListener);
                    
                    // Forzar actualización de la matriz mundial
                    this.audioListener.updateMatrixWorld(true);
                    
                    console.log('[Game Debug] AudioListener recreado y conectado');
                }
            }
        }, 5000);
    }
    
    // Sistema para reproducir "arr" aleatoriamente mientras el jugador navega
    _startPirateArrSystem() {
        // Sonido desactivado, no iniciar el sistema
        console.log('[Game] Sistema de "arr" aleatorio DESACTIVADO');
        return;
        
        /*
        // Solo iniciar si aún no está iniciado
        if (this._arrSystemActive) return;
        
        this._arrSystemActive = true;
        
        // Función para reproducir "arr" aleatoriamente
        const playRandomArr = () => {
            // Solo reproducir si hay un jugador activo
            if (this.player && this.player.isAlive) {
                // Reproducir el evento 'idle' que reproduce "arr"
                this.playAudioEvent('idle', this.player.position);
            }
            
            // Programar el próximo "arr" con tiempo aleatorio
            const minTime = 15000;  // 15 segundos mínimo
            const maxTime = 45000;  // 45 segundos máximo
            const nextTime = minTime + Math.random() * (maxTime - minTime);
            
            setTimeout(playRandomArr, nextTime);
        };
        
        // Iniciar la primera reproducción después de un tiempo inicial
        const initialDelay = 10000 + Math.random() * 5000;  // 10-15 segundos
        setTimeout(playRandomArr, initialDelay);
        */
    }
    
    // Método para buscar un personaje por su ID
    findCharacterById(characterId) {
        if (!this.characterManager) return null;
        return this.characterManager.getCharacter(characterId);
    }

    // Verificar si el audio está reproduciéndose correctamente
    async checkAudioPlayback() {
        if (!this.audioManager) return;
        
        // Si el audio no está inicializado, intentar inicializarlo
        if (!this.audioManager.initialized) {
            console.warn('[Game] El sistema de audio no está inicializado. Inicializando...');
            try {
                // Asegurarnos de que tenemos un AudioListener válido
                if (!this.audioListener && this.engine && this.engine.camera) {
                    this.audioListener = new THREE.AudioListener();
                    this.engine.camera.add(this.audioListener);
                }
                
                await this.audioManager.init(this.audioListener);
            } catch (error) {
                console.error('[Game] Error al inicializar el audio:', error);
                return;
            }
        }
        
        // Verificar reproducción de música
        if (this.audioManager.currentMusic) {
            // Con el nuevo sistema, comprobamos la instancia de música actual
            const musicInstance = this.audioManager.musicInstances.get(this.audioManager.currentMusic);
            
            if (musicInstance) {
                // Verificar si la música está sonando
                if (!musicInstance.isPlaying) {
                    console.warn(`[Game] La música ${this.audioManager.currentMusic} se ha detenido. Reiniciando...`);
                    
                    // Volver a reproducir la música actual
                    this.audioManager.playMusic(this.audioManager.currentMusic);
                }
            } else {
                console.warn(`[Game] No se encuentra la instancia de música ${this.audioManager.currentMusic}`);
            }
        } else {
            console.warn('[Game] No hay música reproduciéndose. Iniciando música de fondo...');
            
            // Intentar iniciar la música de fondo
            if (this.audioManager.initialized) {
                this.audioManager.playMusic('sailing');
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

    // Reproducir un evento de sonido
    playAudioEvent(eventName, position = null, sourcePlayer = null) {
        if (!this.audioManager || !this.audioManager.initialized) {
            console.warn('[Game Debug] No se puede reproducir evento de audio - AudioManager no disponible');
            return;
        }
        
        // Verificar que tenemos un listener disponible
        if (!this.audioListener) {
            console.warn('[Game Debug] No hay AudioListener disponible - intentando recrearlo');
            this.audioListener = new THREE.AudioListener();
            
            if (this.engine && this.engine.camera) {
                this.engine.camera.add(this.audioListener);
                this.audioManager.setListener(this.audioListener);
            } else {
                console.warn('[Game Debug] No se pudo recrear el AudioListener - cámara no disponible');
            }
        } else {
            // IMPORTANTE: Verificar que el AudioListener siga conectado a la cámara
            if (this.engine && this.engine.camera && this.audioListener.parent !== this.engine.camera) {
                console.log('[Game] Reconectando AudioListener a la cámara');
                this.engine.camera.add(this.audioListener);
                this.audioManager.setListener(this.audioListener);
            }
        }
        
        // Validar la posición antes de pasarla
        let validatedPosition = null;
        
        // Si no se proporcionó una posición pero sí un sourcePlayer
        if (!position && sourcePlayer) {
            // Si el sourcePlayer es un ID y es el jugador local
            if (typeof sourcePlayer === 'string' && sourcePlayer === this.networkManager.playerId && this.player) {
                // Usar la posición del player local
                if (this.player.position) {
                    validatedPosition = this.player.position.clone();
                }
                // Usar el objeto del player como sourcePlayer
                sourcePlayer = this.player;
            }
            // Si el sourcePlayer es un ID de otro jugador
            else if (typeof sourcePlayer === 'string' && this.characterManager) {
                const character = this.characterManager.getCharacter(sourcePlayer);
                if (character && character.object && character.object.position) {
                    validatedPosition = character.object.position.clone();
                }
            }
        }
        // Si se proporcionó una posición explícita
        else if (position) {
            // Si la posición es un objeto THREE.Vector3
            if (position instanceof THREE.Vector3) {
                if (isFinite(position.x) && isFinite(position.y) && isFinite(position.z)) {
                    validatedPosition = position.clone();
                }
            } 
            // Si es un objeto con propiedades x, y, z
            else if (position.x !== undefined && position.z !== undefined) {
                try {
                    validatedPosition = new THREE.Vector3(
                        Number(position.x) || 0,
                        Number(position.y) || 0,
                        Number(position.z) || 0
                    );
                } catch (error) {
                    console.warn('[Game Debug] Error al crear Vector3 para audio:', error);
                }
            }
        }

        // Asegurar que se use el objeto 3D del jugador si es el jugador local
        if (sourcePlayer === this.networkManager.playerId && this.player) {
            sourcePlayer = this.player;
        }
        
        // Registrar datos del evento de sonido para depuración
        console.log(`[Game] Evento de sonido: "${eventName}" - Datos:`, {
            tienePlayerLocal: !!this.player,
            tieneCharacterManager: !!this.characterManager,
            tieneValidPosition: !!validatedPosition,
            sourcePlayerType: typeof sourcePlayer,
            playerIdLocal: this.networkManager ? this.networkManager.playerId : 'desconocido'
        });
        
        // Si tenemos posición validada, mostrarla
        if (validatedPosition) {
            console.log(`[Game] Posición para evento "${eventName}":`, 
                validatedPosition.x.toFixed(2), validatedPosition.y.toFixed(2), validatedPosition.z.toFixed(2));
        }
        
        // Verificar y mostrar la posición actual del AudioListener
        if (this.audioListener && this.audioListener.parent) {
            // Obtener posición mundial del AudioListener
            const listenerPosition = new THREE.Vector3();
            this.audioListener.getWorldPosition(listenerPosition);
            console.log(`[Game] Posición del AudioListener:`, 
                listenerPosition.x.toFixed(2), listenerPosition.y.toFixed(2), listenerPosition.z.toFixed(2));
        }
        
        // Reproducir el evento de sonido
        return this.audioManager.playSoundEvent(eventName, validatedPosition, sourcePlayer);
    }

    handleNetworkEvents() {
        // Configurar callbacks para eventos de red
        this.networkManager.onProjectileFired = (projectileData) => {
            // ... código existente ...
            
            // Verificar que tenemos datos de posición válidos
            const hasValidPosition = projectileData.initialPosition && 
                typeof projectileData.initialPosition.x === 'number' &&
                typeof projectileData.initialPosition.z === 'number';
                
            console.log('[Game Debug] Proyectil disparado:', {
                jugador: projectileData.playerId,
                posiciónVálida: hasValidPosition,
                posición: hasValidPosition ? 
                    `x:${projectileData.initialPosition.x.toFixed(1)}, y:${projectileData.initialPosition.y?.toFixed(1)}, z:${projectileData.initialPosition.z.toFixed(1)}` : 
                    'inválida'
            });
            
            // Reproducir sonido de disparo en la posición del proyectil
            if (hasValidPosition) {
                this.playAudioEvent('shoot', projectileData.initialPosition, projectileData.playerId);
            } else {
                console.warn('[Game Debug] No se puede reproducir sonido de disparo - posición inválida');
            }
        };
        
        this.networkManager.onProjectileImpact = (impactData) => {
            // ... código existente ...
            
            // Verificar que tenemos datos de posición válidos
            const hasValidPosition = impactData.position && 
                typeof impactData.position.x === 'number' &&
                typeof impactData.position.z === 'number';
                
            console.log('[Game Debug] Impacto de proyectil:', {
                jugador: impactData.playerId,
                posiciónVálida: hasValidPosition,
                posición: hasValidPosition ? 
                    `x:${impactData.position.x.toFixed(1)}, y:${impactData.position.y?.toFixed(1)}, z:${impactData.position.z.toFixed(1)}` : 
                    'inválida',
                tipo: impactData.hitType || 'desconocido'
            });
            
            // Reproducir sonido apropiado según el tipo de impacto
            if (hasValidPosition) {
                // Determinar qué sonido reproducir según el tipo de impacto
                const soundEvent = impactData.hitType === 'water' ? 'splash' : 'impact';
                this.playAudioEvent(soundEvent, impactData.position);
            } else {
                console.warn('[Game Debug] No se puede reproducir sonido de impacto - posición inválida');
            }
        };
        
        this.networkManager.onPlayerDamaged = (damageData) => {
            // ... código existente ...
            
            // Verificar que tenemos datos de posición válidos
            const hasValidPosition = damageData.position && 
                typeof damageData.position.x === 'number' &&
                typeof damageData.position.z === 'number';
                
            console.log('[Game Debug] Jugador dañado:', {
                jugador: damageData.playerId,
                posiciónVálida: hasValidPosition,
                posición: hasValidPosition ? 
                    `x:${damageData.position.x.toFixed(1)}, y:${damageData.position.y?.toFixed(1)}, z:${damageData.position.z.toFixed(1)}` : 
                    'inválida',
                daño: damageData.damage || 0
            });
            
            // Reproducir sonido de daño
            if (hasValidPosition) {
                this.playAudioEvent('hit', damageData.position, damageData.playerId);
            } else {
                console.warn('[Game Debug] No se puede reproducir sonido de daño - posición inválida');
            }
        };
        
        this.networkManager.onPlayerKilled = (killData) => {
            // ... código existente ...
            
            // Sonidos desactivados
            /*
            // Reproducir sonido de muerte para la víctima
            if (killData.position) {
                this.playAudioEvent('die', killData.position, killData.victimId);
            }
            
            // Reproducir sonido de victoria para el asesino
            if (killData.killerPosition) {
                this.playAudioEvent('kill', killData.killerPosition, killData.killerId);
            }
            */
        };
        
        this.networkManager.onSkullCaptured = (captureData) => {
            // ... código existente ...
            
            // Sonido desactivado
            /*
            // Reproducir sonido de captura de calavera
            if (captureData.position) {
                this.playAudioEvent('score', captureData.position, captureData.playerId);
            }
            */
        };
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

    // Actualizar efectos ambientales como la niebla
    updateEnvironmentalEffects(deltaTime) {
        // Si no hay motor o no está configurada la niebla, salir
        if (!this.engine || !this.engine.fog) return;
        
        // Ajustes de niebla según el modo de juego
        if (this.skullGameMode && this.skullGameMode.isSkullActive) {
            // Durante el modo calavera, hacer la niebla más densa y oscura
            const targetColor = new THREE.Color(0x3a4e58); // Color oscuro para modo calavera
            const targetDensity = 0.025; // Aumentar densidad
            
            // Interpolación suave para el color y densidad
            this._interpolateFogProperties(targetColor, targetDensity, deltaTime);
        } else {
            // Condiciones normales
            // Obtener la hora del día simulada (0.0 a 1.0)
            const time = (performance.now() % 300000) / 300000; // Ciclo de 5 minutos
            
            // Simular ciclo día/noche con cambios sutiles en la niebla
            const dayNightCycle = Math.sin(time * Math.PI * 2);
            
            // Durante el "amanecer" y "atardecer", hacer la niebla más visible
            if (dayNightCycle > 0.7) { // Amanecer
                const targetColor = new THREE.Color(0xd7a883); // Color amanecer/atardecer
                const targetDensity = 0.015;
                this._interpolateFogProperties(targetColor, targetDensity, deltaTime);
            } else if (dayNightCycle < -0.7) { // Atardecer
                const targetColor = new THREE.Color(0x7e6b94); // Color atardecer/noche
                const targetDensity = 0.02;
                this._interpolateFogProperties(targetColor, targetDensity, deltaTime);
            } else { // Día normal
                const targetColor = new THREE.Color(0xadc3db); // Color diurno normal
                const targetDensity = 0.01;
                this._interpolateFogProperties(targetColor, targetDensity, deltaTime);
            }
        }
    }
    
    // Método auxiliar para interpolar suavemente entre colores y densidades de niebla
    _interpolateFogProperties(targetColor, targetDensity, deltaTime) {
        // Solo interpolamos si tenemos un motor con niebla
        if (!this.engine || !this.engine.fog) return;
        
        // Velocidad de interpolación (ajustar según necesidades)
        const interpolationSpeed = 0.5 * deltaTime;
        
        // Interpolar color - asegurarnos de que tenemos acceso a los valores correctos
        const currentColor = this.engine.fog.options.fogColor;
        if (currentColor) {
            currentColor.r += (targetColor.r - currentColor.r) * interpolationSpeed;
            currentColor.g += (targetColor.g - currentColor.g) * interpolationSpeed;
            currentColor.b += (targetColor.b - currentColor.b) * interpolationSpeed;
            
            // Aplicar el nuevo color
            this.engine.setFogColor(currentColor);
        }
        
        // Interpolar densidad - asegurarnos de que tenemos acceso al valor correcto
        const currentDensity = this.engine.fog.options.fogDensity;
        if (typeof currentDensity === 'number') {
            const newDensity = currentDensity + (targetDensity - currentDensity) * interpolationSpeed;
            
            // Aplicar la nueva densidad
            this.engine.setFogDensity(newDensity);
            
            // Actualizar controles si están visibles
            if (this.fogControls && this.fogControls.visible) {
                // Actualizar los valores en la interfaz
                const hexColor = '#' + currentColor.getHexString();
                if (this.fogControls.fogSettings.color !== hexColor) {
                    this.fogControls.fogSettings.color = hexColor;
                }
                
                if (this.fogControls.fogSettings.density !== newDensity) {
                    this.fogControls.fogSettings.density = newDensity;
                }
            }
        }
    }
}