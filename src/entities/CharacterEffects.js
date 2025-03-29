import * as THREE from 'three';

export class CharacterEffects {
    constructor(character) {
        this.character = character;
    }

    createMuzzleFlash(position, direction) {
        const flashGroup = new THREE.Group();
        
        const flashGeometry = new THREE.SphereGeometry(0.2, 8, 8);
        const flashMaterial = new THREE.MeshBasicMaterial({
            color: 0xff7700,
            transparent: true,
            opacity: 1
        });
        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        flashGroup.add(flash);
        
        const smokeCount = 12;
        const smokeParticles = [];
        
        for (let i = 0; i < smokeCount; i++) {
            const size = 0.1 + Math.random() * 0.2;
            const smokeGeometry = new THREE.SphereGeometry(size, 6, 6);
            const smokeMaterial = new THREE.MeshBasicMaterial({
                color: 0x888888,
                transparent: true,
                opacity: 0.7
            });
            const smoke = new THREE.Mesh(smokeGeometry, smokeMaterial);
            
            smoke.position.set(
                Math.random() * 0.1 - 0.05,
                Math.random() * 0.1 - 0.05,
                0.2
            );
            
            const speed = 0.2 + Math.random() * 0.4;
            const angle = Math.random() * Math.PI * 2;
            const elevationAngle = Math.random() * Math.PI * 0.3;
            
            smokeParticles.push({
                mesh: smoke,
                velocity: new THREE.Vector3(
                    Math.cos(angle) * Math.sin(elevationAngle) * speed + direction.x * speed * 0.5,
                    Math.sin(angle) * Math.sin(elevationAngle) * speed + direction.y * speed * 0.5,
                    Math.cos(elevationAngle) * speed + direction.z * speed
                ),
                rotationSpeed: Math.random() * 0.05 - 0.025
            });
            
            flashGroup.add(smoke);
        }
        
        const sparkCount = 15;
        const sparkParticles = [];
        
        for (let i = 0; i < sparkCount; i++) {
            const sparkGeometry = new THREE.BoxGeometry(0.03, 0.03, 0.03);
            const sparkMaterial = new THREE.MeshBasicMaterial({
                color: 0xff9900,
                transparent: true,
                opacity: 1
            });
            const spark = new THREE.Mesh(sparkGeometry, sparkMaterial);
            
            spark.position.set(0, 0, 0.2);
            
            const speed = 0.8 + Math.random() * 1.2;
            const angle = Math.random() * Math.PI * 2;
            const elevationAngle = Math.random() * Math.PI * 0.2;
            
            sparkParticles.push({
                mesh: spark,
                velocity: new THREE.Vector3(
                    Math.cos(angle) * Math.sin(elevationAngle) * speed + direction.x * speed * 0.8,
                    Math.sin(angle) * Math.sin(elevationAngle) * speed + direction.y * speed * 0.8,
                    Math.cos(elevationAngle) * speed + direction.z * speed * 0.8
                ),
                rotationSpeed: Math.random() * 0.2 - 0.1,
                lifespan: 400 + Math.random() * 300
            });
            
            flashGroup.add(spark);
        }
        
        flashGroup.position.copy(position);
        
        if (this.character.scene) {
            this.character.scene.add(flashGroup);
            
            const initialTime = performance.now();
            const flashDuration = 1500;
            
            const originalPosition = position.clone();
            
            const animateFlash = () => {
                const now = performance.now();
                const elapsed = now - initialTime;
                const progress = Math.min(elapsed / flashDuration, 1);
                
                flashGroup.position.copy(originalPosition);
                
                if (progress < 0.2) {
                    const flashScale = progress < 0.1 ? progress * 10 : 1 - (progress - 0.1) / 0.1;
                    flash.scale.set(flashScale, flashScale, flashScale);
                    flash.material.opacity = 1 - progress * 5;
                } else {
                    flash.visible = false;
                }
                
                for (const particle of smokeParticles) {
                    particle.mesh.position.x += particle.velocity.x;
                    particle.mesh.position.y += particle.velocity.y;
                    particle.mesh.position.z += particle.velocity.z;
                    
                    particle.mesh.rotation.x += particle.rotationSpeed;
                    particle.mesh.rotation.y += particle.rotationSpeed;
                    
                    particle.velocity.multiplyScalar(0.96);
                    
                    particle.mesh.material.opacity = 0.7 * (1 - progress);
                    
                    const scale = 1 + progress * 2;
                    particle.mesh.scale.set(scale, scale, scale);
                }
                
                for (const spark of sparkParticles) {
                    const sparkElapsed = elapsed;
                    const sparkProgress = Math.min(sparkElapsed / spark.lifespan, 1);
                    
                    if (sparkProgress < 1) {
                        spark.mesh.position.x += spark.velocity.x;
                        spark.mesh.position.y += spark.velocity.y;
                        spark.mesh.position.z += spark.velocity.z;
                        
                        spark.velocity.y -= 0.01;
                        
                        spark.mesh.rotation.x += spark.rotationSpeed;
                        spark.mesh.rotation.y += spark.rotationSpeed;
                        
                        if (sparkProgress > 0.7) {
                            spark.mesh.material.opacity = 1 - (sparkProgress - 0.7) / 0.3;
                        }
                    } else {
                        spark.mesh.visible = false;
                    }
                }
                
                if (progress < 1) {
                    requestAnimationFrame(animateFlash);
                } else {
                    if (flashGroup.parent) {
                        flashGroup.parent.remove(flashGroup);
                    }
                }
            };
            
            animateFlash();
        }
    }

    createSplashEffect(position) {
        const splashGroup = new THREE.Group();
        
        const splashGeometry = new THREE.CylinderGeometry(0, 1.5, 2, 12);
        const splashMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x77aaff,
            transparent: true,
            opacity: 0.7
        });
        const splash = new THREE.Mesh(splashGeometry, splashMaterial);
        splash.position.y = 1;
        splashGroup.add(splash);
        
        const ringGeometry = new THREE.RingGeometry(0.5, 0.8, 16);
        const ringMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.05;
        splashGroup.add(ring);
        
        const dropCount = 8;
        const drops = [];
        
        for (let i = 0; i < dropCount; i++) {
            const dropGeometry = new THREE.SphereGeometry(0.1, 6, 6);
            const dropMaterial = new THREE.MeshBasicMaterial({
                color: 0x77aaff,
                transparent: true,
                opacity: 0.7
            });
            const drop = new THREE.Mesh(dropGeometry, dropMaterial);
            
            const angle = (i / dropCount) * Math.PI * 2;
            const radius = 0.3 + Math.random() * 0.2;
            drop.position.x = Math.cos(angle) * radius;
            drop.position.z = Math.sin(angle) * radius;
            drop.position.y = 0.5 + Math.random() * 0.5;
            
            drops.push({
                mesh: drop,
                velocity: new THREE.Vector3(
                    Math.cos(angle) * (0.5 + Math.random() * 0.5),
                    1 + Math.random() * 0.5,
                    Math.sin(angle) * (0.5 + Math.random() * 0.5)
                ),
                gravity: 5 + Math.random() * 2
            });
            
            splashGroup.add(drop);
        }
        
        splashGroup.position.copy(position);
        splashGroup.position.y = 0;
        
        if (this.character.scene) {
            this.character.scene.add(splashGroup);
            
            const initialTime = performance.now();
            const duration = 1200;
            
            const animateSplash = () => {
                const now = performance.now();
                const elapsed = now - initialTime;
                const progress = Math.min(elapsed / duration, 1);
                
                const splashScale = progress < 0.4 ? progress * 2.5 : 1 - (progress - 0.4) / 0.6;
                splash.scale.set(splashScale, splashScale * (1 - progress * 0.5), splashScale);
                splash.material.opacity = 0.7 * (1 - progress);
                
                ring.scale.set(1 + progress * 5, 1 + progress * 5, 1);
                ring.material.opacity = 0.5 * (1 - progress);
                
                const deltaT = 1/60;
                for (const drop of drops) {
                    drop.velocity.y -= drop.gravity * deltaT;
                    drop.mesh.position.x += drop.velocity.x * deltaT;
                    drop.mesh.position.y += drop.velocity.y * deltaT;
                    drop.mesh.position.z += drop.velocity.z * deltaT;
                    
                    if (drop.mesh.position.y < 0.05) {
                        drop.mesh.position.y = 0.05;
                        drop.velocity.y = -drop.velocity.y * 0.3;
                    }
                    
                    drop.mesh.material.opacity = 0.7 * (1 - progress);
                }
                
                if (progress < 1) {
                    requestAnimationFrame(animateSplash);
                } else {
                    if (splashGroup.parent) {
                        splashGroup.parent.remove(splashGroup);
                    }
                }
            };
            
            animateSplash();
        }
    }

    createExplosionEffect(position) {
        const explosionGroup = new THREE.Group();
        
        const flashGeometry = new THREE.SphereGeometry(0.6, 12, 12);
        const flashMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xff6600,
            transparent: true,
            opacity: 1
        });
        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        explosionGroup.add(flash);
        
        const debrisCount = 20;
        const debrisParticles = [];
        
        for (let i = 0; i < debrisCount; i++) {
            const debrisSize = 0.05 + Math.random() * 0.15;
            const debrisGeometry = new THREE.BoxGeometry(debrisSize, debrisSize, debrisSize);
            const debrisMaterial = new THREE.MeshBasicMaterial({
                color: 0x8B4513,
                transparent: true,
                opacity: 0.9
            });
            const debris = new THREE.Mesh(debrisGeometry, debrisMaterial);
            
            debris.position.set(0, 0, 0);
            
            const speed = 0.5 + Math.random() * 1;
            const angle = Math.random() * Math.PI * 2;
            const elevationAngle = Math.random() * Math.PI;
            
            debrisParticles.push({
                mesh: debris,
                velocity: new THREE.Vector3(
                    Math.cos(angle) * Math.sin(elevationAngle) * speed,
                    Math.cos(elevationAngle) * speed,
                    Math.sin(angle) * Math.sin(elevationAngle) * speed
                ),
                rotationSpeed: {
                    x: (Math.random() - 0.5) * 0.2,
                    y: (Math.random() - 0.5) * 0.2,
                    z: (Math.random() - 0.5) * 0.2
                },
                gravity: 9.8
            });
            
            explosionGroup.add(debris);
        }
        
        const smokeCount = 8;
        const smokeParticles = [];
        
        for (let i = 0; i < smokeCount; i++) {
            const size = 0.3 + Math.random() * 0.4;
            const smokeGeometry = new THREE.SphereGeometry(size, 8, 8);
            const smokeMaterial = new THREE.MeshBasicMaterial({
                color: 0x666666,
                transparent: true,
                opacity: 0.7
            });
            const smoke = new THREE.Mesh(smokeGeometry, smokeMaterial);
            
            smoke.position.set(
                (Math.random() - 0.5) * 0.2,
                (Math.random() - 0.5) * 0.2 + 0.3,
                (Math.random() - 0.5) * 0.2
            );
            
            const speed = 0.1 + Math.random() * 0.2;
            const angle = Math.random() * Math.PI * 2;
            
            smokeParticles.push({
                mesh: smoke,
                velocity: new THREE.Vector3(
                    Math.cos(angle) * speed * 0.5,
                    speed,
                    Math.sin(angle) * speed * 0.5
                ),
                rotationSpeed: (Math.random() - 0.5) * 0.02,
                scale: 1 + Math.random() * 0.5
            });
            
            explosionGroup.add(smoke);
        }
        
        explosionGroup.position.copy(position);
        
        if (this.character.scene) {
            this.character.scene.add(explosionGroup);
            
            const initialTime = performance.now();
            const duration = 1500;
            
            const animateExplosion = () => {
                const now = performance.now();
                const elapsed = now - initialTime;
                const progress = Math.min(elapsed / duration, 1);
                
                if (progress < 0.2) {
                    const flashScale = progress < 0.1 ? progress * 10 : 1 - (progress - 0.1) / 0.1;
                    flash.scale.set(flashScale, flashScale, flashScale);
                    flash.material.opacity = 1 - progress * 5;
                } else {
                    flash.visible = false;
                }
                
                const deltaT = 1/60;
                for (const particle of debrisParticles) {
                    particle.velocity.y -= particle.gravity * deltaT;
                    
                    particle.mesh.position.x += particle.velocity.x * deltaT;
                    particle.mesh.position.y += particle.velocity.y * deltaT;
                    particle.mesh.position.z += particle.velocity.z * deltaT;
                    
                    particle.mesh.rotation.x += particle.rotationSpeed.x;
                    particle.mesh.rotation.y += particle.rotationSpeed.y;
                    particle.mesh.rotation.z += particle.rotationSpeed.z;
                    
                    if (particle.mesh.position.y < 0) {
                        particle.mesh.position.y = 0;
                        particle.velocity.y = 0;
                        particle.velocity.x *= 0.9;
                        particle.velocity.z *= 0.9;
                    }
                    
                    if (progress > 0.7) {
                        particle.mesh.material.opacity = 0.9 * (1 - (progress - 0.7) / 0.3);
                    }
                }
                
                for (const smoke of smokeParticles) {
                    smoke.mesh.position.x += smoke.velocity.x;
                    smoke.mesh.position.y += smoke.velocity.y;
                    smoke.mesh.position.z += smoke.velocity.z;
                    
                    smoke.mesh.rotation.y += smoke.rotationSpeed;
                    
                    smoke.velocity.multiplyScalar(0.98);
                    
                    const scale = smoke.scale * (1 + progress * 0.5);
                    smoke.mesh.scale.set(scale, scale, scale);
                    
                    smoke.mesh.material.opacity = 0.7 * (1 - progress);
                }
                
                if (progress < 1) {
                    requestAnimationFrame(animateExplosion);
                } else {
                    if (explosionGroup.parent) {
                        explosionGroup.parent.remove(explosionGroup);
                    }
                }
            };
            
            animateExplosion();
        }
    }

    createSmokeEffect(position) {
        const smokeGroup = new THREE.Group();
        
        const smokeCount = 15;
        const smokeParticles = [];
        
        for (let i = 0; i < smokeCount; i++) {
            const size = 0.2 + Math.random() * 0.3;
            const smokeGeometry = new THREE.SphereGeometry(size, 8, 8);
            const smokeMaterial = new THREE.MeshBasicMaterial({
                color: Math.random() > 0.6 ? 0x444444 : 0x222222,
                transparent: true,
                opacity: 0.6 + Math.random() * 0.2
            });
            const smoke = new THREE.Mesh(smokeGeometry, smokeMaterial);
            
            smoke.position.set(
                (Math.random() - 0.5) * 2,
                1 + Math.random() * 1.5,
                (Math.random() - 0.5) * 2
            );
            
            const speed = 0.2 + Math.random() * 0.2;
            const angle = Math.random() * Math.PI * 2;
            
            smokeParticles.push({
                mesh: smoke,
                velocity: new THREE.Vector3(
                    Math.cos(angle) * speed * 0.3,
                    speed,
                    Math.sin(angle) * speed * 0.3
                ),
                rotationSpeed: (Math.random() - 0.5) * 0.02,
                scale: 1 + Math.random() * 0.5,
                lifespan: 2000 + Math.random() * 1000
            });
            
            smokeGroup.add(smoke);
        }
        
        smokeGroup.position.copy(position);
        smokeGroup.position.y += 0.5;
        
        if (this.character.scene) {
            this.character.scene.add(smokeGroup);
            
            const initialTime = performance.now();
            const duration = 3000;
            
            const animateSmoke = () => {
                const now = performance.now();
                const elapsed = now - initialTime;
                const progress = Math.min(elapsed / duration, 1);
                
                for (const particle of smokeParticles) {
                    particle.mesh.position.x += particle.velocity.x;
                    particle.mesh.position.y += particle.velocity.y;
                    particle.mesh.position.z += particle.velocity.z;
                    
                    particle.mesh.rotation.y += particle.rotationSpeed;
                    
                    particle.velocity.multiplyScalar(0.99);
                    particle.velocity.y *= 0.98;
                    
                    const currentScale = particle.scale * (1 + progress * 1.5);
                    particle.mesh.scale.set(currentScale, currentScale, currentScale);
                    
                    particle.mesh.material.opacity = Math.max(0, 0.7 * (1 - progress));
                }
                
                if (progress < 1) {
                    requestAnimationFrame(animateSmoke);
                } else {
                    if (smokeGroup.parent) {
                        smokeGroup.parent.remove(smokeGroup);
                    }
                }
            };
            
            animateSmoke();
        }
    }
    
    createCollisionEffect(position) {
        const collisionGroup = new THREE.Group();
        
        const debrisCount = 10;
        const debrisParticles = [];
        
        for (let i = 0; i < debrisCount; i++) {
            const debrisSize = 0.05 + Math.random() * 0.1;
            const debrisGeometry = new THREE.BoxGeometry(debrisSize, debrisSize, debrisSize);
            const debrisMaterial = new THREE.MeshBasicMaterial({
                color: 0x8B4513,
                transparent: true,
                opacity: 0.9
            });
            const debris = new THREE.Mesh(debrisGeometry, debrisMaterial);
            
            debris.position.set(0, 0.5, 0);
            
            const speed = 0.3 + Math.random() * 0.5;
            const angle = Math.random() * Math.PI * 2;
            const elevationAngle = Math.random() * Math.PI * 0.5;
            
            debrisParticles.push({
                mesh: debris,
                velocity: new THREE.Vector3(
                    Math.cos(angle) * Math.sin(elevationAngle) * speed,
                    Math.cos(elevationAngle) * speed,
                    Math.sin(angle) * Math.sin(elevationAngle) * speed
                ),
                rotationSpeed: {
                    x: (Math.random() - 0.5) * 0.2,
                    y: (Math.random() - 0.5) * 0.2,
                    z: (Math.random() - 0.5) * 0.2
                },
                gravity: 9.8
            });
            
            collisionGroup.add(debris);
        }
        
        collisionGroup.position.copy(position);
        
        if (this.character.scene) {
            this.character.scene.add(collisionGroup);
            
            const initialTime = performance.now();
            const duration = 1000;
            
            const animateCollision = () => {
                const now = performance.now();
                const elapsed = now - initialTime;
                const progress = Math.min(elapsed / duration, 1);
                
                const deltaT = 1/60;
                for (const particle of debrisParticles) {
                    particle.velocity.y -= particle.gravity * deltaT;
                    
                    particle.mesh.position.x += particle.velocity.x * deltaT;
                    particle.mesh.position.y += particle.velocity.y * deltaT;
                    particle.mesh.position.z += particle.velocity.z * deltaT;
                    
                    particle.mesh.rotation.x += particle.rotationSpeed.x;
                    particle.mesh.rotation.y += particle.rotationSpeed.y;
                    particle.mesh.rotation.z += particle.rotationSpeed.z;
                    
                    if (progress > 0.7) {
                        particle.mesh.material.opacity = 0.9 * (1 - (progress - 0.7) / 0.3);
                    }
                }
                
                if (progress < 1) {
                    requestAnimationFrame(animateCollision);
                } else {
                    if (collisionGroup.parent) {
                        collisionGroup.parent.remove(collisionGroup);
                    }
                }
            };
            
            animateCollision();
        }
    }

    createDeathExplosionEffect(position) {
        const explosionGroup = new THREE.Group();
        
        const flashGeometry = new THREE.SphereGeometry(1.2, 16, 16);
        const flashMaterial = new THREE.MeshBasicMaterial({ 
            color: 0xff3300,
            transparent: true,
            opacity: 1
        });
        const flash = new THREE.Mesh(flashGeometry, flashMaterial);
        explosionGroup.add(flash);
        
        const secondaryExplosions = 5;
        for (let i = 0; i < secondaryExplosions; i++) {
            const size = 0.6 + Math.random() * 0.4;
            const secondaryGeometry = new THREE.SphereGeometry(size, 12, 12);
            const secondaryMaterial = new THREE.MeshBasicMaterial({
                color: Math.random() > 0.5 ? 0xff6600 : 0xff3300,
                transparent: true,
                opacity: 0.9
            });
            const secondaryFlash = new THREE.Mesh(secondaryGeometry, secondaryMaterial);
            
            const angle = (i / secondaryExplosions) * Math.PI * 2;
            const radius = 1 + Math.random() * 2;
            secondaryFlash.position.set(
                Math.cos(angle) * radius,
                Math.random() * 1.5,
                Math.sin(angle) * radius
            );
            
            explosionGroup.add(secondaryFlash);
        }
        
        const debrisCount = 40;
        const debrisParticles = [];
        
        for (let i = 0; i < debrisCount; i++) {
            const debrisSize = 0.1 + Math.random() * 0.2;
            const debrisGeometry = new THREE.BoxGeometry(debrisSize, debrisSize, debrisSize);
            const debrisMaterial = new THREE.MeshBasicMaterial({
                color: 0x8B4513,
                transparent: true,
                opacity: 0.9
            });
            const debris = new THREE.Mesh(debrisGeometry, debrisMaterial);
            
            debris.position.set(
                (Math.random() - 0.5) * 2,
                Math.random() * 2,
                (Math.random() - 0.5) * 2
            );
            
            const speed = 1 + Math.random() * 3;
            const angle = Math.random() * Math.PI * 2;
            const elevationAngle = Math.random() * Math.PI;
            
            debrisParticles.push({
                mesh: debris,
                velocity: new THREE.Vector3(
                    Math.cos(angle) * Math.sin(elevationAngle) * speed,
                    Math.cos(elevationAngle) * speed,
                    Math.sin(angle) * Math.sin(elevationAngle) * speed
                ),
                rotationSpeed: {
                    x: (Math.random() - 0.5) * 0.3,
                    y: (Math.random() - 0.5) * 0.3,
                    z: (Math.random() - 0.5) * 0.3
                },
                gravity: 9.8
            });
            
            explosionGroup.add(debris);
        }
        
        const smokeCount = 20;
        const smokeParticles = [];
        
        for (let i = 0; i < smokeCount; i++) {
            const size = 0.5 + Math.random() * 0.7;
            const smokeGeometry = new THREE.SphereGeometry(size, 8, 8);
            const smokeMaterial = new THREE.MeshBasicMaterial({
                color: Math.random() > 0.7 ? 0x222222 : 0x444444,
                transparent: true,
                opacity: 0.8
            });
            const smoke = new THREE.Mesh(smokeGeometry, smokeMaterial);
            
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 3;
            smoke.position.set(
                Math.cos(angle) * radius,
                0.5 + Math.random() * 2,
                Math.sin(angle) * radius
            );
            
            const speed = 0.2 + Math.random() * 0.3;
            
            smokeParticles.push({
                mesh: smoke,
                velocity: new THREE.Vector3(
                    Math.cos(angle) * speed * 0.5,
                    speed,
                    Math.sin(angle) * speed * 0.5
                ),
                rotationSpeed: (Math.random() - 0.5) * 0.02,
                scale: 1 + Math.random() * 0.5
            });
            
            explosionGroup.add(smoke);
        }
        
        explosionGroup.position.copy(position);
        
        if (this.character.scene) {
            this.character.scene.add(explosionGroup);
            
            const initialTime = performance.now();
            const duration = 4000;
            
            const animateExplosion = () => {
                const now = performance.now();
                const elapsed = now - initialTime;
                const progress = Math.min(elapsed / duration, 1);
                
                if (progress < 0.3) {
                    const flashScale = progress < 0.15 ? progress * 6.67 : 1 - (progress - 0.15) / 0.15;
                    flash.scale.set(flashScale, flashScale, flashScale);
                    flash.material.opacity = 1 - progress * 3.33;
                } else {
                    flash.visible = false;
                }
                
                const deltaT = 1/60;
                for (const particle of debrisParticles) {
                    particle.velocity.y -= particle.gravity * deltaT;
                    
                    particle.mesh.position.x += particle.velocity.x * deltaT;
                    particle.mesh.position.y += particle.velocity.y * deltaT;
                    particle.mesh.position.z += particle.velocity.z * deltaT;
                    
                    particle.mesh.rotation.x += particle.rotationSpeed.x;
                    particle.mesh.rotation.y += particle.rotationSpeed.y;
                    particle.mesh.rotation.z += particle.rotationSpeed.z;
                    
                    if (particle.mesh.position.y < 0) {
                        particle.mesh.position.y = 0;
                        particle.velocity.y = 0;
                        particle.velocity.x *= 0.9;
                        particle.velocity.z *= 0.9;
                    }
                    
                    if (progress > 0.7) {
                        particle.mesh.material.opacity = 0.9 * (1 - (progress - 0.7) / 0.3);
                    }
                }
                
                for (const smoke of smokeParticles) {
                    smoke.mesh.position.x += smoke.velocity.x;
                    smoke.mesh.position.y += smoke.velocity.y;
                    smoke.mesh.position.z += smoke.velocity.z;
                    
                    smoke.mesh.rotation.y += smoke.rotationSpeed;
                    
                    smoke.velocity.multiplyScalar(0.99);
                    
                    const scale = smoke.scale * (1 + progress * 1.5);
                    smoke.mesh.scale.set(scale, scale, scale);
                    
                    if (progress > 0.5) {
                        smoke.mesh.material.opacity = 0.8 * (1 - (progress - 0.5) / 0.5);
                    }
                }
                
                if (progress < 1) {
                    requestAnimationFrame(animateExplosion);
                } else {
                    if (explosionGroup.parent) {
                        explosionGroup.parent.remove(explosionGroup);
                    }
                }
            };
            
            animateExplosion();
        }
    }
} 