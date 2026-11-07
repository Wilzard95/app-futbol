# Propuesta técnica

Estado: base de frontend implementada; backend propuesto, pendiente de acordar reglas y proveedor. Fecha: 7 de noviembre de 2026.

## Componentes

| Componente               | Elección propuesta                                 | Función                                                  |
| ------------------------ | -------------------------------------------------- | -------------------------------------------------------- |
| Interfaz                 | React + TypeScript                                 | Vistas, formularios, cancha y estados                    |
| Desarrollo y compilación | Vite                                               | Generar archivos estáticos portables                     |
| Alojamiento inicial      | GitHub Pages                                       | Servir la interfaz por HTTPS                             |
| Identidad                | Supabase Auth                                      | Correo verificado, sesiones, enlace o código de acceso   |
| Datos                    | PostgreSQL de Supabase                             | Equipos, torneos, participación e históricos             |
| Autorización             | RLS y funciones transaccionales                    | Comprobar permisos y limitar qué devuelve cada operación |
| Operaciones sensibles    | Funciones SQL/RPC y, si hace falta, Edge Functions | Invitaciones, vinculación, votos y resultados anónimos   |

No hace falta un servidor dedicado ni Next.js para este alcance. La interfaz podrá mudarse de alojamiento sin rediseñar el modelo de datos. Una PWA instalable se puede añadir después; la primera entrega es una web adaptable y conectada a internet. No se propone soporte sin conexión para enviar votos.

GitHub Pages sirve contenido estático y no ejecuta la lógica privada de la aplicación. El código fuente de un repositorio público también es público; esto no obliga a que lo sean los registros del equipo.

## Identidad y ficha de jugador

- `auth.users`: identidad autenticada y correo verificado.
- `teams`: equipo; al crearlo se crea una membresía de administrador en la misma transacción.
- `memberships`: relación cuenta/equipo y roles de administrador, entrenador o miembro.
- `players`: ficha deportiva perteneciente al equipo, inicialmente sin cuenta.
- Vinculación opcional de membresía a ficha: una ficha admite una cuenta; una cuenta admite una ficha por equipo. Una misma cuenta puede pertenecer a varios equipos.
- Ser administrador o entrenador no impide ser jugador. El permiso de valorar depende de estar vinculado a un participante del partido.
- Un jugador todavía sin cuenta sí puede participar y recibir valoraciones; podrá ver su historial cuando se vincule.

Las decisiones de membresía y rol se toman en el servidor, nunca a partir de un campo editable que envíe el navegador.

## Invitaciones y vinculación segura

El enlace de invitación al equipo y el enlace de inicio de sesión tienen propósitos distintos.

1. El administrador genera una invitación con token aleatorio, vencimiento y revocación. Solo se almacena su hash.
2. El invitado verifica su correo mediante Auth.
3. Ve las fichas permitidas para esa invitación y elige la suya.
4. El servidor vincula la ficha en una transacción con restricción única y consume la invitación cuando corresponda.
5. Para impedir que alguien reclame la ficha de un compañero, se recomienda preasignar el correo permitido o requerir aprobación del administrador para un enlace abierto. La modalidad queda pendiente.

Los tokens no se guardan en el repositorio ni en registros de analítica. No se enviará correo desde esta fase del proyecto. Antes de invitar a amigos hay que configurar correo/SMTP y URLs de retorno de desarrollo y Pages; el servicio de correo predeterminado de Supabase tiene restricciones de destinatarios y uso.

## Modelo relacional previsto

| Entidad                            | Relación y restricciones principales                                                                                    |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `teams`                            | Propietario y estado del equipo                                                                                         |
| `memberships` / `membership_roles` | Usuario y equipo únicos; roles acumulables                                                                              |
| `players`                          | Ficha del equipo; vínculo opcional y único con una membresía                                                            |
| `invitations` / `player_claims`    | Token hash, destinatario opcional, vencimiento, consumo y aprobación                                                    |
| `tournaments`                      | Equipo, modalidad 5/6/11, temporada y formación configurada                                                             |
| `matches`                          | Torneo, rival, fecha, resultado y ventana de valoración                                                                 |
| `match_participants`               | Partido y jugador únicos; ambos del mismo equipo                                                                        |
| `match_events`                     | Acción registrada por administrador, partido, participante, tipo y contexto; una portería en cero por jugador y partido |
| `private.rating_ballots`           | Partido, autor y destinatario únicos; nota validada; autor privado                                                      |
| `private.rating_event_adjustments` | Voto y acción únicos; ajuste dentro del rango del tipo de acción; misma persona y partido del voto                      |
| `private.feedback`                 | Comentario y reacción vinculados al voto; nunca devuelve el autor                                                       |
| `private.lineup_proposals`         | Una propuesta activa por jugador y torneo; autor privado                                                                |
| `private.lineup_picks`             | Posición y jugador de cada propuesta; sin repetir jugadores                                                             |

El esquema `private` no se expone a la API de datos del navegador. El modelo exacto se convertirá en migraciones SQL después de cerrar las decisiones. Los tipos TypeScript de esta demo son un contrato inicial, no un sustituto de las restricciones de PostgreSQL.

## Anonimato frente a todos los usuarios de la aplicación

El requisito confirmado incluye al administrador del equipo. Su rol le permite gestionar equipo y partidos, sin conceder lectura de los autores de votos o propuestas.

- El servidor deriva el autor de la sesión; no acepta que el cliente elija otra identidad.
- El servidor verifica que autor y destinatario participaron en el mismo partido, incluso en la autoevaluación.
- Las filas originales, sus autores y sus tiempos precisos no llegan al cliente, ni siquiera al cliente de un administrador.
- Las funciones devuelven promedios permitidos, comentarios sin identidad y propuestas con identificadores de presentación sin relación pública con una cuenta.
- Los errores, las exportaciones, las notificaciones y los registros de actividad tampoco revelan autoría.
- Las funciones privilegiadas tendrán permisos mínimos, `search_path` fijo y comprobaciones explícitas de membresía y equipo.
- No se usará `service_role` ni una secret key en variables `VITE_*`: el contenido compilado es visible.
- Ocultar columnas en React no satisface este requisito. Antes de abrir el backend habrá pruebas de acceso directo con sesiones de jugador, administrador, usuario ajeno y usuario sin autenticar.

La aplicación necesita conservar una relación privada con el autor para impedir votos dobles y permitir correcciones, si se acuerdan. El operador con acceso a la base de datos podría consultar esa relación; no se promete anonimato criptográfico frente al dueño de la infraestructura. El administrador deportivo no recibirá ese acceso. Si la misma persona opera la infraestructura y administra el equipo, esa diferencia debe entenderse antes de usar datos reales.

Para reducir inferencias por cambios de promedio, se propone publicar resultados al cerrar la ventana y exigir un mínimo de tres evaluadores por destinatario. Está pendiente de aprobación. Un grupo pequeño, el texto de un comentario o el contenido de una propuesta también pueden permitir conjeturas; quitar nombres no elimina esa posibilidad.

## Promedios propuestos

Escala confirmada de 1 a 10; autoevaluación incluida con el mismo peso propuesto.

1. Cada evaluador asigna una nota base de 1 a 10 y un ajuste opcional por cada acción registrada de ese jugador en ese partido. Un ajuste omitido equivale a cero.
2. Se suman todos los ajustes a esa nota base y se limita el resultado a 1–10. El límite se aplica una sola vez después de sumar, antes del promedio colectivo.
3. Nota del partido: media de las notas finales válidas recibidas por ese jugador en ese partido.
4. Nota del torneo: media de las notas de los partidos valorados del jugador en ese torneo.
5. No participar o no tener votos se representa con `null`/«—», sin introducir ceros. Las acciones sin ningún voto no crean una nota.
6. No se mezclan torneos. Se calcula con precisión completa; el promedio del partido se presenta con dos decimales y las notas del torneo con uno, sin redondeos intermedios.
7. Cada partido tiene el mismo peso. Por ejemplo, un partido con media 9 y otro con media 5 dan 7, aunque tengan distinto número de evaluadores.

### Acciones y ajustes confirmados

| Acción           | Ajuste de cada evaluador por cada acción |
| ---------------- | ---------------------------------------- |
| Amarilla         | −2 a +2                                  |
| Roja             | −3 a +3                                  |
| Gol              | 0 a +1                                   |
| Asistencia       | 0 a +0,5                                 |
| Portería en cero | 0 a +1                                   |

El administrador registra los hechos y sus destinatarios; no decide el ajuste de los demás. Por ejemplo, una amarilla por detener una ocasión peligrosa puede recibir +2, y otra por protestar, −2. Los goles y las asistencias no generan una bonificación automática: cada votante elige cuánto aportan dentro del rango.

Cada acción tiene un identificador independiente. Dos goles permiten dos ajustes de hasta +1. Se rechazan ajustes duplicados, fuera de rango, sin acción registrada, de otro jugador o de otro partido. No se crean automáticamente goles, asistencias ni una roja adicional por segunda amarilla: el administrador registra los hechos que se deben valorar.

Ejemplo: base 7 + gol 1 + asistencia 0,5 − amarilla 2 = 6,5. Base 9 + roja 3 = 12 en bruto y 10 final. Primero se limita cada valoración y después se promedian: dos notas finales 10 y 1 dan 5,5.

Ejemplo confirmado de independencia: el administrador registra una amarilla para Daniel. Un evaluador ingresa nota general 7 y ajuste 0: su nota final es 7. Otro ingresa nota general 7 y ajuste +0,1: su nota final es 7,1. El promedio de ambos es 7,05. Editar uno de esos ajustes no modifica la nota ni los ajustes de la otra persona.

### Flujo de registro y valoración

1. El administrador registra el partido dentro del torneo, su fecha, marcador y participantes.
2. En el mismo partido registra goles, asistencias, amarillas, rojas y porterías en cero, indicando sus destinatarios y el contexto opcional. La lista reúne los eventos de todos los participantes.
3. El jugador abre el partido desde su propia cuenta, selecciona a un participante e ingresa su nota general, inicialmente vacía. Los eventos aparecen a partir del registro administrativo.
4. El jugador asigna un ajuste independiente a cada evento de ese destinatario. Se guarda una valoración por autor, destinatario y partido.
5. El servidor calcula cada nota final y después el promedio colectivo; solo devuelve los resultados y datos que permitan las reglas de publicación y privacidad.

La demo separa las dos vistas y ofrece dos sesiones ficticias para verificar el flujo. Esas sesiones no tienen votos iniciales precargados; otras valoraciones sintéticas mantienen los ejemplos de ranking. Crear un partido nuevo permite probar dos votos sin ningún dato previo. Los partidos creados en memoria alimentan tanto las estadísticas como los promedios de la plantilla y la titular. El selector de sesión no se incluirá como mecanismo de acceso en la versión con cuentas reales.

La portería en cero se asigna expresamente al participante que indique el administrador. No se restringe automáticamente al arquero ni se infiere únicamente del marcador final, que no representa el tiempo individual en cancha. Solo se admite una por jugador y partido. En la versión conectada habrá que definir cómo verificarla según participación y sustituciones.

Los controles de la demo usan pasos de 0,1, mientras el motor valida los rangos sin redondear ajustes intermedios. Modificar o retirar un hecho después de recibir votos afecta sus resultados: en producción debe bloquearse al cerrar o provocar una reapertura explícita. En la demo retirar una acción elimina sus ajustes en memoria.

En PostgreSQL, el registro de hechos se autorizará solo a administradores, mientras que los ajustes privados seguirán las mismas restricciones de participación y anonimato del voto base. Las funciones del servidor deben comprobar los rangos y las relaciones; no confiarán en el cálculo del navegador.

Las reglas se pueden probar en `src/domain/rules.test.ts`. En la app real el cálculo autorizado vivirá en el servidor. Los votos que contiene `src/data/demo.ts` son exclusivamente sintéticos y no son un patrón de privacidad para producción.

## Titulares colectivas

- Fútbol 6: un arquero y cinco jugadores de campo. Formación inicial 2–2–1.
- Fútbol 5: un arquero y cuatro de campo. Formación inicial 1–2–1.
- Fútbol 11: un arquero y diez de campo. Formación inicial 4–3–3.
- La formación define posiciones estables dentro de cada torneo. Cada propuesta completa esas posiciones sin repetir jugadores.
- Se cuenta la frecuencia de cada jugador en cada posición. Todos los máximos empatados se muestran superpuestos, como se solicitó.
- La nota sobre el icono es su promedio del torneo, no una media de votos de alineación.
- Se muestran propuestas individuales sin identificar a sus autores.
- Si un jugador gana en dos posiciones, el algoritmo actual lo detecta. Resolverlo exige acordar una regla; una asignación global sin repeticiones podría cambiar al ganador de una posición. No se impondrá ese cambio sin decidirlo.

## Primera versión conectada

1. Crear equipo, membresías, fichas e invitaciones; verificar aislamiento entre equipos.
2. Crear torneos 5/6/11, partidos y participantes.
3. Registrar acciones por administrador y enviar una valoración por autor/destinatario/partido con nota base, ajustes por acción, comentario opcional y reacción; cierre y resultados anónimos.
4. Crear/editar una propuesta por torneo y publicar la titular colectiva y las propuestas anónimas.
5. Probar dos o más cuentas reales con datos de prueba y revisar la experiencia en teléfono.

No se implementarán chat, pagos, aplicación nativa, estadísticas de vídeo ni tiempo real en esta primera versión. No son necesarios para probar la idea.

## Fuentes técnicas

- [GitHub Pages: contenido estático y disponibilidad](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [Vite: desplegar en GitHub Pages](https://vite.dev/guide/static-deploy.html#github-pages)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
- [Acceso por enlace o código de correo](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Seguridad por filas de PostgreSQL](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Correo SMTP para invitar a usuarios reales](https://supabase.com/docs/guides/auth/auth-smtp)
