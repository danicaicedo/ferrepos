import { collection, getDocs, updateDoc, doc } from "firebase/firestore";

import { db } from "./firebase";
import {
  
  SEDES,
  nombreSede,
  stockDe,
  otraSede,
} from "./config";

// 🔔 CENTINELA DE STOCK POR SEDE
// Vigila CADA sede por separado. Avisa UNA sola vez por (producto, sede)
// cuando el stock de ESA sede cruza su mínimo. Se rearma cuando sube.
// Incluye sugerencia de traslado si la otra sede tiene excedente.
export const revisarCentinela = async () => {
  try {
    const snap = await getDocs(collection(db, "products"));
    const productos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const nuevasAlertas = []; // {p, sede, sugerir: {sedeId, cantidadDisponible} | null}
    const rearmar = [];       // {p, sede}

    for (const p of productos) {
      for (const s of SEDES) {
        const stock = stockDe(p, s.id);
        const flag = `alertaEnviada_${s.id}`;
        const yaAvisado = Boolean(p[flag]);

        if (stock <= p.minimo && !yaAvisado) {
          const otra = otraSede(s.id);
          const stockOtra = stockDe(p, otra);
          const excedente = stockOtra - p.minimo;
          const sugerir =
            excedente > 0
              ? { sedeId: otra, cantidadDisponible: excedente }
              : null;
          nuevasAlertas.push({ p, sede: s, sugerir });
        } else if (stock > p.minimo && yaAvisado) {
          rearmar.push({ p, sede: s });
        }
      }
    }

    // Rearmar alertas (productos repuestos en ESA sede)
    for (const r of rearmar) {
      await updateDoc(doc(db, "products", r.p.id), {
        [`alertaEnviada_${r.sede.id}`]: false,
      });
    }

    if (nuevasAlertas.length === 0) return;

    // Agrupar por sede
    const porSede = {};
    for (const s of SEDES) porSede[s.id] = [];
    for (const a of nuevasAlertas) {
      const stock = stockDe(a.p, a.sede.id);
      let linea = `• ${a.p.nombre}: quedan ${stock} (mínimo ${a.p.minimo})`;
      if (a.sugerir) {
        linea += `  →  ${nombreSede(a.sugerir.sedeId)} tiene ${a.sugerir.cantidadDisponible} disponibles para traslado`;
      }
      porSede[a.sede.id].push(linea);
    }

    const lista_alertas = SEDES.map((s) => {
      const lineas = porSede[s.id];
      if (lineas.length === 0) return null;
      return `🏪 ${s.nombre}:\n${lineas.join("\n")}`;
    })
      .filter(Boolean)
      .join("\n\n");

    console.log("🔔 Centinela (silencioso):", nuevasAlertas.length, "caso(s) de bajo stock marcados. Se reportarán a las 9 pm.");

    // Marcar avisados
    for (const a of nuevasAlertas) {
      await updateDoc(doc(db, "products", a.p.id), {
        [`alertaEnviada_${a.sede.id}`]: true,
      });
    }

    console.log("🔔 Centinela: enviadas", nuevasAlertas.length, "alerta(s) por sede");
  } catch (e) {
    console.error("Error en centinela:", e);
  }
};