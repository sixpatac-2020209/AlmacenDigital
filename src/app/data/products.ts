import { of } from "rxjs";

export interface Product {
  id: number;
  name: string;
  price: number;
  oldPrice?: number;
  image: string;
  offer?: boolean;
}

export const PRODUCTS: Product[] = [
  {
    id: 1,
    name: 'Producto 1',
    oldPrice: 150,
    price: 100,
    image: 'assets/img/product-1.jpg',
    offer: true
  },
  {
    id: 2,
    name: 'Producto 2',
    oldPrice: 150,
    price: 200,
    image: 'assets/img/product-2.jpg',
    offer: false
  }
];