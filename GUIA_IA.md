# GUÍA PARA IA - Notas de Venta

## Descripción del Proyecto

Aplicación web progresiva (PWA) tipo ERP para gestionar ventas en mercadillos. Desarrollada con Node.js + Express + SQLite en el backend y Vanilla JS SPA en el frontend. Diseñada siguiendo los principios de Samsung One UI 8.5.

## Stack Tecnológico

### Backend
- **Node.js** (v18+) con **Express** 4.21
- **better-sqlite3** 11.x - Base de datos SQLite síncrona
- **bcryptjs** 2.4.x - Hash de contraseñas (12 rondas)
- **jsonwebtoken** 9.x - Tokens JWT (expiración 7 días)
- **web-push** 3.6.x - Notificaciones push VAPID
- **ExcelJS** 4.4.x - Exportación a Excel con estilos

### Frontend
- **Vanilla JS** (ES modules, sin framework)
- **Chart.js** 4.4.x - Gráficas interactivas (CDN)
- **jsPDF** 2.5.x + autoTable - Generación de PDFs (CDN)
- **Service Worker** - Caché offline + notificaciones push
- **BarcodeDetector API** nativa - Escáner de código de barras

### Diseño
- Samsung One UI 8.5 Design System
- https://developer.samsung.com/one-ui/index.html
- Colores: #0381fe (primario), #0072de (dark), #3e91ff (control)
- Iconos SVG con fondo degradado azul y símbolos blancos
- Bordes redondeados (12-20px), sombras suaves

## Estructura de Archivos

```
notas de venta/
├── server.js              # Servidor Express (puerto 3000) + backup auto
├── database.js            # Esquema SQLite + inicialización + migraciones
├── package.json
├── PROGRESO.md            # Estado del proyecto y roadmap
├── GUIA_IA.md             # Esta guía
├── middleware/
│   └── auth.js            # JWT middleware + generateToken()
├── routes/
│   ├── auth.js            # POST /register, /login, GET /me
│   ├── companies.js       # CRUD empresas, miembros, join requests, roles
│   ├── sales.js           # Sesiones venta, items, CSV, XLSX, edición, borrado
│   ├── dashboard.js       # Estadísticas mensuales, top, comparativa, advanced
│   ├── users.js           # Perfil, avatar, contraseña, perfil público
│   ├── activity.js        # Logs de actividad paginados (logActivity helper)
│   ├── products.js        # CRUD productos por empresa
│   ├── permissions.js     # Roles y permisos granulares
│   └── push.js            # Notificaciones push VAPID
├── public/
│   ├── index.html         # Entry point SPA
│   ├── manifest.json      # PWA manifest
│   ├── sw.js              # Service Worker (push + cache estático)
│   ├── icons/             # Iconos SVG One UI style
│   ├── css/
│   │   └── style.css      # One UI 8.5 + dark mode completo
│   └── js/
│       ├── api.js         # Cliente API REST
│       ├── router.js      # Router SPA hash-based
│       ├── app.js         # App principal, init, dark mode, estado global
│       └── pages/
│           ├── login.js
│           ├── register.js
│           ├── home.js     # Dashboard + Chart.js + stats avanzadas
│           ├── sales.js    # Venta activa + escáner + catálogo + edición inline
│           ├── sessions.js # Historial + filtros fecha/búsqueda + detalle
│           ├── companies.js # Lista empresas + crear + buscar + badge solicitudes
│           ├── company-detail.js # Detalle empresa + roles + miembros + productos
│           ├── join-requests.js # Solicitudes enviadas/recibidas + aceptar/rechazar
│           ├── profile.js  # Perfil + avatar + push + backup + dark mode auto
│           └── activity.js # Logs de actividad con paginación
└── ventas.db              # BD auto-creada al iniciar
```

## Base de Datos (SQLite) - 10 tablas

### Tablas

| Tabla | Columnas clave | Propósito |
|-------|---------------|-----------|
| users | id, name, email (UNIQUE), password (bcrypt), avatar | Usuarios |
| companies | id, name, description, created_by | Empresas |
| company_users | user_id, company_id, role (owner/admin/member/cashier), joined_at | Relación N:M |
| sales_sessions | id, company_id, created_by, name, session_date, notes, is_closed | Días de venta |
| sales | id, session_id, user_id, product_name, price, quantity, image_url | Productos vendidos |
| join_requests | id, company_id, user_id, status (pending/accepted/rejected) | Solicitudes unión |
| products | id, company_id, name, price, category, image_url, created_by, prices (JSON) | Catálogo productos + múltiples precios |
| role_permissions | id, company_id, role, permission (UNIQUE trio) | Permisos granulares |
| push_subscriptions | id, user_id, endpoint (UNIQUE), p256dh, auth | Push notifications |
| activity_logs | id, user_id, action, description, company_id, session_id | Logs de actividad |

### Relaciones
- Usuario -> Empresa (N:M mediante company_users)
- Empresa -> Sesiones (1:N)
- Sesión -> Ventas (1:N)
- Usuario -> Ventas (1:N, quién vendió)
- Empresa -> Productos (1:N)
- Empresa -> Role Permissions (1:N)

### Migraciones automáticas (database.js)
- `ALTER TABLE sales ADD COLUMN image_url` (si no existe)
- `ALTER TABLE products ADD COLUMN prices TEXT DEFAULT NULL` (JSON con array de {name, price, quantity})
- `UPDATE company_users SET role = 'owner'` para creadores de empresa con role 'admin'
- Seed de permisos por defecto para todas las empresas existentes

## API REST Completa

Todas las rutas excepto `/api/auth/*` requieren header `Authorization: Bearer <token>`.

### Autenticación
- `POST /api/auth/register` - { name, email, password } -> { token, user }
- `POST /api/auth/login` - { email, password } -> { token, user }
- `GET /api/auth/me` -> { id, name, email, created_at, avatar }

### Empresas
- `GET /api/companies` -> empresas del usuario con role
- `POST /api/companies` - { name, description } -> company
- `GET /api/companies/search?q=` -> empresas que coinciden
- `GET /api/companies/my-requests` -> solicitudes enviadas por el usuario
- `GET /api/companies/incoming-requests` -> solicitudes recibidas (admin/owner)
- `GET /api/companies/:id` -> detalle + usuarios con roles + sesiones
- `POST /api/companies/:id/users` - { email, role } -> añadir miembro
- `DELETE /api/companies/:id/users/:userId` -> eliminar miembro
- `POST /api/companies/:id/join-request` -> solicitar unirse
- `GET /api/companies/:id/join-requests` -> solicitudes de una empresa
- `POST /api/companies/:id/join-requests/:requestId/accept` -> aceptar
- `POST /api/companies/:id/join-requests/:requestId/reject` -> rechazar

### Permisos
- `GET /api/permissions/:companyId` -> permisos actuales por rol
- `PUT /api/permissions/:companyId/:role` - { permissions: [...] } -> actualizar

### Productos
- `GET /api/companies/:id/products` -> catálogo de la empresa
- `POST /api/companies/:id/products` - { name, price, category, image_url, prices } -> producto (prices: array de {name, price, quantity})
- `DELETE /api/products/:id` -> eliminar producto

### Ventas
- `GET /api/sales/sessions` -> sesiones del usuario (últimas 50)
- `GET /api/sales/sessions/:companyId` -> sesiones de una empresa
- `POST /api/sales/sessions` - { company_id, name, session_date, notes } -> sesión
- `GET /api/sales/session/:id` -> sesión + productos + summary + bySeller
- `POST /api/sales/session/:id/items` - { product_name, price, quantity, image_url } -> venta
- `PUT /api/sales/items/:id` - { product_name?, price?, quantity? } -> venta actualizada
- `DELETE /api/sales/items/:id` -> eliminar venta (con permisos)
- `POST /api/sales/session/:id/close` -> cerrar sesión
- `PUT /api/sales/session/:id` - { name?, session_date?, notes? } -> sesión actualizada
- `DELETE /api/sales/session/:id` -> eliminar sesión (con protección)
- `GET /api/sales/session/:id/csv` -> descargar CSV (con BOM UTF-8)
- `GET /api/sales/session/:id/xlsx` -> descargar Excel (.xlsx con estilos)

### Dashboard
- `GET /api/dashboard/monthly?year=&month=` -> stats + dailySales
- `GET /api/dashboard/top-products?limit=` -> productos más vendidos
- `GET /api/dashboard/daily-comparison?limit=` -> comparativa días
- `GET /api/dashboard/overview` -> resumen global (total ventas, items, sesiones, empresas)
- `GET /api/dashboard/advanced` -> ticket promedio, comparativa semanal, tendencias 6m, ventas por vendedor

### Usuario
- `GET /api/users/profile` -> perfil completo
- `PUT /api/users/profile` - { name, email } -> actualizar
- `PUT /api/users/password` - { currentPassword, newPassword } -> cambiar contraseña
- `PUT /api/users/avatar` - { avatar } -> actualizar avatar (base64)
- `GET /api/users/:id/public` -> perfil público (sin auth)

### Actividad
- `GET /api/activity?page=&limit=` -> logs paginados

### Push Notifications
- `GET /api/push/vapid-public-key` -> { publicKey }
- `POST /api/push/subscribe` - { endpoint, keys: { p256dh, auth } } -> suscribir
- `POST /api/push/unsubscribe` - { endpoint } -> desuscribir
- `GET /api/push/status` -> { subscribed }
- `POST /api/push/test` -> enviar notificación de prueba

### Backup
- `GET /api/backup` -> descargar archivo .db
- `GET /api/backup/info` -> { lastBackup, backupCount, autoBackupEnabled }

## Validaciones

### Contraseña (normativa vigente)
- Mínimo 8 caracteres
- Al menos 1 mayúscula
- Al menos 1 minúscula
- Al menos 1 número
- Al menos 1 carácter especial

### Email
- Formato válido (regex)
- Único en base de datos
- Almacenado en minúsculas

## Diseño UI (One UI 8.5)

### Principios
1. **Enfocado en la tarea** - Interfaces simples e intuitivas
2. **Interacción natural** - Área de visualización arriba, interacción abajo
3. **Confort visual** - Colores calmados, buen contraste
4. **Responsive** - Adaptable a cualquier pantalla

### Paleta de colores
- Primario: #0381fe
- Primario dark: #0072de
- Control activado: #3e91ff
- Fondos: #f2f3f7 (light) / #0a0a0f (dark)
- Tarjetas: #ffffff (light) / #1a1a2e (dark)
- Texto: #1a1a2e (primario), #6b7280 (secundario)
- Éxito: #10b981, Advertencia: #f59e0b, Error: #ef4444

### Componentes
- **Bottom Navigation**: 5 tabs, indicador activo con barra superior
- **Botones**: Contained (fondo azul, border-radius: 18dp), Flat (transparente)
- **Cards**: bg blanco, border-radius: 16px, sombra sutil
- **Modales**: Bottom sheet con slide-up
- **Formularios**: Inputs con borde, focus azul con glow

### Modo Oscuro
- CSS custom properties con `[data-theme="dark"]`
- Detecta preferencia del sistema (`prefers-color-scheme`)
- Toggle manual 🌙/☀️ en header (desactiva auto)
- **Modo automático programado**: activo de 20:00 a 07:00, configurable desde Perfil
- Timer cada 60s comprueba hora actual cuando está en modo auto
- Persistencia en localStorage (`darkMode`, `autoDarkMode`)

## PWA

### Service Worker (sw.js)
- **Instalación**: Cachea estáticos (CSS, JS, icons, HTML)
- **Push**: Manejador de eventos `push` y `notificationclick`
- **Estrategia**: Network first para CDN, cache first para locales

### Manifest
- Display: standalone
- Background: #0381fe
- Shortcuts: "Nueva Venta", "Dashboard"
- Categoría: business

## Funcionamiento del Router SPA

- Hash-based routing (`#/page` o `#/page/param`)
- `Router.register(name, handler)` - registra página
- `Router.go(name, params)` - navega y renderiza
- Soporte para params: `company/5` -> `Router.go('company', { id: 5 })`
- Popstate listener para navegación atrás/adelante

## Funciones Globales del Frontend

### App (app.js)
- `App.initDarkMode()` - Inicializa dark mode con auto detect
- `App.applyDarkMode()` - Aplica tema al DOM
- `App.isDarkTime()` - True si hora < 7 o >= 20
- `App.startAutoDarkCheck()` - Timer cada 60s
- `App.showToast(msg, type)` - Toast notificaciones (info/success/error/warning)
- `App.showModal(html)` / `App.hideModal()` - Modal overlay
- `App.updateTitle(title)` - Cambia título del header
- `App.logout()` - Cierra sesión

### API (api.js)
- `API.request(method, path, body)` - Base request con JWT
- Helpers: get, post, put, del
- Métodos específicos para cada endpoint (ver sección API REST)
- `API.downloadBlob(url, filename)` - Download helper con token

### Páginas y sus Funciones

| Archivo | Funciones | Propósito |
|---------|-----------|-----------|
| login.js | renderLogin | Formulario login |
| register.js | renderRegister | Formulario registro |
| home.js | renderHome, loadHomeData, renderHomeStats, renderMonthlyChart, renderTopProductsChart, renderDailyChart, renderAdvancedStats, destroyHomeCharts, showCustomizeModal, getWidgetSettings, isWidgetEnabled | Dashboard completo + widgets personalizables (5 secciones toggleables vía localStorage) |
| sales.js | renderSales, loadSaleSessions, loadSessionDetails, enterSaleSession, addSaleItem, loadCatalogProducts, renderSalesList, updateTotal, editSaleItem, closeCurrentSession, generateSalePDF | Venta activa |
| sessions.js | renderSessions, loadSessions, showSessionDetail, generatePDFFromData | Historial + detalle |
| companies.js | renderCompanies, loadMyCompanies, searchCompanies, loadPendingCount | Empresas |
| company-detail.js | renderCompanyDetail | Detalle empresa |
| join-requests.js | renderJoinRequests | Solicitudes enviadas/recibidas |
| profile.js | renderProfile | Perfil + ajustes |
| activity.js | renderActivity | Logs paginados |

## Notas de Desarrollo

### Convenciones
- Sin frameworks frontend: Vanilla JS puro
- Sin TypeScript: JS plano
- Sin comentarios en código
- CSS con custom properties para theming
- SQLite síncrono con better-sqlite3
- Las rutas estáticas (como `/my-requests`) deben registrarse antes de rutas paramétricas (`/:id`)

### Estructura de Rutas Express (server.js)
```javascript
// Orden importante: rutas estáticas ANTES de paramétricas
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/companies', companyRoutes);  // /my-requests antes de /:id
app.use('/api/sales', saleRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/products', productRoutes);
app.use('/api/permissions', permissionRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/backup', backupRoutes);
app.use(express.static('public'));
// SPA fallback: servir index.html para rutas no API
```

### Backup Automático
- Ejecutado en server.js con `setInterval` cada 24h
- Usa `fs.copyFileSync` con checkpoint WAL
- Rotación: mantiene últimas 7 copias
- Descarga manual desde Perfil

### Activity Logs
- Helper `logActivity(userId, action, description, companyId?, sessionId?)` en routes/activity.js
- Se llama automáticamente en crear sesión, añadir/editar/eliminar venta, cerrar/eliminar sesión, crear empresa
- Endpoint GET con paginación

### Roles y Permisos
- 4 roles: owner, admin, member, cashier
- 8 permisos: manage_company, manage_members, manage_roles, manage_products, manage_sessions, add_sales, delete_sales, view_reports
- Owner tiene todos los permisos (no modificable)
- Seed automático para empresas existentes
- Editor visual en company-detail.js (solo owner)

### Próximas Mejoras Potenciales
- [ ] Chat interno (WebSocket)
- [ ] Modo offline completo (IndexedDB)
- [x] Múltiples precios por producto (variantes unidad/pack/mayor con selector en ventas)
- [ ] Módulo de inventario
- [ ] Gateway de pago (Stripe)
- [ ] Tests automatizados
- [ ] API pública documentada
- [ ] Multi-idioma
- [x] Widgets dashboard personalizables (toggle secciones vía localStorage + botón ⚙️)
- [ ] Facturación electrónica
- [ ] Firma digital
- [ ] Vista administrador global
- [ ] Sistema de comisiones
- [x] Editar sesión (nombre, fecha, notas)
