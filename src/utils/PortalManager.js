import * as THREE from 'three';

export class PortalManager {
    constructor(game) {
        this.game = game;
        this.scene = game.engine.scene;
        this.camera = game.engine.camera;
        this.networkManager = game.networkManager;
        
        this.startPortal = null;
        this.exitPortal = null;
        this.startPortalBox = null;
        this.exitPortalBox = null;
        
        // Propiedades para la animación
        this.animationTime = 0;
    }
    
    // Inicializar los portales
    init() {
        // Comprobar si el jugador viene a través de un portal
        const urlParams = new URLSearchParams(window.location.search);
        const comesFromPortal = urlParams.get('portal') === 'true';
        const refUrl = urlParams.get('ref');
        
        // Crear portal de salida siempre (a Vibeverse)
        this.createExitPortal();
        
        // Crear portal de entrada solo si el jugador viene de otro juego
        if (comesFromPortal && refUrl) {
            this.createStartPortal(refUrl);
        }
    }
    
    // Crear un portal mesh
    createPortalMesh(radius = 6, color = 0xff0000, options = {}) {
        // Crear contenedor principal
        const portal = new THREE.Group();
        
        // Crear el anillo del portal
        const tubeRadius = radius * 0.1;
        const ringGeometry = new THREE.TorusGeometry(radius, tubeRadius, 16, 100);
        const ringMaterial = new THREE.MeshPhongMaterial({
            color: color,
            emissive: color,
            transparent: true,
            opacity: 0.8,
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        portal.add(ring);
        
        // Crear superficie interior del portal
        const innerRadius = radius * 0.9;
        const innerGeometry = new THREE.CircleGeometry(innerRadius, 32);
        const innerMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.5,
            side: THREE.DoubleSide,
        });
        const inner = new THREE.Mesh(innerGeometry, innerMaterial);
        portal.add(inner);
        
        // Crear sistema de partículas para efecto del portal
        const particleCount = 500;
        const particlesGeometry = new THREE.BufferGeometry();
        const particlePositions = new Float32Array(particleCount * 3);
        const particleColors = new Float32Array(particleCount * 3);
        
        for (let i = 0; i < particleCount * 3; i += 3) {
            // Crear partículas en un anillo alrededor del portal
            const angle = Math.random() * Math.PI * 2;
            const particleRadius = radius + (Math.random() - 0.5) * (radius * 0.15);
            
            // Posicionar partículas en un anillo en el mismo plano que el portal
            particlePositions[i] = Math.cos(angle) * particleRadius;     // x
            particlePositions[i + 1] = Math.sin(angle) * particleRadius; // y
            particlePositions[i + 2] = (Math.random() - 0.5) * (radius * 0.15); // z
            
            // Establecer color con ligera variación
            if (color === 0xff0000) {
                // Portal rojo (entrada)
                particleColors[i] = 0.8 + Math.random() * 0.2;
                particleColors[i + 1] = 0;
                particleColors[i + 2] = 0;
            } else {
                // Portal verde (salida)
                particleColors[i] = 0;
                particleColors[i + 1] = 0.8 + Math.random() * 0.2;
                particleColors[i + 2] = 0;
            }
        }
        
        particlesGeometry.setAttribute(
            'position',
            new THREE.BufferAttribute(particlePositions, 3)
        );
        particlesGeometry.setAttribute(
            'color',
            new THREE.BufferAttribute(particleColors, 3)
        );
        
        const particleMaterial = new THREE.PointsMaterial({
            size: radius * 0.03,
            vertexColors: true,
            transparent: true,
            opacity: 0.6,
        });
        
        const particles = new THREE.Points(particlesGeometry, particleMaterial);
        portal.add(particles);
        
        // Guardar datos para la animación
        portal.userData = {
            particlesGeometry: particlesGeometry,
            type: color === 0xff0000 ? 'entrance' : 'exit',
        };
        
        // Texto por defecto según el tipo de portal
        const defaultLabelText = portal.userData.type === 'entrance' 
            ? 'Return to previous game' 
            : 'Vibeverse Portal';
        
        // Obtener texto de la etiqueta
        const labelText = options.labelText || defaultLabelText;
        
        // Crear etiqueta con canvas
        if (labelText) {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (!context) return portal;
            
            canvas.width = 512;
            canvas.height = 128;  // Aumentar altura para texto más grande
            
            // Color según el tipo de portal
            const labelColor = options.labelColor || (color === 0xff0000 ? '#ff0000' : '#00ff00');
            
            context.fillStyle = labelColor;
            context.font = 'bold 48px Arial';  // Aumentar tamaño de fuente
            context.textAlign = 'center';
            context.fillText(labelText, canvas.width / 2, canvas.height / 2);
            
            const texture = new THREE.CanvasTexture(canvas);
            const labelMaterial = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                side: THREE.DoubleSide,
            });
            
            const labelGeometry = new THREE.PlaneGeometry(radius * 2.5, radius * 0.4);  // Hacer la etiqueta más grande
            const label = new THREE.Mesh(labelGeometry, labelMaterial);
            
            // Posicionar la etiqueta encima del portal
            label.position.y = radius * 1.2;
            label.rotation.x = -Math.PI / 6; // Inclinar para mejor visibilidad
            
            portal.add(label);
        }
        
        // Orientar el portal correctamente - perpendicular al suelo
        // No necesitamos rotar el anillo principal, ya que por defecto está en el plano XY,
        // lo que ya lo hace vertical en el mundo 3D
        
        return portal;
    }
    
    // Crear portal de entrada (para volver al juego anterior)
    createStartPortal(refUrl) {
        // Posicionar en una esquina del mapa
        const x = -150;  // Esquina negativa del mapa
        const y = 3;     // Altura reducida sobre el nivel del agua
        const z = -150;  // Esquina negativa del mapa
        
        // Crear el portal con opciones personalizadas
        const portal = this.createPortalMesh(6, 0xff0000, {
            labelText: 'Return to previous game',
            labelColor: '#ff5555',
        });
        
        // Posicionar el portal
        portal.position.set(x, y, z);
        
        // Rotar el portal para que mire hacia el centro del mapa
        // Calcular ángulo para mirar hacia el centro (0,0,0)
        const angleToCenter = Math.atan2(-z, -x); // Dirección hacia el centro
        portal.rotation.y = angleToCenter;
        
        // Añadir al mundo
        this.scene.add(portal);
        
        // Guardar la URL de referencia
        portal.userData.refUrl = refUrl;
        
        // Crear caja de colisión
        this.startPortalBox = new THREE.Box3().setFromObject(portal);
        
        // Guardar referencia
        this.startPortal = portal;
        
        return portal;
    }
    
    // Crear portal de salida (hacia Vibeverse)
    createExitPortal() {
        // Posicionar en otra esquina del mapa
        const x = 150;   // Esquina positiva del mapa
        const y = 3;     // Altura reducida sobre el nivel del agua
        const z = 150;   // Esquina positiva del mapa
        
        // Crear el portal con opciones personalizadas
        const portal = this.createPortalMesh(6, 0x00ff00, {
            labelText: 'Vibeverse Portal',
            labelColor: '#55ff55',
        });
        
        // Posicionar el portal
        portal.position.set(x, y, z);
        
        // Rotar el portal para que mire hacia el centro del mapa
        // Calcular ángulo para mirar hacia el centro (0,0,0)
        const angleToCenter = Math.atan2(-z, -x); // Dirección hacia el centro
        portal.rotation.y = angleToCenter;
        
        // Añadir al mundo
        this.scene.add(portal);
        
        // Crear caja de colisión
        this.exitPortalBox = new THREE.Box3().setFromObject(portal);
        
        // Guardar referencia
        this.exitPortal = portal;
        
        return portal;
    }
    
    // Animar partículas de los portales
    animatePortals(deltaTime) {
        this.animationTime += deltaTime;
        
        // Animar portal de entrada
        if (this.startPortal && this.startPortal.userData) {
            const particlesGeometry = this.startPortal.userData.particlesGeometry;
            if (particlesGeometry) {
                const positions = particlesGeometry.attributes.position.array;
                
                for (let i = 0; i < positions.length; i += 3) {
                    positions[i + 2] = Math.sin(this.animationTime * 2 + i) * 0.3;
                }
                
                particlesGeometry.attributes.position.needsUpdate = true;
            }
        }
        
        // Animar portal de salida
        if (this.exitPortal && this.exitPortal.userData) {
            const particlesGeometry = this.exitPortal.userData.particlesGeometry;
            if (particlesGeometry) {
                const positions = particlesGeometry.attributes.position.array;
                
                for (let i = 0; i < positions.length; i += 3) {
                    positions[i + 2] = Math.sin(this.animationTime * 2 + i) * 0.3;
                }
                
                particlesGeometry.attributes.position.needsUpdate = true;
            }
        }
    }
    
    // Comprobar colisiones con los portales
    checkPortalCollisions() {
        if (!this.game.player) return;
        
        // Posición del jugador local
        const player = this.game.player;
        const playerPosition = new THREE.Vector3(
            player.position.x,
            player.position.y,
            player.position.z
        );
        
        // Comprobar colisión con el portal de entrada
        if (this.startPortalBox && this.startPortal) {
            // Actualizar la caja de colisión
            this.startPortalBox.setFromObject(this.startPortal);
            
            // Expandir ligeramente para mejor detección
            const expandedStartBox = this.startPortalBox.clone().expandByScalar(2);
            if (expandedStartBox.containsPoint(playerPosition)) {
                this.handleStartPortalEntry();
            }
        }
        
        // Comprobar colisión con el portal de salida
        if (this.exitPortalBox && this.exitPortal) {
            // Actualizar la caja de colisión
            this.exitPortalBox.setFromObject(this.exitPortal);
            
            // Expandir ligeramente para mejor detección
            const expandedExitBox = this.exitPortalBox.clone().expandByScalar(2);
            if (expandedExitBox.containsPoint(playerPosition)) {
                this.handleExitPortalEntry();
            }
        }
    }
    
    // Manejar entrada al portal de inicio
    handleStartPortalEntry() {
        if (!this.startPortal || !this.startPortal.userData.refUrl) return;
        
        // Obtener URL de referencia
        let url = this.startPortal.userData.refUrl;
        
        // Asegurar que la URL tiene protocolo
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }
        
        // Conservar todos los parámetros excepto 'ref'
        const currentParams = new URLSearchParams(window.location.search);
        const newParams = new URLSearchParams();
        
        for (const [key, value] of currentParams) {
            if (key !== 'ref') {
                newParams.append(key, value);
            }
        }
        
        const paramString = newParams.toString();
        
        // Redirigir al juego anterior
        window.location.href = url + (paramString ? '?' + paramString : '');
    }
    
    // Manejar entrada al portal de salida
    handleExitPortalEntry() {
        // Crear parámetros para la siguiente página
        const currentParams = new URLSearchParams(window.location.search);
        const newParams = new URLSearchParams();
        
        // Marcar que viene desde un portal
        newParams.append('portal', 'true');
        
        // Añadir nombre del jugador
        if (this.game.player) {
            const playerName = this.game.player.name || 'Jugador';
            newParams.append('username', playerName);
        }
        
        // Color del jugador (podría ser personalizable)
        newParams.append('color', 'white');
        
        // Velocidad del jugador
        if (this.game.player && this.game.player.maxSpeed) {
            newParams.append('speed', this.game.player.maxSpeed);
        }
        
        // URL de referencia para volver a este juego
        newParams.append('ref', window.location.hostname + window.location.pathname);
        
        // Copiar otros parámetros
        for (const [key, value] of currentParams) {
            if (!newParams.has(key)) {
                newParams.append(key, value);
            }
        }
        
        const paramString = newParams.toString();
        const nextPage = 'https://portal.pieter.com' + (paramString ? '?' + paramString : '');
        
        // Redirigir a Vibeverse
        window.location.href = nextPage;
    }
    
    // Actualizar el estado de los portales
    update(deltaTime) {
        // Animar partículas
        this.animatePortals(deltaTime);
        
        // Comprobar colisiones
        this.checkPortalCollisions();
    }
} 