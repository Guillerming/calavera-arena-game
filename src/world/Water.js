import * as THREE from 'three';

export class Water {
    constructor(size = { width: 100, depth: 100 }, level = 0) {
        this.size = size;
        this.waterLevel = level;
        this.mesh = this.createWater();
        
        // Propiedades de animación
        this.waveSpeed = 0.5;
        this.waveHeight = 0.05;
        this.time = 0;
    }

    createWater() {
        // Crear geometría plana para el agua
        const waterGeometry = new THREE.PlaneGeometry(
            this.size.width,
            this.size.depth,
            64, // segmentos en X (para el movimiento de olas)
            64  // segmentos en Y
        );
        
        // Rotar para que quede horizontal
        waterGeometry.rotateX(-Math.PI / 2);
        
        // Crear material para el agua con shader personalizado
        const waterMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                waterColor: { value: new THREE.Color(0x0077be) },
                waterDeepColor: { value: new THREE.Color(0x005a8c) },
                foamColor: { value: new THREE.Color(0xffffff) },
                waveHeight: { value: 0.1 },
                waveSpeed: { value: 1.0 }
            },
            vertexShader: `
                uniform float time;
                uniform float waveHeight;
                uniform float waveSpeed;
                
                varying vec2 vUv;
                varying float vElevation;
                
                // Simple noise function
                float noise(vec2 p) {
                    return sin(p.x * 10.0) * sin(p.y * 10.0) * 0.5 + 0.5;
                }
                
                void main() {
                    vUv = uv;
                    
                    // Generate waves with different frequencies
                    float elevation = 
                        sin(position.x * 0.2 + time * waveSpeed) * 
                        sin(position.z * 0.3 + time * waveSpeed) * waveHeight * 0.5 +
                        sin(position.x * 0.3 + time * waveSpeed * 0.8) * 
                        sin(position.z * 0.2 + time * waveSpeed * 1.2) * waveHeight * 0.5;
                    
                    // Add some noise
                    elevation += noise(vec2(position.x * 0.1, position.z * 0.1 + time * 0.1)) * waveHeight * 0.2;
                    
                    vElevation = elevation;
                    
                    // Apply the elevation to the vertex
                    vec3 newPosition = position;
                    newPosition.y += elevation;
                    
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 waterColor;
                uniform vec3 waterDeepColor;
                uniform vec3 foamColor;
                
                varying vec2 vUv;
                varying float vElevation;
                
                void main() {
                    // Mix colors based on elevation for a better water effect
                    float waterDepthFactor = smoothstep(-0.05, 0.05, vElevation);
                    vec3 finalColor = mix(waterDeepColor, waterColor, waterDepthFactor);
                    
                    // Add foam at wave peaks
                    float foamFactor = smoothstep(0.08, 0.09, vElevation);
                    finalColor = mix(finalColor, foamColor, foamFactor * 0.7);
                    
                    // Add some shallow water shading at the edges
                    float edgeFactor = smoothstep(0.45, 0.5, abs(vUv.x - 0.5) + abs(vUv.y - 0.5));
                    finalColor = mix(finalColor, waterColor * 1.2, edgeFactor * 0.3);
                    
                    gl_FragColor = vec4(finalColor, 0.85); // Slight transparency
                }
            `,
            transparent: true,
            side: THREE.DoubleSide
        });
        
        // Crear malla de agua
        const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
        
        // Posicionar el agua
        waterMesh.position.y = this.waterLevel;
        
        return waterMesh;
    }

    // Método para actualizar la animación del agua
    update(deltaTime) {
        this.time += deltaTime * this.waveSpeed;
        
        // Actualizar el tiempo en el shader
        if (this.mesh.material.uniforms) {
            this.mesh.material.uniforms.time.value = this.time;
        }
    }
}