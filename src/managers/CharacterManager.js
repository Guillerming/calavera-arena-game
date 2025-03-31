import { Character } from '../entities/Character.js';
import * as THREE from 'three';

export class CharacterManager {
    constructor() {
        this.characters = new Map();
        this.playerCharacter = null;
        this.scene = null; // Referencia a la escena
        this.terrain = null; // Referencia al terreno
        this.inputManager = null; // Referencia al inputManager
        this.networkManager = null;
        this.scoreManager = null; // Nuevo ScoreManager
        this.scoreboardUI = null; // UI del scoreboard
    }

    setScene(scene) {
        this.scene = scene;
    }
    
    setTerrain(terrain) {
        this.terrain = terrain;
    }
    
    setInputManager(inputManager) {
        this.inputManager = inputManager;
    }

    setNetworkManager(networkManager) {
        this.networkManager = networkManager;
    }

    setScoreManager(scoreManager) {
        this.scoreManager = scoreManager;
        
        if (this.networkManager) {
            this.networkManager.setScoreManager(scoreManager);
        }
    }

    setScoreboardUI(scoreboardUI) {
        this.scoreboardUI = scoreboardUI;
    }

    createCharacter(id = null) {
        if (!this.scene) {
            console.error("No se ha establecido la escena en CharacterManager");
            return null;
        }

        const character = new Character(this.scene);
        if (!character) return null;

        // Si se proporciona un ID, usarlo; si no, generar uno
        const characterId = id || Math.random().toString(36).substring(7);
        this.characters.set(characterId, character);

        return character;
    }

    getCharacter(characterId) {
        return this.characters.get(characterId);
    }

    removeCharacter(id) {
        const character = this.characters.get(id);
        if (character) {
            if (character.parent) {
                character.parent.remove(character);
            }
            this.characters.delete(id);
        }
    }

    createPlayer(playerName) {
        if (!this.networkManager) {
            console.error('No se ha establecido el NetworkManager');
            return null;
        }
        
        // Guardar el nombre del jugador en el NetworkManager
        this.networkManager.setClientName(playerName);
        
        // Crear el personaje con un ID temporal
        const player = this.createCharacter('temp_player');
        if (!player) {
            console.error('No se pudo crear el personaje');
            return null;
        }

        // Configurar el personaje
        player.isLocalPlayer = true; // Marcar como jugador local
        player.setTerrain(this.scene.terrain);
        player.setCameraController(this.scene.cameraController);
        
        // Asignar posición segura
        const safeCoordinates = this.getSafeCoordinates(15);
        player.position.set(safeCoordinates.x, 0, safeCoordinates.z);
        
        // Calcular rotación hacia el centro del mapa
        player.rotation.y = this.getRotationTowardCenter(safeCoordinates.x, safeCoordinates.z);
        
        // Añadir el personaje a la escena
        this.scene.add(player);
        
        // Configurar callback para cuando el servidor asigne un ID
        const originalOnInit = this.networkManager.onInit;
        this.networkManager.onInit = (serverId) => {
            console.log(`[CharacterManager] ID recibido del servidor: ${serverId}`);
            
            // Actualizar el ID del personaje con el asignado por el servidor
            this.characters.delete('temp_player');
            player.name = serverId;
            this.characters.set(serverId, player);
            
            // Guardar referencia al personaje del jugador
            this.playerCharacter = player;
            
            // Añadir al ScoreManager con el ID correcto
            if (this.scoreManager) {
                this.scoreManager.initPlayer(serverId, playerName);
                console.log(`[DEBUG] Jugador local añadido al ScoreManager: ${serverId} (${playerName})`);
            }
            
            // Restaurar callback original si existía
            if (originalOnInit) {
                originalOnInit(serverId);
            }
        };
        
        // Asignar el NetworkManager al jugador
        player.setNetworkManager(this.networkManager);
        
        return player;
    }

    getPlayerCharacter() {
        return this.playerCharacter;
    }

    updateAll(deltaTime) {
        for (const character of this.characters.values()) {
            // Pasar el inputManager solo al personaje del jugador
            if (character === this.playerCharacter && this.inputManager) {
                character.update(deltaTime, this.inputManager);
            } else {
                character.update(deltaTime);
            }
        }
    }

    // Añadir método para actualizar la posición de un jugador
    updatePlayerPosition(playerData) {
        const player = this.characters.get(playerData.id);
        if (player) {
            player.position.set(
                playerData.position.x,
                playerData.position.y,
                playerData.position.z
            );
            player.rotation.y = playerData.rotation.y;
        }
    }

    // Añadir método para crear un jugador remoto
    createOtherPlayer(playerData) {
        const player = this.createCharacter(playerData.id);
        if (player) {
            // Asignar nombre si está disponible
            if (playerData.name) {
                player.name = playerData.name;
            } else {
                player.name = playerData.id;
            }
            
            // IMPORTANTE: Asignar NetworkManager al jugador remoto
            if (this.networkManager) {
                player.setNetworkManager(this.networkManager);
                console.log(`[DEBUG] Asignado NetworkManager a jugador remoto: ${playerData.id}`);
            }
            
            // Añadir al ScoreManager
            if (this.scoreManager) {
                this.scoreManager.initPlayer(playerData.id, playerData.name || playerData.id);
                console.log(`[DEBUG] Jugador remoto añadido al ScoreManager: ${playerData.id}`);
            }
            
            // Si tiene una posición definida, usarla
            if (playerData.position) {
                player.position.set(
                    playerData.position.x,
                    playerData.position.y,
                    playerData.position.z
                );
            } else {
                // Si no tiene posición, asignarle una segura
                const safeCoordinates = this.getSafeCoordinates(15);
                player.position.set(safeCoordinates.x, 0, safeCoordinates.z);
            }
            
            // Si tiene rotación definida, usarla
            if (playerData.rotation) {
                player.rotation.y = playerData.rotation.y;
            } else {
                // Si no tiene rotación, orientarlo hacia el centro
                player.rotation.y = this.getRotationTowardCenter(player.position.x, player.position.z);
            }
            
            // Asegurarnos de que el jugador remoto tiene el radio de colisión correcto
            player.radius = 1.5; // Radio de colisión del barco
            player.height = 2;   // Altura de colisión del barco
        }
        
        return player;
    }

    // Añadir método para eliminar un jugador
    removePlayer(playerId) {
        const player = this.characters.get(playerId);
        if (player) {
            // Eliminar todos los proyectiles del jugador
            player.projectiles.forEach(projectile => {
                if (projectile.mesh.parent) {
                    projectile.mesh.parent.remove(projectile.mesh);
                }
            });
            player.projectiles = [];

            // Eliminar el jugador de la escena
            if (player.parent) {
                player.parent.remove(player);
            }
            this.characters.delete(playerId);
            
            // Eliminar del ScoreManager
            if (this.scoreManager) {
                this.scoreManager.removePlayer(playerId);
                console.log(`[DEBUG] Jugador eliminado del ScoreManager: ${playerId}`);
            }
        }
    }

    // Añadir método para manejar proyectiles de otros jugadores
    handleProjectileUpdate(projectileData) {
        // Verificar que tenemos los datos necesarios
        if (!projectileData || !projectileData.playerId) {
            console.error('Datos de proyectil incompletos:', projectileData);
            return;
        }

        // Ignorar los proyectiles del jugador local (ya los manejamos localmente)
        if (projectileData.playerId === this.playerCharacter?.name) {
            return;
        }

        // Encontrar el jugador que disparó el proyectil
        const player = this.characters.get(projectileData.playerId);
        if (player) {
            // Crear el proyectil remoto con todos los datos necesarios
            player.createOtherPlayerProjectile({
                ...projectileData,
                initialPosition: { 
                    x: projectileData.position.x,
                    y: projectileData.position.y,
                    z: projectileData.position.z
                }
            });
        } else {
            console.warn(`No se encontró el jugador con ID: ${projectileData.playerId} para crear el proyectil`);
        }
    }

    // Añadir método para eliminar proyectiles
    handleProjectileRemove(projectileData) {
        // Verificar que tenemos los datos necesarios
        if (!projectileData || !projectileData.projectileId || !projectileData.playerId) {
            console.error('Datos de eliminación de proyectil incompletos:', projectileData);
            return;
        }

        // Encontrar el jugador que disparó el proyectil
        const player = this.characters.get(projectileData.playerId);
        if (player) {
            player.removeProjectile(projectileData.projectileId);
        }
    }

    // Añadir método para manejar colisiones de proyectiles
    handleProjectileCollision(collisionData) {
        // Verificar que tenemos los datos necesarios
        if (!collisionData || !collisionData.position || !collisionData.collisionType) {
            console.error('Datos de colisión de proyectil incompletos:', collisionData);
            return;
        }
        
        // Ignorar colisiones de proyectiles del jugador local (ya las manejamos localmente)
        if (collisionData.playerId === this.playerCharacter?.name) {
            return;
        }
        
        // Crear los efectos visuales según el tipo de colisión
        const position = new THREE.Vector3(
            collisionData.position.x,
            collisionData.position.y,
            collisionData.position.z
        );
        
        // Recrear el efecto visual correspondiente
        switch (collisionData.collisionType) {
            case 'water':
                if (this.playerCharacter) {
                    this.playerCharacter.createSplashEffect(position);
                }
                break;
            case 'terrain':
                if (this.playerCharacter) {
                    this.playerCharacter.createExplosionEffect(position);
                }
                break;
            case 'player':
                if (this.playerCharacter) {
                    this.playerCharacter.createExplosionEffect(position);
                }
                break;
        }
    }

    // Manejar actualización de salud de un jugador
    handleHealthUpdate(playerData) {
        const character = this.getCharacter(playerData.id);
        
        if (character) {
            console.log(`[CharacterManager] Actualizando salud de ${playerData.id}: ${playerData.health}, vivo: ${playerData.isAlive}, respawn: ${playerData.isRespawn || false}`);
            
            // Si es un respawn, asegurar que el barco sea visible
            if (playerData.isRespawn) {
                console.log(`[CharacterManager] Procesando respawn para ${playerData.id}`);
                
                // Asegurar que el barco sea visible
                if (character.boat) {
                    character.boat.visible = true;
                    console.log(`[CharacterManager] Restaurando visibilidad del barco para ${playerData.id}`);
                }
                
                // Reactivar colisiones
                if (character.colliderMesh) {
                    character.colliderMesh.visible = true;
                }
            }
            
            // Actualizar estado del personaje
            character.updateStateFromServer(
                playerData.health,
                playerData.isAlive,
                playerData.position
            );
            
            // Mostrar efecto de daño si es necesario
            if (playerData.damageType) {
                character.showDamageEffect(playerData.damageType);
            }
        } else {
            console.warn(`[CharacterManager] No se encontró el personaje con ID ${playerData.id} para actualizar salud`);
        }
    }

    // Verificar si un punto no colisiona con otros jugadores
    isPointAwayFromPlayers(x, z, safeDistance = 10) {
        // Verificar para todos los jugadores en el mapa
        for (const character of this.characters.values()) {
            if (!character.isAlive) continue; // Ignorar jugadores muertos
            
            // Calcular distancia al cuadrado (más eficiente que calcular la raíz cuadrada)
            const dx = character.position.x - x;
            const dz = character.position.z - z;
            const distanceSquared = dx * dx + dz * dz;
            
            // Si está demasiado cerca, no es seguro
            if (distanceSquared < safeDistance * safeDistance) {
                return false;
            }
        }
        
        // Verificar también para el jugador local
        if (this.playerCharacter && this.playerCharacter.isAlive) {
            const dx = this.playerCharacter.position.x - x;
            const dz = this.playerCharacter.position.z - z;
            const distanceSquared = dx * dx + dz * dz;
            
            if (distanceSquared < safeDistance * safeDistance) {
                return false;
            }
        }
        
        return true; // No colisiona con ningún jugador
    }

    // Obtener coordenadas seguras para spawn
    getSafeCoordinates(safeDistance = 10, maxAttempts = 100) {
        // Verificar que tenemos el terreno
        if (!this.terrain) {
            console.warn("No hay terreno para verificar coordenadas seguras, usando valores predeterminados");
            return { x: 0, z: 0 };
        }
        
        // Intentar encontrar coordenadas seguras
        let attempts = 0;
        let foundSafeSpot = false;
        let x, z;
        
        do {
            // Generar coordenadas aleatorias dentro del mapa
            x = (Math.random() * 400) - 200; // -200 a 200
            z = (Math.random() * 400) - 200; // -200 a 200
            
            // Verificar si es un lugar seguro (lejos de tierra)
            const isSafeTerrain = this.terrain.isSafePlace(x, z, safeDistance);
            
            // Verificar si está lejos de otros jugadores
            const isSafeFromPlayers = this.isPointAwayFromPlayers(x, z, safeDistance);
            
            // Ambas condiciones deben cumplirse
            foundSafeSpot = isSafeTerrain && isSafeFromPlayers;
            
            attempts++;
        } while (!foundSafeSpot && attempts < maxAttempts);
        
        // Si después de varios intentos no encontramos un lugar seguro, usar una posición predeterminada
        if (!foundSafeSpot) {
            console.warn(`No se encontró un lugar seguro después de ${maxAttempts} intentos, usando coordenadas predeterminadas`);
            return { x: 0, z: 0 };
        }
        
        return { x, z };
    }
    
    // Calcular rotación para que el barco mire hacia el centro del mapa
    getRotationTowardCenter(x, z) {
        // El centro del mapa está en 0,0
        // Calculamos el ángulo desde la posición (x,z) hacia (0,0)
        // Matematicamente, este es el arco tangente de (-z/-x), pero con Math.atan2 para manejar los cuadrantes
        // Añadimos Math.PI porque los barcos tienen rotación 180° por defecto
        return Math.atan2(-z, -x) + Math.PI;
    }

    update(deltaTime) {
        // Asegurar que el ScoreboardUI se actualiza con la información más reciente
        if (this.scoreboardUI) {
            // Verificar que inputManager está disponible
            if (this.inputManager) {
                this.scoreboardUI.update();
            } else {
                console.warn("[CharacterManager] No se puede actualizar scoreboardUI: falta inputManager");
            }
        }
        
        // Sincronizar ScoreManager con jugadores activos cada 5 segundos
        this._syncScoreManagerTimer = (this._syncScoreManagerTimer || 0) + deltaTime;
        if (this._syncScoreManagerTimer > 5) {
            this.syncScoreManager();
            this._syncScoreManagerTimer = 0;
        }
    }
    
    // Método para sincronizar el ScoreManager con los jugadores activos
    syncScoreManager() {
        if (!this.scoreManager) return;
        
        // Obtener lista de IDs de jugadores activos
        const activePlayerIds = Array.from(this.characters.keys());
        
        // Si hay jugador local, asegurarse de incluirlo
        if (this.playerCharacter && this.playerCharacter.name) {
            if (!activePlayerIds.includes(this.playerCharacter.name)) {
                activePlayerIds.push(this.playerCharacter.name);
            }
        }
        
        // Sincronizar ScoreManager (eliminar jugadores que ya no están activos)
        this.scoreManager.syncPlayers(activePlayerIds);
        
        console.log(`[DEBUG] ScoreManager sincronizado. Jugadores activos: ${activePlayerIds.length}`);
    }
}