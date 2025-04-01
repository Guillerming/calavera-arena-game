import * as THREE from 'three';

export class VolumetricFog {
    constructor(scene, camera, options = {}) {
        this.scene = scene;
        this.camera = camera;
        
        // Opciones por defecto
        this.options = {
            fogColor: options.fogColor || new THREE.Color(0xcccccc),
            fogDensity: options.fogDensity || 0.025,
            noiseScale: options.noiseScale || 0.1,
            noiseSpeed: options.noiseSpeed || 0.05,
            fogStart: options.fogStart || 10,
            fogEnd: options.fogEnd || 100,
            staticColor: options.staticColor || false,
            numLayers: options.numLayers ?? 50,        // ¡Mucho más elementos iniciales!
            maxLayers: options.maxLayers ?? 300,       // Permitir muchas más capas
            // Límites del mapa (valores por defecto)
            mapLimits: options.mapLimits ?? {
                minX: -200,
                maxX: 200,
                minZ: -200,
                maxZ: 200
            },
            // Comportamiento en los límites: 'bounce' o 'fade'
            boundaryBehavior: options.boundaryBehavior ?? 'bounce'
        };
        
        this.time = 0;
        this.fogMeshes = [];
        this.noiseTexture = null;
        this.nextLayerTime = 0;
        this.layerCreationInterval = 0.5; // Crear nuevos elementos mucho más rápido (cada 0.5 segundos)
        
        // Inicializar
        this._initialize();
    }
    
    async _initialize() {
        // Crear textura de ruido para hacer la niebla dinámica
        await this._createNoiseTexture();
        
        // Crear material base para la niebla
        this.fogMaterial = this._createFogMaterial();
        
        // Inicializar con algunas capas de niebla
        for (let i = 0; i < this.options.numLayers; i++) {
            this._createFogLayer(true);
        }
    }
    
    _createFogMaterial() {
        // Crear material con shaders para la niebla volumétrica
        return new THREE.ShaderMaterial({
            uniforms: {
                fogColor: { value: this.options.fogColor.clone() },
                fogDensity: { value: this.options.fogDensity },
                noiseTexture: { value: this.noiseTexture },
                noiseScale: { value: this.options.noiseScale },
                noiseSpeed: { value: this.options.noiseSpeed },
                fogStart: { value: this.options.fogStart },
                fogEnd: { value: this.options.fogEnd },
                time: { value: 0.0 },
                opacity: { value: 1.0 },
                useGradient: { value: 1.0 },
                heightFactor: { value: 1.0 }
            },
            vertexShader: `
                varying vec3 vPosition;
                varying vec3 vWorldPosition;
                varying vec2 vUv;
                
                void main() {
                    vPosition = position;
                    vUv = uv;
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 fogColor;
                uniform float fogDensity;
                uniform sampler2D noiseTexture;
                uniform float noiseScale;
                uniform float noiseSpeed;
                uniform float fogStart;
                uniform float fogEnd;
                uniform float time;
                uniform float opacity;
                uniform float useGradient;
                uniform float heightFactor;
                
                varying vec3 vPosition;
                varying vec3 vWorldPosition;
                varying vec2 vUv;
                
                // Función para obtener valor de ruido del sampler 2D
                float getNoise(vec3 pos) {
                    // Usar tiempo para animar el ruido
                    float nx = pos.x * noiseScale + time * noiseSpeed;
                    float ny = pos.y * noiseScale + time * noiseSpeed * 0.5;
                    float nz = pos.z * noiseScale + time * noiseSpeed * 0.3;
                    
                    // Combinar coordenadas para usar textura 2D
                    vec2 noiseCoord1 = vec2(nx, ny + nz);
                    vec2 noiseCoord2 = vec2(ny, nz + nx);
                    
                    // Combinar múltiples muestras de ruido para efecto más complejo
                    float noise1 = texture2D(noiseTexture, noiseCoord1).r;
                    float noise2 = texture2D(noiseTexture, noiseCoord2).r;
                    
                    return (noise1 * 0.7 + noise2 * 0.3);
                }
                
                void main() {
                    // Calcular distancia desde la cámara
                    float dist = length(vWorldPosition - cameraPosition);
                    
                    // Añadir ruido a la densidad de la niebla
                    float noise = getNoise(vWorldPosition);
                    
                    // Calcular degradado vertical - más suave en la parte superior
                    float heightGradient = 1.0;
                    if (useGradient > 0.5) {
                        // Degradado más acentuado para nubes bajas
                        heightGradient = smoothstep(0.0, 0.7, vUv.y * heightFactor);
                        // Suavizar la parte superior para mejor efecto de nube
                        heightGradient *= (1.0 - smoothstep(0.8, 1.0, vUv.y));
                    }
                    
                    // Factor para los bordes - más difuminado
                    float edgeFactor = smoothstep(0.0, 0.4, vUv.x) * smoothstep(0.0, 0.4, 1.0 - vUv.x) *
                                     smoothstep(0.0, 0.4, vUv.y) * smoothstep(0.0, 0.4, 1.0 - vUv.y);
                    
                    // Aplicar densidad variable basada en la distancia
                    float fogFactor = exp(-dist * fogDensity * (1.0 + noise * 0.4));
                    
                    // Calcular variación de altura para efecto de ondas
                    float waveEffect = sin(vWorldPosition.x * 0.05 + time * 0.2) * 0.2 + 
                                      cos(vWorldPosition.z * 0.05 + time * 0.3) * 0.2;
                    
                    // Calcular opacidad final con todos los factores
                    float finalOpacity = (1.0 - fogFactor) * 
                                        noise * 
                                        heightGradient * 
                                        edgeFactor * 
                                        opacity * 
                                        (1.0 + waveEffect * 0.3);
                    
                    // Calculo de color final
                    gl_FragColor = vec4(fogColor, finalOpacity);
                }
            `,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide // Importante: hacer visible desde ambos lados
        });
    }
    
    _createFogLayer(isInitial = false) {
        if (this.fogMeshes.length >= this.options.maxLayers) {
            return; // Limitar el número máximo de capas
        }
        
        // Clonar el material para esta capa específica
        const material = this.fogMaterial.clone();
        
        // Dimensiones aleatorias para la capa - hacerlas más anchas que altas para efecto nube
        const width = 100 + Math.random() * 300; // Nubes más anchas
        const height = 2 + Math.random() * 5;    // Altura más baja (2-7 unidades)
        
        // Crear geometría de plano para una capa de niebla
        const geometry = new THREE.PlaneGeometry(width, height, 16, 16);
        
        // Crear malla para la capa de niebla
        const fogMesh = new THREE.Mesh(geometry, material);
        
        // Posicionar la capa dentro de los límites del mapa
        let posX, posZ;
        
        // Obtener los límites del mapa
        const { minX, maxX, minZ, maxZ } = this.options.mapLimits;
        
        if (isInitial) {
            // Para capas iniciales, distribuir por todo el mapa pero siempre dentro de los límites
            const paddingX = width / 2;  // Mantener cierta distancia del borde para que la niebla no se corte
            const paddingZ = width / 2;
            
            posX = minX + paddingX + Math.random() * (maxX - minX - paddingX * 2);
            posZ = minZ + paddingZ + Math.random() * (maxZ - minZ - paddingZ * 2);
        } else {
            // Para nuevas capas que se crean durante el juego, generarlas en los bordes
            // para que parezca que la niebla viene de fuera del mapa hacia dentro
            const side = Math.floor(Math.random() * 4); // 0: arriba, 1: derecha, 2: abajo, 3: izquierda
            const paddingFromEdge = 50; // Distancia desde la que aparecen las nuevas capas
            
            switch (side) {
                case 0: // Arriba (norte)
                    posX = minX + Math.random() * (maxX - minX);
                    posZ = maxZ - paddingFromEdge;
                    break;
                case 1: // Derecha (este)
                    posX = maxX - paddingFromEdge;
                    posZ = minZ + Math.random() * (maxZ - minZ);
                    break;
                case 2: // Abajo (sur)
                    posX = minX + Math.random() * (maxX - minX);
                    posZ = minZ + paddingFromEdge;
                    break;
                case 3: // Izquierda (oeste)
                    posX = minX + paddingFromEdge;
                    posZ = minZ + Math.random() * (maxZ - minZ);
                    break;
            }
        }
        
        fogMesh.position.set(posX, Math.random() * 4, posZ);
        
        // Rotación aleatoria - mantener casi horizontal
        fogMesh.rotation.y = Math.random() * Math.PI * 2;
        fogMesh.rotation.x = (Math.random() * 0.1) - 0.05; // Ligera rotación en X
        
        // Propiedades específicas de la capa
        fogMesh.userData = {
            // Velocidad de desplazamiento - dirigida hacia el centro del mapa si es una nueva capa
            velocityX: isInitial ? 
                      (Math.random() * 2 - 1) * 2.0 : 
                      ((0 - posX) / Math.abs(posX) || 0) * (1 + Math.random()),
            velocityY: (Math.random() * 0.1 - 0.05) * 0.1, // Movimiento vertical mínimo
            velocityZ: isInitial ? 
                      (Math.random() * 2 - 1) * 2.0 : 
                      ((0 - posZ) / Math.abs(posZ) || 0) * (1 + Math.random()),
            
            // Velocidad de rotación - muy lenta
            rotationSpeed: (Math.random() * 0.01 - 0.005) * 0.3,
            
            // Propiedades de animación
            opacityTarget: 0.3 + Math.random() * 0.3, // Menor opacidad para que no quede saturado
            opacityCurrent: 0.0, // Inicia invisible y aparece gradualmente
            opacitySpeed: 0.3 + Math.random() * 0.7,
            
            // Factor de altura para el gradiente
            heightFactor: 0.7 + Math.random() * 0.4,
            
            // Tiempo de vida
            lifetime: isInitial ? (20 + Math.random() * 20) : (15 + Math.random() * 15), // Vidas más cortas
            age: 0,
            
            // Estado de la capa
            state: 'growing' // 'growing', 'stable', 'fading'
        };
        
        // Aplicar propiedades iniciales a los uniforms
        material.uniforms.opacity.value = fogMesh.userData.opacityCurrent;
        material.uniforms.heightFactor.value = fogMesh.userData.heightFactor;
        
        // Decidir si usar degradado
        material.uniforms.useGradient.value = Math.random() > 0.2 ? 1.0 : 0.0;
        
        // Si se quiere un color estático (gris/blanco)
        if (this.options.staticColor) {
            const greyValue = 0.7 + Math.random() * 0.3; // Valor entre 0.7 y 1.0 (gris claro a blanco)
            material.uniforms.fogColor.value.set(greyValue, greyValue, greyValue);
        } 
        // Si no, asignar un color ligeramente variado del color base
        else {
            const baseColor = this.options.fogColor.clone();
            // Pequeña variación de color
            baseColor.r += (Math.random() * 0.1 - 0.05);
            baseColor.g += (Math.random() * 0.1 - 0.05);
            baseColor.b += (Math.random() * 0.1 - 0.05);
            material.uniforms.fogColor.value.copy(baseColor);
        }
        
        // Añadir la capa a la escena
        this.scene.add(fogMesh);
        this.fogMeshes.push(fogMesh);
        
        return fogMesh;
    }
    
    _removeFogLayer(index) {
        if (index >= 0 && index < this.fogMeshes.length) {
            const mesh = this.fogMeshes[index];
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
            this.fogMeshes.splice(index, 1);
        }
    }
    
    async _createNoiseTexture() {
        // Crear textura de ruido para la niebla dinámica
        const size = 256;
        const data = new Uint8Array(size * size * 4);
        
        // Generar un patrón de ruido de Perlin simplificado
        for (let i = 0; i < size; i++) {
            for (let j = 0; j < size; j++) {
                const idx = (i * size + j) * 4;
                
                // Ruido de Perlin simplificado con mayor detalle
                const x = i / size;
                const y = j / size;
                
                // Usar múltiples frecuencias para un ruido más natural
                const n1 = this._simplexNoise(x * 4, y * 4) * 0.5;
                const n2 = this._simplexNoise(x * 8, y * 8) * 0.25;
                const n3 = this._simplexNoise(x * 16, y * 16) * 0.125;
                const n4 = this._simplexNoise(x * 32, y * 32) * 0.0625;
                
                const n = n1 + n2 + n3 + n4;
                
                const value = Math.floor((n * 0.5 + 0.5) * 255);
                
                data[idx] = value;     // R
                data[idx + 1] = value; // G
                data[idx + 2] = value; // B
                data[idx + 3] = 255;   // A
            }
        }
        
        this.noiseTexture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
        this.noiseTexture.wrapS = THREE.RepeatWrapping;
        this.noiseTexture.wrapT = THREE.RepeatWrapping;
        this.noiseTexture.needsUpdate = true;
    }
    
    // Una función simple de ruido (no es Perlin real, pero sirve para nuestro propósito)
    _simplexNoise(x, y) {
        // Se puede mejorar para un ruido más natural
        const dot = x * 12.9898 + y * 78.233;
        const sin = Math.sin(dot) * 43758.5453;
        return sin - Math.floor(sin);
    }
    
    // Actualizar la niebla en cada frame
    update(deltaTime = 0.016) {
        this.time += deltaTime;
        
        // Controlar creación de nuevas capas de niebla
        this.nextLayerTime -= deltaTime;
        if (this.nextLayerTime <= 0) {
            this._createFogLayer();
            this.nextLayerTime = this.layerCreationInterval;
        }
        
        // Obtener los límites del mapa
        const { minX, maxX, minZ, maxZ } = this.options.mapLimits;
        const bounceMode = this.options.boundaryBehavior === 'bounce';
        
        // Actualizar todas las capas de niebla
        for (let i = this.fogMeshes.length - 1; i >= 0; i--) {
            const fogMesh = this.fogMeshes[i];
            const userData = fogMesh.userData;
            
            // Actualizar edad de la capa
            userData.age += deltaTime;
            
            // Gestionar el estado de la capa según su edad
            if (userData.age > userData.lifetime - 10 && userData.state !== 'fading') {
                userData.state = 'fading';
            } else if (userData.age > 5 && userData.state === 'growing') {
                userData.state = 'stable';
            }
            
            // Gestionar la opacidad según el estado
            if (userData.state === 'growing') {
                userData.opacityCurrent += userData.opacitySpeed * deltaTime;
                if (userData.opacityCurrent > userData.opacityTarget) {
                    userData.opacityCurrent = userData.opacityTarget;
                }
            } else if (userData.state === 'fading') {
                userData.opacityCurrent -= userData.opacitySpeed * deltaTime;
                if (userData.opacityCurrent < 0) {
                    userData.opacityCurrent = 0;
                    this._removeFogLayer(i);
                    continue;
                }
            }
            
            // Mover la capa
            fogMesh.position.x += userData.velocityX * deltaTime;
            fogMesh.position.y += userData.velocityY * deltaTime;
            fogMesh.position.z += userData.velocityZ * deltaTime;
            
            // Verificar y ajustar la posición para mantenerla dentro de los límites del mapa
            const width = fogMesh.geometry.parameters.width / 2;  // Mitad del ancho de la capa
            
            // Calcular los límites reales considerando el tamaño de la capa
            const effectiveMinX = minX + width;
            const effectiveMaxX = maxX - width;
            const effectiveMinZ = minZ + width;
            const effectiveMaxZ = maxZ - width;
            
            // Comprobar si se está saliendo del mapa
            if (fogMesh.position.x < effectiveMinX || fogMesh.position.x > effectiveMaxX ||
                fogMesh.position.z < effectiveMinZ || fogMesh.position.z > effectiveMaxZ) {
                
                // Si está configurado para rebotar en los bordes o es una capa joven en modo de rebote
                if (bounceMode || (this.options.boundaryBehavior === 'mixed' && userData.age < userData.lifetime * 0.5)) {
                    // Rebotar en los bordes
                    if (fogMesh.position.x < effectiveMinX) {
                        fogMesh.position.x = effectiveMinX;
                        userData.velocityX = Math.abs(userData.velocityX) * (0.8 + Math.random() * 0.4);
                    } else if (fogMesh.position.x > effectiveMaxX) {
                        fogMesh.position.x = effectiveMaxX;
                        userData.velocityX = -Math.abs(userData.velocityX) * (0.8 + Math.random() * 0.4);
                    }
                    
                    if (fogMesh.position.z < effectiveMinZ) {
                        fogMesh.position.z = effectiveMinZ;
                        userData.velocityZ = Math.abs(userData.velocityZ) * (0.8 + Math.random() * 0.4);
                    } else if (fogMesh.position.z > effectiveMaxZ) {
                        fogMesh.position.z = effectiveMaxZ;
                        userData.velocityZ = -Math.abs(userData.velocityZ) * (0.8 + Math.random() * 0.4);
                    }
                } 
                // Si está configurado para desvanecerse
                else {
                    if (userData.state !== 'fading') {
                        userData.state = 'fading';
                        userData.opacitySpeed *= 1.5; // Desvanecer más rápidamente
                    }
                }
            }
            
            // Mantener la niebla cerca del suelo si se eleva demasiado
            if (fogMesh.position.y > 10) {
                fogMesh.position.y = 10;
                userData.velocityY = -Math.abs(userData.velocityY); // Forzar movimiento hacia abajo
            } else if (fogMesh.position.y < 0) {
                fogMesh.position.y = 0;
                userData.velocityY = Math.abs(userData.velocityY); // Forzar movimiento hacia arriba
            }
            
            // Rotación suave
            fogMesh.rotation.y += userData.rotationSpeed * deltaTime;
            
            // Actualizar uniforms
            if (fogMesh.material.uniforms) {
                fogMesh.material.uniforms.time.value = this.time;
                fogMesh.material.uniforms.opacity.value = userData.opacityCurrent;
            }
        }
    }
    
    // Métodos para controlar la niebla
    setDensity(density) {
        this.options.fogDensity = density;
        
        // Actualizar todas las capas
        for (const fogMesh of this.fogMeshes) {
            if (fogMesh.material && fogMesh.material.uniforms) {
                fogMesh.material.uniforms.fogDensity.value = density;
            }
        }
        
        // Actualizar el material base para futuras capas
        if (this.fogMaterial && this.fogMaterial.uniforms) {
            this.fogMaterial.uniforms.fogDensity.value = density;
        }
    }
    
    setColor(color) {
        this.options.fogColor.copy(color);
        
        // Solo actualizar el color si no está en modo de color estático
        if (!this.options.staticColor) {
            // Actualizar el material base para futuras capas
            if (this.fogMaterial && this.fogMaterial.uniforms) {
                this.fogMaterial.uniforms.fogColor.value.copy(color);
            }
        }
    }
    
    setStaticColor(isStatic) {
        this.options.staticColor = isStatic;
        
        if (isStatic) {
            // Actualizar todas las capas actuales a colores estáticos en gris/blanco
            for (const fogMesh of this.fogMeshes) {
                if (fogMesh.material && fogMesh.material.uniforms) {
                    const greyValue = 0.7 + Math.random() * 0.3;
                    fogMesh.material.uniforms.fogColor.value.set(greyValue, greyValue, greyValue);
                }
            }
        }
    }
    
    setNoiseScale(scale) {
        this.options.noiseScale = scale;
        
        // Actualizar todas las capas
        for (const fogMesh of this.fogMeshes) {
            if (fogMesh.material && fogMesh.material.uniforms) {
                fogMesh.material.uniforms.noiseScale.value = scale;
            }
        }
        
        // Actualizar el material base para futuras capas
        if (this.fogMaterial && this.fogMaterial.uniforms) {
            this.fogMaterial.uniforms.noiseScale.value = scale;
        }
    }
    
    setNoiseSpeed(speed) {
        this.options.noiseSpeed = speed;
        
        // Actualizar todas las capas
        for (const fogMesh of this.fogMeshes) {
            if (fogMesh.material && fogMesh.material.uniforms) {
                fogMesh.material.uniforms.noiseSpeed.value = speed;
            }
        }
        
        // Actualizar el material base para futuras capas
        if (this.fogMaterial && this.fogMaterial.uniforms) {
            this.fogMaterial.uniforms.noiseSpeed.value = speed;
        }
    }
    
    // Método para cambiar el comportamiento en los límites
    setBoundaryBehavior(behavior) {
        if (behavior === 'bounce' || behavior === 'fade' || behavior === 'mixed') {
            this.options.boundaryBehavior = behavior;
            console.log(`[Fog] Comportamiento en límites cambiado a: ${behavior}`);
        } else {
            console.warn(`[Fog] Comportamiento no válido: ${behavior}. Usar 'bounce', 'fade' o 'mixed'`);
        }
    }
} 