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
        this.projectileSpeed = 60;
        this.projectileGravity = 4.9;
        this.maxRange = 200;
        this.cannonAngle = Math.PI / 35;
        this.projectileInitialHeight = 0.5;
        this.prevMouseDown = false;
        
        this.mapLimits = {
            minX: -195,
            maxX: 195,
            minZ: -195,
            maxZ: 195
        };
        
        this.projectiles = [];

        this.speedIndicator = new SpeedIndicator();
        
        this.isJumping = false;
        this.jumpForce = 7;
        this.gravity = -30;
        
        this.health = 100;
        this.isAlive = true;

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
    }

    update(deltaTime = 0.016, inputManager = null) {
        this.movement.updateMovement(deltaTime, inputManager);
        this.cannon.updateCannon(deltaTime, inputManager);
        this.projectilesManager.updateProjectiles(deltaTime);
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
} 