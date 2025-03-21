import * as THREE from 'three';
// import {Logger as GameLogger} from '../utils/Logger.js';

export class Character {
    constructor(team = 'blue', modelVariant = 0, terrain) {
        this.team = team;
        this.modelVariant = modelVariant;
        this.terrain = terrain;
        this.mesh = this.createTemporaryModel();
        
        // Parámetros de movimiento
        this.moveSpeed = 5;
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        
        // Parámetros de salto
        this.isJumping = false;
        this.jumpForce = 7;
        this.gravity = -30;
        
        // Estado del personaje
        this.health = 100;
        this.isAlive = true;

        // Añadir propiedades de colisión
        this.radius = 0.5;
        this.height = 2;
        this.collider = new THREE.CylinderGeometry(this.radius, this.radius, this.height, 8);
        
        // Si quieres visualizar el collider (opcional, para debugging)
        this.colliderMesh = new THREE.Mesh(
            this.collider,
            new THREE.MeshBasicMaterial({ 
                wireframe: true, 
                visible: false // Cambiar a true para ver los colliders
            })
        );
        this.mesh.add(this.colliderMesh);

        // Añadir estado de agua
        this.normalHeight = 1;
        this.waterHeight = 0.5; // Más hundido en el agua
        this.inWater = false;
    }

    createTemporaryModel() {
        // Crear el cuerpo principal
        const bodyGeometry = this.createBodyGeometry();
        const bodyMaterial = new THREE.MeshPhongMaterial({ 
            color: this.team === 'blue' ? 0x0000ff : 0xff0000 
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.castShadow = true;
        body.receiveShadow = true;

        // Crear indicador frontal (un triángulo más claro en la parte delantera)
        const frontMarkerGeometry = new THREE.ConeGeometry(0.2, 0.4, 3);
        const frontMarkerMaterial = new THREE.MeshPhongMaterial({ 
            color: this.team === 'blue' ? 0x4444ff : 0xff4444 
        });
        const frontMarker = new THREE.Mesh(frontMarkerGeometry, frontMarkerMaterial);
        frontMarker.position.set(0, 0.5, -0.5);
        frontMarker.rotation.x = Math.PI / 2;
        frontMarker.castShadow = true;
        frontMarker.receiveShadow = true;

        const modelGroup = new THREE.Group();
        modelGroup.add(body);
        modelGroup.add(frontMarker);
        
        // Ajustar posición inicial
        modelGroup.position.y = this.normalHeight;
        return modelGroup;
    }

    createBodyGeometry() {
        const geometries = [
            new THREE.CapsuleGeometry(0.5, 1, 4, 8),
            new THREE.BoxGeometry(1, 2, 1),
            new THREE.CylinderGeometry(0.5, 0.5, 2, 8),
            new THREE.SphereGeometry(0.7, 8, 8)
        ];
        return geometries[this.modelVariant % geometries.length];
    }

    update(deltaTime, inputManager) {
        if (inputManager) {
            this.updateMovement(deltaTime, inputManager);
            this.updateJump(deltaTime, inputManager);
        }
    }

    // En el método updateMovement de Character.js
    updateMovement(deltaTime, inputManager) {
        // Reiniciar la dirección
        this.direction.set(0, 0, 0);

        // Movimiento adelante/atrás
        if (inputManager.isKeyPressed('KeyW')) this.direction.z -= 1;
        if (inputManager.isKeyPressed('KeyS')) this.direction.z += 1;

        // Movimiento izquierda/derecha
        if (inputManager.isKeyPressed('KeyA')) this.direction.x -= 1;
        if (inputManager.isKeyPressed('KeyD')) this.direction.x += 1;

        // Normalizar la dirección para movimiento consistente en diagonales
        if (this.direction.length() > 0) {
            this.direction.normalize();
            
            // Crear matriz de rotación basada en la rotación del personaje
            const rotationMatrix = new THREE.Matrix4();
            rotationMatrix.makeRotationY(this.mesh.rotation.y);
            
            // Aplicar la rotación a la dirección del movimiento
            this.direction.applyMatrix4(rotationMatrix);
            
            // Calcular la nueva posición
            const newPosition = this.mesh.position.clone();
            newPosition.x += this.direction.x * this.moveSpeed * deltaTime;
            newPosition.z += this.direction.z * this.moveSpeed * deltaTime;

            // Verificar si la nueva posición está dentro de los límites
            if (this.terrain && this.terrain.isInBounds(newPosition)) {
                this.mesh.position.copy(newPosition);
                
                // Obtener la altura del terreno en la nueva posición
                if (this.terrain) {
                    const terrainHeight = this.terrain.getHeightAt(
                        this.mesh.position.x,
                        this.mesh.position.z
                    );
                    
                    // Ajustar la altura del personaje según el terreno
                    // Sumamos this.normalHeight para que los pies estén sobre el terreno
                    if (!this.isJumping) {
                        this.mesh.position.y = terrainHeight + this.normalHeight;
                    }
                    
                    // Detectar si estamos en agua (si la altura es menor que cierto umbral)
                    this.inWater = terrainHeight < 0.1; // Ajusta este valor según tu terreno
                }
            }
        }
    }

    // En el método updateJump de Character.js
    updateJump(deltaTime, inputManager) {
        // Obtener la altura actual del terreno
        const terrainHeight = this.terrain ? this.terrain.getHeightAt(
            this.mesh.position.x, 
            this.mesh.position.z
        ) : 0;
        
        // Altura mínima a la que puede descender (terreno + altura base)
        const minHeight = terrainHeight + this.normalHeight;
        
        // No permitir salto en el agua
        if (this.inWater) {
            this.velocity.y = 0;
            this.isJumping = false;
            return;
        }

        // Aplicar gravedad
        this.velocity.y += this.gravity * deltaTime;

        // Procesar salto
        if (inputManager.isKeyPressed('Space') && !this.isJumping) {
            this.velocity.y = this.jumpForce;
            this.isJumping = true;
        }

        // Actualizar posición vertical
        this.mesh.position.y += this.velocity.y * deltaTime;

        // Detectar colisión con el suelo (basado en la altura del terreno)
        if (this.mesh.position.y <= minHeight) {
            this.mesh.position.y = minHeight;
            this.velocity.y = 0;
            this.isJumping = false;
        }
    }

    setPosition(x, y, z) {
        this.mesh.position.set(x, y, z);
    }

    checkCollision(otherCharacter) {
        const dx = this.mesh.position.x - otherCharacter.mesh.position.x;
        const dz = this.mesh.position.z - otherCharacter.mesh.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        // Si hay colisión, empujar a los personajes en direcciones opuestas
        if (distance < this.radius + otherCharacter.radius) {
            const overlap = (this.radius + otherCharacter.radius) - distance;
            const pushDirection = new THREE.Vector3(dx, 0, dz).normalize();
            
            // Empujar a ambos personajes
            this.mesh.position.add(pushDirection.multiplyScalar(overlap * 0.5));
            otherCharacter.mesh.position.add(pushDirection.multiplyScalar(-overlap * 0.5));
            
            return true;
        }
        return false;
    }
} 