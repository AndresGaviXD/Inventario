# MiniSistema de Gestión de Inventario

Aplicación web para registrar entradas y salidas de productos y consultar el inventario actual. Prueba técnica.

## Stack

| Capa | Tecnología |
|---|---|
| Backend | C#, ASP.NET Core Web API (.NET <8>), Dapper + Npgsql |
| Base de datos | PostgreSQL con stored procedures |
| Autenticación | JWT (Bearer) + BCrypt, roles `admin` y `operador` |
| Frontend | JavaScript puro, HTML y CSS propios (sin frameworks), servido desde `wwwroot` |
| Documentación API | Swagger |

## Requisitos

- Visual Studio 2022 con la carga de trabajo *ASP.NET y desarrollo web*
- .NET SDK <7.0>
- PostgreSQL 15 o superior (con pgAdmin)

## Instalación

### 1. Base de datos

1. En pgAdmin, crear una base de datos llamada `inventario_db`.
2. Abrir *Query Tool* sobre ella y ejecutar `database/database.sql`.
   El script crea las tablas, los stored procedures, datos de prueba y los usuarios iniciales. Se puede volver a ejecutar: reinicia las tablas.

### 2. Cadena de conexión

Necesitas abrir el archivo `InventarioApi/appsettings.json` y en Password ingresa la contraseña del usuario `postgres` que tengas configurada en tu maquina, o en su defecto, el usuario con el que hayas ejecutado el scritp realizado para esta prueba.

### 3. Ejecutar

Abrir `PruebaInventario.sln` en Visual Studio y presionar **F5**.

- Aplicación: `https://localhost:<XXXX>/`
- Swagger: `https://localhost:<XXXX>/swagger`

## Usuarios de prueba

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin` | `Admin123*` | Administrador |
| `operador1` | `Operador123*` | Operador |

## Funcionalidades

- **Panel** con indicadores, alertas de stock bajo y últimos movimientos.
- **Inventario** con búsqueda, filtro de bajo stock, nivel por producto y exportación a CSV.
- **Movimientos**: registro de entradas y salidas, historial con filtros. El diálogo muestra el stock actual antes de confirmar.
- **Productos**: alta, edición, desactivación (solo si el stock es 0) y reactivación.
- **Usuarios y roles**: alta de usuarios, cambio de rol y activación/desactivación.
- Actualización automática cada 30 segundos y diseño adaptable a móvil.

### Permisos por rol

| Acción | Operador | Administrador |
|---|:---:|:---:|
| Ver panel, inventario e historial | ✔ | ✔ |
| Registrar entradas y salidas | ✔ | ✔ |
| Crear, editar y desactivar productos | | ✔ |
| Gestionar usuarios y roles | | ✔ |

## Stored procedures

| Nombre | Función |
|---|---|
| `sp_registrar_entrada` | Valida y registra una entrada |
| `sp_registrar_salida` | Valida stock disponible y registra una salida. Bloquea la fila del producto para evitar sobreventa en peticiones simultáneas |
| `sp_estado_inventario` | Calcula entradas, salidas y stock actual por producto |
| `sp_listar_movimientos` | Historial de movimientos |
| `sp_desactivar_producto` | Desactiva un producto solo si no tiene stock |

Los errores de negocio usan códigos propios (`IN001` validación, `IN002` no existe, `IN003` stock insuficiente, `IN004` producto con stock) que la API traduce a respuestas HTTP 400, 404 y 409.

## API REST

Todas las rutas, excepto `login`, requieren `Authorization: Bearer <token>`.

| Método | Ruta | Rol | Descripción |
|---|---|---|---|
| POST | `/api/auth/login` | Público | Inicia sesión y devuelve el JWT |
| GET | `/api/inventario` | Cualquiera | Estado actual del inventario |
| GET | `/api/movimientos` | Cualquiera | Historial |
| POST | `/api/movimientos/entrada` | Cualquiera | Registrar entrada |
| POST | `/api/movimientos/salida` | Cualquiera | Registrar salida |
| GET | `/api/productos` | Cualquiera | Listar productos |
| POST | `/api/productos` | Admin | Crear producto |
| PUT | `/api/productos/{id}` | Admin | Editar producto |
| POST | `/api/productos/{id}/desactivar` | Admin | Desactivar producto |
| POST | `/api/productos/{id}/reactivar` | Admin | Reactivar producto |
| GET/POST | `/api/usuarios` | Admin | Listar y crear usuarios |
| PUT | `/api/usuarios/{id}/rol` | Admin | Cambiar rol |
| PUT | `/api/usuarios/{id}/estado` | Admin | Activar o desactivar |

## Seguridad

- Contraseñas con hash BCrypt, nunca en texto plano.
- JWT firmado (HMAC-SHA256) con validación de emisor, audiencia y expiración (60 min).
- Autorización por rol validada en el backend.
- Consultas parametrizadas con Dapper (sin concatenar SQL).
- Validación de datos con DataAnnotations y de nuevo en los stored procedures.
- Un administrador no puede cambiar su propio rol ni desactivarse.
- El frontend escapa el contenido que muestra para prevenir XSS.
- Middleware global de errores: no expone detalles internos al cliente.

> Para producción, la clave JWT y la cadena de conexión deben ir en variables de entorno o un gestor de secretos, no en `appsettings.json`. En desarrollo se usan *User Secrets*.

## Estructura

```
PruebaInventario/
├── database/database.sql      Script completo de la base de datos
├── capturas/                  Capturas de pantalla
└── InventarioApi/
    ├── Controllers/           Auth, Inventario, Productos, Usuarios
    ├── Data/                  Conexión y repositorio
    ├── Middleware/            Manejo global de errores
    ├── Models/                DTOs y modelos
    ├── Services/              Generación de JWT
    └── wwwroot/               Frontend 
```

## Capturas

Las capturas están en la carpeta `capturas/`

## Posibles mejoras futuras

- La implementación de refresh tokens y revocación inmediata de sesiones al desactivar un usuario
- Paginación en inventario e historial
- Pruebas automatizadas.
- Movimientos con número de documento y proveedor o cliente.