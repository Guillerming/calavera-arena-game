import * as THREE from 'three';
import { CameraController } from './CameraController.js';

export class Engine {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.cameraController = new CameraController(this.camera);
        
        this.init();
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);
        
        // Configuración de sombras
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Configuración básica de la escena
        this.scene.background = new THREE.Color(0x87ceeb); // Color cielo
        this.camera.position.set(0, 20, 40); // Posición más elevada y alejada
        this.camera.lookAt(0, 0, 0);
        
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

    update(deltaTime = 0.016, inputManager = null) {
        this.cameraController.update(deltaTime, inputManager);
    }
    
    render() {
        this.renderer.render(this.scene, this.camera);
    }
} 