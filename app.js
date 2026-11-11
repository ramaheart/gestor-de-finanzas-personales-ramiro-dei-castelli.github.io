import { Transaccion } from './classes/Transaccion.js';

const form = document.getElementById('form-transaccion');
const tablaMovimientos = document.getElementById('tabla-movimientos');
const totalIngresosElem = document.getElementById('total-ingresos');
const totalGastosElem = document.getElementById('total-gastos');
const balanceNetoElem = document.getElementById('balance-neto');
const fechaInput = document.getElementById('fecha');

// Variable global temporal para saber si estamos editando un ID específico
let idTransaccionEnEdicion = null;

// Instancias globales de Chart.js
let chartBarras = null;
let chartLineas = null;

// Establecer la fecha actual por defecto en el input
if (fechaInput) {
    fechaInput.value = new Date().toISOString().split('T')[0];
}

// Función al cargar la página para pintar las transacciones de localStorage
actualizarInterfaz();

form.addEventListener('submit', (e) => {
    e.preventDefault();

    const descripcion = document.getElementById('descripcion').value;
    const monto = document.getElementById('monto').value;
    const tipo = document.getElementById('tipo').value;
    const categoria = document.getElementById('categoria').value;
    const fecha = fechaInput.value;

    if (idTransaccionEnEdicion !== null) {
        Transaccion.actualizar(idTransaccionEnEdicion, { descripcion, monto, tipo, categoria, fecha });
        idTransaccionEnEdicion = null;

        const btnSubmit = form.querySelector('button[type="submit"]');
        btnSubmit.textContent = 'Registrar Transacción';
    } else {
        const nuevaTransaccion = new Transaccion(tipo, descripcion, monto, categoria, fecha);
        Transaccion.agregar(nuevaTransaccion);
    }

    actualizarInterfaz();
    form.reset();
    fechaInput.value = new Date().toISOString().split('T')[0];
});

function actualizarInterfaz() {
    tablaMovimientos.innerHTML = '';

    let ingresosTotales = 0;
    let gastosTotales = 0;

    if (Transaccion.historial.length === 0) {
        tablaMovimientos.innerHTML = `
            <tr>
                <td colspan="7" class="px-4 py-8 text-center text-gray-500">
                    No hay carga financiera registrada.
                </td>
            </tr>
        `;
    }

    Transaccion.historial.forEach((t) => {
        if (t.tipo === 'ingreso') {
            ingresosTotales += t.monto;
        } else {
            gastosTotales += t.monto;
        }

        const fila = document.createElement('tr');

        // Botón de Editar como el de Eliminar en la columna de acciones
        fila.innerHTML = `
            <td class="p-4 pl-1 font-mono text-xs text-gray-500">${t.id}</td>
            <td class="p-4 text-sm text-gray-300">${t.fecha || 'N/A'}</td>
            <td class="p-4 text-gray-200 font-medium">${t.descripcion}</td>
            <td class="p-4 text-gray-300">${t.categoria}</td>
            <td class="p-4 capitalize text-sm">${t.tipo}</td>
            <td class="p-4 font-semibold ${t.tipo === 'ingreso' ? 'text-emerald-400' : 'text-rose-400'}">$${t.monto.toFixed(2)}</td>
            <td class="p-4 pr-1 text-right space-x-2">
                <button onclick="window.prepararEdicion(${t.id})" class="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 px-3 py-1 rounded-lg text-sm transition cursor-pointer">Editar</button>
                <button onclick="window.eliminarRegistro(${t.id})" class="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 px-3 py-1 rounded-lg text-sm transition cursor-pointer">Eliminar</button>
            </td>
        `;

        tablaMovimientos.appendChild(fila);
    });

    const balanceNeto = ingresosTotales - gastosTotales;

    totalIngresosElem.textContent = `$${ingresosTotales.toFixed(2)}`;
    totalGastosElem.textContent = `$${gastosTotales.toFixed(2)}`;
    balanceNetoElem.textContent = `$${balanceNeto.toFixed(2)}`;

    // Renderizar o refrescar gráficos
    renderizarGraficoBarras();
    renderizarGraficoLineas();
}


// Lógica del Gráfico de Barras por Categoría
function renderizarGraficoBarras() {
    const ctx = document.getElementById('chart-barras-categorias')?.getContext('2d');
    if (!ctx) return;

    const categoriasPosibles = ['Sueldo', 'Servicios', 'Comida', 'Transporte', 'Entretenimiento', 'Salud', 'Educación', 'Otros'];
    const acumuladoCategorias = {};
    categoriasPosibles.forEach(cat => acumuladoCategorias[cat] = 0);

    Transaccion.historial.forEach(t => {
        if (acumuladoCategorias[t.categoria] !== undefined) {
            acumuladoCategorias[t.categoria] += t.monto;
        }
    });

    const dataValues = categoriasPosibles.map(cat => acumuladoCategorias[cat]);

    if (chartBarras) {
        chartBarras.destroy();
    }

    chartBarras = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: categoriasPosibles,
            datasets: [{
                label: 'Monto Total ($)',
                data: dataValues,
                backgroundColor: 'rgba(59, 130, 246, 0.65)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#9ca3af' } }
            },
            scales: {
                x: { ticks: { color: '#9ca3af' }, grid: { color: '#1f2937' } },
                y: { ticks: { color: '#9ca3af' }, grid: { color: '#1f2937' }, beginAtZero: true }
            }
        }
    });
}


// Lógica del Gráfico de Líneas (Evolución Temporal)
function renderizarGraficoLineas() {
    const ctx = document.getElementById('chart-lineas-evolucion')?.getContext('2d');
    if (!ctx) return;

    // Extraer fechas únicas ordenadas cronológicamente
    const fechasUnicas = [...new Set(Transaccion.historial.map(t => t.fecha))].sort();

    const dataIngresos = [];
    const dataEgresos = [];
    const dataBalanceNeto = [];

    fechasUnicas.forEach(fecha => {
        const transaccionesFecha = Transaccion.historial.filter(t => t.fecha === fecha);

        const ing = transaccionesFecha
            .filter(t => t.tipo === 'ingreso')
            .reduce((acc, t) => acc + t.monto, 0);

        const egr = transaccionesFecha
            .filter(t => t.tipo === 'gasto')
            .reduce((acc, t) => acc + t.monto, 0);

        dataIngresos.push(ing);
        dataEgresos.push(egr);
        dataBalanceNeto.push(ing - egr);
    });

    if (chartLineas) {
        chartLineas.destroy();
    }

    chartLineas = new Chart(ctx, {
        type: 'line',
        data: {
            labels: fechasUnicas,
            datasets: [
                {
                    label: 'Ingresos',
                    data: dataIngresos,
                    borderColor: '#34d399',
                    backgroundColor: 'rgba(52, 211, 153, 0.1)',
                    tension: 0.3,
                    fill: true
                },
                {
                    label: 'Egresos (Gastos)',
                    data: dataEgresos,
                    borderColor: '#f87171',
                    backgroundColor: 'rgba(248, 113, 113, 0.1)',
                    tension: 0.3,
                    fill: true
                },
                {
                    label: 'Balance Neto',
                    data: dataBalanceNeto,
                    borderColor: '#60a5fa',
                    backgroundColor: 'rgba(96, 165, 250, 0.1)',
                    tension: 0.3,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#9ca3af' } }
            },
            scales: {
                x: { ticks: { color: '#9ca3af' }, grid: { color: '#1f2937' } },
                y: { ticks: { color: '#9ca3af' }, grid: { color: '#1f2937' }, beginAtZero: true }
            }
        }
    });
}

// Función global para cargar los datos en el formulario y activar el modo edición
window.prepararEdicion = function (id) {
    const transaccion = Transaccion.historial.find(t => t.id === Number(id));
    if (!transaccion) return;

    // los inputs con los datos actuales de la transacción 
    document.getElementById('descripcion').value = transaccion.descripcion;
    document.getElementById('monto').value = transaccion.monto;
    document.getElementById('tipo').value = transaccion.tipo;
    document.getElementById('categoria').value = transaccion.categoria;
    fechaInput.value = transaccion.fecha || new Date().toISOString().split('T')[0];

    // ID que estamos editando temporalmente
    idTransaccionEnEdicion = transaccion.id;
    // texto del botón de envío para darle feedback visual al usuario
    const btnSubmit = form.querySelector('button[type="submit"]');
    btnSubmit.textContent = 'Actualizar Transacción';
    form.scrollIntoView({ behavior: 'smooth' });
};

window.eliminarRegistro = function (id) {
    // eliminan el registro que se estaba editando hace que se limpie el formulario y resetea el estado
    if (idTransaccionEnEdicion === Number(id)) {
        idTransaccionEnEdicion = null;
        form.reset();
        fechaInput.value = new Date().toISOString().split('T')[0];
        const btnSubmit = form.querySelector('button[type="submit"]');
        btnSubmit.textContent = 'Registrar Transacción';
    }

    Transaccion.eliminar(id);
    actualizarInterfaz();
};

    Transaccion.eliminar(id);
    actualizarInterfaz();
};
