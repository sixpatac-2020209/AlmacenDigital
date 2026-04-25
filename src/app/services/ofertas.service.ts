import { Injectable, inject } from '@angular/core';
import { Database, ref, push, set, get, update, remove } from '@angular/fire/database';
import { Storage, ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from '@angular/fire/storage';
import { UploadResult } from 'firebase/storage';
import { BehaviorSubject, Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';
import { Oferta } from '../data/ofertas.model';

@Injectable({
  providedIn: 'root'
})
export class OfertasService {
  private db = inject(Database);
  private storage = inject(Storage);
  private ofertasSubject = new BehaviorSubject<Oferta[]>([]);
  public ofertas$ = this.ofertasSubject.asObservable();

  constructor() {
    this.loadOfertas();
  }

  // Cargar ofertas de Firebase
  loadOfertas(): void {
    const dbRef = ref(this.db, 'ofertas');
    get(dbRef).then((snapshot: any) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const ofertas: Oferta[] = Object.keys(data).map(key => ({
          ...data[key],
          id: key
        }));
        this.ofertasSubject.next(ofertas);
      } else {
        this.ofertasSubject.next([]);
      }
    });
  }

  // Obtener ofertas como Observable
  getOfertas(): Observable<Oferta[]> {
    return this.ofertas$;
  }

  // Obtener ofertas activas
  getOfertasActivas(): Observable<Oferta[]> {
    return this.ofertas$.pipe(
      map(ofertas => ofertas.filter(oferta =>
        oferta.activa &&
        oferta.fechaInicio <= Date.now() &&
        oferta.fechaFin >= Date.now()
      ))
    );
  }

  // Crear oferta
  crearOferta(oferta: Oferta, imagenFile?: File): Promise<string> {
    return new Promise((resolve, reject) => {
      if (imagenFile) {
        // Subir imagen primero
        this.uploadImagen(imagenFile).then(imagenUrl => {
          oferta.imagen = imagenUrl;
          this.guardarOferta(oferta).then(id => resolve(id)).catch(reject);
        }).catch(reject);
      } else {
        this.guardarOferta(oferta).then(id => resolve(id)).catch(reject);
      }
    });
  }

  private guardarOferta(oferta: Oferta): Promise<string> {
    const dbRef = ref(this.db, 'ofertas');
    const newRef = push(dbRef);
    const ofertaId = newRef.key;

    return set(newRef, {
      ...oferta,
      createdAt: Date.now()
    }).then(() => {
      this.loadOfertas();
      return ofertaId || '';
    });
  }

  // Actualizar oferta
  actualizarOferta(id: string, oferta: Partial<Oferta>, imagenFile?: File): Promise<void> {
    return new Promise((resolve, reject) => {
      if (imagenFile) {
        this.uploadImagen(imagenFile).then(imagenUrl => {
          oferta.imagen = imagenUrl;
          this.actualizarOfertaEnBD(id, oferta).then(() => resolve()).catch(reject);
        }).catch(reject);
      } else {
        this.actualizarOfertaEnBD(id, oferta).then(() => resolve()).catch(reject);
      }
    });
  }

  private actualizarOfertaEnBD(id: string, oferta: Partial<Oferta>): Promise<void> {
    const dbRef = ref(this.db, `ofertas/${id}`);
    return update(dbRef, oferta).then(() => {
      this.loadOfertas();
    });
  }

  // Eliminar oferta
  eliminarOferta(id: string): Promise<void> {
    const dbRef = ref(this.db, `ofertas/${id}`);

    return get(dbRef).then((snapshot: any) => {
      const oferta = snapshot.exists() ? snapshot.val() : null;
      const imagenUrl: string = oferta?.imagen;

      return this.eliminarImagenOferta(imagenUrl).then(() => {
        return remove(dbRef);
      });
    }).then(() => {
      this.loadOfertas();
    });
  }

  private uploadImagen(file: File): Promise<string> {
    const fileName = `ofertas/${Date.now()}_${file.name}`;
    const storageReference = storageRef(this.storage, fileName);

    return uploadBytes(storageReference, file).then((snapshot: UploadResult) => {
      return getDownloadURL(snapshot.ref);
    });
  }

  private eliminarImagenOferta(imagenUrl: string): Promise<void> {
    if (!imagenUrl) {
      return Promise.resolve();
    }

    try {
      const storagePath = this.extraerRutaStorageDesdeUrl(imagenUrl);
      if (!storagePath) {
        return Promise.resolve();
      }
      const imageRef = storageRef(this.storage, storagePath);
      return deleteObject(imageRef);
    } catch (error) {
      return Promise.resolve();
    }
  }

  private extraerRutaStorageDesdeUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathMatch = urlObj.pathname.match(/\/o\/(.+)$/);
      if (!pathMatch || !pathMatch[1]) {
        return null;
      }
      return decodeURIComponent(pathMatch[1]);
    } catch (error) {
      return null;
    }
  }
}