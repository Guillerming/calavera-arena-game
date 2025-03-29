import * as THREE from 'three';
import { SpeedIndicator } from '../utils/SpeedIndicator.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class Character extends THREE.Object3D {
    constructor(scene) {
        super();
        this.scene = scene;
        this.terrain = scene.terrain; // Guardamos referencia directa al terreno

        // Configuración de movimiento y límites
        this.currentSpeed = 0;
        this.maxSpeed = 20;
        this.minSpeed = -5; // Velocidad máxima en reversa
        this.speedChangeRate = 20; // Velocidad de cambio al pulsar W/S
        this.rotationSpeed = 0.03;
        
        // Configuración de basculación del barco
        this.currentRoll = 0;
        this.targetRoll = 0;
        this.maxRoll = Math.PI / 12; // 15 grados de basculación máxima
        this.rollSpeed = 3; // Velocidad de transición de la basculación
        
        // Configuración de disparo
        this.cannonReady = true;
        this.cannonCooldown = 1000; // 1 segundo entre disparos
        this.cannonTimer = 0;
        this.projectileSpeed = 60;
        this.projectileGravity = 4.9;
        this.maxRange = 200;
        this.cannonAngle = Math.PI / 35; // ~18 grados
        this.projectileInitialHeight = 0.5; // Altura inicial del proyectil
        this.prevMouseDown = false;
        
        // Límites del mapa
        this.mapLimits = {
            minX: -195,
            maxX: 195,
            minZ: -195,
            maxZ: 195
        };
        
        // Array para almacenar proyectiles
        this.projectiles = [];

        // Crear el indicador de velocidad
        this.speedIndicator = new SpeedIndicator();
        
        // Parámetros de salto
        this.isJumping = false;
        this.jumpForce = 7;
        this.gravity = -30;
        
        // Estado del personaje
        this.health = 100;
        this.isAlive = true;

        // Crear grupo para los proyectiles
        this.projectilesGroup = new THREE.Group();
        this.add(this.projectilesGroup);

        // Añadir propiedades de colisión
        this.radius = 0.5;
        this.height = 2;
        
        // Añadir estado de agua
        this.normalHeight = 1;
        this.waterHeight = 0.3;
        this.inWater = false;

        // Cargador de modelos GLTF/GLB
        const loader = new GLTFLoader();
        
        // Cargar el nuevo modelo del barco
        loader.load('assets/models/lowpolyboat.glb', (gltf) => {
            this.boat = gltf.scene;
            
            // Ajustar escala y rotación inicial del barco
            this.boat.scale.set(0.6, 0.6, 0.6);
            this.boat.rotation.y = Math.PI;
            this.boat.position.y = -0.8;
            
            // Añadir el barco a la escena
            this.add(this.boat);
            
            // Crear el collider después de cargar el barco
            this.colliderMesh = new THREE.Mesh(
                new THREE.CylinderGeometry(this.radius, this.radius, this.height, 8),
                new THREE.MeshBasicMaterial({ 
                    wireframe: true, 
                    visible: false
                })
            );
            this.colliderMesh.position.y = 0.8;
            this.boat.add(this.colliderMesh);

            // Añadir el barco a la escena del juego
            if (this.scene) {
                this.scene.add(this);
            }
        });
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

            // Control de rotación con A/D
            // Para un giro de 360º en 15s, necesitamos 2π/15 radianes por segundo
            const rotationRate = (2 * Math.PI) / 15;
            
            // Resetear el targetRoll si no se está girando
            if (!inputManager.isKeyPressed('KeyA') && !inputManager.isKeyPressed('KeyD')) {
                this.targetRoll = 0;
            }
            
            if (inputManager.isKeyPressed('KeyA')) {
                // Rotar a la izquierda
                this.rotation.y += rotationRate * deltaTime;
                if (this.boat) {
                    this.boat.rotation.y = Math.PI; // Mantener la rotación base del modelo
                    this.targetRoll = this.maxRoll; // Bascular hacia la derecha
                }
            }
            if (inputManager.isKeyPressed('KeyD')) {
                // Rotar a la derecha
                this.rotation.y -= rotationRate * deltaTime;
                if (this.boat) {
                    this.boat.rotation.y = Math.PI; // Mantener la rotación base del modelo
                    this.targetRoll = -this.maxRoll; // Bascular hacia la izquierda
                }
            }
            
            // Actualizar la basculación suavemente
            if (this.boat) {
                const rollDiff = this.targetRoll - this.currentRoll;
                this.currentRoll += rollDiff * this.rollSpeed * deltaTime;
                this.boat.rotation.z = this.currentRoll;
            }
        }

        // Actualizar el indicador de velocidad
        if (this.speedIndicator) {
            this.speedIndicator.update(this.currentSpeed, this.maxSpeed, this.minSpeed);
        }

        // Calcular la dirección de movimiento basada en la rotación actual del barco
        const direction = new THREE.Vector3(0, 0, -1);
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeRotationY(this.rotation.y);
        direction.applyMatrix4(rotationMatrix);
        
        // Calcular la nueva posición
        const newPosition = this.position.clone();
        newPosition.x += direction.x * this.currentSpeed * deltaTime;
        newPosition.z += direction.z * this.currentSpeed * deltaTime;

        // Verificar límites y colisiones
        const isWithinBounds = 
            newPosition.x >= this.mapLimits.minX &&
            newPosition.x <= this.mapLimits.maxX &&
            newPosition.z >= this.mapLimits.minZ &&
            newPosition.z <= this.mapLimits.maxZ;
        
        // Crear puntos de colisión
        const cosRotation = Math.cos(this.rotation.y);
        const sinRotation = Math.sin(this.rotation.y);
        
        const collisionPoints = [
            newPosition.clone(), // Centro
            new THREE.Vector3( // Proa
                newPosition.x + sinRotation * 2,
                newPosition.y,
                newPosition.z + cosRotation * 2
            ),
            new THREE.Vector3( // Popa
                newPosition.x - sinRotation * 2,
                newPosition.y,
                newPosition.z - cosRotation * 2
            ),
            new THREE.Vector3( // Babor
                newPosition.x - cosRotation,
                newPosition.y,
                newPosition.z + sinRotation
            ),
            new THREE.Vector3( // Estribor
                newPosition.x + cosRotation,
                newPosition.y,
                newPosition.z - sinRotation
            )
        ];
        
        // Comprobar colisiones
        const collision = collisionPoints.some(point => {
            const terrainHeight = this.terrain.getHeightAt(point.x, point.z);
            return terrainHeight > 0;
        });

        if (!collision && isWithinBounds) {
            this.position.copy(newPosition);
        } else {
            this.currentSpeed = 0;
        }
    }

    // En el método updateJump de Character.js
    updateJump(deltaTime, inputManager) {
        // Obtener la altura actual del terreno
        const terrainHeight = this.scene.terrain ? this.scene.terrain.getHeightAt(
            this.boat.position.x, 
            this.boat.position.z
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
        this.boat.position.y += this.velocity.y * deltaTime;
    
        // Detectar colisión con el suelo (basado en la altura del terreno)
        if (this.boat.position.y <= minHeight) {
            this.boat.position.y = minHeight;
            this.velocity.y = 0;
            this.isJumping = false;
        }
    }
    
    // También modifica el método setPosition para que sea consistente:
    setPosition(x, z) {
        if (this.boat) {
            this.boat.position.set(x, 0, z); // Siempre y = 0
        }
    }

    checkCollision(otherCharacter) {
        const dx = this.boat.position.x - otherCharacter.boat.position.x;
        const dz = this.boat.position.z - otherCharacter.boat.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        // Si hay colisión, empujar a los personajes en direcciones opuestas
        if (distance < this.radius + otherCharacter.radius) {
            const overlap = (this.radius + otherCharacter.radius) - distance;
            const pushDirection = new THREE.Vector3(dx, 0, dz).normalize();
            
            // Empujar a ambos personajes
            this.boat.position.add(pushDirection.multiplyScalar(overlap * 0.5));
            otherCharacter.boat.position.add(pushDirection.multiplyScalar(-overlap * 0.5));
            
            return true;
        }
        return false;
    }

    updateCannon(deltaTime, inputManager) {
        // Actualizar el temporizador del cañón
        if (!this.cannonReady) {
            this.cannonTimer += deltaTime * 1000; // Convertir deltaTime a milisegundos
            if (this.cannonTimer >= this.cannonCooldown) {
                this.cannonReady = true;
                this.cannonTimer = 0;
            }
        }
        
        // Verificar si se debe disparar cuando se hace click
        if (inputManager && inputManager.isMouseButtonPressed(0) && this.cannonReady) {
            this.fireCannon();
            this.cannonReady = false;
            this.cannonTimer = 0;
        }
    }
    
    fireCannon() {
        // Crear la geometría y material para el proyectil
        const projectileGeometry = new THREE.SphereGeometry(0.3, 12, 12);
        const projectileMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x333333,
            metalness: 0.8,
            roughness: 0.3,
            emissive: 0x000000,
        });
        
        const projectile = new THREE.Mesh(projectileGeometry, projectileMaterial);
        projectile.castShadow = true;
        projectile.receiveShadow = true;
        
        // Calcular la dirección hacia adelante del barco usando la rotación del Character
        const direction = new THREE.Vector3(0, 0, -1);
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeRotationY(this.rotation.y);
        direction.applyMatrix4(rotationMatrix);
        
        // Posición inicial del proyectil
        const initialPos = new THREE.Vector3();
        initialPos.copy(this.position);
        
        // Ajustar la posición inicial para que salga desde el frente del barco
        const cannonOffset = direction.clone().multiplyScalar(2.4);
        initialPos.add(cannonOffset);
        initialPos.y = this.projectileInitialHeight;
        
        // Establecer la posición del proyectil
        projectile.position.copy(initialPos);
        
        // Calcular la velocidad inicial con componentes ajustados por el ángulo del cañón
        const initialVelocity = new THREE.Vector3();
        initialVelocity.x = direction.x * Math.cos(this.cannonAngle) * this.projectileSpeed;
        initialVelocity.y = Math.sin(this.cannonAngle) * this.projectileSpeed;
        initialVelocity.z = direction.z * Math.cos(this.cannonAngle) * this.projectileSpeed;
        
        // Añadir el proyectil a la lista de proyectiles activos
        this.projectiles.push({
            mesh: projectile,
            velocity: initialVelocity,
            initialPosition: initialPos.clone(),
            launchTime: performance.now(),
            rotationSpeed: {
                x: (Math.random() - 0.5) * 0.3,
                y: (Math.random() - 0.5) * 0.3,
                z: (Math.random() - 0.5) * 0.3
            }
        });
        
        // Añadir el proyectil a la escena
        if (this.scene) {
            this.scene.add(projectile);
            this.createMuzzleFlash(initialPos, direction);
        }
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
        if (this.boat.parent) {
            this.boat.parent.add(flashGroup);
            
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
            newPosition.y = projectile.initialPosition.y + 
                          projectile.velocity.y * timeElapsed - 
                          0.5 * this.projectileGravity * timeElapsed * timeElapsed;
            
            // Actualizar la posición del proyectil
            projectile.mesh.position.copy(newPosition);
            
            // Obtener la altura del terreno en la nueva posición
            const terrainHeight = this.terrain ? this.terrain.getHeightAt(newPosition.x, newPosition.z) : 0;
            
            // Verificar colisiones
            if (newPosition.y <= 0) {
                const splashPosition = new THREE.Vector3(
                    newPosition.x,
                    0, // El splash siempre debe estar a nivel del agua
                    newPosition.z
                );
                this.createSplashEffect(splashPosition);
                
                // Eliminar el proyectil
                if (projectile.mesh.parent) {
                    projectile.mesh.parent.remove(projectile.mesh);
                }
                this.projectiles.splice(i, 1);
            } else if (newPosition.y <= terrainHeight) {
                const explosionPosition = new THREE.Vector3(
                    newPosition.x,
                    terrainHeight, // La explosión debe estar en la superficie del terreno
                    newPosition.z
                );
                this.createExplosionEffect(explosionPosition);
                
                // Eliminar el proyectil
                if (projectile.mesh.parent) {
                    projectile.mesh.parent.remove(projectile.mesh);
                }
                this.projectiles.splice(i, 1);
            }
            
            // Aplicar rotación al proyectil
            projectile.mesh.rotation.x += projectile.rotationSpeed.x * deltaTime;
            projectile.mesh.rotation.y += projectile.rotationSpeed.y * deltaTime;
            projectile.mesh.rotation.z += projectile.rotationSpeed.z * deltaTime;
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
        if (this.scene) {
            this.scene.add(splashGroup);
            
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
    
    // Crear efecto de explosión cuando el proyectil impacta en tierra
    createExplosionEffect(position) {
        // Crear grupo para el efecto completo
        const explosionGroup = new THREE.Group();
        
        // 1. Destello de explosión
        const flashGeometry = new THREE.SphereGeometry(0.6, 12, 12);
        const flashMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xff6600,
            transparent: true,
            opacity: 1
        });
        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        explosionGroup.add(flash);
        
        // 2. Partículas de tierra/escombros
        const debrisCount = 20;
        const debrisParticles = [];
        
        for (let i = 0; i < debrisCount; i++) {
            const debrisSize = 0.05 + Math.random() * 0.15;
            const debrisGeometry = new THREE.BoxGeometry(debrisSize, debrisSize, debrisSize);
            const debrisMaterial = new THREE.MeshBasicMaterial({
                color: 0x8B4513, // Marrón para tierra
                transparent: true,
                opacity: 0.9
            });
            const debris = new THREE.Mesh(debrisGeometry, debrisMaterial);
            
            // Posición inicial en el centro de la explosión
            debris.position.set(0, 0, 0);
            
            // Velocidad inicial para simular proyección en todas direcciones
            const speed = 0.5 + Math.random() * 1;
            const angle = Math.random() * Math.PI * 2;
            const elevationAngle = Math.random() * Math.PI;
            
            debrisParticles.push({
                mesh: debris,
                velocity: new THREE.Vector3(
                    Math.cos(angle) * Math.sin(elevationAngle) * speed,
                    Math.cos(elevationAngle) * speed,
                    Math.sin(angle) * Math.sin(elevationAngle) * speed
                ),
                rotationSpeed: {
                    x: (Math.random() - 0.5) * 0.2,
                    y: (Math.random() - 0.5) * 0.2,
                    z: (Math.random() - 0.5) * 0.2
                },
                gravity: 9.8
            });
            
            explosionGroup.add(debris);
        }
        
        // 3. Humo de la explosión
        const smokeCount = 8;
        const smokeParticles = [];
        
        for (let i = 0; i < smokeCount; i++) {
            const size = 0.3 + Math.random() * 0.4;
            const smokeGeometry = new THREE.SphereGeometry(size, 8, 8);
            const smokeMaterial = new THREE.MeshBasicMaterial({
                color: 0x666666,
                transparent: true,
                opacity: 0.7
            });
            const smoke = new THREE.Mesh(smokeGeometry, smokeMaterial);
            
            // Posición inicial con ligero offset
            smoke.position.set(
                (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * 0.2 + 0.3,
                (Math.random() - 0.5) * 0.2
            );
            
            // Velocidad del humo (más lenta y ascendente)
            const speed = 0.1 + Math.random() * 0.2;
            const angle = Math.random() * Math.PI * 2;
            
            smokeParticles.push({
                mesh: smoke,
                velocity: new THREE.Vector3(
                    Math.cos(angle) * speed * 0.5,
                    speed,
                    Math.sin(angle) * speed * 0.5
                ),
                rotationSpeed: (Math.random() - 0.5) * 0.02,
                scale: 1 + Math.random() * 0.5
            });
            
            explosionGroup.add(smoke);
        }
        
        // Posicionar el grupo en el punto de impacto
        explosionGroup.position.copy(position);
        
        // Añadir a la escena
        if (this.scene) {
            this.scene.add(explosionGroup);
            
            // Variables para animar
            const initialTime = performance.now();
            const duration = 1500; // ms
            
            // Función para animar la explosión
            const animateExplosion = () => {
                const now = performance.now();
                const elapsed = now - initialTime;
                const progress = Math.min(elapsed / duration, 1);
                
                // Animar destello principal
                if (progress < 0.2) {
                    // Crecer y luego desaparecer rápidamente
                    const flashScale = progress < 0.1 ? progress * 10 : 1 - (progress - 0.1) / 0.1;
                    flash.scale.set(flashScale, flashScale, flashScale);
                    flash.material.opacity = 1 - progress * 5;
                } else {
                    flash.visible = false;
                }
                
                // Animar partículas de escombros
                const deltaT = 1/60; // Simular 60fps
                for (const particle of debrisParticles) {
                    // Aplicar gravedad
                    particle.velocity.y -= particle.gravity * deltaT;
                    
                    // Mover partícula
                    particle.mesh.position.x += particle.velocity.x * deltaT;
                    particle.mesh.position.y += particle.velocity.y * deltaT;
                    particle.mesh.position.z += particle.velocity.z * deltaT;
                    
                    // Rotar
                    particle.mesh.rotation.x += particle.rotationSpeed.x;
                    particle.mesh.rotation.y += particle.rotationSpeed.y;
                    particle.mesh.rotation.z += particle.rotationSpeed.z;
                    
                    // Detener en el suelo
                    if (particle.mesh.position.y < 0) {
                        particle.mesh.position.y = 0;
                        particle.velocity.y = 0;
                        particle.velocity.x *= 0.9; // Fricción
                        particle.velocity.z *= 0.9; // Fricción
                    }
                    
                    // Desvanecer gradualmente
                    if (progress > 0.7) {
                        particle.mesh.material.opacity = 0.9 * (1 - (progress - 0.7) / 0.3);
                    }
                }
                
                // Animar humo
                for (const smoke of smokeParticles) {
                    // Mover según velocidad
                    smoke.mesh.position.x += smoke.velocity.x;
                    smoke.mesh.position.y += smoke.velocity.y;
                    smoke.mesh.position.z += smoke.velocity.z;
                    
                    // Rotar
                    smoke.mesh.rotation.y += smoke.rotationSpeed;
                    
                    // Ralentizar
                    smoke.velocity.multiplyScalar(0.98);
                    
                    // Expandir
                    const scale = smoke.scale * (1 + progress * 0.5);
                    smoke.mesh.scale.set(scale, scale, scale);
                    
                    // Desvanecer gradualmente
                    smoke.mesh.material.opacity = 0.7 * (1 - progress);
                }
                
                // Continuar animación o finalizar
                if (progress < 1) {
                    requestAnimationFrame(animateExplosion);
                } else {
                    if (explosionGroup.parent) {
                        explosionGroup.parent.remove(explosionGroup);
                    }
                }
            };
            
            // Iniciar animación
            animateExplosion();
        }
    }
} 