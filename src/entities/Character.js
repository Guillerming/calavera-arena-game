import * as THREE from 'three';
import { SpeedIndicator } from '../utils/SpeedIndicator.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CharacterMovement } from './CharacterMovement.js';
import { CharacterCannon } from './CharacterCannon.js';
import { CharacterProjectiles } from './CharacterProjectiles.js';
import { CharacterEffects } from './CharacterEffects.js';
import { CharacterUI } from './CharacterUI.js';
import { CharacterCollision } from './CharacterCollision.js';

export class Character extends THREE.Object3D {
    constructor(scene) {
        super();
        this.scene = scene;
        this.terrain = null;
        this.cameraController = null;
        this.networkManager = null;

        this.currentSpeed = 0;
        this.maxSpeed = 20;
        this.minSpeed = -5;
        this.speedChangeRate = 20;
        
        this.maxRotationRate = (2 * Math.PI) / 15;
        
        this.currentRoll = 0;
        this.targetRoll = 0;
        this.maxRoll = (Math.PI / 12) * 0.6;
        this.rollSpeed = 3;
        
        this.cannonReady = true;
        this.cannonCooldown = 1000;
        this.cannonTimer = 0;
        this.projectileSpeed = 70;
        this.projectileGravity = 9.8;
        this.cannonAngle = Math.PI / 35;
        this.projectileInitialHeight = 0.5;
        this.prevMouseDown = false;
        
        this.mapLimits = {
            minX: -200,
            maxX: 200,
            minZ: -200,
            maxZ: 200
        };
        
        this.projectiles = [];

        this.speedIndicator = new SpeedIndicator();
        
        this.isJumping = false;
        this.jumpForce = 7;
        this.gravity = -30;
        
        this.health = 100;
        this.isAlive = true;
        this.isLocalPlayer = false;

        this.projectilesGroup = new THREE.Group();
        this.add(this.projectilesGroup);

        this.radius = 1.5;
        this.height = 2;
        
        this.normalHeight = 1;
        this.waterHeight = 0.3;
        this.inWater = false;

        const loader = new GLTFLoader();
        
        loader.load('assets/models/lowpolyboat.glb', (gltf) => {
            this.boat = gltf.scene;
            
            this.boat.scale.set(0.6, 0.6, 0.6);
            this.boat.rotation.y = Math.PI;
            this.boat.position.y = -0.8;
            
            this.add(this.boat);
            
            this.colliderMesh = new THREE.Mesh(
                new THREE.CylinderGeometry(this.radius, this.radius, this.height, 8),
                new THREE.MeshBasicMaterial({ 
                    wireframe: true, 
                    visible: false
                })
            );
            this.colliderMesh.position.y = 0.8;
            this.boat.add(this.colliderMesh);

            if (this.scene) {
                this.scene.add(this);
                this.createAimingLine();
            }
        });

        this.currentPosition = new THREE.Vector3();
        this.currentCameraAngle = 0;
        
        // Inicializar componentes
        this.movement = new CharacterMovement(this);
        this.cannon = new CharacterCannon(this);
        this.projectilesManager = new CharacterProjectiles(this);
        this.effects = new CharacterEffects(this);
        this.collision = new CharacterCollision(this);
        
        // Inicializar UI después de crear los componentes
        this.ui = new CharacterUI(this);
        this.createCannonIndicators();
        
        // Inicializar UI de salud solo si es el jugador local
        if (this.isLocalPlayer) {
            this.updateHealthUI();
        }
    }

    update(deltaTime = 0.016, inputManager = null) {
        // Si el personaje está muerto, no actualizar movimiento ni cañón
        if (!this.isAlive) {
            // Solo actualizar proyectiles ya disparados
            if (this.projectilesManager) {
                this.projectilesManager.updateProjectiles(deltaTime);
            }
            
            return;
        }
        
        this.movement.updateMovement(deltaTime, inputManager);
        this.cannon.updateCannon(deltaTime, inputManager);
        
        // Verificar que projectilesManager existe
        if (this.projectilesManager) {
            this.projectilesManager.updateProjectiles(deltaTime);
        } else {
            console.warn('projectilesManager no está inicializado en Character');
        }
        
        this.updateAimingLine();
    }

    updateMovement(deltaTime = 0.016, inputManager = null) {
        this.movement.updateMovement(deltaTime, inputManager);
    }

    setPosition(x, z) {
        if (this.boat) {
            this.boat.position.set(x, 0, z);
        }
    }

    checkCollision(otherCharacter) {
        return this.collision.checkCollision(otherCharacter);
    }

    createCannonIndicators() {
        this.ui.createCannonIndicators();
    }

    updateCannonIndicators(angleToCamera) {
        this.ui.updateCannonIndicators(angleToCamera);
    }

    updateCannon(deltaTime, inputManager) {
        this.cannon.updateCannon(deltaTime, inputManager);
    }
    
    getAngleToCameraDirection() {
        return this.cannon.getAngleToCameraDirection();
    }

    fireCannon() {
        this.cannon.fireCannon();
    }

    createMuzzleFlash(position, direction) {
        this.effects.createMuzzleFlash(position, direction);
    }

    updateProjectiles(deltaTime) {
        this.projectilesManager.updateProjectiles(deltaTime);
    }

    createSplashEffect(position) {
        this.effects.createSplashEffect(position);
    }

    createExplosionEffect(position) {
        this.effects.createExplosionEffect(position);
    }

    setCameraController(controller) {
        this.cameraController = controller;
    }

    createAimingLine() {
        const geometry = new THREE.BufferGeometry();
        const points = [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, -1000)
        ];
        geometry.setFromPoints(points);

        const material = new THREE.LineBasicMaterial({
            color: 0xffff00,
            transparent: false,
        });

        this.aimingLine = new THREE.Line(geometry, material);
        this.scene.add(this.aimingLine);
    }

    updateAimingLine() {
        if (!this.aimingLine) return;

        const direction = new THREE.Vector3(0, 0, -1);
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeRotationY(this.currentCameraAngle);
        direction.applyMatrix4(rotationMatrix);

        const points = [
            this.currentPosition.clone(),
            this.currentPosition.clone().add(direction.multiplyScalar(10))
        ];

        this.aimingLine.geometry.setFromPoints(points);
    }

    setNetworkManager(networkManager) {
        this.networkManager = networkManager;
    }

    checkCollisionWithPlayer(newPosition, playerData) {
        return this.collision.checkCollisionWithPlayer(newPosition, playerData);
    }

    handleProjectileCollision(projectile, position, collisionType) {
        this.projectilesManager.handleProjectileCollision(projectile, position, collisionType);
    }

    setTerrain(terrain) {
        this.terrain = terrain;
    }

    createOtherPlayerProjectile(projectileData) {
        this.projectilesManager.createOtherPlayerProjectile(projectileData);
    }

    removeProjectile(projectileId) {
        this.projectilesManager.removeProjectile(projectileId);
    }
    
    // Métodos para gestionar puntos de vida
    takeDamage(damage, damageType, sourceId = null) {
        // Si ya está muerto, no procesar más daño
        if (!this.isAlive) {
            console.log(`[DEBUG] ${this.name} ya está muerto, ignorando daño`);
            return;
        }
        
        // IMPORTANTE: Si el jugador es local, enviamos la solicitud al servidor
        // pero no modificamos el estado directamente
        if (this.isLocalPlayer) {
            console.log(`[DEBUG] Jugador local ${this.name} recibe daño: ${damage}`);
            
            // No reducimos la salud directamente, esperamos confirmación del servidor
            // Solo mostramos efectos visuales inmediatos
            this.showDamageEffect(damageType);
            
            // Enviar al servidor la solicitud de aplicar daño
            if (this.networkManager) {
                // Calcular nueva salud potencial
                const newHealth = Math.max(0, this.health - damage);
                const wouldDie = newHealth <= 0;
                
                console.log(`[DEBUG] Solicitando actualización de salud al servidor. Nueva salud: ${newHealth}, moriría: ${wouldDie}`);
                this.networkManager.sendHealthUpdate(newHealth, !wouldDie, sourceId, this.name);
            } else {
                console.error(`[ERROR] No se puede enviar actualización de daño: networkManager no está definido`);
                console.log(`[DEBUG] Character ${this.name}, isLocalPlayer: ${this.isLocalPlayer}`);
            }
            
            return;
        }
        
        // Para jugadores remotos, solo mostramos efectos visuales
        // El servidor es quien actualiza el estado real
        console.log(`[DEBUG] Jugador remoto ${this.name} mostrando efecto de daño (visual)`);
        this.showDamageEffect(damageType);
    }
    
    // Método para recibir daño de proyectiles
    takeProjectileDamage(sourcePlayerId) {
        // Si ya está muerto, no procesar más daño
        if (!this.isAlive) return;
        
        // Aplicar daño según la configuración
        this.takeDamage(25, 'projectile', sourcePlayerId);
    }
    
    // Método para actualizar el estado desde el servidor
    updateStateFromServer(health, isAlive, position = null) {
        // Crear logger para esta función
        const logPrefix = `[Character ${this.name || 'desconocido'}] updateStateFromServer:`;
        console.log(`${logPrefix} health=${health}, isAlive=${isAlive}, position=${position ? JSON.stringify(position) : 'null'}`);
        
        // Actualizar salud si es diferente
        if (health !== undefined && health !== this.health) {
            const oldHealth = this.health;
            this.health = health;
            console.log(`${logPrefix} Salud actualizada: ${oldHealth} -> ${health}`);
            
            // Si es el jugador local, actualizar la UI de salud
            if (this.isLocalPlayer) {
                this.updateHealthUI();
            }
        }
        
        // Actualizar estado de vida
        if (isAlive !== undefined && isAlive !== this.isAlive) {
            const wasAlive = this.isAlive;
            this.isAlive = isAlive;
            
            // Si acaba de morir
            if (wasAlive && !isAlive) {
                console.log(`${logPrefix} El jugador ha muerto`);
                this.onDeath();
            }
            
            // Si acaba de revivir
            if (!wasAlive && isAlive) {
                console.log(`${logPrefix} El jugador ha revivido`);
            }
        }
        
        // Actualizar posición si se proporciona
        if (position && !this.isLocalPlayer) {
            this.position.set(position.x, position.y, position.z);
        }
        
        return this;
    }
    
    // Método para daño por colisión
    takeCollisionDamage(damage, colliderId = null) {
        // Aplicar el daño con el tipo 'collision'
        this.takeDamage(damage, 'collision', colliderId);
    }
    
    // Método llamado cuando el personaje muere
    onDeath() {
        // Asegurarse de que esta función solo se ejecuta si realmente está muerto
        if (!this.isAlive) {
            
            // Ocultar el modelo del barco
            if (this.boat) {
                this.boat.visible = false;
            }
            
            // Desactivar colisiones
            if (this.colliderMesh) {
                this.colliderMesh.visible = false;
            }
            
            // Mostrar efecto grande de explosión de muerte
            // Usamos position.clone() para asegurarnos de que la posición es correcta incluso si el barco se mueve
            this.effects.createDeathExplosionEffect(this.position.clone());
            
            // Programar respawn solo si es el jugador local
            if (this.isLocalPlayer && this.scene) {
                
                // Programar respawn después de 5 segundos
                setTimeout(() => {
                    this.respawn();
                }, 5000);
            }
        }
    }
    
    // Método para hacer respawn del barco
    respawn() {
        
        // Restaurar salud completa
        this.health = 100;
        this.isAlive = true;
        
        // Colocar el barco en una posición segura (solo para jugador local)
        if (this.isLocalPlayer) {
            // Buscar coordenadas seguras a través del scene.characterManager
            if (this.scene && this.scene.characterManager) {
                const safeCoordinates = this.scene.characterManager.getSafeCoordinates(15);
                this.position.set(safeCoordinates.x, 0, safeCoordinates.z);
                
                // Orientar el barco hacia el centro del mapa
                if (this.scene.characterManager.getRotationTowardCenter) {
                    this.rotation.y = this.scene.characterManager.getRotationTowardCenter(safeCoordinates.x, safeCoordinates.z);
                }
            } else {
                // Fallback a posición aleatoria si no tenemos acceso al characterManager
                console.warn("No se encontró CharacterManager, usando posición aleatoria");
                const spawnX = (Math.random() * 150) - 75;
                const spawnZ = (Math.random() * 150) - 75;
                this.position.set(spawnX, 0, spawnZ);
                
                // Orientar hacia el centro incluso en el fallback
                this.rotation.y = Math.atan2(-spawnZ, -spawnX) + Math.PI;
            }
        }
        
        // Hacer visible nuevamente el barco
        if (this.boat) {
            this.boat.visible = true;
        }
        
        // Reactivar colisiones
        if (this.colliderMesh) {
            this.colliderMesh.visible = true;
        }
        
        // Actualizar UI de salud
        this.updateHealthUI();
        
        // Enviar actualización de salud y posición a través de la red (solo jugador local)
        if (this.isLocalPlayer && this.networkManager) {
            this.networkManager.sendHealthUpdate(this.health, this.isAlive);
        }
    }
    
    // Mostrar efecto visual de daño
    showDamageEffect(damageType) {
        if (!this.boat) return;
        
        // Crear efecto visual según el tipo de daño
        if (damageType === 'projectile') {
            // Efecto de humo/fuego para impacto de cañón
            this.createSmokeEffect(this.position.clone());
        } else if (damageType === 'collision') {
            // Efecto más sutil para colisión
            this.createCollisionEffect(this.position.clone());
        }
    }
    
    // Crear efecto de humo para mostrar daño
    createSmokeEffect(position) {
        if (!this.effects) return;
        
        // Delegar la creación del efecto visual a la clase de efectos
        this.effects.createSmokeEffect(position);
    }
    
    // Crear efecto de colisión
    createCollisionEffect(position) {
        if (!this.effects) return;
        
        // Efecto visual para colisión
        this.effects.createCollisionEffect(position);
    }
    
    // Actualizar UI de salud
    updateHealthUI() {
        if (this.ui) {
            this.ui.updateHealthIndicator(this.health);
        }
    }
} 