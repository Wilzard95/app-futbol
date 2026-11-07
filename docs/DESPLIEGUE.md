# GitHub Pages

Repositorio previsto: `Wilzard95/app-futbol`. Rama principal: `main`.

## Flujo

`.github/workflows/pages.yml` instala las versiones del archivo de bloqueo, ejecuta pruebas, comprueba TypeScript y compila. En `main` publica únicamente `dist/` con el mecanismo oficial de Pages. Las acciones externas se fijan por SHA.

En el repositorio se debe activar **Settings → Pages → Build and deployment → Source: GitHub Actions**. La API equivalente es `POST /repos/Wilzard95/app-futbol/pages` con `build_type: workflow`.

La URL esperada es `https://wilzard95.github.io/app-futbol/`. Debe verificarse el estado del despliegue antes de considerarla publicada.

`base: './'` en Vite genera rutas relativas para CSS, JavaScript e icono. Esta demo cambia de vista mediante estado de React y no depende de rutas de servidor: recargar la URL de Pages funciona sin reglas de reescritura.

## Futuras variables

`.env.example` documenta las variables públicas del proveedor propuesto; por ahora no se usan. Nunca incluir claves privadas en la compilación. Las restricciones reales serán las de la base de datos, sus funciones y sus políticas RLS.

La futura vuelta del enlace de autenticación debe apuntar al directorio de la app en Pages, incluido `/app-futbol/`. No se debe perder el token de acceso ni crear un conflicto entre fragmentos de URL y navegación; al implementar Auth se elegirá explícitamente el flujo y se retirarán los parámetros sensibles tras consumirlos.

El sitio inicial y su código son públicos. Los datos de partidos reales, correos, votos y autores no se publican como JSON ni como archivos dentro del repositorio.
