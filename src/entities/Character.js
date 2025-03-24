import * as THREE from 'three';
import { SpeedIndicator } from '../utils/SpeedIndicator.js';

export class Character {
    constructor(team = 'blue', modelVariant = 0, terrain) {
        this.team = team;
        this.modelVariant = modelVariant;
        this.terrain = terrain;
        this.mesh = this.createTemporaryModel();
        
        // Parámetros de movimiento
        this.maxSpeed = 10;
        this.minSpeed = -2; // 1/5 de la velocidad máxima en reversa
        this.currentSpeed = this.maxSpeed;
        this.speedChangeRate = 5; // Velocidad de cambio de velocidad
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        
        // Crear el indicador de velocidad
        this.speedIndicator = new SpeedIndicator();
        
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
        
        // Parámetros de disparo
        this.cannonReady = true;
        this.cannonCooldown = 0.5; // Tiempo entre disparos en segundos
        this.cannonTimer = 0;
        this.projectiles = [];
        this.projectileSpeed = 50; // Velocidad de los proyectiles
        this.maxRange = 200; // Alcance máximo en unidades
        this.prevMouseDown = false; // Estado anterior del mouse para detectar cuando se suelta el botón
        
        // Crear grupo para los proyectiles
        this.projectilesGroup = new THREE.Group();
        this.mesh.add(this.projectilesGroup);
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
        
        // Añadir cañón en la proa (parte delantera)
        const cannonGeometry = new THREE.CylinderGeometry(0.15, 0.2, 0.8, 8);
        const cannonMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 }); // Color oscuro para el cañón
        const cannon = new THREE.Mesh(cannonGeometry, cannonMaterial);
        
        // Rotar y posicionar el cañón horizontalmente en la proa
        cannon.rotation.x = Math.PI / 2; // Rotar para que apunte hacia adelante
        cannon.position.set(0, 0.3, -1.8); // Colocar en la proa (valor z positivo para la parte delantera)
        
        // Base para el cañón
        const baseGeometry = new THREE.BoxGeometry(0.5, 0.1, 0.5);
        const base = new THREE.Mesh(baseGeometry, hullMaterial);
        base.position.set(0, 0.15, 1.8);
        
        // Añadir todo al grupo
        boatGroup.add(hull);
        boatGroup.add(leftSide);
        boatGroup.add(rightSide);
        boatGroup.add(base);
        boatGroup.add(cannon);

        // Guardar referencia al cañón
        this.cannon = cannon;

        // Configurar sombras
        hull.castShadow = true;
        leftSide.castShadow = true;
        rightSide.castShadow = true;
        cannon.castShadow = true;
        base.castShadow = true;

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

    update(deltaTime = 0.016, inputManager = null) {
        this.updateMovement(deltaTime, inputManager);
        // this.updateJump(deltaTime, inputManager);
        this.updateCannon(deltaTime, inputManager);
        this.updateProjectiles(deltaTime);
    }

    // En el método updateMovement de Character.js
    updateMovement(deltaTime = 0.016, inputManager = null) {
        if (!this.terrain) return;

        // Control de velocidad con W/S
        if (inputManager) {
            if (inputManager.isKeyPressed('KeyW')) {
                this.currentSpeed = Math.min(this.maxSpeed, this.currentSpeed + this.speedChangeRate * deltaTime);
            } else if (inputManager.isKeyPressed('KeyS')) {
                this.currentSpeed = Math.max(this.minSpeed, this.currentSpeed - this.speedChangeRate * deltaTime);
            }
        }

        // Actualizar el indicador de velocidad
        if (this.speedIndicator) {
            this.speedIndicator.update(this.currentSpeed, this.maxSpeed, this.minSpeed);
        }

        const currentPosition = this.mesh.position.clone();
        
        // Siempre moverse en la dirección actual
        this.direction.set(0, 0, -1);
        
        // Aplicar la rotación actual del barco
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeRotationY(this.mesh.rotation.y);
        this.direction.applyMatrix4(rotationMatrix);
        
        const newPosition = currentPosition.clone();
        newPosition.x += this.direction.x * this.currentSpeed * deltaTime;
        newPosition.z += this.direction.z * this.currentSpeed * deltaTime;

        // Comprobar colisiones en múltiples puntos alrededor del barco
        const boatWidth = 1.2;  // Mitad del ancho total (2.4 unidades)
        const boatLength = 2.2; // Mitad del largo total (4.4 unidades)
        
        // Crear puntos de colisión rotados según la orientación del barco
        const cosRotation = Math.cos(this.mesh.rotation.y);
        const sinRotation = Math.sin(this.mesh.rotation.y);
        
        const collisionPoints = [
            // Centro
            { x: newPosition.x, z: newPosition.z },
            // Proa y popa
            { 
                x: newPosition.x + (boatLength * sinRotation), 
                z: newPosition.z + (boatLength * cosRotation)
            },
            { 
                x: newPosition.x - (boatLength * sinRotation), 
                z: newPosition.z - (boatLength * cosRotation)
            },
            // Babor y estribor
            { 
                x: newPosition.x + (boatWidth * cosRotation), 
                z: newPosition.z - (boatWidth * sinRotation)
            },
            { 
                x: newPosition.x - (boatWidth * cosRotation), 
                z: newPosition.z + (boatWidth * sinRotation)
            },
            // Esquinas
            { 
                x: newPosition.x + (boatLength * sinRotation) + (boatWidth * cosRotation), 
                z: newPosition.z + (boatLength * cosRotation) - (boatWidth * sinRotation)
            },
            { 
                x: newPosition.x + (boatLength * sinRotation) - (boatWidth * cosRotation), 
                z: newPosition.z + (boatLength * cosRotation) + (boatWidth * sinRotation)
            },
            { 
                x: newPosition.x - (boatLength * sinRotation) + (boatWidth * cosRotation), 
                z: newPosition.z - (boatLength * cosRotation) - (boatWidth * sinRotation)
            },
            { 
                x: newPosition.x - (boatLength * sinRotation) - (boatWidth * cosRotation), 
                z: newPosition.z - (boatLength * cosRotation) + (boatWidth * sinRotation)
            }
        ];

        // Comprobar si algún punto colisiona con tierra
        const collision = collisionPoints.some(point => {
            const terrainHeight = this.terrain.getHeightAt(point.x, point.z);
            return terrainHeight > 0;
        });

        // Si no hay colisión, permitir el movimiento
        if (!collision) {
            newPosition.y = 0;
            this.mesh.position.copy(newPosition);
        }

        // Mantener siempre el barco a nivel del mar
        this.mesh.position.y = 0;
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

    updateCannon(deltaTime, inputManager) {
        // Actualizar el temporizador del cañón
        if (!this.cannonReady) {
            this.cannonTimer += deltaTime;
            if (this.cannonTimer >= this.cannonCooldown) {
                this.cannonReady = true;
                this.cannonTimer = 0;
            }
        }
        
        // Variable para almacenar si el botón del mouse está siendo presionado
        const mouseDown = inputManager ? inputManager.isMouseButtonPressed(0) : false;
        
        // Verificar si se debe disparar cuando se suelta el botón izquierdo
        if (inputManager && this.prevMouseDown && !mouseDown && this.cannonReady) {
            this.fireCannon();
            this.cannonReady = false;
        }
        
        // Actualizar el estado anterior del mouse
        this.prevMouseDown = mouseDown;
    }
    
    fireCannon() {
        // Crear el proyectil
        const projectileGeometry = new THREE.SphereGeometry(0.2, 8, 8);
        const projectileMaterial = new THREE.MeshPhongMaterial({ color: 0x111111 });
        const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
        
        // Posicionar el proyectil en la punta del cañón
        const cannonWorldPos = new THREE.Vector3();
        this.cannon.getWorldPosition(cannonWorldPos);
        
        // Calcular posición inicial del proyectil
        const direction = new THREE.Vector3(0, 0, -1);
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeRotationY(this.mesh.rotation.y);
        direction.applyMatrix4(rotationMatrix);
        
        const startPos = cannonWorldPos.clone().add(direction.clone().multiplyScalar(0.5));
        projectile.position.copy(startPos);
        
        // Añadir el proyectil a la escena global (no al barco)
        if (this.mesh.parent) {
            this.mesh.parent.add(projectile);
        }
        
        // Agregar a la lista de proyectiles con su dirección y tiempo de creación
        this.projectiles.push({
            mesh: projectile,
            direction: direction,
            creationTime: performance.now() / 1000,
            distance: 0
        });
        
        // Efectos visuales y sonoros aquí (opcional)
    }
    
    updateProjectiles(deltaTime) {
        // Mover los proyectiles
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.projectiles[i];
            
            // Actualizar la posición
            const movementVector = projectile.direction.clone().multiplyScalar(this.projectileSpeed * deltaTime);
            projectile.mesh.position.add(movementVector);
            
            // Actualizar la distancia recorrida
            projectile.distance += movementVector.length();
            
            // Verificar si ha alcanzado el rango máximo
            if (projectile.distance >= this.maxRange) {
                // Eliminar el proyectil
                if (projectile.mesh.parent) {
                    projectile.mesh.parent.remove(projectile.mesh);
                }
                this.projectiles.splice(i, 1);
            }
        }
    }
} 