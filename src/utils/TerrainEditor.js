import * as THREE from 'three';

export class TerrainEditor {
    constructor(terrain, engine) {
        this.terrain = terrain;
        this.engine = engine;
        this.isEditing = false;
        this.brushSize = 10;
        this.brushStrength = 0.5;
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        // Inicializar UI
        this.initializeUI();
    }

    initializeUI() {
        // Obtener referencia al contenedor del editor
        this.container = document.getElementById('terrain-editor');
        
        if (!this.container) {
            console.error('No se encontró el contenedor del editor de terreno en el HTML');
            return;
        }
        
        // Configurar escuchadores de eventos
        this.setupListeners();
    }

    setupListeners() {
        const editButton = document.getElementById('edit-mode');
        if (!editButton) {
            console.error('No se encontró el botón de modo edición');
            return;
        }
        
        editButton.addEventListener('click', () => {
            this.isEditing = !this.isEditing;
            editButton.textContent = this.isEditing ? 'Salir Edición' : 'Modo Edición';
            this.container.classList.toggle('active', this.isEditing);
        });

        const brushSizeSlider = document.getElementById('brush-size-slider');
        if (brushSizeSlider) {
            brushSizeSlider.addEventListener('input', (e) => {
                this.brushSize = parseInt(e.target.value);
                const brushSizeDisplay = document.getElementById('brush-size');
                if (brushSizeDisplay) {
                    brushSizeDisplay.textContent = this.brushSize;
                }
            });
        }

        const brushStrengthSlider = document.getElementById('brush-strength-slider');
        if (brushStrengthSlider) {
            brushStrengthSlider.addEventListener('input', (e) => {
                this.brushStrength = parseFloat(e.target.value);
                const brushStrengthDisplay = document.getElementById('brush-strength');
                if (brushStrengthDisplay) {
                    brushStrengthDisplay.textContent = this.brushStrength;
                }
            });
        }

        const saveButton = document.getElementById('save-terrain');
        if (saveButton) {
            saveButton.addEventListener('click', () => {
                this.saveTerrain();
            });
        }

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