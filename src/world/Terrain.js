import * as THREE from 'three';

export class Terrain {
    constructor() {
        this.size = { width: 100, depth: 100 }; // 100x100 metros
        this.islandRadius = 30; // Radio de la isla
        this.createTerrain();
    }

    createTerrain() {
        // Crear grupo para contener todos los elementos
        this.mesh = new THREE.Group();

        // Crear el océano (un plano grande)
        const oceanGeometry = new THREE.PlaneGeometry(this.size.width, this.size.depth, 20, 20);
        const oceanMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x0077be,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        this.ocean = new THREE.Mesh(oceanGeometry, oceanMaterial);
        this.ocean.rotation.x = -Math.PI / 2;
        this.ocean.position.y = -0.2; // Ligeramente por debajo de la isla

        // Crear la isla
        const islandGeometry = new THREE.CircleGeometry(this.islandRadius, 32);
        const islandMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xc2b280, // Color arena
            side: THREE.DoubleSide
        });
        this.island = new THREE.Mesh(islandGeometry, islandMaterial);
        this.island.rotation.x = -Math.PI / 2;

        // Crear palmeras
        this.createPalms();

        // Añadir todo al grupo
        this.mesh.add(this.ocean);
        this.mesh.add(this.island);
    }

    createPalms() {
        // Crear 5 palmeras distribuidas aleatoriamente en el centro de la isla
        for (let i = 0; i < 5; i++) {
            // Posición aleatoria dentro de un radio más pequeño que la isla
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * (this.islandRadius * 0.5); // Solo en la mitad interior
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;

            const palm = this.createPalmTree();
            palm.position.set(x, 0, z);
            palm.rotation.y = Math.random() * Math.PI * 2; // Rotación aleatoria
            this.mesh.add(palm);
        }
    }

    createPalmTree() {
        const palm = new THREE.Group();

        // Tronco
        const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.3, 4, 8);
        const trunkMaterial = new THREE.MeshPhongMaterial({ color: 0x8b4513 });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 2; // Altura del tronco

        // Hojas (usando conos planos)
        const leavesGroup = new THREE.Group();
        const leafCount = 5;
        for (let i = 0; i < leafCount; i++) {
            const leafGeometry = new THREE.ConeGeometry(1, 2, 3);
            const leafMaterial = new THREE.MeshPhongMaterial({ color: 0x2d5a27 });
            const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
            
            // Posicionar y rotar las hojas
            leaf.position.y = 4;
            leaf.rotation.x = Math.PI / 4;
            leaf.rotation.y = (i / leafCount) * Math.PI * 2;
            leavesGroup.add(leaf);
        }

        palm.add(trunk);
        palm.add(leavesGroup);
        return palm;
    }

    isInBounds(position) {
        // Ahora solo comprobamos los límites del océano
        const halfWidth = this.size.width / 2;
        const halfDepth = this.size.depth / 2;
        return position.x >= -halfWidth && 
               position.x <= halfWidth && 
               position.z >= -halfDepth && 
               position.z <= halfDepth;
    }

    isInWater(position) {
        // Comprobar si está fuera de la isla
        const distanceFromCenter = Math.sqrt(
            position.x * position.x + 
            position.z * position.z
        );
        return distanceFromCenter > this.islandRadius;
    }
} 