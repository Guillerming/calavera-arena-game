import * as THREE from 'three';

export class CameraController {
    constructor(camera) {
        this.camera = camera;
        this.target = null;
        this.offset = new THREE.Vector3(0, 2, 5); // La cámara estará 5 unidades detrás y 2 arriba
        this.smoothness = 0.1;
        
        // Parámetros de rotación
        this.rotationX = 0;
        this.rotationY = 0;
        this.sensitivity = 0.002;
        this.minPolarAngle = 0.1;
        this.maxPolarAngle = Math.PI / 2;
    }

    setTarget(target) {
        this.target = target;
    }

    update(deltaTime, inputManager) {
        if (!this.target || !inputManager) return;

        if (inputManager.isPointerLocked) {
            // Actualizar rotación basada en el movimiento del ratón
            this.rotationY -= inputManager.mouseDelta.x * this.sensitivity;
            this.rotationX += inputManager.mouseDelta.y * this.sensitivity;
            
            // Limitar rotación vertical
            this.rotationX = Math.max(this.minPolarAngle - Math.PI/2, 
                                    Math.min(this.maxPolarAngle - Math.PI/2, 
                                    this.rotationX));
            
            // El personaje siempre mira en la dirección de la cámara
            this.target.mesh.rotation.y = this.rotationY;
        }

        // Calcular posición de la cámara siempre detrás del personaje
        const targetPosition = new THREE.Vector3();
        targetPosition.copy(this.target.mesh.position);

        // Usar la rotación del personaje para posicionar la cámara
        const cameraOffset = new THREE.Vector3(0, this.offset.y, this.offset.z);
        cameraOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotationY);
        
        this.camera.position.copy(targetPosition).add(cameraOffset);
        this.camera.lookAt(targetPosition);

        inputManager.resetMouseDelta();
    }
} 