import * as THREE from 'three';

export class CharacterCollision {
    constructor(character) {
        this.character = character;
    }

    checkCollision(otherCharacter) {
        // Calcular la distancia entre los barcos
        const position1 = this.character.position.clone();
        position1.y = 0; // Ignoramos la altura para colisiones
        
        const position2 = otherCharacter.position.clone();
        position2.y = 0; // Ignoramos la altura para colisiones
        
        const distance = position1.distanceTo(position2);
        
        // Usar los radios para detectar colisión
        const collisionDistance = this.character.radius + otherCharacter.radius;
        
        // Si hay colisión
        if (distance < collisionDistance) {
            // Calcular cuánto se superponen
            const overlap = collisionDistance - distance;
            
            // Si están perfectamente superpuestos, moverlos en una dirección aleatoria
            if (distance === 0) {
                const randomAngle = Math.random() * Math.PI * 2;
                position2.x = position1.x + Math.cos(randomAngle) * collisionDistance * 1.01;
                position2.z = position1.z + Math.sin(randomAngle) * collisionDistance * 1.01;
            } else {
                // Calcular la dirección de empuje para separarlos
                const pushDir = new THREE.Vector3()
                    .subVectors(position2, position1)
                    .normalize();
                
                // Mover ambos barcos en direcciones opuestas para resolver la colisión
                // (Solo si son objetos que se pueden mover)
                position1.sub(pushDir.clone().multiplyScalar(overlap * 0.5));
                position2.add(pushDir.clone().multiplyScalar(overlap * 0.5));
                
                // Actualizar posiciones (manteniendo la altura original)
                this.character.position.x = position1.x;
                this.character.position.z = position1.z;
                
                otherCharacter.position.x = position2.x;
                otherCharacter.position.z = position2.z;
                
                // Calcular velocidad relativa para determinar la intensidad de la colisión
                const relativeSpeed = Math.abs(this.character.currentSpeed - otherCharacter.currentSpeed);
                
                // Aplicar daño solo si la colisión es significativa (velocidad relativa alta)
                if (relativeSpeed > 5) {
                    // Cantidad de daño basada en la velocidad relativa
                    const damage = Math.min(15, Math.floor(relativeSpeed * 2));
                    
                    // Aplicar daño a ambos barcos
                    if (this.character.takeCollisionDamage) {
                        this.character.takeCollisionDamage(damage, otherCharacter.name);
                    }
                    
                    if (otherCharacter.takeCollisionDamage) {
                        otherCharacter.takeCollisionDamage(damage, this.character.name);
                    }
                }
            }
            
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