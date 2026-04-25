# 🔗 Guía: Integración de Google Drive para Imágenes

## Estructura Recomendada en Google Drive

### Paso 1: Crear la carpeta principal
1. En Google Drive, crea: `Almacén Digital - Productos`
2. Anota el **ID de la carpeta** (último parámetro en la URL):
   - URL: `https://drive.google.com/drive/folders/1ABC123DEF456GHI789JKL`
   - Folder ID: `1ABC123DEF456GHI789JKL`

### Paso 2: Crear carpetas por producto
Para cada producto del Google Sheet (ej: Mixturador, Batidora, etc.):

```
Almacén Digital - Productos/
├── 1-Mixturador/
│   ├── principal.jpg
│   ├── 01.jpg
│   ├── 02.jpg
│   └── 03.jpg
├── 2-Batidora/
│   ├── principal.jpg
│   ├── 01.jpg
│   └── 02.jpg
└── 3-Tostadora/
    └── principal.jpg
```

### Paso 3: Compartir la carpeta
1. Click derecho en "Almacén Digital - Productos"
2. **Compartir**
3. Cambiar permisos a: **"Cualquiera con el enlace"** → **Viewer**
4. Copiar el URL compartido

## Implementación Técnica

### Opción 1: Firebase Cloud Function (Recomendado)

#### Instalación:
```bash
npm install firebase-admin google-auth-library
firebase init functions
```

#### Función de ejemplo (`functions/index.js`):

```javascript
 const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { google } = require("googleapis");

admin.initializeApp();

const drive = google.drive("v3");

exports.getProductImages = functions.https.onCall(async (data, context) => {
  const { productId, productName } = data;
  
  try {
    // Usar service account para autenticar
    const auth = new google.auth.GoogleAuth({
      keyFilename: "path/to/service-account.json",
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });

    const drive = google.drive({
      version: "v3",
      auth: auth,
    });

    // Buscar carpeta del producto (ej: "1-Mixturador")
    const query = `name = '${productId}-${productName}' and mimeType = 'application/vnd.google-apps.folder'`;
    
    const folderResult = await drive.files.list({
      q: query,
      fields: "files(id)",
      pageSize: 1,
    });

    if (!folderResult.data.files.length) {
      return { success: false, images: [] };
    }

    const folderId = folderResult.data.files[0].id;

    // Obtener archivos de imagen
    const imageQuery = `'${folderId}' in parents and (mimeType='image/jpeg' or mimeType='image/png')`;
    const imageResult = await drive.files.list({
      q: imageQuery,
      fields: "files(id, name, webViewLink, webContentLink)",
      orderBy: "name",
    });

    // Generar URLs públicas
    const images = imageResult.data.files.map(file => ({
      name: file.name,
      url: `https://drive.google.com/uc?id=${file.id}&export=download`
    }));

    return { success: true, images };
  } catch (error) {
    console.error("Error:", error);
    return { success: false, error: error.message };
  }
});
```

#### Desploy:
```bash
firebase deploy --only functions
```

### Opción 2: Script Python automático

```python
# sync_drive_images.py
from google.oauth2 import service_account
from googleapiclient.discovery import build
import json

SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

credentials = service_account.Credentials.from_service_account_file(
    'service-account.json', scopes=SCOPES)

drive_service = build('drive', 'v3', credentials=credentials)

# Carpeta principal ID
MAIN_FOLDER_ID = 'YOUR_FOLDER_ID_HERE'

def get_product_images(product_id, product_name):
    query = f"name = '{product_id}-{product_name}' and mimeType = 'application/vnd.google-apps.folder' and '{MAIN_FOLDER_ID}' in parents"
    
    results = drive_service.files().list(
        q=query, fields='files(id)', pageSize=1).execute()
    
    if not results['files']:
        return []
    
    folder_id = results['files'][0]['id']
    
    # Obtener imágenes
    img_query = f"'{folder_id}' in parents and (mimeType='image/jpeg' or mimeType='image/png')"
    images = drive_service.files().list(
        q=img_query, fields='files(id, name)', orderBy='name').execute()
    
    return [f"https://drive.google.com/uc?id={img['id']}&export=download" 
            for img in images['files']]

# Resultado
images = get_product_images("1", "Mixturador")
print(images)
```

### Ejecutar en Google Sheets automáticamente:

En el Google Sheet, agregar una columna `imagen_url` y usar esta fórmula:

```javascript
// Apps Script en Google Sheets
function onEdit(e) {
  const sheet = e.source.getActiveSheet();
  const range = e.range;
  
  if (range.getColumn() == 2) { // Columna de nombre del producto
    const productId = range.getRow();
    const productName = range.getValue();
    
    // Llamar a la Cloud Function o API
    const url = `https://us-central1-YOUR_PROJECT.cloudfunctions.net/getProductImages`;
    
    const payload = { productId, productName };
    const options = { method: 'post', payload: JSON.stringify(payload) };
    
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    
    // Guardar primera imagen en la hoja
    if (result.images.length > 0) {
      range.offset(0, 3).setValue(result.images[0].url);
    }
  }
}
```

## Integración en Angular

### Service para obtener imágenes:

```typescript
// src/app/services/drive.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class DriveService {
  
  private apiUrl = 'https://us-central1-YOUR_PROJECT.cloudfunctions.net';

  constructor(private http: HttpClient) { }

  getProductImages(productId: number, productName: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/getProductImages`, {
      productId,
      productName
    });
  }
}
```

### Usar en Component:

```typescript
// src/app/components/detail/detail.component.ts
import { DriveService } from '../../services/drive.service';

export class DetailComponent implements OnInit {
  product: Product | null = null;
  productImages: string[] = [];

  constructor(
    private driveService: DriveService,
    ...
  ) { }

  ngOnInit() {
    // ... obtener producto ...
    if (this.product) {
      this.driveService.getProductImages(this.product.id, this.product.nombre)
        .subscribe(result => {
          if (result.success) {
            this.productImages = result.images.map((img: any) => img.url);
          }
        });
    }
  }
}
```

### Mostrar en HTML:

```html
<div class="carousel-slide">
  <img [src]="productImages[currentImageIndex]" 
       [alt]="product.nombre"
       class="w-100">
</div>
```

## Seguridad

⚠️ **Importante:**
- NUNCA exponer API Keys en el código Angular
- Usar Firebase Authentication para verificar usuarios
- Implementar reglas de CORS en Cloud Functions
- Limitar acceso a carpetas específicas

## Paso a Paso para Configurar

1. **Obtener Service Account:**
   - [Google Cloud Console](https://console.cloud.google.com)
   - Crear nuevo proyecto
   - Habilitar "Google Drive API"
   - Crear "Service Account"
   - Descargar JSON key

2. **Compartir carpeta con Service Account:**
   - Obtener email del service account (en el JSON: `client_email`)
   - Compartir carpeta de Drive con ese email

3. **Desplegar Cloud Function:**
   ```bash
   firebase init functions
   cd functions
   npm install google-auth-library googleapis
   # ... copiar código de la función ...
   firebase deploy --only functions
   ```

4. **Probar en Angular:**
   - Inyectar `DriveService`
   - Llamar método en `ngOnInit`
   - Verificar en DevTools Network que se conecta correctamente

## Alternativa: URLs directas en Google Sheet

Si prefieres una solución más simple sin backend:

1. Mantener las imágenes en Drive
2. En el Google Sheet, usar URLs de Drive directas:
   ```
   https://drive.google.com/uc?id=FILE_ID&export=view
   ```
3. Guardar estas URLs en una columna del Sheet
4. Angular las lee directamente del Sheet

**Ventaja:** Simple, sin servidor
**Desventaja:** URLs públicas expuestas, manejo manual

---

**¿Preguntas?** Necesitas ayuda con alguna de estas implementaciones, avisa.
