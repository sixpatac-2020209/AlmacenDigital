import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FirebaseService, Producto, Categoria } from '../../services/firebase.service';
import { OfertasService } from '../../services/ofertas.service';
import { Oferta } from '../../data/ofertas.model';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.css'
})
export class AdminDashboardComponent implements OnInit {
  productos: Producto[] = [];
  categorias: Categoria[] = [];
  ofertas: Oferta[] = [];
  showForm = false;
  showCategoriaForm = false;
  showOfertaForm = false;
  editingId: string | null = null;
  editingCategoriaId: string | null = null;
  editingOfertaId: string | null = null;
  loading = false;
  uploading = false;
  error = '';
  success = '';

  form: Producto = {
    nombre: '',
    descripcion: '',
    precio: 0,
    precioOferta: 0,
    oferta: 0,
    categoriaId: '',
    imagenes: [],
    cantidad: 0
  };

  categoriaForm: Categoria = {
    nombre: '',
  };

  ofertaForm: Oferta = {
    titulo: '',
    descripcion: '',
    imagen: '',
    fechaInicio: Date.now(),
    fechaFin: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 días por defecto
    activa: true
  };

  selectedFiles: File[] = [];
  selectedOfertaFile: File | null = null;

  constructor(
    private firebaseService: FirebaseService,
    private authService: AuthService,
    private router: Router,
    private ofertasService: OfertasService
  ) {}

  ngOnInit(): void {
    this.loadProductos();
    this.loadCategorias();
    this.loadOfertas();
  }

  loadProductos(): void {
    this.firebaseService.getProductos().subscribe((productos) => {
      this.productos = productos;
    });
  }

  loadCategorias(): void {
    this.firebaseService.getCategorias().subscribe((categorias) => {
      this.categorias = categorias;
    });
  }

  loadOfertas(): void {
    this.ofertasService.getOfertas().subscribe((ofertas) => {
      this.ofertas = ofertas;
    });
  }

  toggleForm(): void {
    this.showForm = !this.showForm;
    if (this.showForm) {
      this.resetForm();
    }
  }

  resetForm(): void {
    this.form = {
      nombre: '',
      descripcion: '',
      precio: 0,
      precioOferta: 0,
      oferta: 0,
      categoriaId: '',
      imagenes: [],
      cantidad: 0
    };
    this.selectedFiles = [];
    this.editingId = null;
    this.error = '';
    this.success = '';
  }

  onFileSelected(event: any): void {
    const files = Array.from(event.target.files) as File[];
    const existingCount = this.form.imagenes?.length || 0;
    const maxAllowed = 5 - existingCount;

    if (files.length > maxAllowed) {
      this.error = `Solo puedes seleccionar hasta ${maxAllowed} imagen(es) adicionales.`;
      this.selectedFiles = files.slice(0, maxAllowed);
    } else {
      this.error = '';
      this.selectedFiles = files;
    }
  }

  guardarProducto(): void {
    if (!this.form.nombre || !this.form.precio || this.form.cantidad < 0) {
      this.error = 'Por favor completa nombre, precio y cantidad válida';
      return;
    }

    const existingImages = this.form.imagenes?.length || 0;
    const totalImages = existingImages + this.selectedFiles.length;

    if (totalImages === 0) {
      this.error = 'Debes subir al menos una imagen para el producto';
      return;
    }

    if (totalImages > 5) {
      this.error = 'El producto no puede tener más de 5 imágenes';
      return;
    }

    // Validar precio de oferta si tiene oferta
    if (this.form.oferta == 1 && (!this.form.precioOferta || this.form.precioOferta >= this.form.precio)) {
      this.error = 'Si tiene oferta, el precio de oferta debe ser menor al precio normal';
      return;
    }

    this.loading = true;
    this.error = '';
    this.success = '';

    const saveOperation = this.editingId
      ? this.firebaseService.actualizarProducto(this.editingId, this.form)
      : this.firebaseService.crearProducto(this.form);

    saveOperation.then((productId) => {
      // Subir imágenes si hay
      if (this.selectedFiles.length > 0) {
        this.uploading = true;
        const idToUse: string = this.editingId || productId || '';
        try {
          this.firebaseService.subirMultiplesImagenes(
            this.selectedFiles,
            idToUse
          ).then((urls: string[]) => {
            const producto = this.editingId ? this.form : { ...this.form, id: productId };
            const imagenes = [...(producto.imagenes || []), ...urls];
            
            return this.firebaseService.actualizarProducto(
              idToUse,
              { imagenes }
            );
          }).then(() => {
            this.success = 'Producto guardado con imágenes correctamente';
            this.showForm = false;
            this.resetForm();
            this.loadProductos();
          }).catch((err: any) => {
            this.error = 'Error al subir imágenes: ' + err.message;
          }).finally(() => {
            this.uploading = false;
            this.loading = false;
          });
        } catch (err: any) {
          this.error = 'Error: ' + err.message;
          this.uploading = false;
          this.loading = false;
        }
      } else {
        this.success = 'Producto guardado correctamente';
        this.showForm = false;
        this.resetForm();
        this.loadProductos();
        this.loading = false;
      }
    }).catch((error) => {
      this.error = 'Error: ' + error.message;
      this.loading = false;
    });
  }

  editarProducto(producto: Producto): void {
    this.form = { ...producto };
    this.editingId = producto.id || null;
    this.selectedFiles = [];
    this.showForm = true;
    this.error = '';
    this.success = '';
  }

  eliminarProducto(id: string): void {
    if (confirm('¿Estás seguro de que quieres eliminar este producto?')) {
      this.firebaseService.eliminarProducto(id).then(() => {
        this.success = 'Producto eliminado';
        this.loadProductos();
        setTimeout(() => this.success = '', 3000);
      }).catch((error) => {
        this.error = 'Error al eliminar: ' + error.message;
      });
    }
  }

  eliminarImagen(producto: Producto, index: number): void {
    if (producto.id && producto.imagenes) {
      const imagenes = producto.imagenes.filter((_, i) => i !== index);
      this.firebaseService.actualizarProducto(producto.id, { imagenes }).then(() => {
        this.loadProductos();
      });
    }
  }

  // Métodos para categorías
  toggleCategoriaForm(): void {
    this.showCategoriaForm = !this.showCategoriaForm;
    if (!this.showCategoriaForm) {
      this.resetCategoriaForm();
    }
  }

  resetCategoriaForm(): void {
    this.categoriaForm = { nombre: '' };
    this.editingCategoriaId = null;
    this.error = '';
    this.success = '';
  }

  guardarCategoria(): void {
    if (!this.categoriaForm.nombre.trim()) {
      this.error = 'El nombre de la categoría es obligatorio';
      return;
    }

    this.loading = true;
    this.error = '';
    this.success = '';

    if (this.editingCategoriaId) {
      this.firebaseService.actualizarCategoria(this.editingCategoriaId, this.categoriaForm).then(() => {
        this.success = 'Categoría actualizada';
        this.resetCategoriaForm();
        this.showCategoriaForm = false;
        this.loading = false;
        setTimeout(() => this.success = '', 3000);
      }).catch((error) => {
        this.error = 'Error al actualizar: ' + error.message;
        this.loading = false;
      });
    } else {
      this.firebaseService.crearCategoria(this.categoriaForm).then(() => {
        this.success = 'Categoría creada';
        this.resetCategoriaForm();
        this.showCategoriaForm = false;
        this.loading = false;
        setTimeout(() => this.success = '', 3000);
      }).catch((error) => {
        this.error = 'Error al crear: ' + error.message;
        this.loading = false;
      });
    }
  }

  editarCategoria(categoria: Categoria): void {
    this.categoriaForm = { ...categoria };
    this.editingCategoriaId = categoria.id || null;
    this.showCategoriaForm = true;
    this.error = '';
    this.success = '';
  }

  eliminarCategoria(id: string): void {
    if (confirm('¿Estás seguro de que quieres eliminar esta categoría? Esto puede afectar productos existentes.')) {
      this.firebaseService.eliminarCategoria(id).then(() => {
        this.success = 'Categoría eliminada';
        setTimeout(() => this.success = '', 3000);
      }).catch((error) => {
        this.error = 'Error al eliminar: ' + error.message;
      });
    }
  }

  // Métodos para Ofertas
  toggleOfertaForm(): void {
    this.showOfertaForm = !this.showOfertaForm;
    if (this.showOfertaForm) {
      this.resetOfertaForm();
    }
  }

  resetOfertaForm(): void {
    this.ofertaForm = {
      titulo: '',
      descripcion: '',
      imagen: '',
      fechaInicio: Date.now(),
      fechaFin: Date.now() + (7 * 24 * 60 * 60 * 1000), // 7 días por defecto
      activa: true
    };
    this.selectedOfertaFile = null;
    this.editingOfertaId = null;
    this.error = '';
    this.success = '';
  }

  onOfertaFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedOfertaFile = file;
      this.error = '';
    }
  }

  onFechaInicioChange(value: string): void {
    this.ofertaForm.fechaInicio = new Date(value).getTime();
  }

  onFechaFinChange(value: string): void {
    this.ofertaForm.fechaFin = new Date(value).getTime();
  }

  guardarOferta(): void {
    if (!this.ofertaForm.titulo || !this.ofertaForm.descripcion) {
      this.error = 'Título y descripción son obligatorios';
      return;
    }

    if (this.ofertaForm.fechaFin <= this.ofertaForm.fechaInicio) {
      this.error = 'La fecha de fin debe ser posterior a la fecha de inicio';
      return;
    }

    this.loading = true;
    this.error = '';
    this.success = '';

    const saveOperation = this.editingOfertaId
      ? this.ofertasService.actualizarOferta(this.editingOfertaId, this.ofertaForm, this.selectedOfertaFile || undefined)
      : this.ofertasService.crearOferta(this.ofertaForm, this.selectedOfertaFile || undefined);

    saveOperation.then(() => {
      this.success = 'Oferta guardada correctamente';
      this.showOfertaForm = false;
      this.resetOfertaForm();
      this.loading = false;
      setTimeout(() => this.success = '', 3000);
    }).catch((error) => {
      this.error = 'Error al guardar oferta: ' + error.message;
      this.loading = false;
    });
  }

  editarOferta(oferta: Oferta): void {
    this.ofertaForm = { ...oferta };
    this.editingOfertaId = oferta.id || null;
    this.selectedOfertaFile = null;
    this.showOfertaForm = true;
    this.error = '';
    this.success = '';
  }

  eliminarOferta(id: string): void {
    if (confirm('¿Estás seguro de que quieres eliminar esta oferta?')) {
      this.ofertasService.eliminarOferta(id).then(() => {
        this.success = 'Oferta eliminada';
        setTimeout(() => this.success = '', 3000);
      }).catch((error) => {
        this.error = 'Error al eliminar oferta: ' + error.message;
      });
    }
  }

  logout(): void {
    this.authService.logout().then(() => {
      this.router.navigate(['/admin/login']);
    });
  }
}
