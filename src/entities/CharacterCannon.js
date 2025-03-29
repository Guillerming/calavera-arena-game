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
            
            cameraDirection.y = Math.sin(this.character.cannonAngle);
            cameraDirection.normalize();
            
            const muzzlePosition = position.clone();
            this.character.createMuzzleFlash(muzzlePosition, cameraDirection);
            
            const projectileId = Math.random().toString(36).substring(7);
            this.character.projectilesManager.createProjectile(position, cameraDirection, projectileId);
        }
    }
} 