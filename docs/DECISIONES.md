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

## Propuesta aplicada solo a la demo

| Decisión             | Valor inicial                         | Estado                                  |
| -------------------- | ------------------------------------- | --------------------------------------- |
| Interfaz             | React + TypeScript + Vite             | Base creada; se puede cambiar           |
| Backend              | Supabase                              | Recomendado; sin contratar ni conectar  |
| Nombre               | La Cancha / app-futbol                | Provisional                             |
| Plantilla de muestra | Los del Barrio                        | Completamente ficticia                  |
| Formaciones          | F6 2–2–1; F5 1–2–1; F11 4–3–3         | Propuestas iniciales                    |
| Notas                | 1 a 10, vista a un decimal            | Pendiente de confirmar                  |
| Promedio del torneo  | Igual peso para cada partido valorado | Pendiente de confirmar                  |
| Autoevaluación       | Incluida con el mismo peso            | Permitida por requisito; peso propuesto |
| Datos                | Ejemplos estáticos; sin persistencia  | Solo para discutir el proyecto          |

## Por acordar antes de conectar cuentas reales

1. **Publicación de resultados.** Se recomienda después del cierre, con al menos tres evaluadores por jugador. ¿Tiempo fijo, por ejemplo 48 horas, o cierre manual? Debe evitarse observar cambios voto a voto.
2. **Escala y promedio.** Confirmar 1–10, enteros o decimales, peso igual por partido y peso de la autoevaluación.
3. **Vinculación.** Correo preasignado a la ficha o solicitud aprobada por administrador. Un enlace abierto no debe permitir apropiarse libremente de cualquier jugador.
4. **Titular y conflictos.** Confirmar formaciones; decidir qué hacer si una persona gana en varias posiciones. El criterio solicitado de frecuencia local puede generar ese resultado.
5. **Quién puede proponer la titular.** Se recomienda cualquier jugador activo vinculado del equipo, aunque no haya participado en el último partido. Entrenadores sin ficha, por definir.
6. **Comentarios y reacciones.** ¿Visibles para todo el equipo o solo para el destinatario? Propuesta inicial: comentario opcional, máximo 500 caracteres, una reacción 👍 o 👎 por valoración. Definir cómo reportar y moderar sin exponer autoría.
7. **Edición.** Se recomienda poder cambiar el voto y la propuesta hasta el cierre, manteniendo un solo envío activo. Evitar borrar históricos al retirar jugadores o torneos.
8. **Administración.** Un creador con posibilidad de designar más administradores; definir transferencia de equipo y correcciones de participación después del cierre.

## Condición para pasar de demo a prueba real

Revisar las decisiones anteriores, crear el proyecto backend y su correo de autenticación, aplicar migraciones y políticas de acceso, y comprobar con varias cuentas que ni el administrador puede consultar autores. Hasta entonces solo se usan ejemplos ficticios.
