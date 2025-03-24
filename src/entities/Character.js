import * as THREE from 'three';
import { SpeedIndicator } from '../utils/SpeedIndicator.js';

export class Character {
    constructor(team = 'blue', modelVariant = 0, terrain) {
        this.team = team;
        this.modelVariant = modelVariant;
        this.terrain = terrain;
        
        // Parámetros de disparo (definir antes de crear el modelo)
        this.cannonReady = true;
        this.cannonCooldown = 0.6; // Tiempo entre disparos en segundos
        this.cannonCooldownTime = 0.6; // Duración del enfriamiento entre disparos
        this.cannonTimer = 0;
        this.projectiles = [];
        this.projectileSpeed = 60; // Aumentar velocidad para trayectoria más plana
        this.projectileGravity = 4.9; // Reducir gravedad para trayectoria más plana (mitad de la normal)
        this.projectileMaxRange = 80; // Alcance máximo en unidades (metros)
        this.cannonAngle = Math.PI / 30; // Reducir ángulo a 18 grados aprox. para trayectoria más plana
        this.projectileInitialHeight = 0.5; // Altura inicial del proyectil sobre el nivel del mar
        this.prevMouseDown = false; // Estado anterior del mouse para detectar cuando se suelta el botón
        
        // Crear el modelo después de definir los parámetros
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
        
        // Rotar y posicionar el cañón en la proa con elevación
        cannon.rotation.x = Math.PI / 2 - this.cannonAngle; // Rotación para el ángulo de elevación
        cannon.position.set(0, 0.3, -1.8); // Colocar en la proa (valor z negativo)
        
        // Base para el cañón
        const baseGeometry = new THREE.BoxGeometry(0.5, 0.1, 0.5);
        const base = new THREE.Mesh(baseGeometry, hullMaterial);
        base.position.set(0, 0.15, -1.8); // Alinear con el cañón
        
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
        frontMarker.position.z = -2; // Colocar en la proa (z negativo)
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
        // Crear la geometría y material para el proyectil
        const projectileGeometry = new THREE.SphereGeometry(0.3, 12, 12);
        
        // Material metálico para la bola de cañón
        const projectileMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x333333,
            metalness: 0.8,
            roughness: 0.3,
            emissive: 0x000000,
        });
        
        const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
        projectile.castShadow = true;
        projectile.receiveShadow = true;
        
        // Calcular la dirección hacia adelante del barco
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(this.mesh.quaternion);
        
        // Posición inicial del proyectil (en la boca del cañón)
        const initialPos = new THREE.Vector3();
        initialPos.copy(this.mesh.position);
        
        // Ajustar la posición inicial para que salga desde el cañón
        // Considerando la posición del cañón y su ángulo de elevación
        const cannonOffset = direction.clone().multiplyScalar(2.4); // Distancia desde el centro del barco a la boca del cañón
        initialPos.add(cannonOffset);
        initialPos.y += this.projectileInitialHeight; // Elevar desde el nivel del agua
        
        // Establecer la posición del proyectil
        projectile.position.copy(initialPos);
        
        // Calcular la velocidad inicial con componentes ajustados por el ángulo del cañón
        const initialVelocity = new THREE.Vector3();
        initialVelocity.x = direction.x * Math.cos(this.cannonAngle) * this.projectileSpeed;
        initialVelocity.y = Math.sin(this.cannonAngle) * this.projectileSpeed;
        initialVelocity.z = direction.z * Math.cos(this.cannonAngle) * this.projectileSpeed;
        
        // Generar velocidades de rotación aleatorias
        const rotationSpeed = {
            x: (Math.random() - 0.5) * 0.3,
            y: (Math.random() - 0.5) * 0.3,
            z: (Math.random() - 0.5) * 0.3
        };
        
        // Añadir el proyectil a la lista de proyectiles activos
        this.projectiles.push({
            mesh: projectile,
            velocity: initialVelocity,
            initialPosition: initialPos.clone(),
            launchTime: performance.now(),
            rotationSpeed: rotationSpeed
        });
        
        // Añadir el proyectil a la escena
        if (this.mesh.parent) {
            this.mesh.parent.add(projectile);
            
            // Crear efecto de fogonazo en la boca del cañón
            // Calcular posición exacta del fogonazo
            const flashPosition = new THREE.Vector3();
            flashPosition.copy(initialPos);
            
            // Crear el efecto
            this.createMuzzleFlash(flashPosition, direction);
        }
        
        // Reiniciar el temporizador de enfriamiento
        this.cannonCooldown = this.cannonCooldownTime;
    }
    
    // Crear efecto de disparo del cañón
    createMuzzleFlash(position, direction) {
        // Grupo para todo el efecto
        const flashGroup = new THREE.Group();
        
        // 1. Destello principal
        const flashGeometry = new THREE.SphereGeometry(0.2, 8, 8);
        const flashMaterial = new THREE.MeshBasicMaterial({
            color: 0xff7700,
            transparent: true,
            opacity: 1
        });
        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        flashGroup.add(flash);
        
        // 2. Humo
        const smokeCount = 12;
        const smokeParticles = [];
        
        for (let i = 0; i < smokeCount; i++) {
            const size = 0.1 + Math.random() * 0.2;
            const smokeGeometry = new THREE.SphereGeometry(size, 6, 6);
            const smokeMaterial = new THREE.MeshBasicMaterial({
                color: 0x888888,
                transparent: true,
                opacity: 0.7
            });
            const smoke = new THREE.Mesh(smokeGeometry, smokeMaterial);
            
            // Posición inicial cerca de la boca del cañón
            smoke.position.set(
                Math.random() * 0.1 - 0.05,
                Math.random() * 0.1 - 0.05,
                0.2
            );
            
            // Velocidad de la partícula
            const speed = 0.2 + Math.random() * 0.4;
            const angle = Math.random() * Math.PI * 2;
            const elevationAngle = Math.random() * Math.PI * 0.3;
            
            smokeParticles.push({
                mesh: smoke,
                velocity: new THREE.Vector3(
                    Math.cos(angle) * Math.sin(elevationAngle) * speed + direction.x * speed * 0.5,
                    Math.sin(angle) * Math.sin(elevationAngle) * speed + direction.y * speed * 0.5,
                    Math.cos(elevationAngle) * speed + direction.z * speed
                ),
                rotationSpeed: Math.random() * 0.05 - 0.025
            });
            
            flashGroup.add(smoke);
        }
        
        // 3. Chispas
        const sparkCount = 15;
        const sparkParticles = [];
        
        for (let i = 0; i < sparkCount; i++) {
            const sparkGeometry = new THREE.BoxGeometry(0.03, 0.03, 0.03);
            const sparkMaterial = new THREE.MeshBasicMaterial({
                color: 0xff9900,
                transparent: true,
                opacity: 1
            });
            const spark = new THREE.Mesh(sparkGeometry, sparkMaterial);
            
            // Posición inicial en la boca del cañón
            spark.position.set(0, 0, 0.2);
            
            // Velocidad de la chispa (más rápida y direccional que el humo)
            const speed = 0.8 + Math.random() * 1.2;
            const angle = Math.random() * Math.PI * 2;
            const elevationAngle = Math.random() * Math.PI * 0.2;
            
            sparkParticles.push({
                mesh: spark,
                velocity: new THREE.Vector3(
                    Math.cos(angle) * Math.sin(elevationAngle) * speed + direction.x * speed * 0.8,
                    Math.sin(angle) * Math.sin(elevationAngle) * speed + direction.y * speed * 0.8,
                    Math.cos(elevationAngle) * speed + direction.z * speed * 0.8
                ),
                rotationSpeed: Math.random() * 0.2 - 0.1,
                lifespan: 400 + Math.random() * 300 // ms
            });
            
            flashGroup.add(spark);
        }
        
        // Posicionar el grupo
        flashGroup.position.copy(position);
        
        // Añadir a la escena
        if (this.mesh.parent) {
            this.mesh.parent.add(flashGroup);
            
            // Variables para animar
            const initialTime = performance.now();
            const flashDuration = 1500; // Duración total ms
            
            // Función para animar el destello y partículas
            const animateFlash = () => {
                const now = performance.now();
                const elapsed = now - initialTime;
                const progress = Math.min(elapsed / flashDuration, 1);
                
                // Animar destello principal
                if (progress < 0.2) {
                    // Crecer y luego desaparecer rápidamente
                    const flashScale = progress < 0.1 ? progress * 10 : 1 - (progress - 0.1) / 0.1;
                    flash.scale.set(flashScale, flashScale, flashScale);
                    flash.material.opacity = 1 - progress * 5;
                } else {
                    flash.visible = false;
                }
                
                // Animar humo
                for (const particle of smokeParticles) {
                    // Mover según velocidad
                    particle.mesh.position.x += particle.velocity.x;
                    particle.mesh.position.y += particle.velocity.y;
                    particle.mesh.position.z += particle.velocity.z;
                    
                    // Rotar
                    particle.mesh.rotation.x += particle.rotationSpeed;
                    particle.mesh.rotation.y += particle.rotationSpeed;
                    
                    // Ralentizar
                    particle.velocity.multiplyScalar(0.96);
                    
                    // Desvanecer gradualmente
                    particle.mesh.material.opacity = 0.7 * (1 - progress);
                    
                    // Expandir gradualmente
                    const scale = 1 + progress * 2;
                    particle.mesh.scale.set(scale, scale, scale);
                }
                
                // Animar chispas
                for (const spark of sparkParticles) {
                    // La chispa solo es visible durante su tiempo de vida
                    const sparkElapsed = elapsed;
                    const sparkProgress = Math.min(sparkElapsed / spark.lifespan, 1);
                    
                    if (sparkProgress < 1) {
                        // Mover según velocidad
                        spark.mesh.position.x += spark.velocity.x;
                        spark.mesh.position.y += spark.velocity.y;
                        spark.mesh.position.z += spark.velocity.z;
                        
                        // Aplicar gravedad leve
                        spark.velocity.y -= 0.01;
                        
                        // Rotar
                        spark.mesh.rotation.x += spark.rotationSpeed;
                        spark.mesh.rotation.y += spark.rotationSpeed;
                        
                        // Desvanecer al final de su vida
                        if (sparkProgress > 0.7) {
                            spark.mesh.material.opacity = 1 - (sparkProgress - 0.7) / 0.3;
                        }
                    } else {
                        spark.mesh.visible = false;
                    }
                }
                
                // Continuar animación o finalizar
                if (progress < 1) {
                    requestAnimationFrame(animateFlash);
                } else {
                    if (flashGroup.parent) {
                        flashGroup.parent.remove(flashGroup);
                    }
                }
            };
            
            // Iniciar animación
            animateFlash();
        }
    }
    
    // Actualizar los proyectiles en movimiento
    updateProjectiles(deltaTime) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.projectiles[i];
            
            // Calcular el tiempo transcurrido desde el lanzamiento en segundos
            const timeElapsed = (performance.now() - projectile.launchTime) / 1000;
            
            // Calcular la nueva posición usando ecuación de movimiento parabólico
            const newPosition = new THREE.Vector3();
            newPosition.x = projectile.initialPosition.x + projectile.velocity.x * timeElapsed;
            newPosition.z = projectile.initialPosition.z + projectile.velocity.z * timeElapsed;
            
            // El componente Y considera la gravedad: y = y₀ + v₀·t - ½·g·t²
            newPosition.y = projectile.initialPosition.y + 
                            projectile.velocity.y * timeElapsed - 
                            0.5 * this.projectileGravity * timeElapsed * timeElapsed;
            
            // Actualizar la posición del proyectil
            projectile.mesh.position.copy(newPosition);
            
            // Aplicar rotación al proyectil para que gire mientras vuela
            projectile.mesh.rotation.x += projectile.rotationSpeed.x * deltaTime;
            projectile.mesh.rotation.y += projectile.rotationSpeed.y * deltaTime;
            projectile.mesh.rotation.z += projectile.rotationSpeed.z * deltaTime;
            
            // Calcular la distancia horizontal recorrida
            const dx = newPosition.x - projectile.initialPosition.x;
            const dz = newPosition.z - projectile.initialPosition.z;
            const distanceTraveled = Math.sqrt(dx * dx + dz * dz);
            
            // Verificar si el proyectil ha excedido el alcance máximo o ha caído al agua
            if (distanceTraveled > this.projectileMaxRange || newPosition.y < 0) {
                // Eliminar el proyectil de la escena
                if (projectile.mesh.parent) {
                    projectile.mesh.parent.remove(projectile.mesh);
                }
                
                // Crear efecto de splash si cae en el agua
                if (newPosition.y < 0) {
                    this.createSplashEffect(newPosition);
                }
                
                // Eliminar el proyectil de la lista
                this.projectiles.splice(i, 1);
            }
        }
    }
    
    // Crear efecto de splash cuando el proyectil impacta en el agua
    createSplashEffect(position) {
        // Crear grupo para el efecto completo
        const splashGroup = new THREE.Group();
        
        // 1. Cono para el splash principal
        const splashGeometry = new THREE.CylinderGeometry(0, 1.5, 2, 12);
        const splashMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x77aaff,
            transparent: true,
            opacity: 0.7
        });
        const splash = new THREE.Mesh(splashGeometry, splashMaterial);
        splash.position.y = 1; // Elevarlo para que surja del agua
        splashGroup.add(splash);
        
        // 2. Disco para la onda circular
        const ringGeometry = new THREE.RingGeometry(0.5, 0.8, 16);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = Math.PI / 2; // Colocar horizontal
        ring.position.y = 0.05; // Justo sobre el nivel del agua
        splashGroup.add(ring);
        
        // 3. Partículas/gotas
        const dropCount = 8;
        const drops = [];
        
        for (let i = 0; i < dropCount; i++) {
            const dropGeometry = new THREE.SphereGeometry(0.1, 6, 6);
            const dropMaterial = new THREE.MeshBasicMaterial({
                color: 0x77aaff,
                transparent: true,
                opacity: 0.7
            });
            const drop = new THREE.Mesh(dropGeometry, dropMaterial);
            
            // Posición inicial aleatoria alrededor del punto de impacto
            const angle = (i / dropCount) * Math.PI * 2;
            const radius = 0.3 + Math.random() * 0.2;
            drop.position.x = Math.cos(angle) * radius;
            drop.position.z = Math.sin(angle) * radius;
            drop.position.y = 0.5 + Math.random() * 0.5;
            
            // Velocidad inicial para simular la trayectoria parabólica
            drops.push({
                mesh: drop,
                velocity: new THREE.Vector3(
                    Math.cos(angle) * (0.5 + Math.random() * 0.5),
                    1 + Math.random() * 0.5,
                    Math.sin(angle) * (0.5 + Math.random() * 0.5)
                ),
                gravity: 5 + Math.random() * 2
            });
            
            splashGroup.add(drop);
        }
        
        // Posicionar el splash en el punto de impacto (a nivel del agua)
        splashGroup.position.copy(position);
        splashGroup.position.y = 0; // A nivel del agua
        
        // Añadir a la escena
        if (this.mesh.parent) {
            this.mesh.parent.add(splashGroup);
            
            // Variables para animar el splash
            const initialTime = performance.now();
            const duration = 1200; // duración de la animación en ms
            
            // Función para animar el splash
            const animateSplash = () => {
                const now = performance.now();
                const elapsed = now - initialTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Animar splash principal
                const splashScale = progress < 0.4 ? progress * 2.5 : 1 - (progress - 0.4) / 0.6;
                splash.scale.set(splashScale, splashScale * (1 - progress * 0.5), splashScale);
                splash.material.opacity = 0.7 * (1 - progress);
                
                // Animar el anillo/onda
                ring.scale.set(1 + progress * 5, 1 + progress * 5, 1);
                ring.material.opacity = 0.5 * (1 - progress);
                
                // Animar las gotas
                const deltaT = 1/60; // Simular 60fps
                for (const drop of drops) {
                    // Física simple para las gotas
                    drop.velocity.y -= drop.gravity * deltaT;
                    drop.mesh.position.x += drop.velocity.x * deltaT;
                    drop.mesh.position.y += drop.velocity.y * deltaT;
                    drop.mesh.position.z += drop.velocity.z * deltaT;
                    
                    // Rebote en el agua
                    if (drop.mesh.position.y < 0.05) {
                        drop.mesh.position.y = 0.05;
                        drop.velocity.y = -drop.velocity.y * 0.3; // Rebote con pérdida de energía
                    }
                    
                    // Desvanecer las gotas
                    drop.mesh.material.opacity = 0.7 * (1 - progress);
                }
                
                // Continuar la animación o finalizar
                if (progress < 1) {
                    requestAnimationFrame(animateSplash);
                } else {
                    if (splashGroup.parent) {
                        splashGroup.parent.remove(splashGroup);
                    }
                }
            };
            
            // Iniciar la animación
            animateSplash();
        }
    }
} 