# Propuesta de cuentas y vinculación

Estado: recomendación técnica en respuesta a la consulta del usuario; pendiente de elegir y conectar el backend. La demo solo simula sesiones con datos ficticios. No hay botones de acceso real ni credenciales configuradas.

## Formas de entrar recomendadas

1. **Continuar con Google:** el usuario inicia sesión mediante Google, sin crear una contraseña adicional para la app.
2. **Correo y contraseña:** cuenta independiente de Google, con correo verificado y recuperación de contraseña mediante el proveedor de autenticación.

Ambas opciones se pueden gestionar con Supabase Auth y apuntan al mismo modelo interno de usuarios, membresías y fichas. No se almacenarán contraseñas en el código del sitio ni se implementará un sistema de contraseñas propio. La administración del equipo no podrá consultar las contraseñas.

La vinculación entre métodos de acceso debe resolverse con las identidades verificadas del proveedor, evitando duplicar fichas o asociar cuentas únicamente porque el cliente declare el mismo correo.

## Flujo para entrar al equipo

1. El administrador crea el equipo y las fichas deportivas.
2. Comparte un enlace de invitación con vencimiento y posibilidad de revocación.
3. El invitado entra con Google o con su cuenta de correo verificado.
4. Pulsa «Soy jugador de este equipo», selecciona «Esta es mi ficha» y envía una solicitud.
5. La solicitud queda pendiente. No puede votar ni consultar contenido privado hasta que el servidor confirme su membresía y vinculación.
6. El administrador revisa y aprueba o rechaza. La ficha admite una sola cuenta vinculada, y una cuenta una sola ficha por equipo.

Una ficha ya ocupada no se puede reclamar sobrescribiendo al titular. La corrección exige revisión administrativa. Una invitación con correo previamente autorizado podría simplificar la aprobación, si se decide habilitar ese flujo.

## Acciones del administrador

- **Desvincular de una ficha:** libera la ficha para corregir una asociación. La cuenta pierde las capacidades de jugador derivadas de ese vínculo; si tiene otro rol legítimo en el equipo, ese rol se gestiona por separado.
- **Retirar acceso al equipo:** revoca la membresía y sus capacidades dentro de ese equipo, incluso si la persona mantiene una sesión abierta.
- **Rechazar solicitudes o revocar invitaciones:** impide usar una solicitud o enlace incorrecto para entrar.
- **Aprobar a la persona correcta:** crea la asociación válida después de resolver el conflicto.

Estas operaciones no borran la cuenta de Google, la cuenta global de autenticación ni el acceso de la persona a otros equipos. El historial deportivo pertenece a la ficha del jugador y se conserva. Las valoraciones y propuestas fraudulentas previas deberán tratarse con una política de revisión auditada, sin exponer sus autores a los miembros del equipo ni reasignarlas a la nueva persona.

## Comprobaciones del servidor

La sesión identifica al usuario. Las políticas consultan la membresía y vinculación vigentes en la base de datos; no basta con esconder botones o mantener un rol antiguo dentro de un token. Aprobar, vincular o desvincular debe hacerse en una transacción con restricciones únicas, para impedir reclamaciones simultáneas de la misma ficha.

Un administrador que también juega conserva una sola cuenta: su membresía lleva los roles administrativos y su ficha deportiva aporta los permisos de participación y voto.

## Configuración pendiente

Crear el proyecto de autenticación, configurar Google OAuth y sus URLs de retorno, activar y verificar los correos de registro/recuperación, y aplicar las tablas, funciones y políticas del servidor. La web en GitHub Pages puede seguir alojando la interfaz.

## Fuentes oficiales

- [Acceso con Google en Supabase](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)
- [Autenticación con contraseña](https://supabase.com/docs/guides/auth/passwords)
- [Autorización por filas y sesiones](https://supabase.com/docs/guides/database/postgres/row-level-security)
