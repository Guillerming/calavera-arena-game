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
    - añadir casilla participación en jam
    - calavera spawnea en tierra muy a menudo
    - pantalla de atajos de teclado
        - shift para score board
        - WASD movimiento
        - click para disparar
        - M para detener la música
    - eliminar elementos de UI
        - velocidad
        - indicador de angulo arriba a la derecha
    - eliminar logs de la consola
    - comprobar eliminación de proyectiles (Revisar logs)
    - agrandar área de impacto de los barcos (más fácil que se les de)
    - ampliar el círculo de la calavera
        - añadir animación a la calavera
    - impactos contra el agua
    - marcador no muestra bien los kills para todos los jugadores, tampoco el nombre
        - eliminar columna death