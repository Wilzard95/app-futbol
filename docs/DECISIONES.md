# Requisitos y decisiones

## Confirmado por el usuario

- Proyecto en esta carpeta y en un nuevo repositorio de la cuenta `Wilzard95`.
- Web inicialmente, con GitHub Pages como alojamiento temporal para pruebas.
- Un administrador crea el equipo, jugadores, torneos y partidos, y registra quién participó.
- Administrador/entrenador también puede ser jugador con la misma cuenta.
- Fichas de jugadores creadas antes de vincularlas a una cuenta de correo mediante invitación.
- Un equipo puede participar en varios torneos; cada torneo agrupa sus partidos y tiene promedios propios.
- Solo quienes participaron pueden valorar y ser valorados en ese partido.
- Los participantes pueden valorar a sus compañeros y a sí mismos.
- Nota numérica, comentario anónimo y emoticones de aprobación/desaprobación.
- Anonimato para todos dentro de la app, incluido el administrador del equipo.
- Propuestas de titular anónimas por torneo, visibles para todos los miembros sin autor.
- Titular colectiva por frecuencia en cada posición; todos los empatados superpuestos.
- Promedio del torneo sobre el icono de cada jugador.
- **Fútbol 6 como modalidad principal; también fútbol 5 y 11. Siempre un arquero.**
- La nota base sigue entre 1 y 10.
- El administrador registra cada gol, asistencia, amarilla, roja y portería en cero, con su jugador y contexto opcional.
- Cada evaluador decide un ajuste por acción: amarilla −2 a +2; roja −3 a +3; gol 0 a +1; asistencia 0 a +0,5; portería en cero 0 a +1.
- Cada acción se valora por separado y todos los ajustes se suman; dos goles permiten dos ajustes.
- La valoración de las tarjetas depende del contexto y puede premiar o penalizar; no hay una penalización automática.
- El administrador registra los eventos dentro del partido. Cada participante evalúa esos mismos eventos de forma independiente: un ajuste 0 y otro +0,1 modifican sus respectivas notas antes del promedio.
- Las vistas de registro del administrador y valoración del jugador deben estar separadas. La nota general la ingresa cada evaluador.
- Titulares de prueba con varias formaciones. En fútbol 6: 3–2, 3–1–1, 2–2–1 y 2–3, además del arquero.
- Mostrar cuál es la formación más seleccionada; conservar todos los empates.
- Equipo de prueba: **combo del Inge**. La plantilla sustituye por completo a los jugadores ficticios anteriores: William Mendoza (09, delantero), Checho (7, volante), Diego Segura (23, portero), Fabian VARGAS (11, defensa), SEBAS (13, volante), Wilson Gómez (06, defensa), Ricky (5, delantero) y Chris (10, volante).
- Un solo torneo de prueba, **Grama 5**, conservando la modalidad fútbol 6; un solo partido contra **Compas**, ganado **6–2**.
- Tres goles para William y tres para Ricky; una amarilla a Ricky; una asistencia para William, Ricky y SEBAS.
- Todos los jugadores pueden ingresar sus propias calificaciones simuladas. Para la prueba se habilitan los ocho como participantes; sin notas ni propuestas iniciales generadas automáticamente.
- Para las cuentas reales se eligió **crear un proyecto nuevo de Supabase**. Aún requiere conectar el servicio y configurar autenticación y permisos.

## Propuesta aplicada solo a la demo

| Decisión             | Valor inicial                                                              | Estado                                                   |
| -------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------- |
| Interfaz             | React + TypeScript + Vite                                                  | Base creada; se puede cambiar                            |
| Backend              | Supabase                                                                   | Recomendado; sin contratar ni conectar                   |
| Nombre               | La Cancha / app-futbol                                                     | Provisional                                              |
| Equipo y plantilla   | combo del Inge; ocho jugadores con dorsales y posiciones indicados         | Definidos por el usuario                                 |
| Formaciones          | F6: 3–2, 3–1–1, 2–2–1 y 2–3; alternativas F5/F11                           | Opciones F6 solicitadas; F5/F11 de ejemplo               |
| Voto de formación    | Una propuesta guardada por persona/torneo; cambiarla reemplaza la anterior | Regla aplicada a la prueba                               |
| Titular colectiva    | Frecuencias de posición solo entre propuestas de la misma formación        | Evita mezclar ubicaciones distintas                      |
| Notas                | Base 1 a 10; final limitada a 1–10; vista a un decimal                     | Escala confirmada; límite final aplicado para mantenerla |
| Ajustes por acciones | Individuales y acumulativos                                                | Rangos y acumulación confirmados                         |
| Promedio del torneo  | Igual peso para cada partido valorado                                      | Pendiente de confirmar                                   |
| Autoevaluación       | Incluida con el mismo peso                                                 | Permitida por requisito; peso propuesto                  |
| Datos                | Ejemplos estáticos; sin persistencia                                       | Solo para discutir el proyecto                           |

## Por acordar antes de conectar cuentas reales

1. **Publicación de resultados.** Se recomienda después del cierre, con al menos tres evaluadores por jugador. ¿Tiempo fijo, por ejemplo 48 horas, o cierre manual? Debe evitarse observar cambios voto a voto.
2. **Promedio.** La escala 1–10 y los rangos por acción están confirmados. Se limita cada voto final a 1–10 antes de promediar. Confirmar peso igual por partido y peso de la autoevaluación; la demo permite décimas en los controles.
3. **Cuentas y vinculación.** Se recomienda Google y correo con contraseña, con solicitud de ficha pendiente de aprobación por administrador. El administrador puede desvincular o expulsar del equipo sin borrar la cuenta global. Es una propuesta sin activar; ver `CUENTAS.md`.
4. **Titular y conflictos.** Las cuatro opciones F6 ya están incluidas. Decidir qué hacer si una persona gana en varias posiciones dentro de una titular colectiva. El criterio solicitado de frecuencia local puede generar ese resultado.
5. **Quién puede proponer la titular.** Se recomienda cualquier jugador activo vinculado del equipo, aunque no haya participado en el último partido. Entrenadores sin ficha, por definir.
6. **Comentarios y reacciones.** ¿Visibles para todo el equipo o solo para el destinatario? Propuesta inicial: comentario opcional, máximo 500 caracteres, una reacción 👍 o 👎 por valoración. Definir cómo reportar y moderar sin exponer autoría.
7. **Edición.** Se recomienda poder cambiar el voto y la propuesta hasta el cierre, manteniendo un solo envío activo. Evitar borrar históricos al retirar jugadores o torneos.
8. **Administración.** Un creador con posibilidad de designar más administradores; definir transferencia de equipo y correcciones de participación después del cierre.

## Condición para pasar de demo a prueba real

La demo separa «Administrador» y «Jugador». La primera vista permite crear un partido con sus participantes y registrar sus eventos en el mismo lugar. La segunda permite elegir cualquiera de las ocho sesiones simuladas, escribir una nota general inicialmente vacía y valorar los eventos registrados por el administrador. Al volver a una sesión se recupera únicamente la valoración guardada para ella. No se generan calificaciones ni propuestas iniciales.

El promedio del partido se muestra con dos decimales: dos notas generales de 7 con ajustes 0 y +0,1 dan 7 y 7,1 finales, y 7,05 de promedio. La plantilla y la titular conservan un decimal de presentación, sin redondeos intermedios en el motor.

Los partidos, eventos y valoraciones de prueba viven en memoria y se pierden al recargar. El selector de roles/sesiones es una herramienta de demostración, sin autenticación ni autorización reales. Retirar un evento elimina sus ajustes de las valoraciones de prueba; en la versión conectada habrá que impedir cambios tras el cierre o reabrir la votación.

La titular permite elegir formación, seleccionar jugadores tocando posiciones de la cancha y guardar una propuesta completa sin repetir jugadores. Se simulan las ocho cuentas para comprobar reemplazos e independencia. El conteo excluye borradores; una propuesta editada conserva un solo voto. La votación presenta todas las formaciones líderes, los porcentajes sobre el total del torneo, las titulares colectivas por formación y las propuestas individuales sin autores. La tarjeta del resumen se actualiza con los mismos datos.

La plantilla, Grama 5, el resultado contra Compas y los diez eventos proceden del usuario. La fecha del partido no fue indicada: se guarda como desconocida y se muestra «Fecha por confirmar». Las notas, propuestas y vínculos de cuentas siguen siendo simulados, en memoria y sin compartir resultados entre dispositivos. Con ocho jugadores no se completaría una titular de fútbol 11; el catálogo permanece disponible en el código, mientras esta demo solo ofrece el torneo de fútbol 6.

Revisar las decisiones anteriores, crear el proyecto backend y su correo de autenticación, aplicar migraciones y políticas de acceso, y comprobar con varias cuentas que ni el administrador puede consultar autores. Hasta entonces no hay cuentas ni votos reales.
