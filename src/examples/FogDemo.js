import * as THREE from 'three';
import { Engine } from '../core/Engine.js';

export class FogDemo {
    constructor() {
        // Crear motor del juego
        this.engine = new Engine();
        
        // Variables para controlar la demostración
        this.time = 0;
        this.objects = [];
        this.dayNightCycle = false;
        
        // Inicializar la demostración
        this.initialize();
    }
    
    async initialize() {
        // Agregar luces
        this.addLights();
        
        // Agregar objetos a la escena para demostrar la niebla
        this.addObjects();
        
        // Crear interfaz de usuario básica para controlar la niebla
        this.createUI();
        
        // Iniciar bucle de renderizado
        this.animate();
    }
    
    addLights() {
        // Luz ambiental
        const ambientLight = new THREE.AmbientLight(0x404040, 1);
        this.engine.scene.add(ambientLight);
        
        // Luz direccional (sol)
        this.sunLight = new THREE.DirectionalLight(0xffffff, 1);
        this.sunLight.position.set(50, 100, 50);
        this.sunLight.castShadow = true;
        
        // Configurar sombras
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 500;
        this.sunLight.shadow.camera.left = -100;
        this.sunLight.shadow.camera.right = 100;
        this.sunLight.shadow.camera.top = 100;
        this.sunLight.shadow.camera.bottom = -100;
        
        this.engine.scene.add(this.sunLight);
    }
    
    addObjects() {
        // Crear suelo
        const groundGeometry = new THREE.PlaneGeometry(200, 200);
        const groundMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x556b2f,
            roughness: 0.8
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.5;
        ground.receiveShadow = true;
        this.engine.scene.add(ground);
        
        // Crear cubos distribuidos por el terreno
        const cubeGeometry = new THREE.BoxGeometry(5, 5, 5);
        
        for (let i = 0; i < 50; i++) {
            const x = Math.random() * 180 - 90;
            const z = Math.random() * 180 - 90;
            const y = 2;
            
            const material = new THREE.MeshStandardMaterial({
                color: new THREE.Color(Math.random() * 0.5 + 0.5, Math.random() * 0.5 + 0.5, Math.random() * 0.5 + 0.5),
                roughness: 0.7,
                metalness: 0.2
            });
            
            const cube = new THREE.Mesh(cubeGeometry, material);
            cube.position.set(x, y, z);
            cube.castShadow = true;
            cube.receiveShadow = true;
            
            this.objects.push(cube);
            this.engine.scene.add(cube);
        }
        
        // Crear árboles simplificados (conos)
        const treeGeometry = new THREE.ConeGeometry(3, 10, 8);
        const treeMaterial = new THREE.MeshStandardMaterial({ color: 0x2d4c1e });
        
        for (let i = 0; i < 60; i++) {
            const x = Math.random() * 190 - 95;
            const z = Math.random() * 190 - 95;
            const y = 4.5;
            
            const tree = new THREE.Mesh(treeGeometry, treeMaterial);
            tree.position.set(x, y, z);
            tree.castShadow = true;
            tree.receiveShadow = true;
            
            this.objects.push(tree);
            this.engine.scene.add(tree);
        }
    }
    
    createUI() {
        // Crear controles básicos
        const container = document.createElement('div');
        container.style.position = 'absolute';
        container.style.top = '10px';
        container.style.left = '10px';
        container.style.background = 'rgba(0, 0, 0, 0.5)';
        container.style.padding = '10px';
        container.style.borderRadius = '5px';
        container.style.color = 'white';
        container.style.fontFamily = 'Arial, sans-serif';
        document.body.appendChild(container);
        
        // Título
        const title = document.createElement('h3');
        title.textContent = 'Controles de Niebla Volumétrica';
        title.style.margin = '0 0 10px 0';
        container.appendChild(title);
        
        // Control de densidad
        const densityLabel = document.createElement('div');
        densityLabel.textContent = 'Densidad de la niebla: 0.015';
        container.appendChild(densityLabel);
        
        const densitySlider = document.createElement('input');
        densitySlider.type = 'range';
        densitySlider.min = '0';
        densitySlider.max = '0.05';
        densitySlider.step = '0.001';
        densitySlider.value = '0.015';
        densitySlider.style.width = '100%';
        container.appendChild(densitySlider);
        
        densitySlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            densityLabel.textContent = `Densidad de la niebla: ${value.toFixed(3)}`;
            this.engine.setFogDensity(value);
        });
        
        // Control de color
        const colorLabel = document.createElement('div');
        colorLabel.textContent = 'Color de la niebla:';
        colorLabel.style.marginTop = '10px';
        container.appendChild(colorLabel);
        
        const colorPicker = document.createElement('input');
        colorPicker.type = 'color';
        colorPicker.value = '#cccccc';
        colorPicker.style.width = '100%';
        container.appendChild(colorPicker);
        
        colorPicker.addEventListener('input', (e) => {
            const color = new THREE.Color(e.target.value);
            this.engine.setFogColor(color);
        });
        
        // Ciclo día/noche
        const cycleContainer = document.createElement('div');
        cycleContainer.style.marginTop = '10px';
        cycleContainer.style.display = 'flex';
        cycleContainer.style.alignItems = 'center';
        container.appendChild(cycleContainer);
        
        const cycleLabel = document.createElement('span');
        cycleLabel.textContent = 'Ciclo día/noche: ';
        cycleContainer.appendChild(cycleLabel);
        
        const cycleCheckbox = document.createElement('input');
        cycleCheckbox.type = 'checkbox';
        cycleCheckbox.checked = this.dayNightCycle;
        cycleContainer.appendChild(cycleCheckbox);
        
        cycleCheckbox.addEventListener('change', (e) => {
            this.dayNightCycle = e.target.checked;
        });
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Calcular delta time
        const now = Date.now();
        const deltaTime = (now - (this._lastTime || now)) / 1000;
        this._lastTime = now;
        
        // Actualizar tiempo global
        this.time += deltaTime;
        
        // Actualizar objetos (rotación simple)
        this.objects.forEach((obj, index) => {
            obj.rotation.y = this.time * 0.2 * ((index % 5) + 1) / 5;
        });
        
        // Ciclo día/noche
        if (this.dayNightCycle) {
            const dayNightCycle = (Math.sin(this.time * 0.1) + 1) / 2;
            
            // Actualizar color del cielo
            const skyColor = new THREE.Color().setHSL(0.6, 0.8, dayNightCycle * 0.5 + 0.1);
            this.engine.scene.background = skyColor;
            
            // Actualizar intensidad del sol
            this.sunLight.intensity = dayNightCycle * 0.8 + 0.2;
            
            // Actualizar posición del sol
            const sunAngle = this.time * 0.1;
            this.sunLight.position.set(
                Math.sin(sunAngle) * 150,
                Math.cos(sunAngle) * 100 + 50,
                Math.cos(sunAngle) * 150
            );
            
            // Actualizar color de la niebla según la hora del día
            const fogColor = new THREE.Color().setHSL(
                0.6,  // Tono azulado
                0.4,  // Saturación
                dayNightCycle * 0.5 + 0.2  // Luminosidad
            );
            this.engine.setFogColor(fogColor);
        }
        
        // Actualizar el motor
        this.engine.update(deltaTime);
        this.engine.render();
    }
} 