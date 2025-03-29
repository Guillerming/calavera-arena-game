import * as THREE from 'three';

export class CharacterCollision {
    constructor(character) {
        this.character = character;
    }

    checkCollision(otherCharacter) {
        const dx = this.character.boat.position.x - otherCharacter.boat.position.x;
        const dz = this.character.boat.position.z - otherCharacter.boat.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        if (distance < this.character.radius + otherCharacter.radius) {
            const overlap = (this.character.radius + otherCharacter.radius) - distance;
            const pushDirection = new THREE.Vector3(dx, 0, dz).normalize();
            
            this.character.boat.position.add(pushDirection.multiplyScalar(overlap * 0.5));
            otherCharacter.boat.position.add(pushDirection.multiplyScalar(-overlap * 0.5));
            
            return true;
        }
        return false;
    }

    checkCollisionWithPlayer(newPosition, playerData) {
        const playerPos = new THREE.Vector3(
            playerData.position.x,
            playerData.position.y,
            playerData.position.z
        );

        const distance = newPosition.distanceTo(playerPos);
        
        return distance <= this.character.radius * 2;
    }
}