import * as THREE from 'three';

export class CharacterMovement {
    constructor(character) {
        this.character = character;
    }

    updateMovement(deltaTime = 0.016, inputManager = null) {
        if (!this.character.terrain) return;

        if (inputManager) {
            if (inputManager.isKeyPressed('KeyW')) {
                this.character.currentSpeed = Math.min(this.character.maxSpeed, this.character.currentSpeed + this.character.speedChangeRate * deltaTime);
            } else if (inputManager.isKeyPressed('KeyS')) {
                this.character.currentSpeed = Math.max(this.character.minSpeed, this.character.currentSpeed - this.character.speedChangeRate * deltaTime);
            }

            const speedFactor = Math.abs(this.character.currentSpeed) / this.character.maxSpeed;
            
            const currentRotationRate = this.character.maxRotationRate * speedFactor;
            
            if (!inputManager.isKeyPressed('KeyA') && !inputManager.isKeyPressed('KeyD')) {
                this.character.targetRoll = 0;
            }
            
            if (inputManager.isKeyPressed('KeyA')) {
                this.character.rotation.y += currentRotationRate * deltaTime;
                if (this.character.boat) {
                    this.character.boat.rotation.y = Math.PI;
                    this.character.targetRoll = this.character.maxRoll * speedFactor;
                }
            }
            if (inputManager.isKeyPressed('KeyD')) {
                this.character.rotation.y -= currentRotationRate * deltaTime;
                if (this.character.boat) {
                    this.character.boat.rotation.y = Math.PI;
                    this.character.targetRoll = -this.character.maxRoll * speedFactor;
                }
            }
            
            if (this.character.boat) {
                const rollDiff = this.character.targetRoll - this.character.currentRoll;
                this.character.currentRoll += rollDiff * this.character.rollSpeed * deltaTime;
                this.character.boat.rotation.z = this.character.currentRoll;
            }
        }

        if (this.character.speedIndicator) {
            this.character.speedIndicator.update(this.character.currentSpeed, this.character.maxSpeed, this.character.minSpeed);
        }

        const direction = new THREE.Vector3(0, 0, -1);
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeRotationY(this.character.rotation.y);
        direction.applyMatrix4(rotationMatrix);
        
        const newPosition = this.character.position.clone();
        newPosition.x += direction.x * this.character.currentSpeed * deltaTime;
        newPosition.z += direction.z * this.character.currentSpeed * deltaTime;

        const isWithinBounds = 
            newPosition.x >= this.character.mapLimits.minX &&
            newPosition.x <= this.character.mapLimits.maxX &&
            newPosition.z >= this.character.mapLimits.minZ &&
            newPosition.z <= this.character.mapLimits.maxZ;
        
        const cosRotation = Math.cos(this.character.rotation.y);
        const sinRotation = Math.sin(this.character.rotation.y);
        
        const collisionPoints = [
            newPosition.clone(),
            new THREE.Vector3(
                newPosition.x + sinRotation * 2,
                newPosition.y,
                newPosition.z + cosRotation * 2
            ),
            new THREE.Vector3(
                newPosition.x - sinRotation * 2,
                newPosition.y,
                newPosition.z - cosRotation * 2
            ),
            new THREE.Vector3(
                newPosition.x - cosRotation,
                newPosition.y,
                newPosition.z + sinRotation
            ),
            new THREE.Vector3(
                newPosition.x + cosRotation,
                newPosition.y,
                newPosition.z - sinRotation
            )
        ];
        
        const collision = collisionPoints.some(point => {
            const terrainHeight = this.character.terrain.getHeightAt(point.x, point.z);
            return terrainHeight > 0;
        });

        if (this.character.networkManager) {
            const otherPlayers = this.character.networkManager.getPlayers();
            let hasCollision = false;

            for (const otherPlayer of otherPlayers) {
                if (this.character.checkCollisionWithPlayer(newPosition, otherPlayer)) {
                    hasCollision = true;
                    break;
                }
            }

            if (hasCollision) {
                this.character.currentSpeed = 0;
                return;
            }
        }

        if (!collision && isWithinBounds) {
            this.character.position.copy(newPosition);
        } else {
            this.character.currentSpeed = 0;
        }

        this.character.currentPosition.copy(this.character.position);
    }
} 