//  Configuración global de FerrePOS

// ÚNICO correo autorizado para ser ADMINISTRADOR (jefatura).
export const ADMIN_EMAIL = "danielhumbertocaicedoarguello@gmail.com";

//  Envío de reportes y alertas por correo (EmailJS)
export const EMAILJS_SERVICE_ID = process.env.REACT_APP_EMAILJS_SERVICE_ID || "service_im7d7by";
export const EMAILJS_TEMPLATE_ID = process.env.REACT_APP_EMAILJS_TEMPLATE_ID || "template_d0fa1yo";
export const EMAILJS_TEMPLATE_ALERTAS = process.env.REACT_APP_EMAILJS_TEMPLATE_ALERTAS || "template_n88mbow";
export const EMAILJS_PUBLIC_KEY = process.env.REACT_APP_EMAILJS_PUBLIC_KEY || "SQ8qjwz0sSzyoXxnc";
export const REPORTE_EMAIL = "danielhumbertocaicedoarguello@gmail.com";

// 🔑 CLAVES DE API (Create React App usa process.env.REACT_APP_*)
export const GROQ_API_KEY = process.env.REACT_APP_GROQ_API_KEY;
export const GOOGLE_VISION_API_KEY = process.env.REACT_APP_GOOGLE_VISION_API_KEY;
export const OCR_SPACE_API_KEY = process.env.REACT_APP_OCR_SPACE_API_KEY;

// 🏪 Sedes del negocio
export const SEDES = [
  { id: "sede1", nombre: "Sede Principal" },
  { id: "sede2", nombre: "Sede 2" },
];

export const nombreSede = (id) => SEDES.find((s) => s.id === id)?.nombre || id;
export const campoStock = (sedeId) => `stock_${sedeId}`;
export const stockDe = (producto, sedeId) => Number(producto[campoStock(sedeId)] ?? producto.stock ?? 0);
export const otraSede = (sedeId) => (sedeId === "sede1" ? "sede2" : "sede1");

//  Métodos de pago por sede
export const METODOS_PAGO_POR_SEDE = {
  sede1: ["efectivo", "nequi", "daviplata", "tarjeta"],
  sede2: ["efectivo", "nequi", "daviplata"],
};

export const METODOS_PAGO_LABELS = {
  efectivo: "Efectivo",
  nequi: "Nequi",
  daviplata: "Daviplata",
  tarjeta: "Tarjeta (datáfono)",
};