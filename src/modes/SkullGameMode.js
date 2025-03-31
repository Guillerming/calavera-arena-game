import * as THREE from 'three';

export class SkullGameMode {
    constructor(game) {
        this.game = game;
        this.scene = game.engine.scene;
        this.networkManager = game.networkManager;
        this.scoreManager = game.scoreManager;
        
        // Configuración del modo
        this.NORMAL_MODE_DURATION = 60 * 0.5; // 30 segundos (en segundos) - modo normal
        this.SKULL_MODE_DURATION = 60 * 2;  // 2 minutos (en segundos) - modo calavera
        this.isSkullModeActive = false;  // Inicialmente en modo normal
        this.countdown = this.NORMAL_MODE_DURATION; // Iniciar countdown
        
        // Propiedades de la calavera
        this.skullMesh = null;
        this.skullRadius = 1; // Radio de detección (unidades)
        this.skullHeight = 3; // Altura a la que flota (unidades)
        this.skullPosition = new THREE.Vector3();
        this.isSkullCaptured = false;
        
        // Propiedades para la animación de la calavera
        this.skullAnimationTime = 0;
        this.skullFloatAmplitude = 0.3; // Amplitud de la flotación
        this.skullFloatSpeed = 2.0;     // Velocidad de la flotación (aumentada)
        this.skullRotationSpeed = 0.8;  // Velocidad de rotación (aumentada)
        
        // Referencias a los jugadores
        this.characters = null;
        
        // Mensajes en pantalla
        this.messageElement = null;
        this.timerElement = null;
        this.createUI();
    }
    
    // Iniciar el modo de juego
    start() {
        // Obtener referencia a los jugadores
        if (this.game.characterManager) {
            this.characters = this.game.characterManager.characters;
        } else {
            console.error("No se pudo obtener referencia a los jugadores");
        }
        
        // Crear la calavera (pero no mostrarla aún)
        this.createSkull();
    }
    
    // Actualizar el modo de juego (llamado cada frame)
    update(deltaTime) {
        // Actualizar UI
        this.updateUI();
        
        // Actualizar contador
        if (deltaTime > 0) {
            this.countdown -= deltaTime;
            
            // Si el contador llega a cero, cambiar el modo
            if (this.countdown <= 0) {
                // Si estábamos en modo normal, activar modo calavera
                if (!this.isSkullModeActive) {
                    this.onModeActivated();
                    this.updateSkullVisibility();
                } 
                // Si estábamos en modo calavera, volver a modo normal
                else {
                    this.onModeDeactivated();
                    this.updateSkullVisibility();
                }
            }
        }
        
        // Si estamos en modo calavera y la calavera no ha sido capturada
        if (this.isSkullModeActive && !this.isSkullCaptured && this.skullMesh) {
            // Actualizar orientación de la calavera
            this.updateSkullOrientation();
            
            // Actualizar animación de la calavera
            this.updateSkullAnimation(deltaTime);
        }
    }
    
    // Crear la calavera (pero no mostrarla aún)
    createSkull() {
        // Crear un canvas para el emoji de la calavera
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'transparent';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Dibujar un círculo negro de fondo
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, 45, 0, Math.PI * 2);
        ctx.fillStyle = 'black';
        ctx.fill();
        
        // Dibujar el emoji de calavera
        ctx.font = '100px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💀', canvas.width / 2, canvas.height / 2);
        
        // Crear textura desde el canvas
        const texture = new THREE.CanvasTexture(canvas);
        
        // Crear material con la textura
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide
        });
        
        // Crear geometría (un plano simple pero más grande - 1.5 veces el tamaño anterior)
        const geometry = new THREE.PlaneGeometry(4.5, 4.5);
        
        // Crear mesh
        this.skullMesh = new THREE.Mesh(geometry, material);
        
        // No mostrar inicialmente
        this.skullMesh.visible = false;
        
        // Añadir a la escena
        this.scene.add(this.skullMesh);
    }
    
    // Actualizar la posición de la calavera (recibida del servidor)
    updateSkullPosition(position) {
        if (!this.skullMesh) return;
        
        this.skullPosition.set(position.x, position.y, position.z);
        this.skullMesh.position.copy(this.skullPosition);
    }
    
    // Actualizar si la calavera es visible o no
    updateSkullVisibility() {
        if (!this.skullMesh) return;
        
        // La calavera es visible si estamos en modo calavera y no ha sido capturada
        this.skullMesh.visible = this.isSkullModeActive && !this.isSkullCaptured;
    }
    
    // Actualizar orientación de la calavera para que mire al jugador local
    updateSkullOrientation() {
        if (!this.skullMesh || !this.skullMesh.visible) return;
        
        // Obtener la cámara
        const camera = this.game.engine.camera;
        if (!camera) return;
        
        // Hacer que la calavera mire hacia la cámara (billboarding)
        this.skullMesh.lookAt(camera.position);
    }
    
    // Método para crear la UI
    createUI() {
        // Obtener referencias a los elementos existentes
        this.messageElement = document.getElementById('message-text');
        this.messageContainer = document.getElementById('message-container');
        this.timerElement = document.getElementById('skull-timer');
        this.skullModeContainer = document.getElementById('skull-mode-container');
        
        // Verificar que todos los elementos existen
        if (!this.messageElement || !this.messageContainer || !this.timerElement || !this.skullModeContainer) {
            console.error('Error: No se encontraron algunos elementos UI del modo calavera en el HTML');
        }
    }
    
    // Actualizar UI (timer y mensajes)
    updateUI() {
        if (!this.timerElement) return;
        
        // Formatear tiempo restante
        const minutes = Math.floor(this.countdown / 60);
        const seconds = Math.floor(this.countdown % 60);
        const timeString = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        
        // Mostrar texto según el modo
        if (this.isSkullModeActive) {
            this.timerElement.textContent = `MODO CALAVERA: ${timeString}`;
            this.skullModeContainer.classList.add('skull-mode-active');
        } else {
            this.timerElement.textContent = `Próximo modo calavera: ${timeString}`;
            this.skullModeContainer.classList.remove('skull-mode-active');
        }
    }
    
    // Mostrar mensaje temporal
    showMessage(message, duration = 5000) {
        if (!this.messageElement || !this.messageContainer) return;
        
        this.messageElement.textContent = message;
        this.messageContainer.style.opacity = '1';
        
        // Ocultar después de duración
        clearTimeout(this.messageTimeout);
        this.messageTimeout = setTimeout(() => {
            this.messageContainer.style.opacity = '0';
        }, duration);
    }
    
    // Limpiar recursos
    cleanup() {
        if (this.skullMesh && this.skullMesh.parent) {
            this.skullMesh.parent.remove(this.skullMesh);
        }
        
        clearTimeout(this.messageTimeout);
        
        // Ya no necesitamos eliminar elementos, solo limpiar su contenido
        if (this.messageElement) {
            this.messageElement.textContent = '';
        }
        
        if (this.messageContainer) {
            this.messageContainer.style.opacity = '0';
        }
    }
    
    // Método para sincronizar con el servidor
    syncWithServer(data) {
        if (!data) return;
        
        // Actualizar estado del modo
        if (data.isActive !== undefined) {
            const wasModeActive = this.isSkullModeActive;
            this.isSkullModeActive = data.isActive;
            
            // Si cambiamos de modo, mostrar mensaje
            if (wasModeActive !== this.isSkullModeActive) {
                if (this.isSkullModeActive) {
                    this.showMessage("¡MODO CALAVERA ACTIVADO! ¡Captura la calavera!");
                } else {
                    this.showMessage("Modo normal restaurado");
                }
            }
        }
        
        // Actualizar countdown
        if (data.countdown !== undefined) {
            this.countdown = data.countdown;
        }
        
        // Actualizar posición de la calavera si está activa
        if (data.data && data.data.skullPosition) {
            this.updateSkullPosition(data.data.skullPosition);
        }
        
        // Actualizar estado de captura
        if (data.data && data.data.isSkullCaptured !== undefined) {
            this.isSkullCaptured = data.data.isSkullCaptured;
        }
        
        // Actualizar visibilidad de la calavera
        this.updateSkullVisibility();
        
        // Actualizar UI
        this.updateUI();
    }
    
    // Método para manejar el evento de captura de calavera desde el servidor
    onSkullCaptured(playerId) {
        // Si no está en modo calavera o ya fue capturada, ignorar
        if (!this.isSkullModeActive || this.isSkullCaptured) {
            return;
        }
        
        // Encontrar el carácter relacionado con este playerId
        const character = this.game.findCharacterById(playerId);
        const playerName = character ? character.name : playerId;
        
        // Actualizar estado
        this.isSkullCaptured = true;
        this.updateSkullVisibility();
        
        // Mostrar mensaje de captura
        this.showMessage(`¡${playerName} ha capturada la calavera!`);
    }
    
    // Manejar la activación del modo calavera
    onModeActivated() {
        this.isSkullModeActive = true;
        this.countdown = this.SKULL_MODE_DURATION;
        
        // Hacer visible la calavera
        if (this.skullMesh) {
            this.skullMesh.visible = true;
        }
        
        // Generar posición aleatoria para la calavera
        this.generateRandomSkullPosition();
        
        // Mostrar mensaje de inicio
        this.showMessage("¡MODO CALAVERA ACTIVADO! ¡Captura la calavera!");
        
        // Reproducir música de modo calavera si existe audioManager
        if (this.game && this.game.audioManager) {
            // Reproducir por 12 segundos (duración de la pista)
            this.game.audioManager.playTemporaryMusic('calaveramode', 12000);
            
            // Iniciar sistema de sonidos de fantasma aleatorios durante el modo calavera
            this._startRandomCalaveraAudio();
        }
    }
    
    // Sistema para reproducir sonidos de fantasma aleatorios durante el modo calavera
    _startRandomCalaveraAudio() {
        // Guardar el estado actual para poder detenerlo después
        this._calaveraAudioActive = true;
        
        // Función recursiva para reproducir sonidos aleatorios
        const playRandomGhostSound = () => {
            // Verificar si aún estamos en modo calavera y el sistema sigue activo
            if (!this.isSkullModeActive || !this._calaveraAudioActive) {
                this._calaveraAudioActive = false;
                return;
            }
            
            // Reproducir un sonido de fantasma aleatorio
            if (this.game && this.game.playAudioEvent) {
                // Calcular una posición que ayude a guiar al jugador
                let soundPosition;
                
                // Verificar si hay un jugador local para guiar
                const localPlayer = this.game.player;
                
                if (localPlayer && this.skullPosition) {
                    // Vector desde el jugador hacia la calavera
                    const directionToSkull = new THREE.Vector3().subVectors(
                        this.skullPosition, 
                        localPlayer.position
                    );
                    
                    // Distancia entre el jugador y la calavera
                    const distanceToSkull = directionToSkull.length();
                    
                    // Normalizar el vector de dirección
                    directionToSkull.normalize();
                    
                    // Si el jugador está lejos, poner el sonido a medio camino
                    // Si está cerca, poner el sonido en la calavera
                    const positionFactor = Math.min(1.0, 20 / distanceToSkull);
                    
                    // Calcular una posición aleatoria cerca de la línea entre jugador y calavera
                    const randomOffset = new THREE.Vector3(
                        (Math.random() - 0.5) * 5,
                        (Math.random() - 0.5) * 3,
                        (Math.random() - 0.5) * 5
                    );
                    
                    // Posición base: más cerca de la calavera a medida que el jugador se acerca
                    const basePosition = new THREE.Vector3().addVectors(
                        localPlayer.position,
                        directionToSkull.multiplyScalar(distanceToSkull * positionFactor)
                    );
                    
                    // Añadir offset aleatorio a la posición
                    soundPosition = basePosition.add(randomOffset);
                } else {
                    // Si no hay jugador local, usar la posición de la calavera con un offset aleatorio
                    soundPosition = this.skullPosition ? this.skullPosition.clone().add(
                        new THREE.Vector3(
                            (Math.random() - 0.5) * 10,
                            (Math.random() - 0.5) * 5,
                            (Math.random() - 0.5) * 10
                        )
                    ) : null;
                }
                
                // Reproducir el evento de sonido 'calaveramode' en la posición calculada
                this.game.playAudioEvent('calaveramode', soundPosition);
            }
            
            // Programar el próximo sonido con tiempo aleatorio
            // Cuanto más cerca esté el jugador de la calavera, más frecuentes serán los sonidos
            let minTime = 3000;  // 3 segundos mínimo
            let maxTime = 8000;  // 8 segundos máximo
            
            // Ajustar tiempos si el jugador está cerca de la calavera
            if (this.game && this.game.player && this.skullPosition) {
                const distanceToSkull = this.game.player.position.distanceTo(this.skullPosition);
                
                // Si el jugador está cerca, sonidos más frecuentes
                if (distanceToSkull < 30) {
                    minTime = 1500;  // 1.5 segundos mínimo
                    maxTime = 4000;  // 4 segundos máximo
                }
            }
            
            const nextTime = minTime + Math.random() * (maxTime - minTime);
            
            // Guardar el timeout para poder cancelarlo si es necesario
            this._nextCalaveraTimeout = setTimeout(playRandomGhostSound, nextTime);
        };
        
        // Iniciar con un pequeño retraso para no interferir con la música inicial
        this._nextCalaveraTimeout = setTimeout(playRandomGhostSound, 2000);
    }
    
    // Detener el sistema de audio de calavera
    _stopCalaveraAudio() {
        this._calaveraAudioActive = false;
        
        // Cancelar cualquier timeout pendiente
        if (this._nextCalaveraTimeout) {
            clearTimeout(this._nextCalaveraTimeout);
            this._nextCalaveraTimeout = null;
        }
    }

    // Manejar la desactivación del modo calavera
    onModeDeactivated() {
        this.isSkullModeActive = false;
        this.skullMesh.visible = false;
        this.isSkullCaptured = false;
        this.countdown = this.NORMAL_MODE_DURATION;
        
        // Detener el sistema de audio aleatorio de calavera
        this._stopCalaveraAudio();
    }

    // Generar una posición aleatoria para la calavera
    generateRandomSkullPosition() {
        if (!this.skullMesh) return;
        
        // Generar posición aleatoria dentro de un cierto rango del mapa
        const mapRadius = 100; // Radio del mapa para colocar la calavera
        const randomAngle = Math.random() * Math.PI * 2;
        const randomRadius = Math.random() * mapRadius * 0.7; // 70% del radio del mapa
        
        // Calcular posición XZ en círculo
        const x = Math.cos(randomAngle) * randomRadius;
        const z = Math.sin(randomAngle) * randomRadius;
        
        // Establecer altura fija + pequeña variación
        const y = this.skullHeight + Math.random() * 0.5;
        
        // Actualizar posición
        this.skullPosition.set(x, y, z);
        this.skullMesh.position.copy(this.skullPosition);
    }

    // Método para animar la calavera
    updateSkullAnimation(deltaTime) {
        if (!this.skullMesh || !this.skullMesh.visible) return;
        
        // Incrementar tiempo de animación
        this.skullAnimationTime += deltaTime * this.skullFloatSpeed;
        
        // Calcular movimiento vertical (sinusoidal)
        const verticalOffset = Math.sin(this.skullAnimationTime) * this.skullFloatAmplitude;
        
        // Aplicar movimiento vertical
        this.skullMesh.position.y = this.skullPosition.y + verticalOffset;
        
        // Aplicar rotación
        this.skullMesh.rotation.y += deltaTime * this.skullRotationSpeed;
    }
} 