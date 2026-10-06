// Luz Diaria: texto corto del aviso de oración (cambia cada día).
const M = ['Señor, gracias por este nuevo día. Ven y reza conmigo un minuto.', 'Tu oración de hoy ya está lista: fuerza, salud y abundancia.', 'Empieza tu día de la mano de Dios.', 'Un minuto con Dios cambia todo el día.', 'Gracias por despertar. Tu oración te espera.', 'Hoy Dios va delante de ti. Abre tu oración.', 'Pide por tu salud y por tu familia antes de empezar.'];
const N = ['Antes de dormir, entrega tu día a Dios.', 'Tu oración de la noche te espera. Descansa en paz.', 'Agradece lo bueno de hoy y duerme tranquilo.', 'Un minuto de paz antes de cerrar los ojos.', 'Deja en manos de Dios lo que no pudiste resolver.', 'Pide por los tuyos y descansa.', 'Termina tu día con gratitud.'];
function luzBody(moment, date) { const arr = moment === 'noche' ? N : M; const n = Number(String(date).replace(/-/g, '')) || 0; return arr[n % arr.length]; }
module.exports = { luzBody };
