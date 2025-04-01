import * as THREE from 'three';
import { CameraController } from './CameraController.js';
import { VolumetricFog } from '../world/Fog.js';

export class Engine {
    constructor() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.cameraController = new CameraController(this.camera);
        this.fog = null;
        
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
        
        // Inicializar niebla volumétrica
        this.initFog();
        
        // Manejo de redimensionamiento
        window.addEventListener('resize', () => this.onWindowResize());
    }
    
    // Inicializar la niebla volumétrica
    async initFog() {
        try {
            console.log("[Engine] Inicializando niebla volumétrica...");
            
            // Opciones de configuración para la niebla
            const fogOptions = {
                fogColor: new THREE.Color(0xcccccc),
                fogDensity: 0.015,
                noiseScale: 0.08,
                noiseSpeed: 0.04,
                fogStart: 20,
                fogEnd: 100,
                staticColor: false,
                numLayers: 50,         // Muchas más capas iniciales
                maxLayers: 300,        // Permitir cientos de capas simultáneas
                mapLimits: {           // Límites del mapa - niebla solo aparecerá aquí
                    minX: -200,
                    maxX: 200,
                    minZ: -200, 
                    maxZ: 200
                },
                boundaryBehavior: 'bounce'  // Comportamiento en los límites
            };
            
            // Comprobar si hay un juego con límites de mapa definidos
            if (this.scene && this.scene.game && this.scene.game.mapLimits) {
                fogOptions.mapLimits = this.scene.game.mapLimits;
            }
            
            // Crear la niebla volumétrica
            this.fog = new VolumetricFog(this.scene, this.camera, fogOptions);
            console.log('[Engine] Niebla volumétrica inicializada correctamente');
        } catch (error) {
            console.error('[Engine] Error al inicializar la niebla volumétrica:', error);
            // Crear una niebla simple como fallback
            this.scene.fog = new THREE.FogExp2(0xcccccc, 0.01);
        }
    }
    
    // Método para controlar la niebla
    setFogDensity(density) {
        if (this.fog) {
            this.fog.setDensity(density);
        }
    }
    
    setFogColor(color) {
        if (this.fog) {
            this.fog.setColor(color);
        }
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    setPlayerTarget(player) {
        this.cameraController.setTarget(player);
    }

    getCameraController() {
        return this.cameraController;
    }

    update(deltaTime = 0.016, inputManager = null) {
        this.cameraController.update(deltaTime, inputManager);
        
        // Actualizar la niebla volumétrica
        if (this.fog) {
            this.fog.update(deltaTime);
        }
    }
    
    render() {
        this.renderer.render(this.scene, this.camera);
    }

    // Configurar la referencia al juego para que los componentes puedan acceder a él
    setGame(game) {
        this.game = game;
        
        // Añadir referencia al juego en la escena para que sea accesible desde los componentes
        if (this.scene) {
            this.scene.game = game;
        }
    }
} 