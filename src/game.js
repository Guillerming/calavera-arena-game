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
        if (!this.worldInitialized) {
            console.warn('Intentando iniciar el juego sin tener el mundo inicializado');
            return;
        }
        
        // Ocultar la pantalla de carga de forma segura
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        } else {
            console.warn('No se encontró el elemento loading-screen para ocultar');
        }
        
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
        // Configurar escenario del juego
        await this.setupWorld();
        
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
                const playPromise = this.audioManager.playMusic('osd');
                if (playPromise) {
                    await playPromise;
                }
            } catch (e) {
                console.warn('[Game] Error al reproducir música de intro, intentando reproducir directamente:', e);
                this.audioManager.playMusic('osd');
            }
        }
        
        // Marcar como initializado una vez que el mundo esté listo
        this.worldInitialized = true;
        
        // Si el usuario ya completó la pantalla de carga, iniciar el juego
        if (this.initialized) {
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
            
            console.log('[Game] Inicializando sistema de audio 3D...');
            
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
                        
                        // Actualizar el listener en el AudioManager
                        if (this.audioManager) {
                            this.audioManager.setListener(this.audioListener);
                        }
                    }
                }, 1000);
            }
            
            // Inicializar el AudioManager con el listener
            if (!this.audioManager.initialized) {
                await this.audioManager.init(this.audioListener);
                console.log('[Game] AudioManager inicializado con éxito');
            } else {
                // Si ya está inicializado, asegurar que tiene el listener correcto
                this.audioManager.setListener(this.audioListener);
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
            this.audioManager.setListener(this.audioListener);
            needsUpdate = true;
        }
        
        // Si la posición del listener es (0,0,0) pero la cámara no está ahí, algo está mal
        if (this.audioListener.position.x === 0 && 
            this.audioListener.position.y === 0 && 
            this.audioListener.position.z === 0 &&
            (this.engine.camera.position.x !== 0 ||
             this.engine.camera.position.y !== 0 ||
             this.engine.camera.position.z !== 0)) {
            
            // Actualizar manualmente la matriz del listener
            this.audioListener.updateMatrixWorld(true);
            needsUpdate = true;
        }
        
        if (needsUpdate) {
            console.log('[Game] AudioListener actualizado: ', 
                this.audioListener.getWorldPosition(new THREE.Vector3()));
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
                    
                    // Actualizar el listener en el AudioManager
                    if (this.audioManager) {
                        this.audioManager.setListener(this.audioListener);
                    }
                    
                    // Forzar actualización de la matriz mundial
                    this.audioListener.updateMatrixWorld(true);
                }
            }
        }, 5000);
    }
    
    // Sistema para reproducir "arr" aleatoriamente mientras el jugador navega
    _startPirateArrSystem() {
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
        // Verificaciones periódicas cada 15 segundos
        setInterval(async () => {
            await this.checkAudioPlayback();
        }, 15000);
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
                // Si el juego ya comenzó, reproducir música del juego (sailing)
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
                console.log('[Game Debug] AudioListener recreado y conectado');
            } else {
                console.warn('[Game Debug] No se pudo recrear el AudioListener - cámara no disponible');
            }
        }
        
        // Validar la posición antes de pasarla
        let validatedPosition = null;
        
        if (position) {
            // Si la posición es un objeto THREE.Vector3, validar sus propiedades
            if (position instanceof THREE.Vector3) {
                if (isFinite(position.x) && isFinite(position.y) && isFinite(position.z)) {
                    validatedPosition = position; // Ya es un Vector3 válido
                } else {
                    console.warn('[Game Debug] Vector3 con componentes no válidos:', position);
                }
            } 
            // Si es un objeto con propiedades x, y, z, crear un Vector3
            else if (position.x !== undefined && position.z !== undefined) {
                try {
                    // Intentar crear un Vector3 con valores válidos
                    validatedPosition = new THREE.Vector3(
                        Number(position.x) || 0,
                        Number(position.y) || 0,
                        Number(position.z) || 0
                    );
                } catch (error) {
                    console.warn('[Game Debug] Error al crear Vector3:', error);
                }
            } else {
                console.warn('[Game Debug] Formato de posición no reconocido:', position);
            }
        }
        
        // Verificar explícitamente que el listener está bien inicializado
        console.log(`[Game Debug] Reproduciendo evento: ${eventName}, Listener disponible: ${!!this.audioListener}, Posición válida: ${!!validatedPosition}`);
        
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
            
            // Reproducir sonido de muerte para la víctima
            if (killData.position) {
                this.playAudioEvent('die', killData.position, killData.victimId);
            }
            
            // Reproducir sonido de victoria para el asesino
            if (killData.killerPosition) {
                this.playAudioEvent('kill', killData.killerPosition, killData.killerId);
            }
        };
        
        this.networkManager.onSkullCaptured = (captureData) => {
            // ... código existente ...
            
            // Reproducir sonido de captura de calavera
            if (captureData.position) {
                this.playAudioEvent('score', captureData.position, captureData.playerId);
            }
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
}