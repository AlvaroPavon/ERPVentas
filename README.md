# Notas de Venta - ERP de Ventas para Mercadillos

Aplicación web progresiva (PWA) instalable en Android e iOS para gestionar ventas en mercadillos. Permite registrar productos vendidos, generar resúmenes en PDF/CSV/Excel, analizar productos más rentables, gestionar equipos de vendedores con roles y permisos, y mucho más.

## Características Principales

- **Gestión de Ventas**: Añade productos con nombre, precio y cantidad durante el día de venta
- **Edición inline**: Corrige nombre, cantidad o precio de productos ya vendidos
- **Resumen PDF/CSV/Excel**: Exporta el detalle y total de ventas al finalizar
- **Dashboard Interactivo**: Gráficas de ventas mensuales, productos más vendidos, comparativa por días, tendencias 6 meses
- **Múltiples Empresas**: Crea empresas y añade trabajadores para llevar ventas colaborativas
- **Roles y Permisos**: 4 roles predefinidos (owner/admin/member/cashier) con 8 permisos granulares
- **Solicitudes de Unión**: Los usuarios pueden solicitar unirse a empresas y los admin aceptar/rechazar
- **Catálogo de Productos**: Crea productos por empresa con precio, categoría y múltiples variantes de precio (unidad/pack/mayor), autocomplete al vender
- **Escáner de Código de Barras**: Escanea productos con la cámara usando BarcodeDetector API
- **Sistema de Usuarios**: Login seguro con contraseñas validadas (normativa vigente), avatares
- **Multi-vendedor**: Varios usuarios pueden añadir ventas a la misma sesión
- **Notas por Sesión**: Añade notas/observaciones a cada sesión de venta
- **Filtro de Sesiones**: Busca por nombre y filtra por rango de fechas
- **Modo Oscuro Automático**: Cambio automático según hora del día (20:00-07:00) o manual
- **Notificaciones Push**: Recordatorios y alertas vía push nativas
- **Logs de Actividad**: Historial completo de todas las acciones con paginación
- **Backup Automático**: Backup diario de la BD con rotación de 7 días + descarga manual
- **PWA Instalable**: Instálala en tu móvil como una app nativa

## Tecnologías

| Tecnología | Versión | Propósito |
|-----------|---------|-----------|
| Node.js | 18+ | Servidor backend |
| Express | 4.21 | Framework web |
| SQLite (better-sqlite3) | 11 | Base de datos local |
| bcryptjs | 2.4 | Hash de contraseñas |
| JSON Web Token | 9 | Autenticación |
| Chart.js | 4.4 | Gráficas interactivas |
| jsPDF + autoTable | 2.5 | Generación de PDFs |
| ExcelJS | 4.4 | Exportación a Excel |
| web-push | 3.6 | Notificaciones push |
| Service Worker | - | Funcionalidad offline parcial |

## Estructura del Proyecto

```
notas de venta/
├── server.js                  # Servidor principal Express (puerto 3000)
├── database.js                # Configuración SQLite y esquema
├── package.json               # Dependencias
├── PROGRESO.md                # Estado del proyecto y roadmap
├── GUIA_IA.md                 # Guía técnica para IA
├── middleware/
│   └── auth.js                # Middleware de autenticación JWT
├── routes/
│   ├── auth.js                # Registro, login, perfil
│   ├── companies.js           # CRUD empresas, miembros, join requests, roles
│   ├── sales.js               # Sesiones de venta, productos, CSV, Excel, edición
│   ├── dashboard.js           # Estadísticas básicas y avanzadas
│   ├── users.js               # Perfil, avatar, cambio contraseña
│   ├── activity.js            # Logs de actividad
│   ├── products.js            # CRUD productos por empresa
│   ├── permissions.js         # Roles y permisos granulares
│   └── push.js                # Notificaciones push (VAPID)
├── public/
│   ├── index.html             # Entry point SPA
│   ├── manifest.json          # PWA manifest
│   ├── sw.js                  # Service Worker (push + cache)
│   ├── icons/                 # Iconos SVG One UI style
│   ├── css/
│   │   └── style.css          # Estilos One UI 8.5 + dark mode
│   └── js/
│       ├── api.js             # Cliente API REST
│       ├── router.js          # Enrutador SPA hash-based
│       ├── app.js             # App principal, init, estado global, dark mode
│       └── pages/
│           ├── login.js       # Inicio de sesión
│           ├── register.js    # Registro de usuario
│           ├── home.js        # Dashboard con gráficas Chart.js
│           ├── sales.js       # Registro de ventas en vivo
│           ├── sessions.js    # Historial de sesiones con filtros
│           ├── companies.js   # Gestión de empresas + solicitudes
│           ├── company-detail.js # Detalle empresa, miembros, roles, productos
│           ├── join-requests.js # Solicitudes enviadas y recibidas
│           ├── profile.js     # Perfil, avatar, push, backups, dark mode auto
│           └── activity.js    # Logs de actividad
└── ventas.db                  # Base de datos (se crea al iniciar)
```

## Instalación

```bash
# Entrar al directorio
cd "Proyecto_Ventas/notas de venta"

# Instalar dependencias
npm install

# Iniciar servidor
npm start
```

El servidor arrancará en `http://localhost:3000`. Para acceder desde tu móvil, usa la IP local de tu ordenador en el mismo puerto.

**Credenciales de prueba**: test@test.com / Test1234!

## API REST

Todas las rutas excepto `/api/auth/*` requieren header `Authorization: Bearer <token>`.

### Autenticación
| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/register` | Registrar usuario |
| POST | `/api/auth/login` | Iniciar sesión |
| GET | `/api/auth/me` | Obtener usuario actual |

### Empresas
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/companies` | Empresas del usuario |
| POST | `/api/companies` | Crear empresa |
| GET | `/api/companies/search?q=` | Buscar empresas |
| GET | `/api/companies/my-requests` | Solicitudes enviadas |
| GET | `/api/companies/incoming-requests` | Solicitudes recibidas |
| GET | `/api/companies/:id` | Detalle de empresa |
| POST | `/api/companies/:id/users` | Añadir usuario |
| DELETE | `/api/companies/:id/users/:userId` | Eliminar usuario |
| POST | `/api/companies/:id/join-request` | Solicitar unirse |
| GET | `/api/companies/:id/join-requests` | Solicitudes de una empresa |
| POST | `/api/companies/:id/join-requests/:requestId/accept` | Aceptar solicitud |
| POST | `/api/companies/:id/join-requests/:requestId/reject` | Rechazar solicitud |

### Permisos
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/permissions/:companyId` | Permisos de la empresa |
| PUT | `/api/permissions/:companyId/:role` | Actualizar permisos de un rol |

### Productos
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/companies/:id/products` | Catálogo de productos |
| POST | `/api/companies/:id/products` | Crear producto (con `prices` opcional: [{name, price, quantity}]) |
| DELETE | `/api/products/:id` | Eliminar producto |

### Ventas
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/sales/sessions` | Todas las sesiones del usuario |
| GET | `/api/sales/sessions/:companyId` | Sesiones de una empresa |
| POST | `/api/sales/sessions` | Crear sesión (con notes opcional) |
| GET | `/api/sales/session/:id` | Detalle de sesión con ventas |
| POST | `/api/sales/session/:id/items` | Añadir producto vendido |
| PUT | `/api/sales/items/:id` | Editar venta (nombre, cantidad, precio) |
| DELETE | `/api/sales/items/:id` | Eliminar venta |
| PUT | `/api/sales/session/:id` | Editar sesión (nombre, fecha, notas) |
| POST | `/api/sales/session/:id/close` | Cerrar sesión |
| DELETE | `/api/sales/session/:id` | Eliminar sesión |
| GET | `/api/sales/session/:id/csv` | Exportar CSV |
| GET | `/api/sales/session/:id/xlsx` | Exportar Excel |

### Dashboard
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/dashboard/monthly` | Estadísticas mensuales |
| GET | `/api/dashboard/top-products` | Productos más vendidos |
| GET | `/api/dashboard/daily-comparison` | Comparativa por días |
| GET | `/api/dashboard/overview` | Resumen global |
| GET | `/api/dashboard/advanced` | Estadísticas avanzadas |

### Usuario
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/users/profile` | Perfil completo |
| PUT | `/api/users/profile` | Actualizar perfil |
| PUT | `/api/users/password` | Cambiar contraseña |
| PUT | `/api/users/avatar` | Actualizar avatar |
| GET | `/api/users/:id/public` | Perfil público (sin auth) |

### Actividad
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/activity?page=&limit=` | Logs de actividad paginados |

### Push Notifications
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/push/vapid-public-key` | Obtener clave VAPID |
| POST | `/api/push/subscribe` | Suscribirse a push |
| POST | `/api/push/unsubscribe` | Desuscribirse |
| GET | `/api/push/status` | Estado de suscripción |
| POST | `/api/push/test` | Enviar notificación de prueba |

### Backup
| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/api/backup` | Descargar backup de BD |
| GET | `/api/backup/info` | Información del backup |

## Base de Datos

SQLite con las siguientes tablas:

| Tabla | Propósito |
|-------|-----------|
| users | Usuarios del sistema |
| companies | Empresas registradas |
| company_users | Relación usuarios-empresas con roles |
| sales_sessions | Sesiones de venta (días de mercadillo) |
| sales | Productos vendidos en cada sesión |
| join_requests | Solicitudes de unión a empresas |
| products | Catálogo de productos por empresa |
| role_permissions | Permisos granulares por rol y empresa |
| push_subscriptions | Suscripciones a notificaciones push |
| activity_logs | Registro histórico de acciones |

## Diseño UI

Inspirado en Samsung One UI 8.5, con:

- **Colores**: Azul Samsung (#0381fe) como color principal
- **Esquinas redondeadas**: Bordes de 12-20px en cards y botones
- **Navegación inferior**: 5 pestañas accesibles con el pulgar
- **Cards**: Sombra suave y efecto de presión al tocar
- **Tipografía**: Sistema nativa para máxima legibilidad
- **Modales**: Bottom sheets con animación slide-up
- **Splash screen**: Gradiente oscuro con loader
- **Modo oscuro**: Completo con toggle manual y automático (20:00-07:00)

## PWA

- **Instalación**: Añadir a pantalla de inicio en Android/iOS
- **Service Worker**: Cachea estáticos, maneja notificaciones push
- **Offline parcial**: Archivos estáticos disponibles sin conexión
- **Notificaciones**: Push nativas con test desde perfil
