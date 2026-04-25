# 🏪 AlmacenDigital - E-commerce con Firebase

Tienda en línea completa con panel de administración, autenticación y gestión de productos en tiempo real.

## ✨ Características

- 🛒 **Tienda en línea completa** - Home, Shop, Detail, Cart, Checkout
- 🔐 **Panel de administración** - Gestión completa de productos con autenticación
- 📸 **Subida de imágenes** - Firebase Storage para imágenes de productos
- 💾 **Base de datos en tiempo real** - Firebase Realtime Database
- 🌙 **Modo oscuro** - Interfaz adaptable
- 📱 **Responsive** - Diseño móvil-first
- 🔍 **Búsqueda y filtros** - Búsqueda por nombre y categoría
- 🏷️ **Sistema de ofertas** - Precios normales y de oferta

## 🚀 Configuración Inicial

### 1. Instalar dependencias
```bash
npm install
```

### 2. Configurar Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Crea un nuevo proyecto o usa uno existente
3. Habilita los siguientes servicios:
   - **Authentication** (Email/Password)
   - **Realtime Database**
   - **Storage**

### 3. Obtener configuración de Firebase

En Project Settings > General > Your apps > Web app:

```javascript
// src/environments/environment.ts
export const environment = {
  production: false,
  firebase: {
    apiKey: "TU_API_KEY",
    authDomain: "TU_PROJECT.firebaseapp.com",
    projectId: "TU_PROJECT_ID",
    storageBucket: "TU_PROJECT.appspot.com",
    messagingSenderId: "TU_SENDER_ID",
    appId: "TU_APP_ID"
  }
};
```

### 4. Configurar reglas de seguridad

#### Realtime Database Rules:
```json
{
  "rules": {
    ".read": "auth != null",
    ".write": "auth != null",
    "productos": {
      ".read": true,
      ".write": "auth != null"
    }
  }
}
```

#### Storage Rules:
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /productos/{productId}/{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

## 👤 Crear usuario administrador

### Opción 1: Desde Firebase Console
1. Ve a Authentication > Users
2. Add user con email y contraseña

### Opción 2: Desde la aplicación
1. Ejecuta la aplicación: `ng serve`
2. Ve a `/admin/login`
3. Regístrate con tu email y contraseña

## 🛠️ Desarrollo

### Servidor de desarrollo
```bash
ng serve
```
Navega a `http://localhost:4200/`

### Build de producción
```bash
ng build --configuration production
```

### Deploy a Firebase
```bash
firebase deploy
```

## 📁 Estructura del proyecto

```
src/
├── app/
│   ├── components/
│   │   ├── admin/           # Panel de administración
│   │   │   ├── admin-dashboard.component.ts
│   │   │   └── admin-login.component.ts
│   │   ├── cart/            # Carrito de compras
│   │   ├── checkout/        # Checkout/Pago
│   │   ├── contact/         # Página de contacto
│   │   ├── detail/          # Detalle de producto
│   │   ├── header/          # Header con navegación
│   │   ├── home/            # Página principal
│   │   └── shop/            # Tienda/catálogo
│   ├── guards/              # Guards de autenticación
│   ├── services/            # Servicios
│   │   ├── auth.service.ts      # Autenticación
│   │   ├── cart.service.ts      # Carrito
│   │   ├── firebase.service.ts  # Firebase operations
│   │   └── product.service.ts   # Productos
│   ├── app.config.ts        # Configuración Firebase
│   ├── app.routes.ts        # Rutas
│   └── app.component.ts     # Componente raíz
├── environments/            # Configuración por entorno
└── assets/                  # Recursos estáticos
```

## 🔧 Servicios principales

### FirebaseService
Gestiona todas las operaciones con Firebase:
- CRUD de productos
- Subida de imágenes
- Observables en tiempo real

### AuthService
Maneja autenticación de usuarios:
- Login/Registro
- Estado de autenticación
- Guards de rutas

### ProductService
Interfaz para productos:
- Carga desde Firebase
- Compatibilidad con Google Sheets (legacy)
- Filtros y búsqueda

## 🎨 Personalización

### Tema y colores
Los colores principales están definidos en `src/assets/css/style.css`:
- Colores primarios: Naranja (#FF8C00)
- Modo oscuro: Variables CSS automáticas

### Logo
Reemplaza `src/assets/img/AlmacenDigitalLogo.png` con tu logo.

## 📊 Panel de administración

### Acceso
- URL: `/admin/login`
- Icono: 🔒 en el header (esquina superior derecha)

### Funciones
- ✅ Crear productos nuevos
- ✅ Editar productos existentes
- ✅ Subir múltiples imágenes
- ✅ Gestionar precios y ofertas
- ✅ Eliminar productos
- ✅ Vista en tiempo real

### Formulario de producto
Campos disponibles:
- Nombre
- Descripción
- Precio normal
- Precio de oferta (opcional)
- Categoría
- Imágenes (múltiples)
- Estado de oferta (1=activo, 0=inactivo)

## 🔍 Sistema de ofertas

El sistema de ofertas funciona así:
- Si `oferta = 1`: Muestra precio de oferta
- Si `oferta = 0`: Muestra precio normal
- Los precios se actualizan automáticamente en toda la tienda

## 🚀 Deployment

### Firebase Hosting
```bash
# Instalar Firebase CLI
npm install -g firebase-tools

# Login
firebase login

# Inicializar (si no está hecho)
firebase init

# Deploy
firebase deploy
```

### Variables de entorno
Asegúrate de que `src/environments/environment.prod.ts` tenga la configuración correcta para producción.

## 🐛 Solución de problemas

### Error de Firebase
- Verifica que las reglas de seguridad estén configuradas
- Confirma que la configuración en `environment.ts` sea correcta

### Problemas de autenticación
- Usuario debe estar registrado en Firebase Authentication
- Verifica que las reglas permitan escritura para usuarios autenticados

### Imágenes no se muestran
- Verifica permisos de Storage
- Confirma que las URLs de imágenes sean válidas

## 📝 Notas de desarrollo

- La aplicación usa Angular 17 con standalone components
- Firebase se integra mediante @angular/fire
- El estado se maneja con BehaviorSubjects y Observables
- Diseño responsive con Bootstrap

## 🤝 Contribución

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para más detalles.

---

**Desarrollado con ❤️ usando Angular + Firebase**