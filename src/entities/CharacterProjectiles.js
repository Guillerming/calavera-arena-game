import * as THREE from 'three';

export class CharacterProjectiles {
    constructor(character) {
        this.character = character;
    }

    updateProjectiles(deltaTime) {
        // Actualizar cada proyectil
        for (let i = this.character.projectiles.length - 1; i >= 0; i--) {
            const projectile = this.character.projectiles[i];
            
            // Verificar que el proyectil tiene las propiedades necesarias
            if (!projectile || !projectile.position || !projectile.velocity) {
                console.warn("Proyectil inválido encontrado, eliminando:", projectile);
                this.character.projectiles.splice(i, 1);
                continue;
            }
            
            // Actualizar posición según la velocidad
            projectile.position.x += projectile.velocity.x * deltaTime;
            projectile.position.y += projectile.velocity.y * deltaTime;
            projectile.position.z += projectile.velocity.z * deltaTime;
            
            // Aplicar gravedad
            projectile.velocity.y -= this.character.projectileGravity * deltaTime;
            
            // Actualizar rotación para efecto visual
            if (projectile.mesh && projectile.rotationSpeed) {
                projectile.mesh.rotation.x += projectile.rotationSpeed.x * deltaTime;
                projectile.mesh.rotation.y += projectile.rotationSpeed.y * deltaTime;
                projectile.mesh.rotation.z += projectile.rotationSpeed.z * deltaTime;
            }
            
            // Inicializar flag para eliminar el proyectil
            let removeProjectile = false;
            
            // Comprobar colisión con el agua - Nueva funcionalidad
            const waterLevel = 0.05; // Nivel del agua, debe coincidir con el nivel en Water.js
            
            // Si el proyectil estaba por encima del agua en el frame anterior y ahora está por debajo
            if (projectile.position.y <= waterLevel && 
                (projectile.previousY === undefined || projectile.previousY > waterLevel)) {
                
                // Crear efecto de splash en el punto de impacto
                const splashPosition = new THREE.Vector3(
                    projectile.position.x,
                    waterLevel,
                    projectile.position.z
                );
                
                // Crear efecto de splash
                if (this.character.createSplashEffect) {
                    this.character.createSplashEffect(splashPosition);
                }
                
                // Informar al servidor de la colisión con agua
                if (this.character.networkManager) {
                    this.character.networkManager.sendProjectileCollision({
                        projectileId: projectile.id,
                        position: splashPosition,
                        collisionType: 'water'
                    });
                }
                
                // Eliminar el proyectil
                removeProjectile = true;
            }
            
            // Guardar la posición Y anterior para detectar cuando cruza el nivel del agua
            projectile.previousY = projectile.position.y;
            
            // Comprobar colisión con el terreno
            // Solo comprobar colisiones si el terreno está disponible y es el jugador local
            if (!removeProjectile && this.character.terrain && this.character.isLocalPlayer) {
                const terrainHeight = this.character.terrain.getHeightAt(projectile.position.x, projectile.position.z);
                
                // Si el proyectil está por debajo del terreno, ha colisionado
                if (projectile.position.y <= terrainHeight) {
                    removeProjectile = true;
                    
                    // Crear efecto de impacto solo visual
                    const impactPoint = new THREE.Vector3(
                        projectile.position.x,
                        terrainHeight,
                        projectile.position.z
                    );
                    
                    // Crear efecto de explosión en el punto de impacto
                    if (this.character.createExplosionEffect) {
                        this.character.createExplosionEffect(impactPoint);
                    }
                    
                    // Informar al servidor sobre la colisión
                    if (this.character.networkManager) {
                        this.character.networkManager.sendProjectileCollision({
                            projectileId: projectile.id,
                            position: impactPoint,
                            collisionType: 'terrain'
                        });
                    }
                }
            }
            
            // Comprobar si el proyectil ha salido de los límites del mapa
            let isOutOfBounds = false;
            
            // Usar los límites del mapa definidos en el personaje
            if (this.character.mapLimits) {
                isOutOfBounds = 
                    projectile.position.x < this.character.mapLimits.minX ||
                    projectile.position.x > this.character.mapLimits.maxX ||
                    projectile.position.z < this.character.mapLimits.minZ ||
                    projectile.position.z > this.character.mapLimits.maxZ;
            } else {
                // Si no hay límites definidos, usar la distancia al centro como fallback
                const maxRange = this.character.maxRange || 200;
                const distanceSquared = 
                    projectile.position.x * projectile.position.x + 
                    projectile.position.z * projectile.position.z;
                
                isOutOfBounds = distanceSquared > maxRange * maxRange;
            }
            
            if (isOutOfBounds) {
                removeProjectile = true;
            }
            
            // Comprobar colisión con otros jugadores
            // Solo si es el jugador local y no se va a eliminar por otra razón
            if (this.character.isLocalPlayer && !removeProjectile) {
                // Buscar el CharacterManager en la escena
                const characterManager = this.character.scene?.characterManager;
                if (characterManager) {
                    // Obtener todos los personajes excepto el propio jugador
                    const players = Array.from(characterManager.characters.values())
                        .filter(player => player !== this.character && player.isAlive);
                    
                    // Comprobar colisión con cada jugador
                    for (const player of players) {
                        if (this.checkProjectilePlayerCollision(projectile, player)) {
                            removeProjectile = true;
                            break;
                        }
                    }
                }
            }
            
            // Eliminar el proyectil si es necesario
            if (removeProjectile) {
                // Eliminar el mesh de la escena
                if (projectile.mesh && projectile.mesh.parent) {
                    projectile.mesh.parent.remove(projectile.mesh);
                }
                
                // Eliminar el proyectil de la lista
                this.character.projectiles.splice(i, 1);
                
                // Informar al servidor si es el jugador local y aún no se ha informado de la colisión
                if (this.character.isLocalPlayer && this.character.networkManager) {
                    this.character.networkManager.removeProjectile(projectile.id);
                }
            }
        }
    }
    
    // Encontrar un personaje por su ID
    findPlayerCharacter(playerId) {
        if (!this.character.scene || !this.character.scene.characterManager) {
            console.warn('Scene o characterManager no disponibles para buscar personaje');
            return null;
        }
        
        const characters = this.character.scene.characterManager.characters;
        if (!characters || !Array.isArray(characters)) {
            console.warn('La lista de personajes no está disponible o no es un array');
            return null;
        }
        
        const character = characters.find(char => char && char.playerId === playerId);
        if (!character) {
            console.warn(`No se encontró personaje con ID: ${playerId}`);
        }
        return character || null;
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
        // Verificar que los datos del proyectil son válidos
        if (!projectileData) {
            console.error('Datos de proyectil inválidos');
            return null;
        }
        
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
            return null;
        }
        
        projectile.position.set(
            position.x,
            position.y,
            position.z
        );
        
        // Verificar que tenemos información de velocidad
        if (!projectileData.velocity) {
            console.error('No se encontró información de velocidad en los datos del proyectil:', projectileData);
            return null;
        }
        
        const projectileObj = {
            mesh: projectile,
            position: projectile.position,  // Añadir referencia explícita
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
        
        return projectileObj;
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
        // Verificar que los parámetros son válidos
        if (!position || !direction || !projectileId) {
            console.error('Parámetros inválidos para crear proyectil:', { position, direction, projectileId });
            return null;
        }

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
            position: projectile.position,  // Añadir explícitamente la posición
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

    // Método para comprobar si un proyectil colisiona con un jugador
    checkProjectilePlayerCollision(projectile, player) {
        // Verificar que el proyectil y el jugador tienen las propiedades necesarias
        if (!projectile || !projectile.position || !player || !player.position || !player.name) {
            return false;
        }
        
        // Comprobar colisión con el personaje
        const distance = projectile.position.distanceTo(player.position);
        
        // Si la distancia es menor que el radio del personaje, hay colisión
        if (distance < player.radius * 1.5) {
            // IMPORTANTE: Ya no aplicamos daño directamente
            // Solo informamos al servidor de la colisión
            
            // Crear efecto visual de impacto (solo visualización)
            const impactPoint = projectile.position.clone();
            if (this.character.createExplosionEffect) {
                this.character.createExplosionEffect(impactPoint);
            }
            
            // Enviar información de colisión al servidor SOLO si es el jugador local
            if (this.character.isLocalPlayer && this.character.networkManager) {
                
                this.character.networkManager.sendProjectileCollision({
                    projectileId: projectile.id,
                    position: impactPoint,
                    collisionType: 'player',
                    targetPlayerId: player.name  // El ID del jugador impactado
                });
            }
            
            return true; // Devolvemos true para que se elimine el proyectil localmente
        }
        
        return false;
    }

    fireProjectile() {
        if (!this.canFire) {
            return false;
        }
        
        // Marcar que no puede disparar durante el cooldown
        this.canFire = false;
        
        // Iniciar temporizador de cooldown
        setTimeout(() => {
            this.canFire = true;
        }, this.fireRateMs);
        
        // Obtener posición y dirección de disparo
        const fireDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(this.character.quaternion);
        
        // Calcular la posición inicial del proyectil (desplazado delante de la nave)
        const initialPosition = new THREE.Vector3();
        initialPosition.copy(this.character.position);
        initialPosition.add(fireDirection.clone().multiplyScalar(2)); // Desplazar 2 unidades hacia adelante
        
        // Ajustar altura para disparar desde el cañón y no desde el centro de la nave
        initialPosition.y += 0.5;
        
        // Calcular velocidad del proyectil en la dirección de disparo
        const velocity = fireDirection.clone().multiplyScalar(25); // 20 unidades por segundo
        const projectileId = this.generateUniqueId();
        
        // Si estamos conectados, enviar evento de disparo por red
        if (this.character.networkManager) {
            const projectileData = {
                id: projectileId,
                playerId: this.character.id,
                initialPosition,
                velocity,
                rotationSpeed: Math.random() * 0.1 // Rotación aleatoria para efecto visual
            };
            
            // Console log para debuggear qué contiene cada proyectil
            console.log('[CharacterProjectiles] Enviando proyectil:', projectileData);
            
            // Enviar al servidor
            this.character.networkManager.sendProjectile(projectileData);
        }
    }
} 