import * as THREE from 'three';

export class FogControls {
    constructor(game) {
        this.game = game;
        this.engine = game.engine;
        this.visible = false;
        this.container = null;
        
        // Valores iniciales
        this.fogSettings = {
            density: 0.01,
            color: '#adc3db',
            effect: 'normal',
            staticColor: false
        };
        
        // Crear la interfaz pero ocultarla inicialmente
        this.createUI();
        this.hide();
        
        // Registrar combinación de teclas para mostrar/ocultar los controles
        document.addEventListener('keydown', (e) => {
            // Ctrl + F para mostrar/ocultar controles de niebla
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault(); // Evitar que el navegador abra la búsqueda
                this.toggleVisibility();
            }
        });
    }
    
    createUI() {
        // Crear contenedor principal
        this.container = document.createElement('div');
        this.container.style.position = 'absolute';
        this.container.style.bottom = '10px';
        this.container.style.left = '10px';
        this.container.style.background = 'rgba(0, 0, 0, 0.5)';
        this.container.style.color = 'white';
        this.container.style.padding = '10px';
        this.container.style.borderRadius = '5px';
        this.container.style.fontFamily = 'Arial, sans-serif';
        this.container.style.fontSize = '14px';
        this.container.style.zIndex = '1000';
        this.container.style.width = '280px';
        
        // Título
        const title = document.createElement('h3');
        title.textContent = 'Controles de Niebla';
        title.style.margin = '0 0 10px 0';
        title.style.textAlign = 'center';
        this.container.appendChild(title);
        
        // Control de densidad
        const densityContainer = document.createElement('div');
        densityContainer.style.marginBottom = '10px';
        
        const densityLabel = document.createElement('div');
        densityLabel.textContent = `Densidad: ${this.fogSettings.density}`;
        densityContainer.appendChild(densityLabel);
        
        const densitySlider = document.createElement('input');
        densitySlider.type = 'range';
        densitySlider.min = '0';
        densitySlider.max = '0.05';
        densitySlider.step = '0.001';
        densitySlider.value = this.fogSettings.density;
        densitySlider.style.width = '100%';
        densityContainer.appendChild(densitySlider);
        
        densitySlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            this.fogSettings.density = value;
            densityLabel.textContent = `Densidad: ${value.toFixed(3)}`;
            
            // Actualizar la niebla en el motor
            if (this.engine && this.engine.fog) {
                this.engine.setFogDensity(value);
            }
        });
        
        this.container.appendChild(densityContainer);
        
        // Control de color (solo visible cuando no está en modo estático)
        const colorContainer = document.createElement('div');
        colorContainer.style.marginBottom = '10px';
        
        const colorLabel = document.createElement('div');
        colorLabel.textContent = 'Color de la niebla:';
        colorContainer.appendChild(colorLabel);
        
        const colorPicker = document.createElement('input');
        colorPicker.type = 'color';
        colorPicker.value = this.fogSettings.color;
        colorPicker.style.width = '100%';
        colorContainer.appendChild(colorPicker);
        
        colorPicker.addEventListener('input', (e) => {
            this.fogSettings.color = e.target.value;
            
            // Actualizar el color de la niebla en el motor
            if (this.engine && this.engine.fog) {
                const color = new THREE.Color(e.target.value);
                this.engine.setFogColor(color);
            }
        });
        
        this.container.appendChild(colorContainer);
        
        // Control para modo de color estático
        const staticColorContainer = document.createElement('div');
        staticColorContainer.style.marginBottom = '15px';
        staticColorContainer.style.display = 'flex';
        staticColorContainer.style.alignItems = 'center';
        
        const staticColorCheckbox = document.createElement('input');
        staticColorCheckbox.type = 'checkbox';
        staticColorCheckbox.id = 'staticColorCheckbox';
        staticColorCheckbox.checked = this.fogSettings.staticColor;
        staticColorCheckbox.style.marginRight = '10px';
        staticColorContainer.appendChild(staticColorCheckbox);
        
        const staticColorLabel = document.createElement('label');
        staticColorLabel.htmlFor = 'staticColorCheckbox';
        staticColorLabel.textContent = 'Usar colores gris/blanco estáticos';
        staticColorContainer.appendChild(staticColorLabel);
        
        staticColorCheckbox.addEventListener('change', (e) => {
            const isStatic = e.target.checked;
            this.fogSettings.staticColor = isStatic;
            
            // Mostrar/ocultar el selector de color según el modo
            colorContainer.style.display = isStatic ? 'none' : 'block';
            
            // Actualizar el motor
            if (this.engine && this.engine.fog) {
                this.engine.fog.setStaticColor(isStatic);
            }
        });
        
        this.container.appendChild(staticColorContainer);
        
        // Controles de efectos predefinidos
        const presetContainer = document.createElement('div');
        presetContainer.style.marginBottom = '15px';
        
        const presetLabel = document.createElement('div');
        presetLabel.textContent = 'Efectos predefinidos:';
        presetLabel.style.marginBottom = '5px';
        presetContainer.appendChild(presetLabel);
        
        // Botones para efectos predefinidos
        const effectButtons = document.createElement('div');
        effectButtons.style.display = 'flex';
        effectButtons.style.justifyContent = 'space-between';
        effectButtons.style.marginTop = '5px';
        
        const presets = [
            { name: 'Claro', id: 'light', color: '#adc3db', density: 0.008, static: false },
            { name: 'Niebla', id: 'fog', color: '#d8dde0', density: 0.03, static: false },
            { name: 'Tormenta', id: 'storm', color: '#3a4e58', density: 0.04, static: false },
            { name: 'Estático', id: 'static', color: '#cccccc', density: 0.015, static: true }
        ];
        
        presets.forEach(preset => {
            const button = document.createElement('button');
            button.textContent = preset.name;
            button.style.flex = '1';
            button.style.margin = '0 2px';
            button.style.padding = '5px';
            button.style.background = preset.id === this.fogSettings.effect ? '#3a7ca5' : '#2f4858';
            button.style.color = 'white';
            button.style.border = 'none';
            button.style.borderRadius = '3px';
            button.style.cursor = 'pointer';
            
            button.addEventListener('click', () => {
                // Actualizar estado de los botones
                effectButtons.querySelectorAll('button').forEach(btn => {
                    btn.style.background = '#2f4858';
                });
                button.style.background = '#3a7ca5';
                
                // Actualizar configuración
                this.fogSettings.effect = preset.id;
                this.fogSettings.color = preset.color;
                this.fogSettings.density = preset.density;
                this.fogSettings.staticColor = preset.static;
                
                // Actualizar controles
                colorPicker.value = preset.color;
                densitySlider.value = preset.density;
                densityLabel.textContent = `Densidad: ${preset.density.toFixed(3)}`;
                staticColorCheckbox.checked = preset.static;
                colorContainer.style.display = preset.static ? 'none' : 'block';
                
                // Aplicar cambios
                if (this.engine && this.engine.fog) {
                    this.engine.setFogColor(new THREE.Color(preset.color));
                    this.engine.setFogDensity(preset.density);
                    this.engine.fog.setStaticColor(preset.static);
                }
            });
            
            effectButtons.appendChild(button);
        });
        
        presetContainer.appendChild(effectButtons);
        this.container.appendChild(presetContainer);
        
        // Control para la velocidad de las capas de niebla
        const layerSpeedContainer = document.createElement('div');
        layerSpeedContainer.style.marginBottom = '10px';
        
        const layerSpeedLabel = document.createElement('div');
        layerSpeedLabel.textContent = 'Velocidad de animación:';
        layerSpeedContainer.appendChild(layerSpeedLabel);
        
        const layerSpeedSlider = document.createElement('input');
        layerSpeedSlider.type = 'range';
        layerSpeedSlider.min = '0.01';
        layerSpeedSlider.max = '0.2';
        layerSpeedSlider.step = '0.01';
        layerSpeedSlider.value = '0.05';
        layerSpeedSlider.style.width = '100%';
        layerSpeedContainer.appendChild(layerSpeedSlider);
        
        layerSpeedSlider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            
            // Actualizar la velocidad de animación del ruido
            if (this.engine && this.engine.fog) {
                this.engine.fog.setNoiseSpeed(value);
            }
        });
        
        this.container.appendChild(layerSpeedContainer);
        
        // Control para la densidad de capas
        const layerDensityContainer = document.createElement('div');
        layerDensityContainer.style.marginBottom = '10px';
        
        const layerDensityLabel = document.createElement('div');
        layerDensityLabel.textContent = 'Densidad de capas:';
        layerDensityContainer.appendChild(layerDensityLabel);
        
        // Crear botones para ajustar la densidad de capas
        const densityButtonsContainer = document.createElement('div');
        densityButtonsContainer.style.display = 'flex';
        densityButtonsContainer.style.marginTop = '5px';
        
        const densityOptions = [
            { name: 'Baja', layers: 20 },
            { name: 'Media', layers: 100 },
            { name: 'Alta', layers: 300 }
        ];
        
        densityOptions.forEach(option => {
            const button = document.createElement('button');
            button.textContent = option.name;
            button.style.flex = '1';
            button.style.margin = '0 2px';
            button.style.padding = '5px';
            button.style.background = '#2f4858';
            button.style.color = 'white';
            button.style.border = 'none';
            button.style.borderRadius = '3px';
            button.style.cursor = 'pointer';
            
            button.addEventListener('click', () => {
                // Actualizar el estilo del botón
                densityButtonsContainer.querySelectorAll('button').forEach(btn => {
                    btn.style.background = '#2f4858';
                });
                button.style.background = '#3a7ca5';
                
                // Aplicar la configuración
                if (this.engine && this.engine.fog) {
                    // Ajustar el máximo de capas
                    this.engine.fog.options.maxLayers = option.layers;
                    
                    // Forzar la creación de nuevas capas si se está aumentando
                    if (this.engine.fog.fogMeshes.length < option.layers / 3) {
                        // Crear más capas inmediatamente
                        for (let i = 0; i < 10; i++) {
                            this.engine.fog._createFogLayer(true);
                        }
                    }
                }
            });
            
            densityButtonsContainer.appendChild(button);
        });
        
        layerDensityContainer.appendChild(densityButtonsContainer);
        this.container.appendChild(layerDensityContainer);
        
        // Botón para ocultar los controles
        const hideButton = document.createElement('button');
        hideButton.textContent = 'Ocultar controles (Ctrl+F)';
        hideButton.style.width = '100%';
        hideButton.style.padding = '5px';
        hideButton.style.marginTop = '10px';
        hideButton.style.background = '#444';
        hideButton.style.color = 'white';
        hideButton.style.border = 'none';
        hideButton.style.borderRadius = '3px';
        hideButton.style.cursor = 'pointer';
        
        hideButton.addEventListener('click', () => {
            this.hide();
        });
        
        this.container.appendChild(hideButton);
        
        // Añadir al DOM
        document.body.appendChild(this.container);
        
        // Inicializar visibilidad del control de color según el modo estático
        colorContainer.style.display = this.fogSettings.staticColor ? 'none' : 'block';
    }
    
    show() {
        if (this.container) {
            this.container.style.display = 'block';
            this.visible = true;
        }
    }
    
    hide() {
        if (this.container) {
            this.container.style.display = 'none';
            this.visible = false;
        }
    }
    
    toggleVisibility() {
        if (this.visible) {
            this.hide();
        } else {
            this.show();
        }
    }
} 