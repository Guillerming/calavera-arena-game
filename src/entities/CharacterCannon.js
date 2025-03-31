import * as THREE from 'three';

export class CharacterCannon {
    constructor(character) {
        this.character = character;
    }

    updateCannon(deltaTime, inputManager) {
        if (!this.character.cannonReady) {
            this.character.cannonTimer += deltaTime * 1000;
            if (this.character.cannonTimer >= this.character.cannonCooldown) {
                this.character.cannonReady = true;
                this.character.cannonTimer = 0;
            }
        }
        
        const angleToCamera = this.getAngleToCameraDirection();
        
        // Actualizar el ángulo del cañón según la posición vertical del ratón si hay un controlador de cámara
        if (this.character.cameraController && this.character.isLocalPlayer) {
            // Usamos rotationX para calcular el ángulo del cañón
            this.updateCannonAngle(this.character.cameraController.rotationX);
        }
        
        this.character.updateCannonIndicators(angleToCamera);
        
        if (inputManager && inputManager.isMouseButtonPressed(0)) {
            if (this.character.cannonReady) {
                // Restricciones angulares para no poder disparar directamente al frente o atrás
                const frontRestrictedAngle = Math.PI / 4;  // 45 grados hacia adelante
                const backRestrictedAngle = Math.PI / 3;   // 60 grados hacia atrás
                
                // Verifica si el ángulo está en zona restringida frontal
                const isInFrontRestriction = Math.abs(angleToCamera) < frontRestrictedAngle / 2;
                
                // Verifica si el ángulo está en zona restringida trasera
                // Nos fijamos en qué tan cerca está el ángulo de PI (180 grados, que es hacia atrás)
                const isInBackRestriction = Math.abs(Math.abs(angleToCamera) - Math.PI) < backRestrictedAngle / 2;
                
                
                // Si no está en ninguna zona restringida, permitir el disparo
                if (!isInFrontRestriction && !isInBackRestriction) {
                    this.fireCannon();
                }
            }
        }

        if (this.character.cameraController) {
            this.character.currentCameraAngle = this.character.cameraController.rotationY;
        }
    }
    
    // Método para actualizar el ángulo del cañón basado en la posición vertical de la cámara
    updateCannonAngle(cameraVerticalAngle) {
        // Definir los valores límite del ángulo del cañón
        const maxCannonAngle = Math.PI / 25; // Ángulo más elevado (para disparo lejano)
        const minCannonAngle = Math.PI / 85; // Ángulo más plano (para disparo cercano)
        
        // Convertir los valores de ángulo de cámara en radianes
        const minCameraAngle = -26 * Math.PI / 180; // -25 grados (nivel del mar)
        const inflectionPoint = 5 * Math.PI / 180; // 0 grados (1/3 hacia el cenit)
        
        // Si el ángulo de la cámara está entre -25° y 0°
        if (cameraVerticalAngle >= minCameraAngle && cameraVerticalAngle <= inflectionPoint) {
            // Normalizar el ángulo en el rango [-25°, 0°]
            const normalizedAngle = (cameraVerticalAngle - minCameraAngle) / (inflectionPoint - minCameraAngle);
            
            // Interpolar el ángulo del cañón entre maxCannonAngle y minCannonAngle
            this.character.cannonAngle = maxCannonAngle - normalizedAngle * (maxCannonAngle - minCannonAngle);
        } 
        // Si el ángulo de la cámara es mayor que 0°
        else if (cameraVerticalAngle > inflectionPoint) {
            // Mantener el ángulo mínimo constante
            this.character.cannonAngle = minCannonAngle;
        }
        // Si el ángulo es menor que -25° (por debajo del nivel del mar)
        else {
            // Mantener el ángulo máximo constante
            this.character.cannonAngle = maxCannonAngle;
        }
    }
    
    getAngleToCameraDirection() {
        if (!this.character.cameraController) return 0;
        
        // Dirección del barco (siempre mira hacia Z negativo)
        const boatDirection = new THREE.Vector3(0, 0, -1);
        // Aplicar la rotación actual del barco
        const boatRotationMatrix = new THREE.Matrix4();
        boatRotationMatrix.makeRotationY(this.character.rotation.y);
        boatDirection.applyMatrix4(boatRotationMatrix);
        
        // Dirección de la cámara (también mira hacia Z negativo por defecto)
        const cameraDirection = new THREE.Vector3(0, 0, -1);
        // Aplicar la rotación de la cámara
        const cameraRotationMatrix = new THREE.Matrix4();
        cameraRotationMatrix.makeRotationY(this.character.cameraController.rotationY);
        cameraDirection.applyMatrix4(cameraRotationMatrix);
        
        // Calcular el ángulo entre ambas direcciones usando atan2
        // Esto nos da el ángulo en el plano XZ
        const angle = Math.atan2(
            boatDirection.x * cameraDirection.z - boatDirection.z * cameraDirection.x,
            boatDirection.x * cameraDirection.x + boatDirection.z * cameraDirection.z
        );
        
        // Debug
        
        return angle;
    }

    fireCannon() {
        if (!this.character.isAlive) {
            return;
        }
        
        if (this.character.cannonReady) {
            this.character.cannonReady = false;
            this.character.cannonTimer = 0;
            
            const position = new THREE.Vector3();
            this.character.getWorldPosition(position);
            position.y += this.character.projectileInitialHeight;
            
            const cameraDirection = new THREE.Vector3(0, 0, -1);
            if (this.character.cameraController) {
                const rotationMatrix = new THREE.Matrix4();
                rotationMatrix.makeRotationY(this.character.cameraController.rotationY);
                cameraDirection.applyMatrix4(rotationMatrix);
            } else {
                cameraDirection.applyQuaternion(this.character.quaternion);
            }
            
            const boatDirection = new THREE.Vector3(0, 0, -1);
            boatDirection.applyQuaternion(this.character.quaternion);
            
            const sideDirection = new THREE.Vector3(-boatDirection.z, 0, boatDirection.x);
            
            const angleToCamera = this.getAngleToCameraDirection();
            const sideOffset = (angleToCamera > 0) ? 1.0 : -1.0;
            
            position.add(sideDirection.multiplyScalar(sideOffset));
            
            // Usar el ángulo de cañón calculado
            cameraDirection.y = Math.sin(this.character.cannonAngle);
            cameraDirection.normalize();
            
            const muzzlePosition = position.clone();
            this.character.createMuzzleFlash(muzzlePosition, cameraDirection);
            
            // Reproducir sonido del cañón
            this.playCannonSound();
            
            // Crear proyectil en el cliente
            const projectileId = Math.random().toString(36).substring(2, 15);
            this.character.projectilesManager.createProjectile(position, cameraDirection, projectileId);
        }
    }
    
    // Reproducir sonido de disparo del cañón
    playCannonSound() {
        // Verificar si podemos usar el nuevo sistema de eventos de audio
        if (this.character.game && this.character.game.playAudioEvent) {
            // Reproducir el sonido del cañón (siempre)
            this.character.game.playAudioEvent('shoot', this.character.position);
            
            // Reproducir una frase de pirata (aleatoria)
            // Pequeño retraso para que no se superpongan exactamente
            setTimeout(() => {
                this.character.game.playAudioEvent('pirateShoot', this.character.position);
            }, 150);
        }
        // Métodos de compatibilidad con versiones anteriores
        else if (this.character.game && this.character.game.audioManager) {
            // Método legado
            this.character.game.audioManager.playSound('canon');
        }
        else if (this.character.scene && this.character.scene.game && this.character.scene.game.audioManager) {
            // Método legado (acceso a través de scene)
            this.character.scene.game.audioManager.playSound('canon');
        }
        else if (window.game && window.game.audioManager) {
            // Método legado (acceso global)
            window.game.audioManager.playSound('canon');
        }
    }
} 