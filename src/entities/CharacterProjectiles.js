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
            
            if (newPosition.y <= 0) {
                this.character.handleProjectileCollision(projectile, newPosition, 'water');
            } else if (newPosition.y <= terrainHeight) {
                this.character.handleProjectileCollision(projectile, newPosition, 'terrain');
            } else {
                if (this.character.networkManager) {
                    const otherPlayers = this.character.networkManager.getPlayers();
                    for (const otherPlayer of otherPlayers) {
                        if (this.character.checkCollisionWithPlayer(newPosition, otherPlayer)) {
                            this.character.handleProjectileCollision(projectile, newPosition, 'player');
                            break;
                        }
                    }
                }
            }
            
            projectile.mesh.rotation.x += projectile.rotationSpeed.x * deltaTime;
            projectile.mesh.rotation.y += projectile.rotationSpeed.y * deltaTime;
            projectile.mesh.rotation.z += projectile.rotationSpeed.z * deltaTime;
        }
    }
    
    handleProjectileCollision(projectile, position, collisionType) {
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
        
        if (projectile.mesh.parent) {
            projectile.mesh.parent.remove(projectile.mesh);
        }
        
        const index = this.character.projectiles.indexOf(projectile);
        if (index > -1) {
            this.character.projectiles.splice(index, 1);
        }

        if (this.character.networkManager) {
            this.character.networkManager.removeProjectile(projectile.id);
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
} 