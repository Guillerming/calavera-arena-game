import * as THREE from 'three';
import { CameraController } from './CameraController.js';

export class Engine {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer();
        this.cameraController = new CameraController(this.camera);
        
        this.init();
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);
        
        // Configuración básica de la escena
        this.scene.background = new THREE.Color(0x87ceeb); // Color cielo
        this.camera.position.set(0, 5, 10);
        
        // Manejo de redimensionamiento
        window.addEventListener('resize', () => this.onWindowResize());
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    setPlayerTarget(player) {
        this.cameraController.setTarget(player);
    }

    update(deltaTime, inputManager) {
        this.cameraController.update(deltaTime, inputManager);
        this.renderer.render(this.scene, this.camera);
    }
} 