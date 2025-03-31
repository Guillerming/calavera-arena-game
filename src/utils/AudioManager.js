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
    }

    // Verificar la validez de las rutas de audio cargadas
    verifyAudioPaths() {
        console.log('[AudioManager] Verificando rutas de audio...');
        
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
        
        console.log(`[AudioManager] Verificando ${description} - URL: ${url}`);
        
        // Realizar solicitud fetch para verificar si el archivo existe
        fetch(url)
            .then(response => {
                if (response.ok) {
                    console.log(`[AudioManager] ✅ ${description} - El archivo existe: ${url}`);
                } else {
                    console.error(`[AudioManager] ❌ ${description} - Error al cargar el archivo: ${url} (${response.status})`);
                }
            })
            .catch(error => {
                console.error(`[AudioManager] ❌ ${description} - Error al verificar el archivo: ${url}`, error);
            });
    }

    // Inicializar el sistema de audio
    async init() {
        if (this.initialized) return;

        console.log('[AudioManager] Iniciando carga de archivos de audio...');
        
        try {
            // Cargar música de fondo - verificando archivos primero
            await this.verifyAndLoadMusic('osd', 'assets/audio/osd/osd.mp3');
            await this.verifyAndLoadMusic('sailing', 'assets/audio/fx/sailing.mp3');
            await this.verifyAndLoadMusic('calaveramode', 'assets/audio/osd/calaveramode.mp3');
    
            // Configurar volumen específico para sailing (más alto)
            if (this.music.has('sailing')) {
                const sailingMusic = this.music.get('sailing');
                sailingMusic.volume = this.musicVolume * this.masterVolume * 1.5; // 50% más alto que el resto
                console.log(`[AudioManager] Volumen de sailing configurado a: ${sailingMusic.volume}`);
            } else {
                console.error('[AudioManager] ⚠️ No se pudo cargar sailing.mp3');
            }
    
            // Cargar efectos de sonido
            await this.verifyAndLoadSound('canon', 'assets/audio/fx/canon.mp3');
            await this.verifyAndLoadSound('impact', 'assets/audio/fx/impact.mp3');
    
            this.initialized = true;
            console.log('[AudioManager] Sistema de audio inicializado correctamente');
            
            // Verificar que todo esté cargado
            this.logLoadedAudio();
        } catch (error) {
            console.error('[AudioManager] Error durante la inicialización:', error);
        }
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
            
            console.log(`[AudioManager] ✅ Archivo verificado: ${url}`);
            
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
            
            console.log(`[AudioManager] ✅ Archivo verificado: ${url}`);
            
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
        console.log('[AudioManager] === Resumen de audio cargado ===');
        console.log(`[AudioManager] Música: ${Array.from(this.music.keys()).join(', ') || 'Ninguna'}`);
        console.log(`[AudioManager] Efectos: ${Array.from(this.sounds.keys()).join(', ') || 'Ninguno'}`);
    }

    // Cargar un efecto de sonido
    loadSound(id, url) {
        console.log(`[AudioManager] Cargando efecto de sonido: ${id} desde ${url}`);
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
        console.log(`[AudioManager] Cargando música: ${id} desde ${url}`);
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

    // Reproducir un efecto de sonido
    playSound(id) {
        if (!this.enabled) {
            console.log(`[AudioManager] Audio deshabilitado, no se reproduce: ${id}`);
            return;
        }
        if (!this.sounds.has(id)) {
            console.warn(`[AudioManager] Sonido no encontrado: ${id}`);
            return;
        }

        console.log(`[AudioManager] Reproduciendo sonido: ${id}`);
        const sound = this.sounds.get(id);
        
        // Clonar el sonido para permitir múltiples reproducciones simultáneas
        const soundClone = sound.cloneNode();
        soundClone.volume = this.sfxVolume * this.masterVolume;
        
        // Añadir manejador de errores en la reproducción
        soundClone.addEventListener('error', (e) => {
            console.error(`[AudioManager] Error al reproducir sonido ${id}:`, e);
        });
        
        // Añadir manejador para confirmar que se está reproduciendo
        soundClone.addEventListener('playing', () => {
            console.log(`[AudioManager] Sonido ${id} reproduciendo correctamente`);
        });
        
        // Intentar reproducir
        const playPromise = soundClone.play();
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.error(`[AudioManager] Error en reproducción de sonido ${id}:`, error);
            });
        }
        
        // Eliminar el clon cuando termine de reproducirse
        soundClone.onended = () => {
            console.log(`[AudioManager] Sonido ${id} finalizado`);
            soundClone.remove();
        };
    }

    // Reproducir música de fondo
    playMusic(id) {
        if (!this.enabled) {
            console.log(`[AudioManager] Audio deshabilitado, no se reproduce música: ${id}`);
            return Promise.reject(new Error('Audio deshabilitado'));
        }
        if (!this.music.has(id)) {
            console.warn(`[AudioManager] Música no encontrada: ${id}`);
            return Promise.reject(new Error(`Música no encontrada: ${id}`));
        }

        console.log(`[AudioManager] Reproduciendo música: ${id}`);
        
        // Detener música actual si existe
        if (this.currentMusic) {
            console.log(`[AudioManager] Deteniendo música actual: ${this.currentMusic}`);
            this.music.get(this.currentMusic).pause();
            this.music.get(this.currentMusic).currentTime = 0;
        }

        // Reproducir nueva música
        const music = this.music.get(id);
        
        // Volumen especial para sailing
        if (id === 'sailing') {
            music.volume = this.musicVolume * this.masterVolume * 1.5; // 50% más alto
            console.log(`[AudioManager] Volumen especial para sailing: ${music.volume}`);
        } else {
            music.volume = this.musicVolume * this.masterVolume;
        }
        
        // Añadir manejador de errores en la reproducción
        music.addEventListener('error', (e) => {
            console.error(`[AudioManager] Error al reproducir música ${id}:`, e);
        });
        
        // Añadir manejador para confirmar que se está reproduciendo
        music.addEventListener('playing', () => {
            console.log(`[AudioManager] Música ${id} reproduciendo correctamente con volumen ${music.volume}`);
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
                console.log(`[AudioManager] Intentando reproducir ${id} después de evento de usuario...`);
                
                // Devolver el error para manejo adicional
                throw error;
            });
        }
        
        // Si el navegador no soporta promesas para play()
        return Promise.resolve();
    }

    // Reproducir una pista temporal mientras se baja el volumen de la música actual
    playTemporaryMusic(id, duration) {
        if (!this.enabled) return;
        if (!this.music.has(id)) {
            console.warn(`[AudioManager] Música temporal no encontrada: ${id}`);
            return;
        }

        // Guardar la música actual para restaurarla después
        const previousMusic = this.currentMusic;
        
        if (previousMusic) {
            // Bajar volumen de la música actual
            const currentMusic = this.music.get(previousMusic);
            const originalVolume = currentMusic.volume;
            
            // Reducir volumen a 20% del original
            currentMusic.volume = originalVolume * 0.2;
            
            // Reproducir la música temporal
            const tempMusic = this.music.get(id);
            tempMusic.loop = false; // No repetir
            tempMusic.volume = this.musicVolume * this.masterVolume;
            tempMusic.play();
            
            console.log(`[AudioManager] Reproduciendo música temporal: ${id} por ${duration}ms`);
            
            // Restaurar después de la duración especificada
            setTimeout(() => {
                // Restaurar volumen original
                currentMusic.volume = originalVolume;
                
                // Asegurarse de que la música temporal se detenga
                tempMusic.pause();
                tempMusic.currentTime = 0;
                
                console.log(`[AudioManager] Música temporal finalizada, restaurando: ${previousMusic}`);
            }, duration);
        } else {
            // Si no hay música actualmente, simplemente reproducir la temporal
            this.playMusic(id);
            
            // Detener después de la duración especificada
            setTimeout(() => {
                if (this.currentMusic === id) {
                    const tempMusic = this.music.get(id);
                    tempMusic.pause();
                    tempMusic.currentTime = 0;
                    this.currentMusic = null;
                }
            }, duration);
        }
    }

    // Detener toda la música
    stopMusic() {
        if (this.currentMusic) {
            this.music.get(this.currentMusic).pause();
            this.music.get(this.currentMusic).currentTime = 0;
            this.currentMusic = null;
        }
    }

    // Cambiar volumen maestro
    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        this.updateAllVolumes();
    }

    // Cambiar volumen de música
    setMusicVolume(volume) {
        this.musicVolume = Math.max(0, Math.min(1, volume));
        this.updateMusicVolumes();
    }

    // Cambiar volumen de efectos
    setSfxVolume(volume) {
        this.sfxVolume = Math.max(0, Math.min(1, volume));
        this.updateSfxVolumes();
    }

    // Actualizar volumen de todas las pistas
    updateAllVolumes() {
        this.updateMusicVolumes();
        this.updateSfxVolumes();
    }

    // Actualizar volumen de música
    updateMusicVolumes() {
        for (const music of this.music.values()) {
            music.volume = this.musicVolume * this.masterVolume;
        }
    }

    // Actualizar volumen de efectos
    updateSfxVolumes() {
        for (const sound of this.sounds.values()) {
            sound.volume = this.sfxVolume * this.masterVolume;
        }
    }

    // Habilitar/deshabilitar todo el audio
    toggle(enabled) {
        if (enabled === undefined) {
            this.enabled = !this.enabled;
        } else {
            this.enabled = enabled;
        }

        if (!this.enabled) {
            this.stopMusic();
        } else if (this.currentMusic) {
            this.music.get(this.currentMusic).play();
        }
        
        return this.enabled;
    }
} 