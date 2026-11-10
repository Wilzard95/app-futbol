# Implementación de varios equipos

El selector muestra los equipos en los que participa la cuenta y, temporalmente, el equipo de una invitación válida. Al crear un equipo, la cuenta verificada pasa a ser su administradora. Una misma cuenta puede pertenecer a varios equipos y mantener una ficha distinta en cada uno.

## Separación de datos

- Cada ficha, invitación y solicitud debe pertenecer a un equipo. La membresía debe identificarse por la combinación de cuenta y equipo, con rol, estado y ficha propios de ese equipo.
- Cada torneo pertenece a un equipo; sus partidos, participantes, acciones, valoraciones y propuestas de titular heredan esa pertenencia. Las operaciones deben comprobarla en la base de datos, incluso cuando se envíen identificadores manualmente.
- El administrador solo puede gestionar cuentas, plantillas, torneos y partidos del equipo donde tiene ese rol. Crear un equipo debe insertar el equipo y su membresía administradora en una misma transacción.
- Las invitaciones deben identificar el equipo y conservar su vencimiento; aceptar o rechazar una solicitud no debe afectar la membresía de otro equipo.
- Las valoraciones y titulares conservan el anonimato y las reglas de participación actuales. El acceso a agregados y comentarios también se limita a miembros autorizados del equipo correspondiente.

## Compatibilidad y despliegue

La migración `multi-team-cutover.sql` copia fichas, membresías, partidos, eventos, votos, titulares e invitaciones a tablas aisladas por equipo. Conserva las tablas anteriores y deshabilita sus API para impedir que los clientes antiguos escriban en una copia desactualizada. Los clientes antiguos deben recargar la página.

Las pruebas SQL ejecutan las operaciones en transacciones que se revierten: dos equipos, una persona en ambos, administradores distintos, invitaciones, fichas, partidos y titulares, además de intentos de leer o modificar otro equipo con identificadores conocidos. Antes de aplicar la migración, verificar el estado del proyecto y que el cliente actualizado esté listo para desplegarse inmediatamente.
