import * as THREE from 'three';

export class SkullGameMode {
    constructor(game) {
        this.game = game;
        this.scene = game.engine.scene;
        this.networkManager = game.networkManager;
        this.scoreManager = game.scoreManager;
        
        // Configuración del modo
        this.NORMAL_MODE_DURATION = 60 * 0.5; // 30 seconds (in seconds) - normal mode
        this.SKULL_MODE_DURATION = 60 * 2;  // 2 minutes (in seconds) - skull mode
        this.isSkullModeActive = false;  // Initially in normal mode
        this.countdown = this.NORMAL_MODE_DURATION; // Start countdown
        
        // Propiedades de la calavera
        this.skullMesh = null;
        this.skullRadius = 1; // Detection radius (units)
        this.skullHeight = 3; // Height at which it floats (units)
        this.skullPosition = new THREE.Vector3();
        this.isSkullCaptured = false;
        
        // Propiedades para la animación de la calavera
        this.skullAnimationTime = 0;
        this.skullFloatAmplitude = 0.3; // Float amplitude
        this.skullFloatSpeed = 2.0;     // Float speed (increased)
        this.skullRotationSpeed = 0.8;  // Rotation speed (increased)
        
        // Referencias a los jugadores
        this.characters = null;
        
        // Mensajes en pantalla
        this.messageElement = null;
        this.timerElement = null;
        this.createUI();
        
        // Efectos visuales para el modo calavera
        this.originalFogColor = null;
        this.originalBackgroundColor = null;
        this.originalLightColor = null;
        this.fog = null;
        this.skullModeColorFilter = null;
        this.visualTransitionDuration = 1.5; // duración de la transición en segundos
        this.isTransitioning = false;
        this.transitionStartTime = 0;
        this.transitionProgress = 0;
        this.transitionDirection = 1; // 1: normal->calavera, -1: calavera->normal
        
        // Colores de efecto calavera
        this.skullBackgroundColor = new THREE.Color(0x14080A);
        this.skullFogColor = new THREE.Color(0x221419);
        this.skullFogDensity = 0.04;
        this.skullLightColor = new THREE.Color(0xCC9999);
        
        this.initializeVisualEffects();
    }
    
    // Inicializar efectos visuales
    initializeVisualEffects() {
        // Guardar colores originales de la escena
        this.originalBackgroundColor = this.scene.background ? this.scene.background.clone() : new THREE.Color(0x87ceeb);
        
        // Guardar referencia a las luces ambientales y sus colores originales
        this.ambientLights = [];
        this.scene.traverse((object) => {
            if (object instanceof THREE.AmbientLight) {
                this.ambientLights.push(object);
                if (!this.originalLightColor) {
                    this.originalLightColor = object.color.clone();
                }
            }
        });
        
        // Crear filtro de color rojizo (se aplicará cuando se active el modo)
        this.createColorFilter();
    }
    
    // Crear filtro de color rojizo para overlay
    createColorFilter() {
        // Crear un div para el filtro de color
        const filterDiv = document.createElement('div');
        filterDiv.id = 'skull-mode-filter';
        filterDiv.style.position = 'fixed';
        filterDiv.style.top = '0';
        filterDiv.style.left = '0';
        filterDiv.style.width = '100vw';
        filterDiv.style.height = '100vh';
        filterDiv.style.backgroundColor = 'rgba(255, 0, 0, 0.04)'; // Reducido a 40% del valor original (0.1)
        filterDiv.style.pointerEvents = 'none';
        filterDiv.style.opacity = '0';
        filterDiv.style.transition = 'opacity 1.5s ease-in-out';
        filterDiv.style.zIndex = '1000';
        document.body.appendChild(filterDiv);
        
        this.skullModeColorFilter = filterDiv;
    }
    
    // Iniciar el modo de juego
    start() {
        // Get reference to players
        if (this.game.characterManager) {
            this.characters = this.game.characterManager.characters;
        } else {
            console.error("No se pudo obtener referencia a los jugadores");
        }
        
        // Create the skull (but not show it yet)
        this.createSkull();
    }
    
    // Actualizar el modo de juego (llamado cada frame)
    update(deltaTime) {
        // Update UI
        this.updateUI();
        
        // Update counter
        if (deltaTime > 0) {
            this.countdown -= deltaTime;
            
            // If counter reaches zero, change mode
            if (this.countdown <= 0) {
                // If we were in normal mode, activate skull mode
                if (!this.isSkullModeActive) {
                    this.onModeActivated();
                    this.updateSkullVisibility();
                } 
                // If we were in skull mode, return to normal mode
                else {
                    this.onModeDeactivated();
                    this.updateSkullVisibility();
                    
                    // Verificación adicional para asegurar que se revierten los efectos visuales
                    if (this.scene && this.scene.fog && !this.isTransitioning) {
                        this.scene.fog = null;
                    }
                    if (this.skullModeColorFilter && !this.isTransitioning) {
                        this.skullModeColorFilter.style.opacity = '0';
                    }
                }
            }
        }
        
        // Actualizar transición visual si está en curso
        if (this.isTransitioning) {
            this.updateVisualTransition(deltaTime);
        }
        
        // If we are in skull mode and the skull hasn't been captured
        if (this.isSkullModeActive && !this.isSkullCaptured && this.skullMesh) {
            // Update skull orientation
            this.updateSkullOrientation();
            
            // Update skull animation
            this.updateSkullAnimation(deltaTime);
        } else if (!this.isSkullModeActive && this.scene && this.scene.fog && !this.isTransitioning) {
            // Verificación adicional: si no estamos en modo calavera pero aún hay niebla, eliminarla
            this.scene.fog = null;
        }
    }
    
    // Actualizar la transición visual (interpolación suave)
    updateVisualTransition(deltaTime) {
        if (!this.isTransitioning) return;
        
        // Actualizar progreso
        this.transitionProgress += deltaTime / this.visualTransitionDuration;
        
        // Limitar progreso entre 0 y 1
        if (this.transitionProgress >= 1) {
            this.transitionProgress = 1;
            this.isTransitioning = false;
        }
        
        // Calcular valor de interpolación (dependiendo de la dirección)
        let t = this.transitionDirection > 0 ? this.transitionProgress : 1 - this.transitionProgress;
        
        // Función de suavizado (ease-in-out)
        t = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        
        // Interpolar color de fondo
        if (this.originalBackgroundColor && this.scene.background) {
            this.scene.background.copy(this.originalBackgroundColor).lerp(this.skullBackgroundColor, t);
        }
        
        // Interpolar niebla
        if (this.transitionDirection > 0) {
            // Transición a modo calavera - crear niebla gradualmente
            if (!this.scene.fog && t > 0.1) {
                // Crear niebla con baja densidad cuando la transición alcanza 10%
                this.fog = new THREE.FogExp2(this.skullFogColor, 0.001);
                this.scene.fog = this.fog;
            }
            
            // Aumentar densidad gradualmente
            if (this.scene.fog) {
                this.scene.fog.density = this.skullFogDensity * t;
                
                // Interpolar color de la niebla
                if (this.scene.fog.color) {
                    this.scene.fog.color.copy(this.skullFogColor);
                }
            }
        } else {
            // Transición a modo normal - reducir niebla gradualmente
            if (this.scene.fog) {
                this.scene.fog.density = this.skullFogDensity * t;
                
                // Si la niebla es casi invisible, eliminarla
                if (t < 0.1) {
                    this.scene.fog = null;
                }
            }
        }
        
        // Interpolar color de luces
        if (this.originalLightColor && this.ambientLights.length > 0) {
            // Interpolar cada luz ambiental
            this.ambientLights.forEach(light => {
                if (this.transitionDirection > 0) {
                    // Normal -> Calavera
                    light.color.copy(this.originalLightColor).lerp(this.skullLightColor, t);
                } else {
                    // Calavera -> Normal
                    light.color.copy(this.skullLightColor).lerp(this.originalLightColor, t);
                }
            });
        }
    }
    
    // Create the skull (but not show it yet)
    createSkull() {
        // Create a canvas for the skull emoji
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'transparent';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw a black circle background
        ctx.beginPath();
        ctx.arc(canvas.width / 2, canvas.height / 2, 45, 0, Math.PI * 2);
        ctx.fillStyle = 'black';
        ctx.fill();
        
        // Draw the skull emoji
        ctx.font = '100px Arial';
        ctx.fillStyle = 'white';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('💀', canvas.width / 2, canvas.height / 2);
        
        // Create texture from canvas
        const texture = new THREE.CanvasTexture(canvas);
        
        // Create material with the texture
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide
        });
        
        // Create geometry (a simple plane but larger - 1.5 times the size of the previous one)
        const geometry = new THREE.PlaneGeometry(4.5, 4.5);
        
        // Create mesh
        this.skullMesh = new THREE.Mesh(geometry, material);
        
        // Not show initially
        this.skullMesh.visible = false;
        
        // Add to scene
        this.scene.add(this.skullMesh);
    }
    
    // Update skull position (received from server)
    updateSkullPosition(position) {
        if (!this.skullMesh) return;
        
        this.skullPosition.set(position.x, position.y, position.z);
        this.skullMesh.position.copy(this.skullPosition);
    }
    
    // Update if the skull is visible or not
    updateSkullVisibility() {
        if (!this.skullMesh) return;
        
        // The skull is visible if we are in skull mode and not captured
        this.skullMesh.visible = this.isSkullModeActive && !this.isSkullCaptured;
    }
    
    // Update skull orientation to face the local player
    updateSkullOrientation() {
        if (!this.skullMesh || !this.skullMesh.visible) return;
        
        // Get camera
        const camera = this.game.engine.camera;
        if (!camera) return;
        
        // Make the skull look towards the camera (billboarding)
        this.skullMesh.lookAt(camera.position);
    }
    
    // Method to create UI
    createUI() {
        // Get references to existing elements
        this.messageElement = document.getElementById('message-text');
        this.messageContainer = document.getElementById('message-container');
        this.timerElement = document.getElementById('skull-timer');
        this.skullModeContainer = document.getElementById('skull-mode-container');
        
        // Verify that all elements exist
        if (!this.messageElement || !this.messageContainer || !this.timerElement || !this.skullModeContainer) {
            console.error('Error: Some skull mode UI elements were not found in the HTML');
        }
    }
    
    // Update UI (timer and messages)
    updateUI() {
        if (!this.timerElement) return;
        
        // Format remaining time
        const minutes = Math.floor(this.countdown / 60);
        const seconds = Math.floor(this.countdown % 60);
        const timeString = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        
        // Show text based on mode
        if (this.isSkullModeActive) {
            this.timerElement.textContent = `CALAVERA MODE: ${timeString}`;
            this.skullModeContainer.classList.add('skull-mode-active');
        } else {
            this.timerElement.textContent = `Next Calavera mode: ${timeString}`;
            this.skullModeContainer.classList.remove('skull-mode-active');
        }
    }
    
    // Show temporary message
    showMessage(message, duration = 5000) {
        if (!this.messageElement || !this.messageContainer) return;
        
        this.messageElement.textContent = message;
        this.messageContainer.style.opacity = '1';
        
        // Hide after duration
        clearTimeout(this.messageTimeout);
        this.messageTimeout = setTimeout(() => {
            this.messageContainer.style.opacity = '0';
        }, duration);
    }
    
    // Clean up resources
    cleanup() {
        if (this.skullMesh && this.skullMesh.parent) {
            this.skullMesh.parent.remove(this.skullMesh);
        }
        
        clearTimeout(this.messageTimeout);
        
        // We no longer need to remove elements, just clean up their content
        if (this.messageElement) {
            this.messageElement.textContent = '';
        }
        
        if (this.messageContainer) {
            this.messageContainer.style.opacity = '0';
        }
        
        // Detener cualquier transición en curso
        this.isTransitioning = false;
        
        // Asegurarnos de que los efectos visuales se eliminen completamente
        this.isSkullModeActive = false;
        this.restoreNormalVisuals(true); // forzar restauración inmediata
        
        // Eliminar filtro de color
        if (this.skullModeColorFilter && this.skullModeColorFilter.parentNode) {
            this.skullModeColorFilter.parentNode.removeChild(this.skullModeColorFilter);
        }
        
        // Asegurarse de que no quede niebla residual
        if (this.scene) {
            this.scene.fog = null;
        }
    }
    
    // Method to synchronize with the server
    syncWithServer(data) {
        if (!data) return;
        
        // Update mode status
        if (data.isActive !== undefined) {
            const wasModeActive = this.isSkullModeActive;
            this.isSkullModeActive = data.isActive;
            
            // If we changed mode, show message
            if (wasModeActive !== this.isSkullModeActive) {
                if (this.isSkullModeActive) {
                    this.showMessage("CALAVERA MODE ACTIVATED! Capture the skull!");
                    // Aplicar efectos visuales cuando el modo se activa por sincronización
                    this.applySkullModeVisuals();
                } else {
                    this.showMessage("Normal mode restored");
                    // Restaurar visuales normales cuando el modo se desactiva por sincronización
                    this.restoreNormalVisuals();
                }
            }
        }
        
        // Update countdown
        if (data.countdown !== undefined) {
            this.countdown = data.countdown;
        }
        
        // Update skull position if active
        if (data.data && data.data.skullPosition) {
            this.updateSkullPosition(data.data.skullPosition);
        }
        
        // Update capture status
        if (data.data && data.data.isSkullCaptured !== undefined) {
            const wasCaptured = this.isSkullCaptured;
            this.isSkullCaptured = data.data.isSkullCaptured;
            
            // Si la calavera fue capturada, asegurarse de que se reviertan los efectos visuales
            // en caso de que el modo vaya a terminar pronto
            if (!wasCaptured && this.isSkullCaptured) {
                // No revertimos aún, pero estamos listos para hacerlo cuando el servidor
                // indique que el modo ha terminado
            }
        }
        
        // Update skull visibility
        this.updateSkullVisibility();
        
        // Update UI
        this.updateUI();
    }
    
    // Method to handle skull capture event from server
    onSkullCaptured(playerId) {
        // If not in skull mode or already captured, ignore
        if (!this.isSkullModeActive || this.isSkullCaptured) {
            return;
        }
        
        // Find the character related to this playerId
        const character = this.game.findCharacterById(playerId);
        const playerName = character ? character.name : playerId;
        
        // Update status
        this.isSkullCaptured = true;
        this.updateSkullVisibility();
        
        // Show capture message
        this.showMessage(`${playerName} has captured the skull!`);
    }
    
    // Method called when the skull mode is activated
    onModeActivated() {
        this.isSkullModeActive = true;
        this.isSkullCaptured = false;
        this.skullMesh.visible = true;
        this.countdown = this.SKULL_MODE_DURATION;
        
        // Generate random position for the skull
        this.generateRandomSkullPosition();
        
        // Apply visual effects with transition
        this.applySkullModeVisuals();
        
        // Show start message
        this.showMessage("CALAVERA MODE ACTIVATED! Capture the skull!");
        
        // Play skull mode music if exists audioManager
        if (this.game && this.game.audioManager) {
            // Play for 12 seconds (track duration)
            this.game.audioManager.playTemporaryMusic('calaveramode', 12000);
        }
    }

    // Method called when the skull mode is deactivated
    onModeDeactivated() {
        this.isSkullModeActive = false;
        this.skullMesh.visible = false;
        this.isSkullCaptured = false;
        this.countdown = this.NORMAL_MODE_DURATION;
        
        // Restore normal visuals with transition
        this.restoreNormalVisuals();
        
        // Show message
        this.showMessage("Normal mode restored");
    }

    // Generate a random position for the skull
    generateRandomSkullPosition() {
        if (!this.skullMesh) return;
        
        // Generate random position within a certain range of the map
        const mapRadius = 100; // Map radius to place the skull
        const randomAngle = Math.random() * Math.PI * 2;
        const randomRadius = Math.random() * mapRadius * 0.7; // 70% of the map radius
        
        // Calculate XZ position in circle
        const x = Math.cos(randomAngle) * randomRadius;
        const z = Math.sin(randomAngle) * randomRadius;
        
        // Set fixed height + small variation
        const y = this.skullHeight + Math.random() * 0.5;
        
        // Update position
        this.skullPosition.set(x, y, z);
        this.skullMesh.position.copy(this.skullPosition);
    }

    // Update skull animation
    updateSkullAnimation(deltaTime) {
        if (!this.skullMesh || !this.skullMesh.visible) return;
        
        // Increment animation time
        this.skullAnimationTime += deltaTime * this.skullFloatSpeed;
        
        // Calculate vertical movement (sinusoidal)
        const verticalOffset = Math.sin(this.skullAnimationTime) * this.skullFloatAmplitude;
        
        // Apply vertical movement
        this.skullMesh.position.y = this.skullPosition.y + verticalOffset;
        
        // Apply rotation
        this.skullMesh.rotation.y += deltaTime * this.skullRotationSpeed;
    }
    
    // Aplicar efectos visuales del modo calavera con transición
    applySkullModeVisuals(immediate = false) {
        if (immediate) {
            // Aplicación inmediata sin transición
            const scene = this.scene;
            
            // 1. Guardar el color de fondo original si no se ha guardado aún
            if (!this.originalBackgroundColor && scene.background) {
                this.originalBackgroundColor = scene.background.clone();
            }
            
            // 2. Oscurecer el escenario cambiando el color de fondo
            scene.background = this.skullBackgroundColor.clone();
            
            // 3. Añadir niebla sutil (ahora más densa)
            if (!this.fog) {
                this.fog = new THREE.FogExp2(this.skullFogColor, this.skullFogDensity);
                scene.fog = this.fog;
            }
            
            // 4. Aplicar tono rojizo con el filtro CSS
            if (this.skullModeColorFilter) {
                this.skullModeColorFilter.style.opacity = '1';
            }
            
            // 5. Cambiar la luz ambiental para darle un tono rojizo
            this.ambientLights.forEach(light => {
                light.color.copy(this.skullLightColor);
            });
        } else {
            // Iniciar transición suave
            this.isTransitioning = true;
            this.transitionProgress = 0;
            this.transitionDirection = 1; // Dirección: normal -> calavera
        }
    }
    
    // Restaurar visuales normales con transición
    restoreNormalVisuals(immediate = false) {
        if (immediate) {
            // Restauración inmediata sin transición
            const scene = this.scene;
            
            // 1. Restaurar color de fondo
            if (this.originalBackgroundColor) {
                scene.background = this.originalBackgroundColor.clone();
            }
            
            // 2. Quitar niebla
            scene.fog = null;
            
            // 3. Quitar filtro rojizo
            if (this.skullModeColorFilter) {
                this.skullModeColorFilter.style.opacity = '0';
            }
            
            // 4. Restaurar luz ambiental original
            if (this.originalLightColor) {
                this.ambientLights.forEach(light => {
                    light.color.copy(this.originalLightColor);
                });
            }
        } else {
            // Iniciar transición suave
            this.isTransitioning = true;
            this.transitionProgress = 0;
            this.transitionDirection = -1; // Dirección: calavera -> normal
        }
    }
} 