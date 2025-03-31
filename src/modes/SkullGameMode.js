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
        
        // Referencias a los jugadores
        this.characters = null;
        
        // Mensajes en pantalla
        this.messageElement = null;
        this.timerElement = null;
        this.createUI();
        
        console.log("Modo de juego Calavera inicializado");
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
        
        console.log("Modo de juego Calavera iniciado - esperando sincronización con el servidor");
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
        
        // Crear geometría (un plano simple)
        const geometry = new THREE.PlaneGeometry(2, 2);
        
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
    
    // Crear UI para mensajes y timer
    createUI() {
        // Crear contenedor de mensajes
        this.messageElement = document.createElement('div');
        this.messageElement.style.cssText = `
            position: fixed;
            top: 100px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            font-family: Arial, sans-serif;
            font-size: 18px;
            transition: opacity 0.3s;
            opacity: 0;
            pointer-events: none;
            z-index: 1000;
        `;
        document.body.appendChild(this.messageElement);
        
        // Crear timer
        this.timerElement = document.createElement('div');
        this.timerElement.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 5px 10px;
            border-radius: 5px;
            font-family: Arial, sans-serif;
            font-size: 16px;
            pointer-events: none;
            z-index: 1000;
        `;
        document.body.appendChild(this.timerElement);
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
            this.timerElement.style.background = 'rgba(255, 0, 0, 0.7)';
        } else {
            this.timerElement.textContent = `Próximo modo calavera: ${timeString}`;
            this.timerElement.style.background = 'rgba(0, 0, 0, 0.7)';
        }
        
        // Log detallado para depuración (solo cada segundo para no saturar la consola)
        if (Math.floor(this.lastLoggedTime || 0) !== Math.floor(this.countdown)) {
            console.log(`[SkullGameMode] Contador actual: ${this.countdown.toFixed(1)}s - Modo calavera activo: ${this.isSkullModeActive}`);
            this.lastLoggedTime = this.countdown;
        }
    }
    
    // Mostrar mensaje temporal
    showMessage(message, duration = 5000) {
        if (!this.messageElement) return;
        
        this.messageElement.textContent = message;
        this.messageElement.style.opacity = '1';
        
        // Ocultar después de duración
        clearTimeout(this.messageTimeout);
        this.messageTimeout = setTimeout(() => {
            this.messageElement.style.opacity = '0';
        }, duration);
    }
    
    // Limpiar recursos
    cleanup() {
        if (this.skullMesh && this.skullMesh.parent) {
            this.skullMesh.parent.remove(this.skullMesh);
        }
        
        if (this.messageElement && this.messageElement.parentNode) {
            this.messageElement.parentNode.removeChild(this.messageElement);
        }
        
        if (this.timerElement && this.timerElement.parentNode) {
            this.timerElement.parentNode.removeChild(this.timerElement);
        }
        
        clearTimeout(this.messageTimeout);
    }
    
    // Método para sincronizar con el servidor
    syncWithServer(data) {
        if (!data) return;
        
        console.log("[SkullGameMode] Recibiendo actualización del servidor:", data);
        
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
        // Buscar el jugador en la lista de caracteres
        const character = this.characters.get(playerId);
        const playerName = character ? character.name : playerId;
        
        // Actualizar estado
        this.isSkullCaptured = true;
        this.updateSkullVisibility();
        
        // Mostrar mensaje de captura
        this.showMessage(`¡${playerName} ha capturada la calavera!`);
        
        console.log(`[SkullGameMode] Calavera capturada por ${playerName}`);
        
        // Registrar la captura en el scoreManager si existe
        if (this.scoreManager) {
            this.scoreManager.registerSkull(playerId);
        }
    }
    
    // Manejar la activación del modo calavera
    onModeActivated() {
        this.isSkullModeActive = true;
        this.isSkullCaptured = false;
        this.skullMesh.visible = true;
        this.countdown = CONFIG.SKULL_MODE_DURATION;
        
        // Generar posición aleatoria para la calavera
        this.generateRandomSkullPosition();
        
        // Mostrar mensaje de inicio
        this.showMessage("¡MODO CALAVERA ACTIVADO! ¡Captura la calavera!");
        
        // Reproducir música de modo calavera si existe audioManager
        if (this.game && this.game.audioManager) {
            // Reproducir por 12 segundos (duración de la pista)
            this.game.audioManager.playTemporaryMusic('calaveramode', 12000);
        }
    }

    // Manejar la desactivación del modo calavera
    onModeDeactivated() {
        this.isSkullModeActive = false;
        this.skullMesh.visible = false;
        this.isSkullCaptured = false;
        this.countdown = CONFIG.NORMAL_MODE_DURATION;
    }
} 