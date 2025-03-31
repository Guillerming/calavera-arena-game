export class DebugUI {
    constructor() {
        // En vez de usar un contenedor del DOM, solo inicializamos la clase
        // Los elementos de UI de debug se eliminaron del HTML
        this.isDebugEnabled = false;
    }

    update(character) {
        // No hacer nada, ya que eliminamos la UI de debug
        return;
    }
} 