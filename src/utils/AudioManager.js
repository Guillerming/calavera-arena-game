import * as THREE from 'three';

export class AudioManager {
    constructor() {
        this.sounds = new Map(); // Mapa de efectos de sonido
        this.music = new Map();  // Mapa de pistas de música
        this.currentMusic = null; // Música actualmente reproducida
        this.initialized = false;
        this.masterVolume = 0.8; // Volumen maestro (aumentado de 0.5 a 0.8)
        this.musicVolume = 0.6;  // Volumen de música (aumentado de 0.3 a 0.6)
        this.sfxVolume = 0.7;    // Volumen de efectos (0-1)
        this.enabled = true;     // Audio habilitado global
        
        // Three.js audio
        this.listener = null;    // THREE.AudioListener para audio 3D
        
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
        
        // Guardar el listener de Three.js si se proporciona para audio posicional
        this.listener = listener;
        
        try {
            // Cargar música de fondo - verificando archivos primero
            await this.verifyAndLoadMusic('osd', 'assets/audio/osd/osd.mp3');
            await this.verifyAndLoadMusic('sailing', 'assets/audio/fx/sailing.mp3'); // sailing ahora es tratado exclusivamente como música
            await this.verifyAndLoadMusic('calaveramode', 'assets/audio/osd/calaveramode.mp3');
    
            // Configurar volumen específico para sailing (más alto)
            if (this.music.has('sailing')) {
                const sailingMusic = this.music.get('sailing');
                sailingMusic.volume = this.musicVolume * this.masterVolume * 1.5; // 50% más alto que el resto
                
                // Configurar para que siempre esté en loop
                sailingMusic.loop = true;
            } else {
                console.error('[AudioManager] ⚠️ No se pudo cargar sailing.mp3');
            }
    
            // Cargar efectos de sonido básicos
            await this.verifyAndLoadSound('canon', 'assets/audio/fx/canon.mp3');
            await this.verifyAndLoadSound('impact', 'assets/audio/fx/impact.mp3');
            await this.verifyAndLoadSound('splash', 'assets/audio/fx/splash.mp3');
            
            // Cargar sonidos adicionales definidos en soundEvents
            const soundsToLoad = this.getAllRequiredSounds();
            for (const sound of soundsToLoad) {
                // Solo cargar si no existe ya y no es uno de los básicos que ya cargamos
                if (!this.sounds.has(sound) && !['canon', 'impact', 'splash'].includes(sound)) {
                    // Intentar cargarlo desde varias carpetas comunes
                    const folders = ['fx', 'osd', 'events'];
                    for (const folder of folders) {
                        await this.verifyAndLoadSound(sound, `assets/audio/${folder}/${sound}.mp3`)
                            .catch(() => {}); // Ignorar errores, probaremos la siguiente carpeta
                        
                        // Si ya se cargó, salir del bucle
                        if (this.sounds.has(sound)) break;
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

    // Verificar y cargar música con comprobación previa
    async verifyAndLoadMusic(id, url) {
        try {
            // Intentar verificar primero si el archivo existe
            const response = await fetch(url, { method: 'HEAD' });
            if (!response.ok) {
                console.error(`[AudioManager] ❌ Error: No se pudo cargar ${id} desde ${url} - ${response.status}`);
                return false;
            }
            
            
            // Cargar el audio normalmente
            this.loadMusic(id, url);
            return true;
        } catch (error) {
            console.error(`[AudioManager] Error al verificar/cargar música ${id}:`, error);
            return false;
        }
    }
    
    // Verificar y cargar efectos con comprobación previa
    async verifyAndLoadSound(id, url) {
        try {
            // Intentar verificar primero si el archivo existe
            const response = await fetch(url, { method: 'HEAD' });
            if (!response.ok) {
                console.error(`[AudioManager] ❌ Error: No se pudo cargar ${id} desde ${url} - ${response.status}`);
                return false;
            }
            
            
            // Cargar el audio normalmente
            this.loadSound(id, url);
            return true;
        } catch (error) {
            console.error(`[AudioManager] Error al verificar/cargar efecto ${id}:`, error);
            return false;
        }
    }
    
    // Registrar todo el audio cargado
    logLoadedAudio() {
        console.log('[AudioManager] Música cargada:', Array.from(this.music.keys()));
        console.log('[AudioManager] Sonidos cargados:', Array.from(this.sounds.keys()));
    }

    // Cargar un efecto de sonido
    loadSound(id, url) {
        const audio = new Audio(url);
        audio.volume = this.sfxVolume * this.masterVolume;
        
        // Configuración para efectos de sonido
        audio.preload = 'auto';
        
        // Añadir manejar de error para detectar problemas
        audio.addEventListener('error', (e) => {
            console.error(`[AudioManager] Error al cargar el sonido ${id}:`, e);
        });
        
        this.sounds.set(id, audio);
    }

    // Cargar una pista de música
    loadMusic(id, url) {
        const audio = new Audio(url);
        audio.volume = this.musicVolume * this.masterVolume;
        
        // Configuración para música de fondo
        audio.loop = true;
        audio.preload = 'auto';
        
        // Añadir manejar de error para detectar problemas
        audio.addEventListener('error', (e) => {
            console.error(`[AudioManager] Error al cargar la música ${id}:`, e);
        });
        
        this.music.set(id, audio);
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
        
        // Validar posición si se proporciona
        let validPosition = null;
        if (position) {
            // Si es THREE.Vector3, usar directamente
            if (position instanceof THREE.Vector3) {
                if (isFinite(position.x) && isFinite(position.z)) {
                    validPosition = position.clone();
                } else {
                    console.warn(`[AudioManager Debug] Posición con valores no finitos: ${JSON.stringify({
                        x: position.x, y: position.y, z: position.z
                    })}`);
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
                } else {
                    console.warn(`[AudioManager Debug] Objeto posición con valores no finitos: ${JSON.stringify({
                        x: position.x, y: position.y, z: position.z
                    })}`);
                }
            } else {
                console.warn(`[AudioManager Debug] Formato de posición inválido: ${JSON.stringify(position)}`);
            }
        }

        // Log para depuración de audio posicional
        console.log(`[AudioManager Debug] Evento: ${eventName}`, {
            posicional: eventConfig.distance !== null,
            maxDistancia: eventConfig.distance,
            posiciónOriginal: position ? 
                (typeof position.toJSON === 'function' ? position.toJSON() : position) : 
                'null',
            posiciónValidada: validPosition ? 
                { x: validPosition.x, y: validPosition.y, z: validPosition.z } : 
                'null',
            jugador: sourcePlayer || 'local'
        });
        
        // TEMPORAL: Aumentar el rango para depuración hasta que se solucione el problema
        const debugRangeMultiplier = 3.0; // Multiplicar el rango x3 para pruebas
        if (eventConfig.distance) {
            eventConfig.distance *= debugRangeMultiplier;
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
        const volume = eventConfig.volume !== undefined ? eventConfig.volume : this.sfxVolume;

        // Crear una copia del sonido para reproducción
        let sound = this.cloneSound(soundName, volume);

        // Aplicar distorsión si está habilitada para este evento
        if (eventConfig.distortion && sound) {
            this.applyRandomDistortion(sound);
        }
        
        // Si tiene una distancia especificada y posición, usar audio posicional
        if (eventConfig.distance !== null && validPosition && this.listener) {
            // Crear el audio posicional
            const positionalAudio = this.createPositionalAudio(sound, validPosition, eventConfig.distance);
            return positionalAudio;
        } else {
            // Log para depuración cuando se reproduce como audio global
            console.log(`[AudioManager Debug] Audio global: ${eventName}`, {
                motivo: !eventConfig.distance ? 'distance es null' : 
                         !validPosition ? 'sin posición válida' : 
                         !this.listener ? 'sin listener' : 'desconocido',
                sonido: soundName
            });
            
            // Reproducir como audio normal (no posicional)
            sound.play();
            return sound;
        }
    }
    
    // Método para aplicar distorsión aleatoria al sonido
    applyRandomDistortion(sound) {
        if (!sound || !sound.play) return;
        
        // Solo intentar aplicar distorsión si el AudioContext está disponible (para navegadores que lo soportan)
        if (window.AudioContext || window.webkitAudioContext) {
            try {
                // Crear contexto de audio si no existe
                if (!this._audioContext) {
                    this._audioContext = new (window.AudioContext || window.webkitAudioContext)();
                }
                
                // Guardar la reproducción original
                const originalPlay = sound.play;
                
                // Reemplazar con nuestra función que aplica distorsión
                sound.play = () => {
                    // Modificar la velocidad de reproducción ligeramente
                    sound.playbackRate = 0.85 + Math.random() * 0.3; // Entre 0.85 y 1.15
                    
                    // Modificar el volumen aleatoriamente
                    const randomVolume = 0.8 + Math.random() * 0.4; // Entre 0.8 y 1.2
                    sound.volume = sound.volume * randomVolume;
                    
                    // Llamar a la función original
                    return originalPlay.call(sound);
                };
            } catch (e) {
                console.warn('[AudioManager] No se pudo aplicar distorsión al audio:', e);
            }
        }
        
        return sound;
    }

    // Reproducir música de fondo
    playMusic(id) {
        if (!this.enabled) {
            return Promise.reject(new Error('Audio deshabilitado'));
        }
        if (!this.music.has(id)) {
            console.warn(`[AudioManager] Música no encontrada: ${id}`);
            return Promise.reject(new Error(`Música no encontrada: ${id}`));
        }

        
        // Detener música actual si existe
        if (this.currentMusic) {
            this.music.get(this.currentMusic).pause();
            this.music.get(this.currentMusic).currentTime = 0;
        }

        // Reproducir nueva música
        const music = this.music.get(id);
        
        // Volumen especial para sailing
        if (id === 'sailing') {
            music.volume = this.musicVolume * this.masterVolume * 1.5; // 50% más alto
        } else {
            music.volume = this.musicVolume * this.masterVolume;
        }
        
        // Añadir manejador de errores en la reproducción
        music.addEventListener('error', (e) => {
            console.error(`[AudioManager] Error al reproducir música ${id}:`, e);
        });
        
        // Añadir manejador para confirmar que se está reproduciendo
        music.addEventListener('playing', () => {
        });
        
        // Intentar reproducir y devolver la promesa para manejar errores
        const playPromise = music.play();
        
        // Actualizar la referencia a la música actual
        this.currentMusic = id;
        
        // Si el navegador soporta promesas para play(), devolver la promesa
        if (playPromise !== undefined) {
            return playPromise.catch(error => {
                console.error(`[AudioManager] Error en reproducción de música ${id}:`, error);
                
                // Los navegadores requieren interacción del usuario para reproducir automáticamente
                
                // Devolver el error para manejo adicional
                throw error;
            });
        }
        
        // Si el navegador no soporta promesas para play()
        return Promise.resolve();
    }

    // Reproducir música temporalmente y luego volver a la anterior
    playTemporaryMusic(id, duration) {
        if (!this.enabled) {
            return;
        }
        if (!this.music.has(id)) {
            console.warn(`[AudioManager] Música temporal no encontrada: ${id}`);
            return;
        }

        // Guardar referencia a la música actual
        const previousMusic = this.currentMusic;
        
        // No hacer nada si ya estamos reproduciendo esta música
        if (previousMusic === id) {
            return;
        }

        // Pausar la música actual sin resetear
        if (previousMusic) {
            const currentMusic = this.music.get(previousMusic);
            if (currentMusic) {
                currentMusic.pause();
            }
        }

        // Reproducir la música temporal
        const tempMusic = this.music.get(id);
        tempMusic.currentTime = 0; // Iniciar desde el principio
        tempMusic.volume = this.musicVolume * this.masterVolume;
        
        const playPromise = tempMusic.play();
        
        // Actualizar la referencia
        this.currentMusic = id;
        
        // Programar el fin de la música temporal
        setTimeout(() => {
            // Solo restaurar si seguimos reproduciendo la misma música temporal
            if (this.currentMusic === id && previousMusic) {
                // Detener la música temporal
                tempMusic.pause();
                tempMusic.currentTime = 0;
                
                // Restaurar la música anterior
                this.playMusic(previousMusic);
            }
        }, duration);
        
        // Manejar errores si el navegador soporta promesas
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.error(`[AudioManager] Error en reproducción de música temporal ${id}:`, error);
            });
        }
    }

    // Detener toda la música
    stopMusic() {
        if (this.currentMusic && this.music.has(this.currentMusic)) {
            const music = this.music.get(this.currentMusic);
            music.pause();
            music.currentTime = 0;
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
        this.updateSfxVolumes();
    }

    // Actualizar todos los volúmenes
    updateAllVolumes() {
        this.updateMusicVolumes();
        this.updateSfxVolumes();
    }

    // Actualizar el volumen de todas las pistas de música
    updateMusicVolumes() {
        for (const [id, audio] of this.music.entries()) {
            if (id === 'sailing') {
                audio.volume = this.musicVolume * this.masterVolume * 1.5;
            } else {
                audio.volume = this.musicVolume * this.masterVolume;
            }
        }
    }

    // Actualizar el volumen de todos los efectos de sonido
    updateSfxVolumes() {
        for (const audio of this.sounds.values()) {
            audio.volume = this.sfxVolume * this.masterVolume;
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
        if (!this.enabled && this.currentMusic) {
            const music = this.music.get(this.currentMusic);
            if (music) {
                music.pause();
            }
        } else if (this.enabled && this.currentMusic) {
            // Si se activa y había música, reanudarla
            const music = this.music.get(this.currentMusic);
            if (music) {
                music.play().catch(e => {
                    console.warn('[AudioManager] No se pudo reanudar la música:', e);
                });
            }
        }
        
        return this.enabled;
    }
    
    // Establecer el THREE.AudioListener para audio posicional
    setListener(listener) {
        this.listener = listener;
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
                        this.verifyAndLoadSound(sound, `assets/audio/${folder}/${sound}.mp3`)
                            .catch(() => {}); // Ignorar errores, probaremos la siguiente carpeta
                        
                        // Si ya se cargó, salir del bucle
                        if (this.sounds.has(sound)) break;
                    }
                }
            }
        }
        
        return this.soundEvents[eventName];
    }

    // Clonar un sonido para reproducción
    cloneSound(soundId, volume = null) {
        if (!this.sounds.has(soundId)) return null;
        
        const sound = this.sounds.get(soundId);
        const soundClone = sound.cloneNode();
        
        // Configurar volumen
        const finalVolume = volume !== null ? 
            volume * this.masterVolume : 
            this.sfxVolume * this.masterVolume;
            
        soundClone.volume = finalVolume;
        
        // Añadir manejador de errores en la reproducción
        soundClone.addEventListener('error', (e) => {
            console.error(`[AudioManager] Error al reproducir sonido ${soundId}:`, e);
        });
        
        // Eliminar el clon cuando termine de reproducirse
        soundClone.onended = () => {
            if (soundClone && soundClone.remove) {
                soundClone.remove();
            }
        };
        
        return soundClone;
    }
    
    // Crear un audio posicional
    createPositionalAudio(audioElement, position, maxDistance) {
        if (!this.listener || !position) {
            // Si no hay listener o posición, reproducir como audio normal
            console.log('[AudioManager Debug] Audio posicional fallido - sin listener o posición');
            audioElement.play();
            return audioElement;
        }
        
        try {
            // Obtener la posición GLOBAL de la cámara usando getWorldPosition
            // Esto es crítico porque this.listener.position solo da posición local
            let cameraPosition;
            
            if (this.listener.getWorldPosition) {
                // Obtener posición global de la cámara
                cameraPosition = this.listener.getWorldPosition(new THREE.Vector3());
                console.log('[AudioManager Debug] Usando getWorldPosition:', cameraPosition);
            } else {
                // Fallback a la posición local (probablemente incorrecta)
                cameraPosition = this.listener.position.clone();
                console.warn('[AudioManager Debug] Fallback a posición local del listener');
            }
            
            // Asegurarse de que la posición de la fuente es un Vector3
            const sourcePosition = position instanceof THREE.Vector3 ? 
                position.clone() : 
                new THREE.Vector3(position.x || 0, position.y || 0, position.z || 0);
            
            // Calcular distancia
            const distance = cameraPosition.distanceTo(sourcePosition);
            
            // Log para depuración de distancia
            console.log('[AudioManager Debug] Audio posicional', {
                cámara: `x:${cameraPosition.x.toFixed(1)}, y:${cameraPosition.y.toFixed(1)}, z:${cameraPosition.z.toFixed(1)}`,
                fuente: `x:${sourcePosition.x.toFixed(1)}, y:${sourcePosition.y.toFixed(1)}, z:${sourcePosition.z.toFixed(1)}`,
                distancia: distance.toFixed(1),
                maxDistancia: maxDistance,
                enRango: distance <= maxDistance
            });
            
            // Si estamos fuera del rango, NO reproducir
            if (distance > maxDistance) {
                console.log(`[AudioManager Debug] Audio fuera de rango (${distance.toFixed(1)} > ${maxDistance})`);
                return null;
            }
            
            // Calcular atenuación de volumen basado en distancia
            let volumeMultiplier = 1 - (distance / maxDistance);
            
            // Limitar a un mínimo para evitar que sea inaudible
            volumeMultiplier = Math.max(0.1, volumeMultiplier);
            
            // Aplicar atenuación por distancia
            audioElement.volume = audioElement.volume * volumeMultiplier;
            
            // Log de volumen final
            console.log(`[AudioManager Debug] Audio posicional - volumen: ${audioElement.volume.toFixed(2)}, factor: ${volumeMultiplier.toFixed(2)}`);
            
            // Reproducir el audio
            audioElement.play();
            
            return audioElement;
        } catch (e) {
            console.warn('[AudioManager Debug] Error creando audio posicional:', e);
            
            // En caso de error, reproducir como audio normal
            audioElement.play();
            return audioElement;
        }
    }
    
    // Reproducir un sonido específico (método legado para compatibilidad)
    playSound(id, volume = null, loop = false, position = null) {
        if (!this.enabled || !this.initialized) {
            return null;
        }
        
        if (!this.sounds.has(id)) {
            console.warn(`[AudioManager] Sonido no encontrado: ${id}`);
            return null;
        }
        
        const sound = this.cloneSound(id, volume);
        if (sound) {
            sound.loop = loop || false;
            
            if (position && this.listener) {
                return this.createPositionalAudio(sound, position, 50); // Distancia por defecto: 50
            } else {
                sound.play();
                return sound;
            }
        }
        
        return null;
    }
} 