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
        
        // Obtener dimensiones
        const width1 = this.character.colliderWidth || this.character.radius * 2;
        const length1 = this.character.colliderLength || this.character.radius * 2;
        const width2 = otherCharacter.colliderWidth || otherCharacter.radius * 2;
        const length2 = otherCharacter.colliderLength || otherCharacter.radius * 2;
        
        // Obtener las rotaciones de los barcos
        const rot1 = this.character.rotation.y;
        const rot2 = otherCharacter.rotation.y;
        
        // Para mantener la compatibilidad con el código existente, usamos un enfoque simplificado
        // Si las nuevas propiedades no están definidas, usamos el método original basado en radios
        if (!this.character.colliderWidth || !otherCharacter.colliderWidth) {
            const distance = position1.distanceTo(position2);
            // Usar los radios para detectar colisión
            const collisionDistance = this.character.radius + otherCharacter.radius;
            
            // Si hay colisión
            if (distance < collisionDistance) {
                this._handleCollisionResponse(position1, position2, distance, collisionDistance, otherCharacter);
                return true;
            }
            return false;
        }
        
        // Enfoque simplificado para colisiones de cajas orientadas
        // Usamos un radio efectivo basado en la distancia al centro desde cualquier punto de la caja
        const maxRadius1 = Math.sqrt((width1/2)*(width1/2) + (length1/2)*(length1/2));
        const maxRadius2 = Math.sqrt((width2/2)*(width2/2) + (length2/2)*(length2/2));
        
        // Verificar primero con una prueba de radio aproximada
        const distance = position1.distanceTo(position2);
        if (distance > maxRadius1 + maxRadius2) {
            // Definitivamente no hay colisión
            return false;
        }
        
        // Si pasó la prueba de radio, podemos usar una prueba más precisa
        // Para simplificar, usamos un factor de corrección para una detección de colisión más precisa
        // pero sin la complejidad de una prueba OBB (Oriented Bounding Box) completa
        const correctionFactor = 0.85; // Ajustar según sea necesario para que se sienta bien
        const effectiveRadius1 = maxRadius1 * correctionFactor;
        const effectiveRadius2 = maxRadius2 * correctionFactor;
        
        if (distance < effectiveRadius1 + effectiveRadius2) {
            this._handleCollisionResponse(position1, position2, distance, effectiveRadius1 + effectiveRadius2, otherCharacter);
            return true;
        }
        
        return false;
    }
    
    _handleCollisionResponse(position1, position2, distance, collisionDistance, otherCharacter) {
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
    }

    checkCollisionWithPlayer(newPosition, playerData) {
        const playerPos = new THREE.Vector3(
            playerData.position.x,
            playerData.position.y,
            playerData.position.z
        );

        // Usar un enfoque basado en radius para mantener compatibilidad
        const distance = newPosition.distanceTo(playerPos);
        
        // Usar el radio efectivo si está disponible, o el radio original como fallback
        const effectiveRadius = this.character.colliderWidth ? 
            Math.sqrt((this.character.colliderWidth/2)*(this.character.colliderWidth/2) + 
                      (this.character.colliderLength/2)*(this.character.colliderLength/2)) : 
            this.character.radius;
        
        return distance <= effectiveRadius * 2;
    }
}