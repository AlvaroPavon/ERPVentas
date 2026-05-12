# PROGRESO DEL PROYECTO - Notas de Venta

## Estado Actual: ✅ COMPLETADO (v1.3.0)

## Resumen

Aplicación web ERP para gestión de ventas en mercadillos, instalable como PWA en Android e iOS.

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
- [x] Navegación inferior con 5 pestañas
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

## Funcionalidades Implementadas (v1.3.0)

### v1.1.0
- [x] Modo oscuro (Dark Mode) siguiendo One UI con toggle manual
- [x] Exportación a CSV con BOM UTF-8 para Excel
- [x] Exportación a Excel (.xlsx) con estilos (ExcelJS)
- [x] Galería de imágenes para productos (base64)
- [x] Logs de actividad con paginación
- [x] Campo de cantidad ajustable en ventas
- [x] Botón de cambio rápido de modo oscuro en el header

### v1.2.0
- [x] **Backup automático BD** cada 24h + descarga manual desde perfil (rotación 7)
- [x] **Estadísticas avanzadas**: ticket promedio, comparativa semanal, tendencias mensuales 6m, ventas por vendedor
- [x] **Perfiles de producto**: catálogo por empresa con precio/categoría + autocomplete en ventas
- [x] **Escáner de código de barras**: BarcodeDetector API nativa del navegador
- [x] **Roles personalizados**: permisos granulares (8 permisos, 4 roles predefinidos) con editor visual en empresa
- [x] **Notificaciones push**: suscripción VAPID + Service Worker + test notification
- [x] **Ver perfil de usuario** desde detalle de empresa (modal con avatar, nombre, email, fechas)
- [x] **Solicitudes de unión**: página de solicitudes enviadas/recibidas con badges y acciones aceptar/rechazar

### v1.3.0
- [x] **Empresas clickables en solicitudes**: navegan al detalle de empresa + usuarios clickables para ver perfil
- [x] **Modo oscuro automático programado**: activo de 20:00 a 07:00, toggle en Perfil, desactivable manualmente
- [x] **Edición inline de ventas**: editar nombre, cantidad y precio de productos vendidos con botones ✏️
- [x] **Notas de sesión visibles**: se muestran en vista activa de venta y en detalle de sesión
- [x] **Filtro por fecha en sesiones**: selector de rango de fechas + búsqueda por nombre
- [x] **Eliminar sesión**: endpoint DELETE + botón 🗑️ en detalle (con protección por permisos)
- [x] **Contador de sesiones** en el título del listado
- [x] **Editar sesión**: modal con nombre, fecha y notas desde detalle de sesión
- [x] **Múltiples precios por producto**: variantes de precio por cantidad (unidad, pack, mayor) con selector en ventas
- [x] **Widgets personalizables en dashboard**: toggle para cada sección (stats, gráficas, avanzadas) desde ⚙️ Personalizar

## Funcionalidades Pendientes (Futuras)

### Próximas
- [ ] **Chat interno**: Sistema de mensajería en tiempo real entre miembros de empresa (WebSocket)
- [ ] **Modo offline completo**: Cachear datos de API con IndexedDB para operar sin conexión y sincronizar después
- [x] **Múltiples precios por producto**: Precio por unidad, por pack, por mayor con selector en ventas

### Largo Plazo
- [ ] **Módulo de inventario**: Control de stock, alertas de reposición, histórico de precios
- [ ] **Gateway de pago**: Integrar pasarela como Stripe para cobros con TPV virtual
- [ ] **Tests automatizados**: Tests unitarios y de integración (backend) + tests E2E (frontend)
- [ ] **CI/CD pipeline**: GitHub Actions para lint, test y deploy automático
- [ ] **API pública**: Endpoints documentados para integración con otras herramientas
- [ ] **Panel multi-idioma**: Soporte para español/inglés/catalán/euskera/gallego
- [x] **Widgets personalizables en dashboard**: Elegir qué gráficas y estadísticas mostrar con botón ⚙️ Personalizar
- [ ] **Facturación electrónica**: Generar facturas oficiales con desglose de IVA y números de factura
- [ ] **Firma digital**: Firma de sesiones y cierres con PIN o biometría
- [ ] **Vista administrador**: Panel global para gestionar múltiples empresas desde una sola cuenta
- [ ] **Sistema de comisiones**: Calcular comisiones por vendedor con porcentajes configurables
- [x] **Editar sesión**: Poder cambiar nombre, fecha y notas de una sesión existente desde el detalle

## Notas del Diseño

El diseño sigue fielmente los principios de Samsung One UI 8.5:
- **Web de Samsung**: https://developer.samsung.com/one-ui/index.html
- **Colores**: Azul One UI (#0381fe) como color principal
- **Iconos**: Fondo cuadrado con radius 40px (en 192x192), degradado azul, símbolo blanco
- **Tipografía**: Sistema nativa del dispositivo
- **Navegación**: Bottom navigation con máximo 5 tabs
- **Botones**: Contained (contenidos) con border-radius 18dp
- **Cards**: Esquinas redondeadas (12-20px), sombras tipo One UI
