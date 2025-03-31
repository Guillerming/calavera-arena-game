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
                }
            }
        }
        
        // If we are in skull mode and the skull hasn't been captured
        if (this.isSkullModeActive && !this.isSkullCaptured && this.skullMesh) {
            // Update skull orientation
            this.updateSkullOrientation();
            
            // Update skull animation
            this.updateSkullAnimation(deltaTime);
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
            this.timerElement.textContent = `SKULL MODE: ${timeString}`;
            this.skullModeContainer.classList.add('skull-mode-active');
        } else {
            this.timerElement.textContent = `Next skull mode: ${timeString}`;
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
                    this.showMessage("SKULL MODE ACTIVATED! Capture the skull!");
                } else {
                    this.showMessage("Normal mode restored");
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
            this.isSkullCaptured = data.data.isSkullCaptured;
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
    
    // Handle skull mode activation
    onModeActivated() {
        this.isSkullModeActive = true;
        this.isSkullCaptured = false;
        this.skullMesh.visible = true;
        this.countdown = this.SKULL_MODE_DURATION;
        
        // Generate random position for the skull
        this.generateRandomSkullPosition();
        
        // Show start message
        this.showMessage("SKULL MODE ACTIVATED! Capture the skull!");
        
        // Play skull mode music if exists audioManager
        if (this.game && this.game.audioManager) {
            // Play for 12 seconds (track duration)
            this.game.audioManager.playTemporaryMusic('calaveramode', 12000);
        }
    }

    // Handle skull mode deactivation
    onModeDeactivated() {
        this.isSkullModeActive = false;
        this.skullMesh.visible = false;
        this.isSkullCaptured = false;
        this.countdown = this.NORMAL_MODE_DURATION;
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

    // Method to animate the skull
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
} 