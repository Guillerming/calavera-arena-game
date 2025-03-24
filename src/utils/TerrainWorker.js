// Web Worker para procesar el terreno
self.onmessage = function(e) {
    const { vertices, segments, size, heightData, minHeight, maxHeight } = e.data;
    
    // Aplicar heightmap
    for (let i = 0; i < vertices.length; i += 3) {
        const x = vertices[i];
        const z = vertices[i + 2];
        vertices[i + 1] = getHeightAt(x, z, size, segments, heightData, minHeight, maxHeight);
    }
    
    // Suavizado temporalmente desactivado para pruebas de rendimiento
    // smoothTerrain(vertices, segments, 5, 0.5);
    
    self.postMessage({ vertices });
};

function getHeightAt(x, z, size, segments, heightData, minHeight, maxHeight) {
    const halfWidth = size.width / 2;
    const halfDepth = size.depth / 2;
    
    const normalizedX = (x + halfWidth) / size.width;
    const normalizedZ = (z + halfDepth) / size.depth;
    
    const ix = Math.floor(normalizedX * segments);
    const iz = Math.floor(normalizedZ * segments);
    
    const index = iz * (segments + 1) + ix;
    return heightData[index];
}

function smoothTerrain(vertices, segments, iterations, intensity) {
    for (let iteration = 0; iteration < iterations; iteration++) {
        const tempHeights = new Float32Array(vertices.length / 3);
        
        for (let i = 0; i < vertices.length; i += 3) {
            const idx = i / 3;
            const row = Math.floor(idx / (segments + 1));
            const col = idx % (segments + 1);
            
            let sum = vertices[i + 1];
            let count = 1;
            
            const neighbors = [
                [-1, -1], [-1, 0], [-1, 1],
                [0, -1],           [0, 1],
                [1, -1],  [1, 0],  [1, 1]
            ];
            
            for (const [dr, dc] of neighbors) {
                const newRow = row + dr;
                const newCol = col + dc;
                
                if (newRow >= 0 && newRow <= segments && 
                    newCol >= 0 && newCol <= segments) {
                    const neighborIdx = (newRow * (segments + 1) + newCol) * 3;
                    sum += vertices[neighborIdx + 1];
                    count++;
                }
            }
            
            tempHeights[idx] = vertices[i + 1] * (1 - intensity) + 
                              (sum / count) * intensity;
        }
        
        for (let i = 0; i < vertices.length; i += 3) {
            vertices[i + 1] = tempHeights[i / 3];
        }
    }
} 