import * as THREE from 'three';

export class CharacterProjectiles {
    constructor(character) {
        this.character = character;
    }

    updateProjectiles(deltaTime) {
        for (let i = this.character.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.character.projectiles[i];
            
            const timeElapsed = (performance.now() - projectile.launchTime) / 1000;
            
            const newPosition = new THREE.Vector3();
            newPosition.x = projectile.initialPosition.x + projectile.velocity.x * timeElapsed;
            newPosition.z = projectile.initialPosition.z + projectile.velocity.z * timeElapsed;
            newPosition.y = projectile.initialPosition.y + 
                          projectile.velocity.y * timeElapsed - 
                          0.5 * this.character.projectileGravity * timeElapsed * timeElapsed;
            
            projectile.mesh.position.copy(newPosition);
            
            const terrainHeight = this.character.terrain ? this.character.terrain.getHeightAt(newPosition.x, newPosition.z) : 0;
            
            // Comprobar colisión con agua
            if (newPosition.y <= 0) {
                this.handleProjectileCollision(projectile, newPosition, 'water');
            } 
            // Comprobar colisión con terreno
            else if (newPosition.y <= terrainHeight) {
                this.handleProjectileCollision(projectile, newPosition, 'terrain');
            } 
            // Comprobar colisión con jugadores
            else {
                // Usar el método checkPlayerCollisions que ya tenemos implementado
                if (this.checkPlayerCollisions(projectile)) {
                    // Si colisiona con un jugador, ya se ha aplicado el daño en checkPlayerCollisions
                    this.handleProjectileCollision(projectile, newPosition, 'player');
                }
            }
            
            projectile.mesh.rotation.x += projectile.rotationSpeed.x * deltaTime;
            projectile.mesh.rotation.y += projectile.rotationSpeed.y * deltaTime;
            projectile.mesh.rotation.z += projectile.rotationSpeed.z * deltaTime;
        }
    }
    
    // Encontrar un personaje por su ID
    findPlayerCharacter(playerId) {
        // Iterar sobre la lista de personajes del manager
        for (const [id, character] of this.character.scene?.characterManager?.characters || []) {
            if (id === playerId) {
                return character;
            }
        }
        return null;
    }
    
    handleProjectileCollision(projectile, position, collisionType) {
        // Crear efectos visuales según el tipo de colisión
        switch (collisionType) {
            case 'water':
                this.character.createSplashEffect(position);
                break;
            case 'terrain':
                this.character.createExplosionEffect(position);
                break;
            case 'player':
                this.character.createExplosionEffect(position);
                break;
        }
        
        // Eliminar el proyectil de la escena
        if (projectile.mesh.parent) {
            projectile.mesh.parent.remove(projectile.mesh);
        }
        
        // Eliminar el proyectil de la lista
        const index = this.character.projectiles.indexOf(projectile);
        if (index > -1) {
            this.character.projectiles.splice(index, 1);
        }

        // Notificar a través de la red
        if (this.character.networkManager) {
            // Primero notificar que se debe eliminar el proyectil
            this.character.networkManager.removeProjectile(projectile.id);
            
            // También enviar información sobre la colisión para que otros jugadores vean el efecto
            if (this.character.networkManager.sendProjectileCollision) {
                this.character.networkManager.sendProjectileCollision({
                    projectileId: projectile.id,
                    position: {
                        x: position.x,
                        y: position.y,
                        z: position.z
                    },
                    collisionType: collisionType
                });
            }
        }
    }
    
    createOtherPlayerProjectile(projectileData) {
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
        
        // Asegurar que tenemos las coordenadas de posición
        const position = projectileData.position || projectileData.initialPosition;
        if (!position) {
            console.error('No se encontró información de posición en los datos del proyectil:', projectileData);
            return;
        }
        
        projectile.position.set(
            position.x,
            position.y,
            position.z
        );
        
        const projectileObj = {
            mesh: projectile,
            velocity: new THREE.Vector3(
                projectileData.velocity.x,
                projectileData.velocity.y,
                projectileData.velocity.z
            ),
            initialPosition: projectile.position.clone(),
            launchTime: performance.now(),
            rotationSpeed: projectileData.rotationSpeed || {
                x: (Math.random() - 0.5) * 0.3,
                y: (Math.random() - 0.5) * 0.3,
                z: (Math.random() - 0.5) * 0.3
            },
            id: projectileData.id
        };
        
        this.character.projectiles.push(projectileObj);
        
        if (this.character.scene) {
            this.character.scene.add(projectile);
            
            // Crear efecto de disparo para proyectiles de otros jugadores
            // Necesitamos calcular la dirección basada en la velocidad del proyectil
            const direction = new THREE.Vector3(
                projectileData.velocity.x,
                0, // Ignoramos la componente Y para la dirección
                projectileData.velocity.z
            ).normalize();
            
            // Crear el efecto de disparo en la posición inicial del proyectil
            const flashPosition = projectile.position.clone();
            
            // Añadir pequeño retraso para mejor visualización (evita parpadeos y asegura que se vea bien)
            setTimeout(() => {
                this.character.createMuzzleFlash(flashPosition, direction);
            }, 10);
        }
    }
    
    removeProjectile(projectileId) {
        const projectile = this.character.projectiles.find(p => p.id === projectileId);
        if (projectile) {
            if (projectile.mesh.parent) {
                projectile.mesh.parent.remove(projectile.mesh);
            }
            const index = this.character.projectiles.indexOf(projectile);
            if (index > -1) {
                this.character.projectiles.splice(index, 1);
            }
        }
    }

    // Comprobar si el proyectil ha colisionado con otro jugador
    checkPlayerCollisions(projectile) {
        // No comprobar colisiones para proyectiles de otros jugadores (ya lo manejan ellos)
        if (projectile.remoteProjectile) return false;
        
        // Obtener todos los jugadores del escenario
        const scene = this.character.scene;
        if (!scene || !scene.characterManager) return false;
        
        const characters = Array.from(scene.characterManager.characters.values());
        
        for (const otherCharacter of characters) {
            // No comprobar colisión con uno mismo
            if (otherCharacter === this.character) continue;
            
            // Verificar que el otro carácter esté vivo
            if (!otherCharacter.isAlive) continue;
            
            // Obtener posición del otro jugador
            const otherPosition = new THREE.Vector3();
            otherCharacter.getWorldPosition(otherPosition);
            
            // Distancia entre el proyectil y el otro jugador
            const distance = projectile.mesh.position.distanceTo(otherPosition);
            
            // Si está dentro del radio de colisión
            if (distance < otherCharacter.radius + 0.3) {
                // El otro jugador recibe daño
                otherCharacter.takeProjectileDamage(this.character.name); // Pasar el ID del jugador que disparó
                
                return true;
            }
        }
        
        return false;
    }

    // Método para crear proyectiles desde el cañón
    createProjectile(position, direction, projectileId) {
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
        
        // Posicionar el proyectil
        projectile.position.copy(position);
        
        // Calcular la velocidad inicial basada en la dirección proporcionada
        const initialVelocity = new THREE.Vector3();
        // La velocidad es la dirección multiplicada por la velocidad configurable del proyectil
        initialVelocity.copy(direction).multiplyScalar(this.character.projectileSpeed);
        
        // Crear objeto de datos del proyectil
        const projectileData = {
            mesh: projectile,
            velocity: initialVelocity,
            initialPosition: position.clone(),
            launchTime: performance.now(),
            rotationSpeed: {
                x: (Math.random() - 0.5) * 0.3,
                y: (Math.random() - 0.5) * 0.3,
                z: (Math.random() - 0.5) * 0.3
            },
            id: projectileId
        };
        
        // Añadir a la lista de proyectiles
        this.character.projectiles.push(projectileData);
        
        // Añadir a la escena
        if (this.character.scene) {
            this.character.scene.add(projectile);
        }
        
        // Enviar información del proyectil a través de la red
        if (this.character.networkManager) {
            this.character.networkManager.sendProjectile({
                id: projectileId,
                initialPosition: projectileData.initialPosition,
                velocity: projectileData.velocity,
                rotationSpeed: projectileData.rotationSpeed
            });
        }
        
        return projectileData;
    }
} 