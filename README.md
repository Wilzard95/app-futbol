# App Fútbol · La Cancha

Base de una aplicación web para equipos de amigos: torneos, partidos, jugadores, valoraciones anónimas y titulares colectivas. La app se llama provisionalmente **La Cancha** y el equipo de prueba es **combo del Inge**.

## Estado de esta versión

Demostración navegable con el equipo, plantilla, torneo, marcador y eventos indicados por el usuario. La sección «Mi cuenta» conecta con Supabase para el registro por correo, invitaciones y vinculación de fichas. Los partidos, las calificaciones y las titulares siguen siendo una simulación en memoria, sin votos compartidos entre dispositivos. El envío de correos requiere configurar Gmail SMTP. Las notas y propuestas empiezan vacías; recargar vuelve al estado inicial.

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
- Los ocho jugadores están habilitados como participantes de la simulación para poder valorar y ser valorados.
- En «Partidos», vistas separadas de administrador y jugador. El administrador registra un partido, sus participantes y sus eventos; el jugador ingresa su nota general y sus ajustes personales.
- Valoración por evento: amarillas −2/+2, rojas −3/+3, goles 0/+1, asistencias 0/+0,5 y porterías en cero 0/+1.
- Ocho sesiones simuladas permiten probar opiniones independientes; todas empiezan sin notas ni propuestas precargadas. El promedio del partido muestra dos decimales para apreciar ajustes pequeños como +0,1.
- Ajustes acumulativos por acción; cada voto final se limita a 1–10 antes de promediar. Cambios temporales reflejados en la plantilla y la titular.
- Fútbol **6 como modalidad principal**, además de fútbol 5 y 11.
- Titular editable por torneo: fútbol 6 ofrece 3–2, 3–1–1, 2–2–1 y 2–3, siempre más un arquero. También hay alternativas para fútbol 5 y 11.
- Votos y porcentajes por formación, con todos los líderes empatados. Guardar otra formación reemplaza la propuesta anterior de esa persona.
- Titular colectiva y propuestas anónimas de ejemplo; empates superpuestos por posición.
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

La base usa **React + TypeScript + Vite**, que generan HTML, CSS y JavaScript estáticos para GitHub Pages. La propuesta para la siguiente fase es **Supabase Auth + PostgreSQL + RLS + funciones de servidor**. El proyecto de Supabase está creado y tiene funciones de cuentas y vinculación. Las valoraciones reales y sus garantías de anonimato todavía requieren implementación y pruebas.

HTML sigue siendo parte de la aplicación. React ayuda a mantener sincronizados formularios, torneos, jugadores y alineaciones; TypeScript evita mezclar accidentalmente sus datos. GitHub Pages aloja la interfaz; la autorización y los datos compartidos vivirán en el backend.

## Publicación

Repositorio: [Wilzard95/app-futbol](https://github.com/Wilzard95/app-futbol).

Demo pública: [wilzard95.github.io/app-futbol/](https://wilzard95.github.io/app-futbol/). El primer despliegue terminó correctamente en GitHub Actions.

Cada cambio en `main` ejecuta pruebas, compila y publica `dist/`. Los pull requests solo verifican y compilan. Las decisiones pendientes están en [docs/DECISIONES.md](docs/DECISIONES.md).

El repositorio y la demo inicial son públicos. Los datos reales del equipo deberán quedar protegidos en el backend, fuera del repositorio y de los archivos del sitio. Las fuentes tipográficas se cargan desde Google Fonts, con fuentes locales de respaldo.
