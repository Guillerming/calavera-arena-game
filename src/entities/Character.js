import * as THREE from 'three';
// import {Logger as GameLogger} from '../utils/Logger.js';

export class Character {
    constructor(team = 'blue', modelVariant = 0, terrain) {
        this.team = team;
        this.modelVariant = modelVariant;
        this.terrain = terrain;
        this.mesh = this.createTemporaryModel();
        
        // Parámetros de movimiento
        this.moveSpeed = 10;
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
        this.waterHeight = 0.3; // Más hundido en el agua
        this.inWater = false;
    }

    createTemporaryModel() {
        const boatGroup = new THREE.Group();

        // Base de la barca (forma de U invertida)
        const hullGeometry = new THREE.BoxGeometry(2, 0.5, 4);
        const hullMaterial = new THREE.MeshPhongMaterial({ color: 0x8B4513 }); // Marrón madera
        const hull = new THREE.Mesh(hullGeometry, hullMaterial);
        
        // Crear los lados de la barca
        const sideGeometry = new THREE.BoxGeometry(0.2, 0.7, 4);
        const leftSide = new THREE.Mesh(sideGeometry, hullMaterial);
        const rightSide = new THREE.Mesh(sideGeometry, hullMaterial);
        
        // Posicionar los lados
        leftSide.position.set(-0.9, 0.1, 0);
        rightSide.position.set(0.9, 0.1, 0);
        
        // Añadir todo al grupo
        boatGroup.add(hull);
        boatGroup.add(leftSide);
        boatGroup.add(rightSide);

        // Configurar sombras
        hull.castShadow = true;
        leftSide.castShadow = true;
        rightSide.castShadow = true;

        // Marcador de dirección (proa)
        const markerGeometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const markerMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
        const frontMarker = new THREE.Mesh(markerGeometry, markerMaterial);
        frontMarker.position.z = 2; // Colocar en la proa
        boatGroup.add(frontMarker);

        return boatGroup;
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
            // this.updateJump(deltaTime, inputManager);
        }
    }

    // En el método updateMovement de Character.js
    updateMovement(deltaTime, inputManager) {
        if (!this.terrain) return;

        // Obtener la posición actual
        const currentPosition = this.mesh.position.clone();
        
        // Calcular el movimiento deseado
        this.direction.set(0, 0, 0);
        if (inputManager.isKeyPressed('KeyW')) this.direction.z -= 1;
        // if (inputManager.isKeyPressed('KeyS')) this.direction.z += 1;
        // if (inputManager.isKeyPressed('KeyA')) this.direction.x -= 1;
        // if (inputManager.isKeyPressed('KeyD')) this.direction.x += 1;

        if (this.direction.length() > 0) {
            this.direction.normalize();
            
            // Aplicar rotación
            const rotationMatrix = new THREE.Matrix4();
            rotationMatrix.makeRotationY(this.mesh.rotation.y);
            this.direction.applyMatrix4(rotationMatrix);
            
            // Calcular nueva posición
            const newPosition = currentPosition.clone();
            newPosition.x += this.direction.x * this.moveSpeed * deltaTime;
            newPosition.z += this.direction.z * this.moveSpeed * deltaTime;
            
            // El barco siempre está a nivel del mar (y = 0)
            newPosition.y = 0;
            
            this.mesh.position.copy(newPosition);
        }
    }

    // En el método updateJump de Character.js
    updateJump(deltaTime, inputManager) {
        // Obtener la altura actual del terreno
        const terrainHeight = this.terrain ? this.terrain.getHeightAt(
            this.mesh.position.x, 
            this.mesh.position.z
        ) : 0;
        
        // Altura mínima a la que puede descender (terreno + mitad de la altura del personaje)
        const minHeight = terrainHeight + this.height / 2;
        
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
    
    // También modifica el método setPosition para que sea consistente:
    setPosition(x, z) {
        if (this.mesh) {
            this.mesh.position.set(x, 0, z); // Siempre y = 0
        }
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