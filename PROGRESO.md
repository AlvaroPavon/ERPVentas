# PROGRESO DEL PROYECTO - Notas de Venta

## Estado Actual: ✅ EN DESARROLLO (v1.9.0)

## Resumen

Aplicación web ERP para gestión de ventas en mercadillos, instalable como PWA en Android e iOS.
Con módulo de inventario, sistema de comisiones, dashboard por empresa y exportación de catálogo.

## Puntos Completados

### 1. Infraestructura del Proyecto
- [x] Creación de estructura de directorios
- [x] Configuración de Node.js + Express
- [x] Base de datos SQLite con esquema completo
- [x] Variables de entorno y configuración

### 2. Sistema de Autenticación
- [x] Registro de usuarios con validación de contraseña (normativa vigente)
- [x] Inicio de sesión con JWT (expiración 7 días)
- [x] Verificación de token en todas las rutas protegidas
- [x] Validación de email único y formato válido
- [x] Middleware de autenticación

### 3. Gestión de Empresas
- [x] CRUD completo de empresas
- [x] Búsqueda de empresas por nombre
- [x] Añadir/eliminar usuarios a empresas
- [x] Roles (owner/admin/member/cashier)
- [x] Roles personalizados con permisos granulares (8 permisos)
- [x] Solicitudes de unión a empresas (join requests)
- [x] Aceptar/rechazar solicitudes recibidas
- [x] Ver perfil público de usuarios desde detalle empresa
- [x] Página de solicitudes enviadas y recibidas
- [x] Badge de solicitudes pendientes en empresas

### 4. Sistema de Ventas
- [x] Creación de sesiones de venta por día
- [x] Nombrado personalizado de sesiones (ej: "ventas ciguela 2026")
- [x] Notas/descripción por sesión
- [x] Añadir productos vendidos (nombre + precio + cantidad)
- [x] Asignación automática de vendedor (quién añade el producto)
- [x] Visualización en tiempo real del total
- [x] Eliminación de productos
- [x] Edición inline de productos (nombre, cantidad, precio)
- [x] Cierre de sesiones
- [x] Eliminación de sesiones (con protección)
- [x] Multi-vendedor en la misma sesión
- [x] Catálogo de productos por empresa con autocomplete
- [x] Escáner de código de barras (BarcodeDetector API)
- [x] Imágenes en productos (base64)
- [x] Búsqueda de sesiones por nombre y filtro por fecha

### 5. Dashboard y Analíticas
- [x] Estadísticas mensuales (total ventas, items, sesiones)
- [x] Gráfica de ventas por día (barras)
- [x] Top productos más vendidos (doughnut)
- [x] Comparativa de días de venta (línea)
- [x] Resumen global del usuario
- [x] Selector de mes para navegar históricos
- [x] Ticket promedio, comparativa semanal, tendencias 6 meses
- [x] Ventas por vendedor con porcentajes

### 6. Generación de PDF
- [x] PDF con detalle de productos vendidos
- [x] Tabla de productos (nombre, cantidad, precio, total, vendedor)
- [x] Resumen por vendedor
- [x] Total general
- [x] Fecha de generación

### 7. Interfaz de Usuario (One UI 8.5)
- [x] Diseño mobile-first responsive
- [x] Navegación inferior con 5 pestañas (+ chat)
- [x] Cards con bordes redondeados y sombras
- [x] Splash screen con gradiente
- [x] Iconos SVG estilo One UI (fondo degradado + símbolo blanco)
- [x] Botones con border-radius 18dp
- [x] Colores oficiales One UI (#0381fe primario)
- [x] Transiciones y animaciones suaves
- [x] Bottom sheets modales

### 8. PWA (Progressive Web App)
- [x] Manifest.json con iconos SVG
- [x] Service Worker con estrategia de caché
- [x] Meta tags para iOS (apple-mobile-web-app)
- [x] Instalable en Android e iOS
- [x] Shortcuts para acceso rápido
- [x] Notificaciones push con VAPID

### 9. Gestión de Usuarios
- [x] Perfil de usuario (nombre, email, avatar)
- [x] Cambio de contraseña
- [x] Actualización de datos personales
- [x] Avatar con upload (base64)
- [x] Perfil público de usuario (GET /api/users/:id/public)

### 10. Documentación
- [x] README.md - Documentación completa del proyecto
- [x] GUIA_IA.md - Guía técnica para IA
- [x] PROGRESO.md - Este archivo de progreso

### 11. Módulo de Inventario (v1.4.0)
- [x] Tabla de stock por empresa
- [x] Movimientos de inventario
- [x] Alertas de stock bajo
- [x] Umbral mínimo configurable

### 12. Sistema de Comisiones (v1.4.0)
- [x] Configuración de porcentajes por rol
- [x] Resumen de comisiones por vendedor en sesiones cerradas

### 13. Dashboard por Empresa (v1.4.0)
- [x] Estadísticas específicas por empresa

### 14. Exportar Catálogo (v1.4.0)
- [x] Descarga en CSV y Excel (.xlsx)

## Funcionalidades Implementadas en esta sesión

### 15. 🧪 Tests Automáticos (109 tests)
- [x] Jest + Supertest configurados
- [x] 12 suites de tests en `tests/`
- [x] Tests de integración para todas las rutas API
- [x] BD en memoria para tests (TEST_DB=true)
- [x] Red de seguridad para todo el proyecto

### 16. 💬 Chat Interno (WebSocket)
- [x] Tablas chat_conversations, chat_conversations_participants, chat_messages
- [x] Router REST `/api/chat/*` (conversaciones, mensajes, participantes, reacciones)
- [x] Servidor WebSocket en `/ws` con autenticación JWT
- [x] Cliente WebSocket con reconexión automática
- [x] Página de chat con sidebar, mensajes en tiempo real
- [x] Reacciones con emojis (👍❤️😂😮😢🎉🔥👏🤔✅)
- [x] Indicador de "está escribiendo..."
- [x] Estado online/offline de usuarios
- [x] Modales para nueva conversación, miembros, en línea
- [x] Badge de no leídos en navegación
- [x] Auto-creación de canal "general" por empresa
- [x] Estilos adaptados a One UI 8.5

### 17. 📧 Resumen Diario por Email (v1.6.0)
- [x] Dependencias: nodemailer + node-cron en package.json
- [x] Migración DB: columnas email_summary_enabled y email_summary_time en companies
- [x] Servicio de agregación: services/summary-service.js (getDailySummary)
- [x] Servicio de email: services/email-service.js (nodemailer + template HTML)
- [x] Template HTML estilo One UI: templates/email-summary.html
- [x] API: PATCH /api/companies/:id/settings (owner/admin)
- [x] Cron automático en server.js (ejecución cada minuto, matchea hora configurada)
- [x] Tests unitarios: summary-service (5) + email-service (4)
- [x] Tests de integración: settings API + cron (5)
- [x] 14 tests nuevos — total: 123 tests pasando

### 18. 🏷️ Categorías/Etiquetas en Productos (v1.6.0)
- [x] Nueva tabla `categories` (id, company_id, name, color, created_at)
- [x] Columna `category_id` + `tags` (JSON array) en products
- [x] Migración automática de categorías existentes (category TEXT → categories table)
- [x] CRUD de categorías: routes/categories.js con aislamiento por empresa
- [x] Filtro de productos por categoría y etiquetas (JSON_EACH)
- [x] Actualización de productos con category_id y tags
- [x] Tests: categories (8) + products (11) — 19 nuevos
- [x] Total: 142 tests pasando

### 19. 🐛 Fix: Pantalla de Carga (Splash Screen)
- [x] **CAUSA**: Redeclaración `const chatSocket` entre `chat.js` y `app.js` → app.js nunca se ejecutaba
- [x] Eliminada redeclaración de `chatSocket` y `EMOJI_PICKER` en `app.js` (ya están en `chat.js`)
- [x] Referencias actualizadas a `window.chatSocket` en `app.js`
- [x] **CAUSA 2**: Error SQL en BD existente — `CREATE INDEX` en `category_id` fallaba porque la columna no existía en DB legacy
- [x] Movido `CREATE INDEX idx_products_category` a después de las migraciones ALTER TABLE
- [x] Server arranca limpio con BD existente

### 20. 🐛 Fix: Chat — "Cargando chat..." infinito + contactos + borrar chat
- [x] **CAUSA**: `pages/chat.js` no estaba en los script tags del HTML, solo se cargaba via `import()` dinámico que no funcionaba para funciones globales
- [x] Agregado `<script src="js/pages/chat.js">` al index.html
- [x] Simplificado route de chat en app.js — llamada directa a `renderChatPage()`
- [x] **Contactos**: Nuevo endpoint `GET /api/chat/contacts` — devuelve compañeros de empresa
- [x] **Borrar chat**: Nuevo endpoint `DELETE /api/chat/conversations/:id` — elimina y limpia si no quedan participantes
- [x] Sidebar muestra contactos como chats iniciables cuando no hay conversaciones
- [x] Modal de contactos con tap para iniciar DM o abrir DM existente
- [x] Botón de eliminar conversación en el header (🗑️) con confirmación
- [x] Botón de refrescar (🔄) para recargar conversaciones
- [x] "No hay contactos" con mensaje claro cuando no hay compañeros de empresa
- [x] Estilos: `.btn-danger`, `.contact-avatar`, `.list-empty-sub`, `.chat-sidebar-footer`
- [x] `openImageModal()` agregado para imágenes en mensajes

### 20b. 🧑‍🤝‍🧑 Sistema de Amigos (v1.7.0)
- [x] Tabla `friend_requests` en BD (sender, receiver, status: pending/accepted/rejected)
- [x] Ruta `routes/friends.js`: search, send, accept, reject, list, remove
- [x] Contactos de chat ahora usan amigos (no company members)
- [x] Buscar personas por nombre/email con estado (amigo/pendiente/enviar solicitud)
- [x] Solicitudes de amistad aparecen en el sidebar del chat
- [x] Botones Aceptar/Rechazar en cada solicitud
- [x] Modal de amigos con chat directo (DM) integrado
- [x] Botón "🔍 Buscar" para encontrar y agregar personas

### 20c. 📨 Chat en Tiempo Real + Push Notifications
- [x] Mensajes via WebSocket aparecen al instante sin recargar
- [x] Handler `onMessage` en chatSocket agrega mensaje al chat abierto
- [x] Actualiza la lista de conversaciones automáticamente
- [x] Notificaciones push para mensajes de chat (VAPID)
- [x] Si el destinatario está offline, se le envía push con nombre y mensaje
- [x] Helper `sendPushToUser()` y `isUserOnline()` en routes/chat.js

### 21. 🎨 Fix: Dashboard chips + Chat layout
- [x] **Dashboard**: Agregado CSS `.chip-group` y `.chip` — estilo One UI con pills, active con gradient, hover/active
- [x] **Chat**: Altura corregida con `calc(100vh - header - nav - 20px)`
- [x] **Chat**: Container con borde y border-radius 18dp (One UI)
- [x] **Chat mobile**: Sidebar full-width cuando no hay chat abierto, se oculta al abrir conversación
- [x] **Chat mobile**: Selector CSS `.chat-sidebar:not(.collapsed) ~ .chat-main` para toggle limpio
- [x] **Chat**: Botón atrás restaura sidebar (`.collapsed` removido en closeChatView)
- [x] **Chat**: Estilos para `.chat-message-avatar img` (object-fit: cover)
- [x] **Chat**: Sidebar footer "👥 Contactos" visible solo en desktop

## Funcionalidades Pendientes (Futuras)

### 22. 🌐 Multi-idioma Dashboard + Multi-empresa + Métricas Comparativas (v1.8.0)
- [x] Sistema i18n con 5 idiomas (es, en, ca, eu, gl)
- [x] Selector de idioma persistente en dashboard
- [x] Filtro multi-empresa por companyId para Admin/Owner
- [x] Validación RBAC: 403 si no pertenece a la empresa
- [x] Cálculo Period-over-Period con CTEs SQL
- [x] Indicadores visuales de crecimiento (↑ verde / ↓ rojo / 🆕 Nuevo)
- [x] 13 tests nuevos (155 total)

### 23. 🎨 Sistema de Temas con Paletas de Acento (v1.9.0)
- [x] 3 modos de tema: Claro / Oscuro / Auto (sigue prefers-color-scheme del dispositivo)
- [x] 8 paletas de color acento: azul, verde, morado, naranja, rosa, teal, rojo, índigo
- [x] Selector de modo y acento en Perfil
- [x] Persistencia en localStorage
- [x] Toggle en header cicla: Auto → Oscuro → Claro
- [x] theme-color dinámico para PWA splash screen
- [x] CSS custom properties con [data-accent] para rendimiento óptimo
- [x] dark/light mode con @media (prefers-color-scheme)

### Próximas
- [ ] **Exportar dashboard como PDF/imagen** — compartir gráficas
- [ ] **Modo offline completo** — IndexedDB + sincronización

### Largo Plazo
- [ ] **Gateway de pago** — Stripe para cobros con TPV virtual
- [ ] **Facturación electrónica** — facturas con IVA
- [ ] **Modo offline completo** — Cachear datos con IndexedDB
- [ ] **Firma digital** — firma de sesiones con PIN o biometría
- [ ] **Tests E2E frontend** — Playwright
- [ ] **CI/CD pipeline** — GitHub Actions
- [ ] **API pública documentada** — Swagger
- [x] **Panel multi-idioma** — es/en/ca/eu/gl (v1.8.0)
- [x] **Vista administrador** — panel global multi-empresa (v1.8.0)

## Notas del Diseño

El diseño sigue fielmente los principios de Samsung One UI 8.5:
- **Web de Samsung**: https://developer.samsung.com/one-ui/index.html
- **Colores**: Azul Samsung (#0381fe) como color principal
- **Iconos**: Fondo cuadrado con radius 40px (en 192x192), degradado azul, símbolo blanco
- **Tipografía**: Sistema nativa para máxima legibilidad
- **Navegación**: Bottom navigation con máximo 6 tabs (incluyendo chat)
- **Botones**: Contained (contenidos) con border-radius 18dp
- **Cards**: Esquinas redondeadas (12-20px), sombras tipo One UI
- **Vista en escritorio**: max-width 600px centrado