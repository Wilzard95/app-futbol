# App Fútbol · La Cancha

Base de una aplicación web para equipos de amigos: torneos, partidos, jugadores, valoraciones anónimas y titulares colectivas. **La Cancha** y **Los del Barrio** son nombres provisionales.

## Estado de esta versión

Demostración navegable con datos enteramente ficticios. No hay autenticación, servidor, persistencia, invitaciones reales ni envío de votos. Las propuestas que se ven son ejemplos precargados; recargar vuelve al estado inicial.

- Resumen y plantilla con promedios independientes por torneo.
- Resultados y participantes de muestra.
- Fútbol **6 como modalidad principal**, además de fútbol 5 y 11.
- Formaciones iniciales 2–2–1, 1–2–1 y 4–3–3, respectivamente, más un arquero.
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
  styles.css           Diseño adaptable
  data/demo.ts         Jugadores, partidos y votos ficticios
  domain/types.ts      Contratos iniciales del dominio
  domain/rules.ts      Promedios, participación, formaciones y consenso
  domain/rules.test.ts Pruebas de las reglas propuestas
docs/
  ARQUITECTURA.md      Propuesta de frontend, backend, permisos e identidad
  DECISIONES.md        Requisitos confirmados y reglas pendientes
  DESPLIEGUE.md        GitHub Pages y desarrollo local
```

## Tecnología

La base usa **React + TypeScript + Vite**, que generan HTML, CSS y JavaScript estáticos para GitHub Pages. La propuesta para la siguiente fase es **Supabase Auth + PostgreSQL + RLS + funciones de servidor**. Supabase todavía no está conectado ni creado.

HTML sigue siendo parte de la aplicación. React ayuda a mantener sincronizados formularios, torneos, jugadores y alineaciones; TypeScript evita mezclar accidentalmente sus datos. GitHub Pages aloja la interfaz; la autorización y los datos compartidos vivirán en el backend.

## Publicación

Repositorio: [Wilzard95/app-futbol](https://github.com/Wilzard95/app-futbol).

Demo pública: [wilzard95.github.io/app-futbol/](https://wilzard95.github.io/app-futbol/). El primer despliegue terminó correctamente en GitHub Actions.

Cada cambio en `main` ejecuta pruebas, compila y publica `dist/`. Los pull requests solo verifican y compilan. Las decisiones pendientes están en [docs/DECISIONES.md](docs/DECISIONES.md).

El repositorio y la demo inicial son públicos. Los datos reales del equipo deberán quedar protegidos en el backend, fuera del repositorio y de los archivos del sitio. Las fuentes tipográficas se cargan desde Google Fonts, con fuentes locales de respaldo.
