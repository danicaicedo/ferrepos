import { collection, getDocs, writeBatch, doc, updateDoc } from "firebase/firestore";
//                                                                   ^^^^^^^^^^^ agregado
import { db } from "./firebase";

// 🧪 10 productos de prueba para pruebas funcionales.
// Se siembran UNA sola vez si la colección products está vacía.
// Después puedes editarlos/borrarlos desde el Inventario o desde Firebase.
export const PRODUCTOS_INICIALES = [
  { nombre: "Martillo de uña", categoria: "Herramientas", precio: 25000, stock: 40, minimo: 10 },
  { nombre: 'Destornillador plano 6"', categoria: "Herramientas", precio: 12000, stock: 8, minimo: 10 },
  { nombre: "Cable THW 12 AWG (m)", categoria: "Eléctricos", precio: 3500, stock: 150, minimo: 50 },
  { nombre: "Tomacorriente doble", categoria: "Eléctricos", precio: 9000, stock: 8, minimo: 15 },
  { nombre: "Pintura vinilo blanco 1L", categoria: "Pinturas", precio: 28000, stock: 25, minimo: 8 },
  { nombre: "Lija de agua #220", categoria: "Pinturas", precio: 2500, stock: 60, minimo: 20 },
  { nombre: 'Tornillo 1/4" x 1" (caja 100)', categoria: "Tornillería", precio: 15000, stock: 30, minimo: 10 },
  { nombre: "Candado 50mm", categoria: "Herramientas", precio: 18000, stock: 12, minimo: 6 },
  { nombre: "Bombillo LED 9W", categoria: "Eléctricos", precio: 7000, stock: 50, minimo: 15 },
  { nombre: "Cinta aislante negra", categoria: "Eléctricos", precio: 4000, stock: 35, minimo: 10 },
];

export const asegurarProductosIniciales = async () => {
  try {
    const snap = await getDocs(collection(db, "products"));
    if (!snap.empty) return; // ya hay productos reales → no tocar nada

    const batch = writeBatch(db);
    PRODUCTOS_INICIALES.forEach((p) => batch.set(doc(collection(db, "products")), p));
    await batch.commit();
    console.log("🌱 Productos de prueba cargados en Firestore:", PRODUCTOS_INICIALES.length);
  } catch (e) {
    console.error("Error sembrando productos:", e);
  }
};

// 🏪 MIGRACIÓN: agrega stock_sede1 / stock_sede2 a productos antiguos (una sola vez por producto)
export const asegurarSedes = async () => {
  try {
    const snap = await getDocs(collection(db, "products"));
    for (const d of snap.docs) {
      const p = d.data();
      if (p.stock_sede1 === undefined) {
        await updateDoc(doc(db, "products", d.id), {
          stock_sede1: Number(p.stock) || 0,
          stock_sede2: 0,
        });
      }
    }
  } catch (e) {
    console.error("Error migrando sedes:", e);
  }
};