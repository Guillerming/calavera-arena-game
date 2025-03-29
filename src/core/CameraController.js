import * as THREE from 'three';

export class CameraController {
    constructor(camera) {
        this.camera = camera;
        this.target = null;
        this.offset = new THREE.Vector3(0, 5, 8); // La cámara estará 8 unidades detrás y 5 arriba
        this.smoothness = 0.1;
        
        // Parámetros de rotación de la cámara
        this.rotationX = 0;
        this.rotationY = 0;
        this.sensitivity = 0.002;
        this.minPolarAngle = -Math.PI / 7; // Aproximadamente -11.25 grados, justo por encima del horizonte
        this.maxPolarAngle = Math.PI / 2.5; // 72 grados hacia arriba
    }

    setTarget(target) {
        this.target = target;
    }

    update(deltaTime, inputManager) {
        if (!this.target) return;

        if (inputManager && inputManager.isPointerLocked) {
            // Actualizar rotación de la cámara basada en el movimiento del ratón
            this.rotationY -= inputManager.mouseDelta.x * this.sensitivity;
            this.rotationX = Math.max(
                this.minPolarAngle,
                Math.min(
                    this.maxPolarAngle,
                    this.rotationX + inputManager.mouseDelta.y * this.sensitivity
                )
            );
            
            // Reiniciar el delta del ratón
            inputManager.resetMouseDelta();
        }

        // Calcular posición de la cámara
        const targetPosition = this.target.position.clone();
        
        // Aplicar rotaciones para la posición de la cámara
        const cameraOffset = new THREE.Vector3(
            0,
            this.offset.y * Math.cos(this.rotationX),
            this.offset.z
        );
        
        // Rotar el offset horizontalmente
        cameraOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotationY);
        
        // Rotar el offset verticalmente
        const horizontalDist = Math.cos(this.rotationX) * this.offset.z;
        cameraOffset.z = Math.cos(this.rotationY) * horizontalDist;
        cameraOffset.x = Math.sin(this.rotationY) * horizontalDist;
        cameraOffset.y = Math.sin(this.rotationX) * this.offset.z + this.offset.y;
        
        // Aplicar la posición final de la cámara
        this.camera.position.copy(targetPosition).add(cameraOffset);
        this.camera.lookAt(targetPosition);
    }
} 