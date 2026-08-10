import { Component, OnInit, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FirebaseService, Producto, Categoria, Pedido } from '../../services/firebase.service';
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
  pedidos: Pedido[] = [];
  ofertas: Oferta[] = [];
  activeTab: 'productos' | 'categorias' | 'ofertas' | 'pedidos' = 'productos';
  private readonly brandCategories = [
    { keys: ['remin', 'remington'], nombre: 'Remington', id: '' },
    { keys: ['picca'], nombre: 'PICCA', id: '' },
    { keys: ['bd', 'blackdecker', 'black&decker', 'black-decker'], nombre: 'Black&Decker', id: '' }
  ];
  // UI helpers
  searchTerm = '';
  categorySearchTerm = '';
  pageSize = 12;
  currentPage = 1;
  viewMode: 'grid' | 'table' = 'grid';
  editedRows: { [id: string]: Partial<Producto> } = {};
  showForm = false;
  showCategoriaForm = false;
  showOfertaForm = false;
  showPedidoToast = false;
  pedidoToastMessage = '';
  private pedidosInitialized = false;
  private knownPedidoIds = new Set<string>();
  expandedPedidoId: string | null = null;
  editingId: string | null = null;
  editingCategoriaId: string | null = null;
  editingOfertaId: string | null = null;
  loading = false;
  error = '';
  success = '';

  form: Producto = {
    sku: '',
    codigo: '',
    nombre: '',
    descripcion: '',
    caracteristicas: '',
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

  selectedOfertaFile: File | null = null;
  imageUrlFields: string[] = this.createEmptyImageFields();
  selectedCsvFile: File | null = null;
  // CSV import
  csvUploading = false;
  csvProgress = 0;
  csvProcessedRows = 0;
  csvTotalRows = 0;
  csvImportedCount = 0;
  csvFailedCount = 0;
  csvErrors: string[] = [];

  constructor(
    private firebaseService: FirebaseService,
    private authService: AuthService,
    private router: Router,
    private ofertasService: OfertasService,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.loadProductos();
    this.loadCategorias();
    this.loadPedidos();
    this.loadOfertas();
    this.ensureBrandCategories();
  }

  setActiveTab(tab: 'productos' | 'categorias' | 'ofertas' | 'pedidos'): void {
    this.activeTab = tab;
    this.showForm = false;
    this.showCategoriaForm = false;
    this.showOfertaForm = false;
    this.error = '';
    this.success = '';
  }

  loadProductos(): void {
    this.firebaseService.getProductos().subscribe((productos) => {
      this.productos = productos;
      // reset pagination when products change
      this.currentPage = 1;
    });
  }

  private getSkuComparable(producto: Producto): string {
    return (producto.sku || producto.codigo || '').trim().toLowerCase();
  }

  private matchesSearch(producto: Producto, term: string): boolean {
    if (!term) return true;

    const termNorm = this.normalizeKey(term);
    const nombre = (producto.nombre || '').toLowerCase();
    const descripcion = (producto.descripcion || '').toLowerCase();
    const sku = (producto.sku || '').toLowerCase();
    const codigo = (producto.codigo || '').toLowerCase();
    const skuNorm = this.normalizeKey(producto.sku || '');
    const codigoNorm = this.normalizeKey(producto.codigo || '');

    return (
      nombre.includes(term) ||
      descripcion.includes(term) ||
      sku.includes(term) ||
      codigo.includes(term) ||
      (!!termNorm && (skuNorm.includes(termNorm) || codigoNorm.includes(termNorm)))
    );
  }

  private sortProductos(list: Producto[]): Producto[] {
    return list.sort((a, b) => {
      const aCreatedAt = a.createdAt || 0;
      const bCreatedAt = b.createdAt || 0;
      const aHasDate = aCreatedAt > 0;
      const bHasDate = bCreatedAt > 0;

      if (aHasDate && bHasDate && aCreatedAt !== bCreatedAt) {
        return bCreatedAt - aCreatedAt;
      }

      if (aHasDate !== bHasDate) {
        return aHasDate ? -1 : 1;
      }

      const skuCompare = this.getSkuComparable(a).localeCompare(this.getSkuComparable(b), 'es', { sensitivity: 'base' });
      if (skuCompare !== 0) {
        return skuCompare;
      }

      return (a.nombre || '').localeCompare((b.nombre || ''), 'es', { sensitivity: 'base' });
    });
  }

  get filteredProducts(): Producto[] {
    const term = this.searchTerm.trim().toLowerCase();
    let list = this.productos.slice();
    if (term) {
      list = list.filter(p => this.matchesSearch(p, term));
    }
    this.sortProductos(list);
    const start = (this.currentPage - 1) * this.pageSize;
    return list.slice(start, start + this.pageSize);
  }

  get filteredCount(): number {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return this.productos.length;
    return this.productos.filter(p => this.matchesSearch(p, term)).length;
  }

  totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredCount / this.pageSize));
  }

  nextPage(): void {
    if (this.currentPage < this.totalPages()) this.currentPage++;
  }

  prevPage(): void {
    if (this.currentPage > 1) this.currentPage--;
  }

  setPage(n: number): void {
    if (n >= 1 && n <= this.totalPages()) this.currentPage = n;
  }

  startEdit(product: Producto): void {
    if (!product.id) return;
    this.editedRows[product.id] = { ...product };
  }

  cancelEdit(productId: string): void {
    delete this.editedRows[productId];
  }

  saveEdit(productId: string): void {
    const changes = this.editedRows[productId];
    if (!changes) return;
    this.firebaseService.actualizarProducto(productId, changes).then(() => {
      delete this.editedRows[productId];
      this.success = 'Producto actualizado';
      setTimeout(() => this.success = '', 3000);
      this.loadProductos();
    }).catch(err => {
      this.error = 'Error al actualizar: ' + err.message;
    });
  }

  changePageSize(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
  }

  goFirst(): void { this.currentPage = 1; }
  goLast(): void { this.currentPage = this.totalPages(); }

  loadCategorias(): void {
    this.firebaseService.getCategorias().subscribe((categorias) => {
      this.categorias = categorias;
    });
  }

  loadPedidos(): void {
    this.firebaseService.getPedidos().subscribe((pedidos) => {
      const ordered = [...pedidos].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      this.notifyNewPedidos(ordered);
      this.pedidos = ordered;
    });
  }

  get nuevosPedidosCount(): number {
    return this.getEstadoCount('nuevo');
  }

  private notifyNewPedidos(pedidosOrdenados: Pedido[]): void {
    const currentIds = new Set<string>(pedidosOrdenados.map(p => p.id || '').filter(Boolean));

    if (!this.pedidosInitialized) {
      this.knownPedidoIds = currentIds;
      this.pedidosInitialized = true;
      return;
    }

    const nuevos = pedidosOrdenados.filter(p => !!p.id && !this.knownPedidoIds.has(p.id));
    this.knownPedidoIds = currentIds;

    if (nuevos.length === 0) {
      return;
    }

    const ultimo = nuevos[0];
    const nombreCliente = `${ultimo.facturacion.nombre} ${ultimo.facturacion.apellido}`.trim();
    this.pedidoToastMessage = nuevos.length === 1
      ? `Nuevo pedido de ${nombreCliente || 'cliente'} por Q.${(ultimo.total || 0).toFixed(2)}`
      : `${nuevos.length} pedidos nuevos recibidos`;
    this.showPedidoToast = true;
    this.playPedidoTone();

    setTimeout(() => {
      this.showPedidoToast = false;
    }, 5000);
  }

  private playPedidoTone(): void {
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.36);
    } catch {
      // Ignore audio errors in browsers that block autoplay sounds.
    }
  }

  get pedidoTotalGeneral(): number {
    return this.pedidos.reduce((acc, pedido) => acc + (pedido.total || 0), 0);
  }

  getEstadoCount(estado: string): number {
    const target = (estado || '').toLowerCase();
    return this.pedidos.filter(p => (p.estado || 'nuevo').toLowerCase() === target).length;
  }

  getPedidoItemsCount(pedido: Pedido): number {
    return (pedido.items || []).reduce((acc, item) => acc + (item.cantidad || 0), 0);
  }

  getPedidoFolio(pedido: Pedido): string {
    const id = pedido.id || '';
    const year = new Date(pedido.createdAt || Date.now()).getFullYear();
    const shortId = id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(-6).padStart(6, '0');
    return `OC-${year}-${shortId}`;
  }

  togglePedidoDetalle(pedidoId?: string): void {
    if (!pedidoId) return;
    this.expandedPedidoId = this.expandedPedidoId === pedidoId ? null : pedidoId;
  }

  isPedidoExpanded(pedidoId?: string): boolean {
    return !!pedidoId && this.expandedPedidoId === pedidoId;
  }

  exportPedidoPdf(pedido: Pedido): void {
    const folio = this.getPedidoFolio(pedido);
    const fecha = pedido.createdAt ? new Date(pedido.createdAt).toLocaleString('es-GT') : '-';
    const logoUrl = `${window.location.origin}/assets/img/AlmacenDigitalLogo.png`;
    const rows = (pedido.items || []).map(item => {
      const subtotal = (item.precio || 0) * (item.cantidad || 0);
      return `<tr>
        <td>${this.escapeHtml(item.nombre)}</td>
        <td>${item.cantidad || 0}</td>
        <td>Q.${(item.precio || 0).toFixed(2)}</td>
        <td>Q.${subtotal.toFixed(2)}</td>
      </tr>`;
    }).join('');

    const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8" />
<title>${folio}</title>
<style>
body { font-family: Arial, sans-serif; padding: 24px; color: #222; }
h1,h2,h3 { margin: 0 0 10px; }
.meta { margin-bottom: 16px; }
.block { border: 1px solid #ddd; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
.doc-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.doc-brand { display: flex; align-items: center; gap: 12px; }
.doc-logo { width: 56px; height: 56px; object-fit: contain; border-radius: 8px; border: 1px solid #eee; padding: 4px; }
.doc-name { font-size: 18px; font-weight: 700; }
table { width: 100%; border-collapse: collapse; margin-top: 10px; }
th, td { border-bottom: 1px solid #ececec; padding: 8px; text-align: left; }
.totals { margin-top: 12px; }
.totals p { margin: 4px 0; }
</style></head><body>
<div class="doc-header">
  <div class="doc-brand">
    <img class="doc-logo" src="${logoUrl}" alt="Almacen Digital" onerror="this.style.display='none'" />
    <div class="doc-name">Almacen Digital</div>
  </div>
  <div><strong>${folio}</strong></div>
</div>
<h1>Orden de Compra Interna</h1>
<div class="meta"><strong>Orden:</strong> ${folio}<br/><strong>Fecha:</strong> ${fecha}<br/><strong>Pedido ID:</strong> ${this.escapeHtml(pedido.id || '-')}</div>
<div class="block"><p><strong>Nota:</strong> Este documento es un comprobante interno y no reemplaza la factura electronica autorizada por SAT.</p></div>

<div class="block">
<h3>Facturación</h3>
<p>${this.escapeHtml(pedido.facturacion.nombre)} ${this.escapeHtml(pedido.facturacion.apellido)}</p>
<p>${this.escapeHtml(pedido.facturacion.email)}</p>
<p>${this.escapeHtml(pedido.facturacion.telefono)}</p>
<p>${this.escapeHtml(pedido.facturacion.direccion)}</p>
</div>

<div class="block">
<h3>Envío</h3>
<p>${this.escapeHtml(pedido.envio.nombre)} ${this.escapeHtml(pedido.envio.apellido)}</p>
<p>${this.escapeHtml(pedido.envio.telefono)}</p>
<p>${this.escapeHtml(pedido.envio.direccion)}</p>
</div>

<div class="block">
<h3>Productos</h3>
<table>
  <thead><tr><th>Producto</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="totals">
  <p>Subtotal: <strong>Q.${(pedido.subtotal || 0).toFixed(2)}</strong></p>
  <p>Envío: <strong>Q.${(pedido.envioCosto || 0).toFixed(2)}</strong></p>
  <p>Total: <strong>Q.${(pedido.total || 0).toFixed(2)}</strong></p>
</div>
</div>

<script>window.onload = function(){ window.print(); };</script>
</body></html>`;

    const win = window.open('', '_blank');
    if (!win) {
      alert('No se pudo abrir la ventana para exportar el pedido.');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
  }

  private escapeHtml(value: string): string {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private normalizeKey(value?: string): string {
    return (value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase()
      .trim();
  }

  private async ensureBrandCategories(): Promise<void> {
    for (const category of this.brandCategories) {
      category.id = await this.firebaseService.asegurarCategoria(category.nombre);
    }
    this.firebaseService.loadCategorias();
  }

  private resolveCategoriaForProducto(nombre: string, sku: string): string {
    const source = `${nombre} ${sku}`;
    const normalized = this.normalizeKey(source);
    for (const category of this.brandCategories) {
      const matched = category.keys.some(key => normalized.includes(this.normalizeKey(key)));
      if (matched) {
        return category.id || '';
      }
    }
    return '';
  }

  getCategoriaNombre(categoriaId?: string): string {
    if (!categoriaId) {
      return 'Sin categoría';
    }
    const categoria = this.categorias.find(item => item.id === categoriaId);
    return categoria?.nombre || categoriaId;
  }

  getCategoriaProductCount(categoriaId?: string): number {
    if (!categoriaId) return 0;
    return this.productos.filter(p => p.categoriaId === categoriaId).length;
  }

  get sortedFilteredCategorias(): Categoria[] {
    const term = this.categorySearchTerm.trim().toLowerCase();
    const filtered = this.categorias.filter((categoria) => {
      if (!term) return true;
      return (categoria.nombre || '').toLowerCase().includes(term);
    });

    return filtered.sort((a, b) => {
      const countDiff = this.getCategoriaProductCount(b.id) - this.getCategoriaProductCount(a.id);
      if (countDiff !== 0) return countDiff;
      return (a.nombre || '').localeCompare((b.nombre || ''), 'es', { sensitivity: 'base' });
    });
  }

  private resolveCategoriaIdDesdeCsv(valor?: string): string {
    const raw = (valor || '').trim();
    if (!raw) {
      return '';
    }

    const porId = this.categorias.find(item => item.id === raw);
    if (porId?.id) {
      return porId.id;
    }

    const normalized = this.normalizeKey(raw);
    const porNombre = this.categorias.find(item => this.normalizeKey(item.nombre) === normalized);
    if (porNombre?.id) {
      return porNombre.id;
    }

    return '';
  }

  loadOfertas(): void {
    this.ofertasService.getOfertas().subscribe((ofertas) => {
      this.ofertas = ofertas;
    });
  }

  toggleForm(): void {
    if (!this.authService.isAuthenticated()) {
      this.error = 'Debes iniciar sesión para crear o editar productos';
      return;
    }
    this.showForm = !this.showForm;
    if (this.showForm) {
      this.resetForm();
    }
  }

  resetForm(): void {
    this.form = {
      sku: '',
      codigo: '',
      nombre: '',
      descripcion: '',
      caracteristicas: '',
      precio: 0,
      precioOferta: 0,
      oferta: 0,
      categoriaId: '',
      imagenes: [],
      cantidad: 0
    };
    this.setImageUrlFields([]);
    this.editingId = null;
    this.error = '';
    this.success = '';
  }

  private createEmptyImageFields(): string[] {
    return ['', '', '', '', ''];
  }

  private setImageUrlFields(urls: string[]): void {
    const clean = (urls || []).map(u => (u || '').trim()).filter(Boolean).slice(0, 5);
    this.imageUrlFields = [...clean, ...this.createEmptyImageFields()].slice(0, 5);
    this.form.imagenes = clean;
  }

  onImageUrlChanged(index: number, value: string): void {
    this.imageUrlFields[index] = (value || '').trim();
    const clean = this.imageUrlFields.map(u => (u || '').trim()).filter(Boolean);
    this.form.imagenes = clean;
  }

  private validateImageUrls(urls: string[]): string | null {
    for (const url of urls) {
      if (!/^https?:\/\//i.test(url)) {
        return `La URL de imagen no es válida: ${url}`;
      }
    }
    return null;
  }

  guardarProducto(): void {
    if (!this.authService.isAuthenticated()) {
      this.error = 'Debes iniciar sesión para guardar un producto';
      return;
    }
    if (!this.form.nombre || this.form.precio === null || this.form.precio === undefined || this.form.precio < 0 || this.form.cantidad < 0) {
      this.error = 'Por favor completa nombre, precio y cantidad válida';
      return;
    }

    const imageUrls = (this.imageUrlFields || []).map(x => (x || '').trim()).filter(Boolean);
    this.form.imagenes = imageUrls;

    const sku = (this.form.sku || this.form.codigo || '').trim();
    if (sku) {
      this.form.sku = sku;
      this.form.codigo = sku;
    }

    const categoriaPorMarca = this.resolveCategoriaForProducto(this.form.nombre, sku);
    if (categoriaPorMarca && !this.form.categoriaId) {
      this.form.categoriaId = categoriaPorMarca;
    }

    if (imageUrls.length === 0) {
      this.error = 'Debes ingresar al menos una URL de imagen para el producto';
      return;
    }

    if (imageUrls.length > 5) {
      this.error = 'El producto no puede tener más de 5 imágenes';
      return;
    }

    const urlError = this.validateImageUrls(imageUrls);
    if (urlError) {
      this.error = urlError;
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

    saveOperation.then(() => {
      this.success = 'Producto guardado correctamente';
      this.showForm = false;
      this.resetForm();
      this.loadProductos();
      this.loading = false;
    }).catch((error) => {
      this.error = 'Error: ' + error.message;
      this.loading = false;
    });
  }

  editarProducto(producto: Producto): void {
    this.form = { ...producto };
    this.editingId = producto.id || null;
    this.setImageUrlFields(producto.imagenes || []);
    this.showForm = true;
    this.error = '';
    this.success = '';
  }

  eliminarTodosLosProductos(): void {
    if (!confirm(`¿Estás seguro de eliminar los ${this.productos.length} productos? Esta acción no se puede deshacer.`)) return;
    this.loading = true;
    const deletes = this.productos.map(p => this.firebaseService.eliminarProducto(p.id!));
    Promise.allSettled(deletes).then(() => {
      this.firebaseService.loadProductos();
      this.success = 'Todos los productos fueron eliminados.';
      this.loading = false;
      setTimeout(() => this.success = '', 4000);
    });
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
    if (!this.authService.isAuthenticated()) {
      this.error = 'Debes iniciar sesión para crear o editar categorías';
      return;
    }
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
    if (!this.authService.isAuthenticated()) {
      this.error = 'Debes iniciar sesión para guardar una categoría';
      return;
    }
    if (!this.categoriaForm.nombre.trim()) {
      this.error = 'El nombre de la categoría es obligatorio';
      return;
    }

    const target = this.normalizeKey(this.categoriaForm.nombre);
    const duplicate = this.categorias.find(c => {
      if (this.editingCategoriaId && c.id === this.editingCategoriaId) return false;
      return this.normalizeKey(c.nombre) === target;
    });

    if (duplicate) {
      this.error = 'Ya existe una categoría con ese nombre';
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
    const categoryInUse = this.getCategoriaProductCount(id);
    if (categoryInUse > 0) {
      this.error = `No puedes eliminar esta categoría porque tiene ${categoryInUse} producto(s) asignado(s).`;
      return;
    }

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

  // CSV import handlers
  onCsvSelected(event: any): void {
    const file = event.target.files[0];
    if (!file) return;
    this.selectedCsvFile = file;
    this.importCsvFile(file);
  }

  private importCsvFile(file: File): void {
    const reader = new FileReader();
    reader.onload = (e: any) => {
      this.ngZone.run(async () => {
        const text: string = e.target?.result ?? '';
        const rows = this.parseCsv(text);
        if (!rows || rows.length === 0) {
          this.error = 'CSV vacío o con formato inválido';
          return;
        }

        await this.ensureBrandCategories();

        const header = rows[0].map(h => h.trim().toLowerCase());
        const dataRows = rows.slice(1).filter(row => row.some(cell => cell.trim() !== ''));

        this.csvUploading = true;
        this.csvProgress = 0;
        this.csvProcessedRows = 0;
        this.csvTotalRows = Math.max(1, dataRows.length);
        this.csvImportedCount = 0;
        this.csvFailedCount = 0;
        this.csvErrors = [];
        this.error = '';
        this.success = '';

        const productos: { prod: Producto; rowIndex: number }[] = [];
        for (let i = 0; i < dataRows.length; i++) {
          const row = dataRows[i];
          const obj: any = {};
          header.forEach((col, idx) => {
            obj[col] = row[idx] !== undefined ? row[idx].trim() : '';
          });

          const nombre = (obj['nombre'] || obj['title'] || '').trim();
          const sku = (obj['codigo'] || obj['code'] || obj['sku'] || obj['id'] || obj['product_code'] || '').trim();
          const categoriaCsv = (obj['categoria'] || obj['category'] || obj['categoriaid'] || obj['categoria_id'] || '').trim();
          const imagenesCsv = this.parseImageUrlsFromCsv(obj);

          if (!nombre) {
            this.csvErrors.push(`Fila ${i + 2}: El nombre del producto es obligatorio`);
            this.csvFailedCount++;
            continue;
          }

          if (!sku) {
            this.csvErrors.push(`Fila ${i + 2}: El SKU/código del producto es obligatorio`);
            this.csvFailedCount++;
            continue;
          }

          if (imagenesCsv.length === 0) {
            this.csvErrors.push(`Fila ${i + 2}: Debes incluir al menos una imagen`);
            this.csvFailedCount++;
            continue;
          }

          const categoriaId = this.resolveCategoriaIdDesdeCsv(categoriaCsv) || this.resolveCategoriaForProducto(nombre, sku) || undefined;
          const prod: Producto = {
            sku,
            codigo: sku,
            nombre,
            descripcion: '',
            precio: 0,
            oferta: 0,
            imagenes: imagenesCsv,
            cantidad: 0,
            ...(categoriaId ? { categoriaId } : {}),
            createdAt: Date.now()
          };

          productos.push({ prod, rowIndex: i + 2 });
        }

        const promises = productos.map(({ prod, rowIndex }) =>
          this.firebaseService.crearProducto(prod, true)
            .then(() => {
              this.csvImportedCount++;
              this.csvProcessedRows++;
              this.csvProgress = Math.round((this.csvProcessedRows / this.csvTotalRows) * 100);
            })
            .catch((err: any) => {
              this.csvErrors.push(`Fila ${rowIndex}: ${err.message || err}`);
              this.csvFailedCount++;
              this.csvProcessedRows++;
              this.csvProgress = Math.round((this.csvProcessedRows / this.csvTotalRows) * 100);
            })
        );
        await Promise.all(promises);

        this.csvUploading = false;
        this.csvProgress = 100;
        this.csvProcessedRows = this.csvTotalRows;
        this.firebaseService.loadProductos();
        if (this.csvErrors.length === 0) {
          this.success = `Importación completada: ${this.csvImportedCount} producto(s) creado(s).`;
          setTimeout(() => this.success = '', 5000);
        } else {
          this.error = `Importación finalizada: ${this.csvImportedCount} creado(s) y ${this.csvFailedCount} con error.`;
          console.log('CSV Errors:', this.csvErrors);
        }

        this.selectedCsvFile = null;
      });
    };
    reader.readAsText(file);
  }

  private parseImageUrlsFromCsv(obj: any): string[] {
    const urls: string[] = [];
    const raw = obj['imagenes_urls'] || obj['imagenesurls'] || obj['imagenes'] || obj['image_urls'] || '';
    if (raw) {
      urls.push(...String(raw).split('|').map((x: string) => x.trim()));
    }

    const directCols = [
      obj['url_1'], obj['url_2'], obj['url_3'], obj['url_4'], obj['url_5'],
      obj['imagen_1'], obj['imagen_2'], obj['imagen_3'], obj['imagen_4'], obj['imagen_5'],
      obj['image_1'], obj['image_2'], obj['image_3'], obj['image_4'], obj['image_5']
    ];
    directCols.forEach((v) => { if (v) urls.push(String(v).trim()); });

    return urls
      .filter((x: string) => /^https?:\/\//i.test(x))
      .filter((x, idx, arr) => arr.indexOf(x) === idx)
      .slice(0, 5);
  }

  // Simple CSV parser that supports quoted fields
  private parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    const lines = text.replace(/\r/g, '').split('\n');
    for (const line of lines) {
      if (line.trim() === '') continue;
      const row: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i+1] === '"') { cur += '"'; i++; } else { inQuotes = !inQuotes; }
        } else if (ch === ',' && !inQuotes) {
          row.push(cur);
          cur = '';
        } else {
          cur += ch;
        }
      }
      row.push(cur);
      rows.push(row);
    }
    return rows;
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
