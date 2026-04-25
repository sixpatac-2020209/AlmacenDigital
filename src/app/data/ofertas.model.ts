export interface Oferta {
  id?: string;
  titulo: string;
  descripcion: string;
  imagen: string;
  fechaInicio: number;
  fechaFin: number;
  activa: boolean;
  createdAt?: number;
}