import * as THREE from 'three';

export class AudioManager {
    constructor() {
        this.sounds = new Map(); // Mapa de buffers de audio para efectos
        this.music = new Map();  // Mapa de buffers de audio para música
        this.currentMusic = null; // Audio de Three.js actualmente reproducido
        this.musicInstances = new Map(); // Instancias de THREE.Audio para música
        this.initialized = false;
        this.masterVolume = 0.8; // Volumen maestro (aumentado de 0.5 a 0.8)
        this.musicVolume = 0.6;  // Volumen de música (aumentado de 0.3 a 0.6)
        this.sfxVolume = 0.7;    // Volumen de efectos (0-1)
        this.enabled = true;     // Audio habilitado global
        
        // Three.js audio
        this.listener = null;    // THREE.AudioListener para audio 3D
        this.audioLoader = null; // THREE.AudioLoader para cargar sonidos
        
        // Configuración de eventos de sonido
        this.soundEvents = {
            // Eventos del jugador
            idle: {
                sounds: ['arr'],
                volume: 0.4,
                loop: false,
                randomSound: true,
                distance: null,  // Todos lo oyen
                description: 'Sonido aleatorio de navegación ("Arr")'
            },
            maxspeed: {
                sounds: ['maxspeed'],
                volume: 0.5,
                loop: false,
                distance: 30,    // Audible hasta 30 unidades
                description: 'Sonido al alcanzar velocidad máxima'
            },
            hit: {
                sounds: ['hit01', 'hit02'],
                volume: 0.7,
                loop: false,
                randomSound: true, // Elegir aleatoriamente entre hit01 y hit02
                distance: 50,    // Audible hasta 50 unidades
                description: 'Sonido al recibir daño (golpe al barco)'
            },
            impact: {
                sounds: ['impact'],
                volume: 0.8,
                loop: false,
                distance: 60,    // Aumentar distancia para que sea más audible
                description: 'Sonido al impactar un proyectil contra algo'
            },
            kill: {
                sounds: ['victory'],
                volume: 1.0,
                loop: false,
                distance: null,  // Todos lo oyen
                description: 'Sonido al eliminar a otro jugador'
            },
            die: {
                sounds: ['death'],
                volume: 1.0,
                loop: false,
                distance: null,  // Todos lo oyen
                description: 'Sonido al morir'
            },
            shoot: {
                sounds: ['canon'],
                volume: 0.9,
                loop: false,
                distance: 70,    // Audible a gran distancia
                description: 'Sonido de disparo de cañón'
            },
            pirateShoot: {
                sounds: ['shoot01', 'shoot02', 'shoot03', 'shoot04'],
                volume: 0.8,
                loop: false,
                randomSound: true, // Elegir aleatoriamente entre las diferentes frases
                distance: 50,    // Audible a menos distancia que el cañón
                description: 'Voces de piratas al disparar'
            },
            splash: {
                sounds: ['splash'],
                volume: 0.6,
                loop: false,
                distance: 50,    // Aumentar distancia para que sea más audible desde lejos
                description: 'Sonido de algo cayendo al agua'
            },
            score: {
                sounds: ['score'],
                volume: 0.8,
                loop: false,
                distance: null,  // Todos lo oyen
                description: 'Sonido al capturar una calavera'
            },
            calaveramode: {
                sounds: ['ghost01', 'ghost02', 'ghost03', 'ghost04', 'ghost05'],
                volume: 0.75,
                loop: false,
                randomSound: true, // Asegurar que se seleccione aleatoriamente
                distance: 80,    // Aumentar la distancia para que guíe mejor
                distortion: true, // Activar distorsión aleatoria
                description: 'Sonidos de fantasma durante el modo calavera'
            }
        };
    }

    // Verificar la validez de las rutas de audio cargadas
    verifyAudioPaths() {
        
        // Verificar música
        for (const [id, audio] of this.music.entries()) {
            this.checkAudioAvailability(audio.src, `música: ${id}`);
        }
        
        // Verificar efectos de sonido
        for (const [id, audio] of this.sounds.entries()) {
            this.checkAudioAvailability(audio.src, `efecto: ${id}`);
        }
    }
    
    // Comprobar disponibilidad de un archivo de audio mediante Fetch
    checkAudioAvailability(src, description) {
        // Extraer la URL relativa
        const url = src.split('/').slice(-3).join('/');
        
        
        // Realizar solicitud fetch para verificar si el archivo existe
        fetch(url)
            .then(response => {
                if (response.ok) {
                } else {
                    console.error(`[AudioManager] ❌ ${description} - Error al cargar el archivo: ${url} (${response.status})`);
                }
            })
            .catch(error => {
                console.error(`[AudioManager] ❌ ${description} - Error al verificar el archivo: ${url}`, error);
            });
    }

    // Inicializar el sistema de audio
    async init(listener = null) {
        if (this.initialized) return;
        
        if (!listener) {
            console.error('[AudioManager] Error: Se requiere un THREE.AudioListener para inicializar');
            return;
        }
        
        // Guardar el listener de Three.js
        this.listener = listener;
        
        // Crear el cargador de audio
        this.audioLoader = new THREE.AudioLoader();
        
        try {
            // Cargar música de fondo
            // await this.loadMusicBuffer('osd', 'assets/audio/osd/osd.mp3');
            await this.loadMusicBuffer('sailing', 'assets/audio/fx/sailing.mp3');
            // await this.loadMusicBuffer('calaveramode', 'assets/audio/osd/calaveramode.mp3');
    
            // Cargar efectos de sonido básicos
            await this.loadSoundBuffer('canon', 'assets/audio/fx/canon.mp3');
            await this.loadSoundBuffer('impact', 'assets/audio/fx/impact.mp3');
            await this.loadSoundBuffer('splash', 'assets/audio/fx/splash.mp3');
            
            // Cargar sonidos adicionales definidos en soundEvents
            const soundsToLoad = this.getAllRequiredSounds();
            for (let soundName of soundsToLoad) {
                // Solo cargar si no existe ya y no es uno de los básicos que ya cargamos
                if (!this.sounds.has(soundName) && !['canon', 'impact', 'splash'].includes(soundName)) {
                    // Intentar cargarlo desde varias carpetas comunes
                    const folders = ['fx', 'osd', 'events'];
                    for (const folder of folders) {
                        try {
                            await this.loadSoundBuffer(soundName, `assets/audio/${folder}/${soundName}.mp3`);
                            // Si ya se cargó, salir del bucle
                            if (this.sounds.has(soundName)) break;
                        } catch (e) {
                            // Ignorar errores, probaremos la siguiente carpeta
                        }
                    }
                }
            }
    
            this.initialized = true;
            
            // Verificar que todo esté cargado
            this.logLoadedAudio();
        } catch (error) {
            console.error('[AudioManager] Error durante la inicialización:', error);
        }
    }
    
    // Obtener todos los sonidos requeridos en la configuración
    getAllRequiredSounds() {
        const uniqueSounds = new Set();
        
        // Recorrer todos los eventos de sonido
        for (const eventConfig of Object.values(this.soundEvents)) {
            // Añadir cada sonido individual
            if (eventConfig.sounds && Array.isArray(eventConfig.sounds)) {
                eventConfig.sounds.forEach(sound => uniqueSounds.add(sound));
            }
        }
        
        return Array.from(uniqueSounds);
    }

    // Cargar buffer de audio para efectos
    loadSoundBuffer(id, url) {
        return new Promise((resolve, reject) => {
            this.audioLoader.load(
                url,
                (buffer) => {
                    this.sounds.set(id, buffer);
                    resolve(buffer);
                },
                (progress) => {
                    // Opcional: mostrar progreso de carga
                },
                (error) => {
                    console.error(`[AudioManager] Error al cargar sonido ${id}:`, error);
                    reject(error);
                }
            );
        });
    }

    // Cargar buffer de audio para música
    loadMusicBuffer(id, url) {
        return new Promise((resolve, reject) => {
            this.audioLoader.load(
                url,
                (buffer) => {
                    this.music.set(id, buffer);
                    resolve(buffer);
                },
                (progress) => {
                    // Opcional: mostrar progreso de carga
                },
                (error) => {
                    console.error(`[AudioManager] Error al cargar música ${id}:`, error);
                    reject(error);
                }
            );
        });
    }
    
    // Registrar todo el audio cargado
    logLoadedAudio() {
        console.log('[AudioManager] Música cargada:', Array.from(this.music.keys()));
        console.log('[AudioManager] Sonidos cargados:', Array.from(this.sounds.keys()));
    }

    // Reproducir un evento de sonido (con o sin posición)
    playSoundEvent(eventName, position = null, sourcePlayer = null) {
        if (!this.enabled || !this.initialized) return null;

        // Verificar si el evento existe
        const eventConfig = this.soundEvents[eventName];
        if (!eventConfig) {
            console.warn(`[AudioManager] Evento de sonido desconocido: ${eventName}`);
            return null;
        }
        
        // Seleccionar qué sonido reproducir (aleatorio o secuencial)
        let soundName;
        if (eventConfig.sounds.length === 1) {
            // Si solo hay un sonido, usarlo
            soundName = eventConfig.sounds[0];
        } else if (eventConfig.randomSound) {
            // Selección aleatoria si está configurado así
            const randomIndex = Math.floor(Math.random() * eventConfig.sounds.length);
            soundName = eventConfig.sounds[randomIndex];
        } else {
            // Rotación secuencial si no es aleatorio (por defecto)
            // Usar un contador para cada evento para ir rotando
            if (!this._soundIndexCounter) this._soundIndexCounter = {};
            if (this._soundIndexCounter[eventName] === undefined) {
                this._soundIndexCounter[eventName] = 0;
            } else {
                this._soundIndexCounter[eventName] = (this._soundIndexCounter[eventName] + 1) % eventConfig.sounds.length;
            }
            soundName = eventConfig.sounds[this._soundIndexCounter[eventName]];
        }

        // Verificar si el sonido existe
        if (!this.sounds.has(soundName)) {
            console.warn(`[AudioManager] Sonido no encontrado para evento ${eventName}: ${soundName}`);
            return null;
        }

        // Obtener volumen configurado para el evento
        const soundVolume = eventConfig.volume !== undefined ? eventConfig.volume : this.sfxVolume;
        const finalVolume = soundVolume * this.masterVolume;
        
        // Intentar encontrar un objeto parent para sonidos posicionales
        let parentObject = null;
        let playerPosition = null;

        // Si el evento está asociado a un jugador, intentar obtener su objeto 3D
        if (sourcePlayer) {
            if (typeof sourcePlayer === 'object' && sourcePlayer.position) {
                // Si es un objeto jugador con posición
                parentObject = sourcePlayer;
                playerPosition = sourcePlayer.position.clone();
                console.log(`[AudioManager] Evento: ${eventName}, Sonido: ${soundName} - Jugador proporciona posición:`, 
                    playerPosition.x.toFixed(2), playerPosition.y.toFixed(2), playerPosition.z.toFixed(2));
            } else if (window.game && window.game.characterManager) {
                // Si es un ID de jugador
                const character = window.game.characterManager.getCharacter(sourcePlayer);
                if (character && character.object) {
                    parentObject = character.object;
                    playerPosition = character.object.position.clone();
                    console.log(`[AudioManager] Evento: ${eventName}, Sonido: ${soundName} - Personaje proporciona posición:`, 
                        playerPosition.x.toFixed(2), playerPosition.y.toFixed(2), playerPosition.z.toFixed(2));
                }
            }
        }
        
        // Si la posición no se obtuvo del jugador pero se proporcionó externamente
        if (!playerPosition && position) {
            if (position instanceof THREE.Vector3) {
                playerPosition = position.clone();
            } else if (position.x !== undefined && position.z !== undefined) {
                playerPosition = new THREE.Vector3(
                    position.x, 
                    position.y !== undefined ? position.y : 0, 
                    position.z
                );
            }
            
            if (playerPosition) {
                console.log(`[AudioManager] Evento: ${eventName}, Sonido: ${soundName} - Posición proporcionada:`, 
                    playerPosition.x.toFixed(2), playerPosition.y.toFixed(2), playerPosition.z.toFixed(2));
            }
        }
        
        // Si tiene una distancia especificada y posición, usar audio posicional
        if (eventConfig.distance !== null && (playerPosition || parentObject)) {
            return this.playPositionalSound(soundName, playerPosition || parentObject.position, {
                volume: finalVolume,
                loop: eventConfig.loop || false,
                distance: eventConfig.distance,
                distortion: eventConfig.distortion,
                parentObject: parentObject
            });
        } else {
            // Reproducir como audio global
            return this.playSound(soundName, finalVolume, eventConfig.loop || false);
        }
    }

    // Reproducir un efecto de sonido (global)
    playSound(id, volume = null, loop = false) {
        if (!this.enabled || !this.initialized) return null;
        
        if (!this.sounds.has(id)) {
            console.warn(`[AudioManager] Sonido no encontrado: ${id}`);
            return null;
        }
        
        // Crear un objeto THREE.Audio
        const audio = new THREE.Audio(this.listener);
        
        // Asignar el buffer
        audio.setBuffer(this.sounds.get(id));
        
        // Configurar volumen
        const finalVolume = volume !== null ? volume : this.sfxVolume * this.masterVolume;
        audio.setVolume(finalVolume);
        
        // Configurar reproducción en bucle
        audio.setLoop(loop);
        
        // Reproducir el sonido
        audio.play();
        
        return audio;
    }
    
    // Reproducir un sonido posicional
    playPositionalSound(id, position, options = {}) {
        if (!this.enabled || !this.initialized || !this.listener) return null;
        
        if (!this.sounds.has(id)) {
            console.warn(`[AudioManager] Sonido posicional no encontrado: ${id}`);
            return null;
        }
        
        // Obtener opciones con valores por defecto
        const { 
            volume = this.sfxVolume * this.masterVolume,
            loop = false,
            distance = 50,
            distortion = false,
            parentObject = null
        } = options;
        
        // Validar posición
        let validPosition = null;
        
        // Si es THREE.Vector3, usar directamente
        if (position instanceof THREE.Vector3) {
            if (isFinite(position.x) && isFinite(position.z)) {
                validPosition = position.clone();
            }
        } 
        // Si es un objeto con x, z, crear Vector3
        else if (position.x !== undefined && position.z !== undefined) {
            if (isFinite(position.x) && isFinite(position.z)) {
                validPosition = new THREE.Vector3(
                    position.x, 
                    position.y !== undefined && isFinite(position.y) ? position.y : 0, 
                    position.z
                );
            }
        }
        
        if (!validPosition) {
            console.warn(`[AudioManager] Posición inválida para audio posicional: ${JSON.stringify(position)}`);
            // Fallback a audio no posicional
            return this.playSound(id, volume, loop);
        }
        
        // Crear audio posicional
        const positionalAudio = new THREE.PositionalAudio(this.listener);
        
        // Asignar buffer
        positionalAudio.setBuffer(this.sounds.get(id));
        positionalAudio.setVolume(volume);
        positionalAudio.setLoop(loop);
        
        // Configurar parámetros posicionales - ajustar para mejor audibilidad
        positionalAudio.setRefDistance(15);  // Aumentar distancia de referencia (antes era 10)
        positionalAudio.setMaxDistance(distance);  // Distancia máxima a la que se oye
        positionalAudio.setDistanceModel('linear');  // Modelo de atenuación
        positionalAudio.setRolloffFactor(0.8);  // Reducir rolloff para que se escuche mejor (antes era 1)
        
        // Aplicar distorsión si está habilitada
        if (distortion) {
            this.applyDistortionToPositionalAudio(positionalAudio);
        }
        
        // IMPORTANTE: Obtener acceso a la escena de THREE.js 
        // Intentar diferentes formas de acceder a la escena
        let sceneFound = false;
        let scene = null;
        
        // Si tenemos un objeto padre, adjuntar el audio a él
        if (parentObject) {
            parentObject.add(positionalAudio);
            console.log(`[AudioManager] Reproduciendo sonido "${id}" adjuntado a objeto en posición:`, 
                parentObject.position.x.toFixed(2), parentObject.position.y.toFixed(2), parentObject.position.z.toFixed(2));
            return positionalAudio; // Si hay parent, ya está añadido a la escena a través del parent
        } 
        
        // Intentar obtener la escena de formas diferentes
        // 1. Intentar a través de window.game
        if (window.game && window.game.engine && window.game.engine.scene) {
            scene = window.game.engine.scene;
            sceneFound = true;
        }
        // 2. Intentar acceder directamente a través de this.listener
        else if (this.listener && this.listener.parent) {
            // Obtener la raíz de la escena subiendo en la jerarquía
            let root = this.listener.parent;
            while (root.parent) {
                root = root.parent;
            }
            scene = root;
            sceneFound = true;
        }
        
        if (sceneFound && scene) {
            // Añadir el audio a la escena
            scene.add(positionalAudio);
            positionalAudio.position.copy(validPosition);
            console.log(`[AudioManager] Reproduciendo sonido "${id}" en la escena en posición:`, 
                validPosition.x.toFixed(2), validPosition.y.toFixed(2), validPosition.z.toFixed(2));
            
            // Limpieza automática después de que termine el sonido
            positionalAudio.onEnded = () => {
                scene.remove(positionalAudio);
            };
        } else {
            // FALLBACK: Si no pudimos encontrar la escena, intentar reproducir como audio global
            console.warn(`[AudioManager] No se pudo encontrar la escena para añadir audio posicional "${id}" - usando fallback a audio global`);
            return this.playSound(id, volume, loop);
        }
        
        // Reproducir el sonido
        positionalAudio.play();
        
        return positionalAudio;
    }
    
    // Aplicar distorsión a audio posicional
    applyDistortionToPositionalAudio(positionalAudio) {
        if (!positionalAudio) return;
        
        try {
            // Modificar la velocidad de reproducción ligeramente
            positionalAudio.setPlaybackRate(0.85 + Math.random() * 0.3); // Entre 0.85 y 1.15
            
            // La distorsión adicional requeriría acceso al AudioContext
            // y crear efectos personalizados, lo cual es más avanzado
            
        } catch (e) {
            console.warn('[AudioManager] No se pudo aplicar distorsión al audio posicional:', e);
        }
        
        return positionalAudio;
    }

    // Reproducir música de fondo
    playMusic(id) {
        if (!this.enabled || !this.initialized) {
            return Promise.reject(new Error('Audio deshabilitado o no inicializado'));
        }
        
        if (!this.music.has(id)) {
            console.warn(`[AudioManager] Música no encontrada: ${id}`);
            return Promise.reject(new Error(`Música no encontrada: ${id}`));
        }
        
        // Detener música actual si existe
        if (this.currentMusic && this.musicInstances.has(this.currentMusic)) {
            const currentMusicInstance = this.musicInstances.get(this.currentMusic);
            if (currentMusicInstance && currentMusicInstance.isPlaying) {
                currentMusicInstance.stop();
            }
        }
        
        // Crear un objeto THREE.Audio para la música
        const musicAudio = new THREE.Audio(this.listener);
        
        // Asignar el buffer
        musicAudio.setBuffer(this.music.get(id));
        
        // Configurar volumen según el tipo
        const volumeMultiplier = id === 'sailing' ? 1.5 : 1.0;
        musicAudio.setVolume(this.musicVolume * this.masterVolume * volumeMultiplier);
        
        // Configurar para loop
        musicAudio.setLoop(true);
        
        // Reproducir la música
        musicAudio.play();
        
        // Guardar referencia a la instancia actual
        this.musicInstances.set(id, musicAudio);
        this.currentMusic = id;
        
        return Promise.resolve();
    }

    // Reproducir música temporalmente y luego volver a la anterior
    playTemporaryMusic(id, duration) {
        if (!this.enabled || !this.initialized) {
            return Promise.reject(new Error('Audio deshabilitado o no inicializado'));
        }
        
        if (!this.music.has(id)) {
            console.warn(`[AudioManager] Música temporal no encontrada: ${id}`);
            return Promise.reject(new Error(`Música no encontrada: ${id}`));
        }

        // Guardar referencia a la música actual
        const previousMusic = this.currentMusic;
        
        // No hacer nada si ya estamos reproduciendo esta música
        if (previousMusic === id) {
            return Promise.resolve();
        }

        // Pausar la música actual sin detenerla
        if (previousMusic && this.musicInstances.has(previousMusic)) {
            const currentMusicInstance = this.musicInstances.get(previousMusic);
            if (currentMusicInstance && currentMusicInstance.isPlaying) {
                currentMusicInstance.pause();
            }
        }

        // Reproducir la música temporal
        this.playMusic(id);
        
        // Programar el fin de la música temporal
        setTimeout(() => {
            // Solo restaurar si seguimos reproduciendo la misma música temporal
            if (this.currentMusic === id && previousMusic) {
                // Detener la música temporal
                if (this.musicInstances.has(id)) {
                    const tempMusic = this.musicInstances.get(id);
                    if (tempMusic && tempMusic.isPlaying) {
                        tempMusic.stop();
                    }
                }
                
                // Restaurar la música anterior
                this.playMusic(previousMusic);
            }
        }, duration);
        
        return Promise.resolve();
    }

    // Detener toda la música
    stopMusic() {
        if (this.currentMusic && this.musicInstances.has(this.currentMusic)) {
            const music = this.musicInstances.get(this.currentMusic);
            if (music && music.isPlaying) {
                music.stop();
            }
            this.currentMusic = null;
        }
    }

    // Establecer el volumen maestro
    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        this.updateAllVolumes();
    }

    // Establecer el volumen de la música
    setMusicVolume(volume) {
        this.musicVolume = Math.max(0, Math.min(1, volume));
        this.updateMusicVolumes();
    }

    // Establecer el volumen de los efectos
    setSfxVolume(volume) {
        this.sfxVolume = Math.max(0, Math.min(1, volume));
    }

    // Actualizar todos los volúmenes
    updateAllVolumes() {
        this.updateMusicVolumes();
    }

    // Actualizar el volumen de todas las pistas de música
    updateMusicVolumes() {
        for (const [id, musicInstance] of this.musicInstances.entries()) {
            const volumeMultiplier = id === 'sailing' ? 1.5 : 1.0;
            musicInstance.setVolume(this.musicVolume * this.masterVolume * volumeMultiplier);
        }
    }

    // Activar/desactivar todo el audio
    toggle(enabled = null) {
        if (enabled !== null) {
            this.enabled = enabled;
        } else {
            this.enabled = !this.enabled;
        }
        
        // Si se desactiva, pausar toda la música
        if (!this.enabled && this.currentMusic && this.musicInstances.has(this.currentMusic)) {
            const music = this.musicInstances.get(this.currentMusic);
            if (music && music.isPlaying) {
                music.pause();
            }
        } else if (this.enabled && this.currentMusic && this.musicInstances.has(this.currentMusic)) {
            // Si se activa y había música, reanudarla
            const music = this.musicInstances.get(this.currentMusic);
            if (music && !music.isPlaying) {
                music.play();
            }
        }
        
        return this.enabled;
    }
    
    // Obtener la configuración de un evento de sonido
    getEventConfig(eventName) {
        return this.soundEvents[eventName] || null;
    }
    
    // Modificar la configuración de un evento de sonido
    setEventConfig(eventName, config) {
        if (!this.soundEvents[eventName]) {
            console.warn(`[AudioManager] Creando nuevo evento de sonido: ${eventName}`);
        }
        
        this.soundEvents[eventName] = { 
            ...this.soundEvents[eventName],
            ...config 
        };
        
        // Asegurar que se carguen los sonidos si son nuevos
        if (config.sounds && Array.isArray(config.sounds)) {
            for (const sound of config.sounds) {
                if (!this.sounds.has(sound)) {
                    const folders = ['fx', 'osd', 'events'];
                    for (const folder of folders) {
                        this.loadSoundBuffer(sound, `assets/audio/${folder}/${sound}.mp3`)
                            .catch(() => {}); // Ignorar errores, probaremos la siguiente carpeta
                        
                        // Si ya se cargó, salir del bucle
                        if (this.sounds.has(sound)) break;
                    }
                }
            }
        }
        
        return this.soundEvents[eventName];
    }
    
    // Establecer el listener para compatibilidad con código existente
    setListener(listener) {
        if (!listener) {
            console.warn('[AudioManager] Intento de establecer un listener nulo');
            return;
        }
        
        // Actualizar el listener
        this.listener = listener;
        
        console.log('[AudioManager] Listener actualizado');
    }
} 