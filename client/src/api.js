// Cliente HTTP sencillo para la API de SobraCerca
export function sesion() {
  try { return JSON.parse(localStorage.getItem('sobracerca_sesion')) || null; } catch { return null; }
}
export function guardarSesion(s) {
  try { s ? localStorage.setItem('sobracerca_sesion', JSON.stringify(s)) : localStorage.removeItem('sobracerca_sesion'); } catch { /* sin almacenamiento */ }
}

export async function api(ruta, { metodo = 'GET', datos } = {}) {
  const s = sesion();
  const r = await fetch(`/api${ruta}`, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(s?.token ? { Authorization: `Bearer ${s.token}` } : {}) },
    body: datos ? JSON.stringify(datos) : undefined,
  });
  const cuerpo = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401 && s) guardarSesion(null);
    throw new Error(cuerpo.error || 'No fue posible completar la acción.');
  }
  return cuerpo;
}

export const pesos = (n) => '$' + Number(n || 0).toLocaleString('es-CO');
export const horaCorta = (f) => new Date(f).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
export const distancia = (m) => (m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`);
export const TIPOS = { panaderia: 'Panadería', fruteria: 'Frutería', cafeteria: 'Cafetería', restaurante: 'Restaurante', otro: 'Otro' };
export const CENTRO = [4.5585, -74.1195]; // barrio Marruecos
