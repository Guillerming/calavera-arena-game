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
                const frontRestrictedAngle = Math.PI / 4;
                const backRestrictedAngle = Math.PI / 3;
                
                const isInFrontRestriction = Math.abs(angleToCamera) < frontRestrictedAngle / 2;
                const isInBackRestriction = Math.abs(Math.abs(angleToCamera) - Math.PI) < backRestrictedAngle / 2;
                
                if (!isInFrontRestriction && !isInBackRestriction) {
                    this.character.fireCannon();
                    this.character.cannonReady = false;
                    this.character.cannonTimer = 0;
                }
            }
        }

        if (this.character.cameraController) {
            this.character.currentCameraAngle = this.character.cameraController.rotationY;
        }
    }
    
    getAngleToCameraDirection() {
        if (!this.character.cameraController) return 0;
        
        const boatDirection = new THREE.Vector3(0, 0, -1);
        const boatRotationMatrix = new THREE.Matrix4();
        boatRotationMatrix.makeRotationY(this.character.rotation.y);
        boatDirection.applyMatrix4(boatRotationMatrix);
        
        const cameraDirection = new THREE.Vector3(0, 0, -1);
        const cameraRotationMatrix = new THREE.Matrix4();
        cameraRotationMatrix.makeRotationY(this.character.cameraController.rotationY);
        cameraDirection.applyMatrix4(cameraRotationMatrix);
        
        return Math.atan2(
            boatDirection.x * cameraDirection.z - boatDirection.z * cameraDirection.x,
            boatDirection.x * cameraDirection.x + boatDirection.z * cameraDirection.z
        );
    }

    fireCannon() {
        if (!this.character.cameraController) return;

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
        
        const direction = new THREE.Vector3(0, 0, -1);
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeRotationY(this.character.cameraController.rotationY);
        direction.applyMatrix4(rotationMatrix);
        
        const initialPos = new THREE.Vector3();
        initialPos.copy(this.character.position);
        
        const sideOffset = 1.2;
        const forwardOffset = 0;
        
        const boatDirection = new THREE.Vector3(0, 0, -1);
        const boatRotationMatrix = new THREE.Matrix4();
        boatRotationMatrix.makeRotationY(this.character.rotation.y);
        boatDirection.applyMatrix4(boatRotationMatrix);
        
        const sideDirection = new THREE.Vector3(-boatDirection.z, 0, boatDirection.x);
        
        initialPos.add(sideDirection.multiplyScalar(sideOffset));
        initialPos.add(boatDirection.multiplyScalar(forwardOffset));
        initialPos.y = this.character.projectileInitialHeight;
        
        projectile.position.copy(initialPos);
        
        const initialVelocity = new THREE.Vector3();
        initialVelocity.x = direction.x * Math.cos(this.character.cannonAngle) * this.character.projectileSpeed;
        initialVelocity.y = Math.sin(this.character.cannonAngle) * this.character.projectileSpeed;
        initialVelocity.z = direction.z * Math.cos(this.character.cannonAngle) * this.character.projectileSpeed;
        
        const projectileData = {
            mesh: projectile,
            velocity: initialVelocity,
            initialPosition: initialPos.clone(),
            launchTime: performance.now(),
            rotationSpeed: {
                x: (Math.random() - 0.5) * 0.3,
                y: (Math.random() - 0.5) * 0.3,
                z: (Math.random() - 0.5) * 0.3
            },
            id: this.character.projectiles.length + 1
        };
        
        this.character.projectiles.push(projectileData);
        
        if (this.character.networkManager) {
            this.character.networkManager.sendProjectile(projectileData);
        }
        
        if (this.character.scene) {
            this.character.scene.add(projectile);
            this.character.createMuzzleFlash(initialPos, direction);
        }
    }
} 