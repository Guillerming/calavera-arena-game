import * as THREE from 'three';

export class TerrainEditor {
    constructor(terrain, engine) {
        this.terrain = terrain;
        this.engine = engine;
        this.createUI();
        this.isEditing = false;
        this.brushSize = 10;
        this.brushStrength = 0.5;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
    }

    createUI() {
        const container = document.createElement('div');
        container.id = 'terrain-editor';
        container.style.cssText = `
            position: fixed;
            bottom: 10px;
            left: 10px;
            background: rgba(0,0,0,0.7);
            padding: 10px;
            border-radius: 5px;
            color: white;
            font-family: Arial;
        `;

        container.innerHTML = `
            <div>
                <label>Tamaño Pincel: <span id="brush-size">10</span></label>
                <input type="range" id="brush-size-slider" min="1" max="50" value="10">
            </div>
            <div>
                <label>Fuerza: <span id="brush-strength">0.5</span></label>
                <input type="range" id="brush-strength-slider" min="0.1" max="1" step="0.1" value="0.5">
            </div>
            <div>
                <button id="edit-mode">Modo Edición</button>
                <button id="save-terrain">Guardar Terreno</button>
            </div>
        `;

        document.body.appendChild(container);
        this.setupListeners();
    }

    setupListeners() {
        const editButton = document.getElementById('edit-mode');
        editButton.addEventListener('click', () => {
            this.isEditing = !this.isEditing;
            editButton.textContent = this.isEditing ? 'Salir Edición' : 'Modo Edición';
        });

        document.getElementById('brush-size-slider').addEventListener('input', (e) => {
            this.brushSize = parseInt(e.target.value);
            document.getElementById('brush-size').textContent = this.brushSize;
        });

        document.getElementById('brush-strength-slider').addEventListener('input', (e) => {
            this.brushStrength = parseFloat(e.target.value);
            document.getElementById('brush-strength').textContent = this.brushStrength;
        });

        document.getElementById('save-terrain').addEventListener('click', () => {
            this.saveTerrain();
        });

        // Mouse events para edición
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        document.addEventListener('mousedown', () => this.isMouseDown = true);
        document.addEventListener('mouseup', () => this.isMouseDown = false);
    }

    onMouseMove(event) {
        if (!this.isEditing || !this.isMouseDown) return;

        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        // Usar la cámara del engine
        this.raycaster.setFromCamera(this.mouse, this.engine.camera);
        const intersects = this.raycaster.intersectObject(this.terrain.mesh);

        if (intersects.length > 0) {
            this.modifyTerrain(intersects[0].point);
        }
    }

    modifyTerrain(point) {
        // Acceder a la geometría a través del mesh del terreno
        const geometry = this.terrain.mesh.geometry;
        const vertices = geometry.attributes.position.array;
        
        // Modificar vértices cercanos al punto
        for (let i = 0; i < vertices.length; i += 3) {
            const distance = Math.sqrt(
                Math.pow(vertices[i] - point.x, 2) + 
                Math.pow(vertices[i + 2] - point.z, 2)
            );

            if (distance < this.brushSize) {
                const influence = 1 - (distance / this.brushSize);
                vertices[i + 1] += this.brushStrength * influence;
            }
        }

        // Marcar los atributos de posición como necesitados de actualización
        geometry.attributes.position.needsUpdate = true;
        geometry.computeVertexNormals();
    }

    saveTerrain() {
        const geometry = this.terrain.mesh.geometry;
        const vertices = geometry.attributes.position.array;
        const heightData = [];
        
        // Convertir vértices a heightmap
        for (let i = 0; i < vertices.length; i += 3) {
            heightData.push(vertices[i + 1]);
        }

        // Guardar como JSON
        const blob = new Blob([JSON.stringify(heightData)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = 'terrain-heightmap.json';
        a.click();
    }
} 