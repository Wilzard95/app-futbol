# App Fútbol · La Cancha

Base de una aplicación web para equipos de amigos: torneos, partidos, jugadores, valoraciones anónimas y titulares colectivas. La app se llama provisionalmente **La Cancha** y el equipo de prueba es **combo del Inge**.

## Estado de esta versión

Versión conectada en prueba para combo del Inge: cuentas por correo, fichas aprobadas, torneos, partidos, acciones, valoraciones y titulares se guardan en Supabase. La simulación anterior se conserva solo en desarrollo local y no se muestra en la web publicada. El correo de confirmación usa Gmail SMTP; Google OAuth aún no está configurado. Los resultados reales se actualizan periódicamente y muestran comentarios y propuestas sin identificar a sus autores.

| Jugador         | Dorsal | Posición  |
| --------------- | ------ | --------- |
| William Mendoza | 09     | Delantero |
| Checho          | 7      | Volante   |
| Diego Segura    | 23     | Portero   |
| Fabian VARGAS   | 11     | Defensa   |
| SEBAS           | 13     | Volante   |
| Wilson Gómez    | 06     | Defensa   |
| Ricky           | 5      | Delantero |
| Chris           | 10     | Volante   |

La plantilla tiene ocho jugadores. Las formaciones de fútbol 11 mantienen tres vacantes y no permiten guardar una titular incompleta. El autocompletado usa a Diego como portero y prioriza las posiciones indicadas.

- Resumen y plantilla con promedios independientes por torneo.
- Un único torneo, **Grama 5**, en modalidad fútbol 6; dos partidos: **vs. Los primeros, victoria 6–2**, el 1 de noviembre de 2026, y **vs. Compas, victoria 3–1**, el 8 de noviembre de 2026.
- Contra Los primeros: tres goles de William, tres de Ricky, una amarilla a Ricky y una asistencia de William, Ricky y SEBAS. Contra Compas: goles de William, Ricky y Fabian VARGAS; asistencias de Ricky y Wilson; sin tarjetas.
- Los ocho jugadores participaron contra Los primeros; contra Compas participaron siete, sin Chris.
- En «Partidos», el administrador crea torneos, jugadores, partidos y acciones; abre la valoración después de registrarlas. Cada participante usa su cuenta para calificar.
- Valoración por evento: amarillas −2/+2, rojas −3/+3, goles 0/+1, asistencias 0/+0,5 y porterías en cero 0/+1.
- Los votos reales se guardan de forma privada. El promedio del partido muestra dos decimales para apreciar ajustes pequeños como +0,1; la simulación conserva sesiones de prueba separadas.
- Ajustes acumulativos por acción; cada voto final se limita a 1–10 antes de promediar. El resumen y la titular usan los resultados reales.
- Fútbol **6 como modalidad principal**, además de fútbol 5 y 11.
- Titular editable por torneo: fútbol 6 ofrece 3–2, 3–1–1, 2–2–1 y 2–3, siempre más un arquero. También hay alternativas para fútbol 5 y 11.
- Votos y porcentajes por formación, con todos los líderes empatados. Guardar otra formación reemplaza la propuesta anterior de esa persona.
- Titular colectiva y propuestas anónimas reales; empates superpuestos por posición.
- Detección de conflictos si alguien resulta elegido en varias posiciones.
- Diseño adaptable a teléfonos y escritorio.

## Arrancar

Requisitos: Node.js 24 y pnpm 11.25.0.

```powershell
pnpm install
pnpm dev
```

```powershell
pnpm check     # pruebas de reglas, TypeScript y compilación
pnpm preview   # servir la compilación existente
```

## Organización

```text
src/
  App.tsx              Interfaz de demostración
  components/MatchRatingsDemo.tsx Registro y valoración de acciones de prueba
  components/MatchCreateForm.tsx Alta de partidos y participantes en memoria
  components/LineupLab.tsx      Editor de titulares, votación y propuestas anónimas
  components/LineupPitch.tsx    Cancha editable y colectiva
  styles.css           Diseño adaptable
  data/demo.ts         Plantilla indicada y datos de prueba simulados
  domain/types.ts      Contratos iniciales del dominio
  domain/events.ts     Acciones, rangos, validación y nota final ajustada
  domain/rules.ts      Promedios, participación, formaciones y consenso
  domain/rules.test.ts Pruebas de las reglas propuestas
  domain/lineups.ts    Formaciones, votos, validación y consenso por formación
  domain/lineups.test.ts Pruebas de propuestas y votos de formaciones
docs/
  ARQUITECTURA.md      Propuesta de frontend, backend, permisos e identidad
  DECISIONES.md        Requisitos confirmados y reglas pendientes
  DESPLIEGUE.md        GitHub Pages y desarrollo local
  CUENTAS.md          Propuesta de Google/correo, solicitud de ficha y administración
```

## Tecnología

La base usa **React + TypeScript + Vite**, que generan HTML, CSS y JavaScript estáticos para GitHub Pages. La propuesta para la siguiente fase es **Supabase Auth + PostgreSQL + RLS + funciones de servidor**. El proyecto de Supabase está creado y tiene funciones de cuentas y vinculación. Las funciones de valoración y titular protegen los autores frente a los usuarios de la app; los permisos y reglas tienen pruebas transaccionales, pero aún falta la prueba completa con varios compañeros.

HTML sigue siendo parte de la aplicación. React ayuda a mantener sincronizados formularios, torneos, jugadores y alineaciones; TypeScript evita mezclar accidentalmente sus datos. GitHub Pages aloja la interfaz; la autorización y los datos compartidos vivirán en el backend.

## Publicación

Repositorio: [Wilzard95/app-futbol](https://github.com/Wilzard95/app-futbol).

Demo pública: [wilzard95.github.io/app-futbol/](https://wilzard95.github.io/app-futbol/). El primer despliegue terminó correctamente en GitHub Actions.

Cada cambio en `main` ejecuta pruebas, compila y publica `dist/`. Los pull requests solo verifican y compilan. Las decisiones pendientes están en [docs/DECISIONES.md](docs/DECISIONES.md).

El repositorio y la demo inicial son públicos. Los datos reales del equipo deberán quedar protegidos en el backend, fuera del repositorio y de los archivos del sitio. Las fuentes tipográficas se cargan desde Google Fonts, con fuentes locales de respaldo.

## Base de datos y pruebas de permisos

Las tablas están en `app_private`, sin lectura directa desde la web. Las funciones públicas invocan funciones privadas que validan la sesión, membresía, participación y rangos. `sports-security-test.sql` prueba varias cuentas de prueba dentro de una transacción que termina en rollback. Los archivos `sports-*.sql` documentan la preparación: en una base nueva se aplica primero `sports-foundation.sql`, luego `sports-open.sql`, `sports-ratings.sql`, `sports-admin.sql`, `sports-players.sql`, `sports-lineups.sql`, `sports-read.sql` y por último `sports-seed.sql`, después de configurar cuentas. No volver a ejecutarlos sobre el proyecto actual.

Los resultados se muestran al llegar las valoraciones, según la elección del equipo. Con pocos votos es posible inferir la autoría por el momento o el contenido. El administrador deportivo no recibe autores desde la app; quien tenga acceso privilegiado a la base de Supabase puede consultarlos.
