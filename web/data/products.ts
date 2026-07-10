export type Product = {
  id: string;
  title: string;
  price: number;
  currency: "USD";
};

export const PRODUCTS: Product[] = [
  { id: "p1", title: "Bariis (1kg)", price: 3.5, currency: "USD" },
  { id: "p2", title: "Caano (1L)", price: 2.25, currency: "USD" },
  { id: "p3", title: "Rooti (6pcs)", price: 1.5, currency: "USD" },
  { id: "p4", title: "Biyo (500ml)", price: 0.75, currency: "USD" },
  { id: "p5", title: "Shaah (250g)", price: 4.0, currency: "USD" },
];
