- disparo de proyectil siguiendo la psición de la cámara
    X impacto del proyectil quita vida
    - colisiones entre barcos quita vida
    - colisiones con barcos/tierra divierte el rumbo

- arreglos en interfaz:
    - nombre de usuario centrado
    - poder enviar el form de nombre de usuario con Enter
    - ui para cadencia de disparo
    - utilizar esta fuente en el intro: https://fonts.google.com/specimen/Henny+Penny?preview.text=calavera%20arena&categoryFilters=Feeling:%2FExpressive%2FPlayful
    - mostrar un aviso si no está conectado al servidor
    - añadir casilla de participación en jam

- calavera deathmatch con countdown
    X bare minimum
        X alargar modo espera a 3 min
        X reducir modo calavera a 1.5min
        X comprobar que si nadie alcanza la calavera se elimina y reanuda el ciclo de modo normal
    - habilitar disparos en cualquier sentido
    - cambio de música
    - escenario con niebla y/o nubes negras

- multijugador
    - asignar colores automáticamente
    X con tab se ve la lista de jugadores y los puntos
    - chat de voz?
    - barcos llevan algún distintivo de color
    X barcos muestran nombre y vida del jugador
    X al entrar en una partida/morir, spawnear en algun lugar random (q no sea sobre otro jugador ni sobre agua)

- efectos de sonido
    - musica
    - explosión
    - navegacion
    - proyectil pasando cerca

- fx
    - salpicaduras de agua
    - material del barco no reflectante




- DEPLOY:
    X añadir casilla participación en jam
    - calavera spawnea en tierra muy a menudo
    X pantalla de atajos de teclado
        X shift para score board
        X WASD movimiento
        X click para disparar
        X M para detener la música
    X eliminar elementos de UI
        X velocidad
        X indicador de angulo arriba a la derecha
    X eliminar logs de la consola
    X comprobar eliminación de proyectiles (Revisar logs)
    X agrandar área de impacto de los barcos (más fácil que se les de)
    X ampliar el círculo de la calavera
        X añadir animación a la calavera
    X impactos contra el agua
    X marcador no muestra bien los kills para todos los jugadores, tampoco el nombre
        X eliminar columna death
    - añadir portal al vibeverse
    X cada vez que cojo una calavera suma +2
    X el mesh de collisiones reaparece dsp de morir
    - refactor sonidos:
        - sistema de eventos
            - sonido/s asociado/s
            - oido por [jugador, todos]
            - sensible a la distancia
        - lista de eventos:
            - idle (randomly play arr sounds)
            - maxspeed
            - hit (suffered)
            - hit (other)
            - kill
            - die
            - shoot
            - impact
            - water splash
            - score (calavera catched)