const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzp5pi6kORcXzziLHNvL8t-6at1BBUJj8molRYYrvyz_pFbQRnMbKrjISmDJlfM3hfL/exec';
let citasExistentes = [];
let popupTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  fetchAppointments();

  // Event Listeners para botones principales
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', fetchAppointments);
  }

  const closePopupBtn = document.getElementById('closePopupBtn');
  if (closePopupBtn) {
    closePopupBtn.addEventListener('click', cerrarPopup);
  }
});

function obtenerFechaLimpia(fechaStr) {
  if (!fechaStr) return '';
  if (typeof fechaStr === 'string' && fechaStr.includes('T')) {
    return fechaStr.split('T')[0];
  }
  const dateObj = new Date(fechaStr);
  if (isNaN(dateObj.getTime())) return fechaStr;

  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function fetchAppointments() {
  const tbody = document.getElementById('citasTable');
  tbody.innerHTML = '<tr><td colspan="8" class="p-6 text-center text-gray-500">Cargando citas...</td></tr>';

  try {
    const res = await fetch(SCRIPT_URL);
    const json = await res.json();
    citasExistentes = json.data || [];
    tbody.innerHTML = '';

    if (citasExistentes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="p-6 text-center text-gray-500">No hay citas registradas.</td></tr>';
      return;
    }

    // Ordenar las citas por fecha de menor a mayor (orden ascendente)
    citasExistentes.sort((a, b) => {
      const dateA = new Date(a.Fecha);
      const dateB = new Date(b.Fecha);
      return dateA - dateB;
    });

    citasExistentes.forEach((cita, index) => {
      if (!cita.Cliente) return;

      const fechaFormateada = obtenerFechaLimpia(cita.Fecha);
      const estadoActual = (cita.Estado || 'Agendada').toUpperCase();
      const telefono = cita.Teléfono || cita.Telefono || '';
      const hora = cita['Hora Inicio'] || cita.Hora || '';

      let statusClass = 'status-agendada';
      if (estadoActual === 'CONFIRMADA') statusClass = 'status-confirmada';
      if (estadoActual === 'CANCELADA') statusClass = 'status-cancelada';

       // 1. Limpieza y formateo con código de país
      let telefonoLimpio = telefono ? telefono.toString().replace(/\D/g, '') : '';
      if (telefonoLimpio.length === 10) {
        telefonoLimpio = '+52' + telefonoLimpio; // Cambia '52' según el país de tu barbería
      }
      
      // 2. Construcción del mensaje codificado
      const mensaje = encodeURIComponent(
        `¡Hola ${cita.Cliente}! Te saludamos de La Luna Roja Barbershop 💈. Confirmamos tu cita para el ${fechaFormateada} a las ${hora} con ${cita.Barbero || 'tu barbero'}. ¿Nos confirmas tu asistencia?`
      );
      
      // 3. URL en formato API universal
      const urlWhatsapp = `https://api.whatsapp.com/send?phone=${telefonoLimpio}&text=${mensaje}`;
      
      // 4. Generación de la celda de la tabla
      const row = `<tr class="hover:bg-[#1a1a1a] transition">
        <td class="p-3 text-gray-400 font-mono">${fechaFormateada}</td>
        <td class="p-3 font-semibold text-[#e5b757] font-mono">${hora}</td>
        <td class="p-3 font-medium text-white">${cita.Cliente}</td>
        <td class="p-3 font-medium text-white">${telefono}</td>
        <td class="p-3 text-gray-300">${cita.Servicio || ''}</td>
        <td class="p-3 text-gray-300">${cita.Barbero || ''}</td>
        <td class="p-3">
          <select 
            data-index="${index}"
            class="status-select ${statusClass} text-xs font-bold px-3 py-1.5 rounded border transition cursor-pointer outline-none disabled:opacity-50 disabled:cursor-not-allowed">
            <option value="AGENDADA" class="bg-[#151515] text-[#e5b757]" ${estadoActual === 'AGENDADA' ? 'selected' : ''}>AGENDADA</option>
            <option value="CONFIRMADA" class="bg-[#151515] text-[#34d399]" ${estadoActual === 'CONFIRMADA' ? 'selected' : ''}>CONFIRMADA</option>
            <option value="CANCELADA" class="bg-[#151515] text-[#f87171]" ${estadoActual === 'CANCELADA' ? 'selected' : ''}>CANCELADA</option>
          </select>
        </td>
        <td class="p-3 text-center">
          ${
            telefonoLimpio 
              ? `<a href="${urlWhatsapp}" target="_blank" rel="noopener noreferrer" 
                  class="inline-flex items-center gap-1.5 bg-[#062c16] hover:bg-[#0b5e30] text-[#34d399] border border-[#0b5e30] px-3 py-1.5 rounded text-xs font-bold transition active:scale-95">
                  💬 Confirmar
                 </a>`
              : `<span class="text-xs text-gray-500">Sin tel.</span>`
          }
        </td>
      </tr>`;
      
      tbody.innerHTML += row;
    });

    // Agregar listeners a los selects dinámicos
    const selects = tbody.querySelectorAll('.status-select');
    selects.forEach(select => {
      select.addEventListener('change', (e) => {
        const index = e.target.getAttribute('data-index');
        cambiarEstadoCita(e.target, index);
      });
    });

  } catch (err) {
    tbody.innerHTML = '<tr><td colspan="8" class="p-4 text-center text-red-500">Error al cargar citas</td></tr>';
  }
}

function toggleControles(bloquear) {
  document.body.classList.toggle('is-updating', bloquear);
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) refreshBtn.disabled = bloquear;

  const selects = document.querySelectorAll('.status-select');
  selects.forEach(select => select.disabled = bloquear);
}

function mostrarPopup() {
  const modal = document.getElementById('popupModal');
  const modalCard = modal.querySelector('.id-modal-card');

  modal.classList.remove('opacity-0', 'pointer-events-none');
  modal.classList.add('opacity-100');
  modalCard.classList.remove('scale-95');
  modalCard.classList.add('scale-100');

  if (popupTimer) clearTimeout(popupTimer);
  popupTimer = setTimeout(cerrarPopup, 3500);
}

function cerrarPopup() {
  const modal = document.getElementById('popupModal');
  const modalCard = modal.querySelector('.id-modal-card');

  modal.classList.remove('opacity-100');
  modal.classList.add('opacity-0', 'pointer-events-none');
  modalCard.classList.remove('scale-100');
  modalCard.classList.add('scale-95');

  if (popupTimer) clearTimeout(popupTimer);
}

async function cambiarEstadoCita(selectElement, index) {
  const nuevoEstado = selectElement.value;
  const cita = citasExistentes[index];

  selectElement.classList.remove('status-agendada', 'status-confirmada', 'status-cancelada');
  if (nuevoEstado.toUpperCase() === 'CONFIRMADA') selectElement.classList.add('status-confirmada');
  else if (nuevoEstado.toUpperCase() === 'CANCELADA') selectElement.classList.add('status-cancelada');
  else selectElement.classList.add('status-agendada');

  toggleControles(true);

  const payload = {
    action: "UPDATE_ESTADO",
    cliente: cita.Cliente,
    fecha: obtenerFechaLimpia(cita.Fecha),
    horaInicio: cita['Hora Inicio'] || cita.Hora,
    estado: nuevoEstado
  };

  try {
    await fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    citasExistentes[index].Estado = nuevoEstado;
    mostrarPopup();
  } catch (err) {
    alert('Error al modificar el estado');
  } finally {
    toggleControles(false);
  }
}
