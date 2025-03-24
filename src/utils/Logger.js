export class Logger {
    constructor() {
        this.timings = new Map();
        this.startTimes = new Map();
    }

    start(label) {
        this.startTimes.set(label, performance.now());
    }

    end(label) {
        const startTime = this.startTimes.get(label);
        if (!startTime) {
            console.warn(`No se encontró tiempo de inicio para: ${label}`);
            return;
        }

        const endTime = performance.now();
        const duration = endTime - startTime;
        
        // Actualizar estadísticas
        if (!this.timings.has(label)) {
            this.timings.set(label, {
                total: 0,
                count: 0,
                max: 0,
                min: Infinity
            });
        }

        const stats = this.timings.get(label);
        stats.total += duration;
        stats.count++;
        stats.max = Math.max(stats.max, duration);
        stats.min = Math.min(stats.min, duration);
        
        this.startTimes.delete(label);
    }

    getStats(label) {
        return this.timings.get(label);
    }

    clear() {
        this.timings.clear();
        this.startTimes.clear();
    }
} 