
    // ========== VARIABLES GLOBALES ==========
    let clientes = [];
    let clienteEditando = null;
    let chartTendencia = null;
    let chartPlanes = null;
    let historialCambios = [];
    let intervalRecordatorios = null;

    // ========== CARGA INICIAL ==========
    document.addEventListener('DOMContentLoaded', () => {
        cargarClientes();
        cargarHistorial();
        configurarPWA();
        programarRecordatorios();
        cargarTema();
    });

    function cargarClientes() {
        const guardados = localStorage.getItem('gtc_clientes');
        if (guardados) {
            clientes = JSON.parse(guardados);
        }
        actualizarTodo();
    }

    function guardarClientes() {
        localStorage.setItem('gtc_clientes', JSON.stringify(clientes));
        actualizarTodo();
        registrarCambio('Actualización masiva', null);
    }

    function cargarHistorial() {
        const historial = localStorage.getItem('gtc_historial');
        if (historial) {
            historialCambios = JSON.parse(historial);
        }
    }

    // ========== ACTUALIZACIONES ==========
    function actualizarTodo() {
        actualizarTabla();
        actualizarEstadisticas();
        actualizarGraficos();
        actualizarRecordatorios();
    }

    // ========== FUNCIONES AUXILIARES ==========
    function calcularEstado(cliente) {
        if (cliente.plan !== 'prueba') return 'activo';
        if (!cliente.fechaVencimiento) return 'activo';

        const hoy = new Date();
        const vencimiento = new Date(cliente.fechaVencimiento);
        const diff = Math.ceil((vencimiento - hoy) / (1000 * 60 * 60 * 24));

        if (diff < 0) return 'vencido';
        if (diff <= 5) return 'por-vencer';
        return 'activo';
    }

    function calcularDiasRestantes(cliente) {
        if (!cliente.fechaVencimiento) return 999;
        const hoy = new Date();
        const vencimiento = new Date(cliente.fechaVencimiento);
        return Math.ceil((vencimiento - hoy) / (1000 * 60 * 60 * 24));
    }

    function traducirRubro(rubro) {
        const traducciones = {
            'barberia': 'Barbería',
            'veterinaria': 'Veterinaria',
            'kiosco': 'Kiosco',
            'lubricentro': 'Lubricentro',
            'restaurante': 'Restaurante',
            'unas': 'Uñas/Estética',
            'otros': 'Otros'
        };
        return traducciones[rubro] || rubro;
    }

    function formatearFecha(fecha) {
        if (!fecha) return '-';
        return new Date(fecha).toLocaleDateString('es-AR');
    }

    // Función para escapar comillas simples en atributos onclick
    function escaparComillas(str) {
        if (!str) return '';
        return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
    }

    // ========== ESTADÍSTICAS AVANZADAS ==========
    function actualizarEstadisticas() {
        const total = clientes.length;

        const mesActual = new Date().getMonth();
        const anioActual = new Date().getFullYear();
        const ingresosMes = clientes.reduce((sum, c) => {
            if (c.fechaPago) {
                const fechaPago = new Date(c.fechaPago);
                if (fechaPago.getMonth() === mesActual && fechaPago.getFullYear() === anioActual) {
                    return sum + (c.monto || 0);
                }
            }
            return sum;
        }, 0);

        const hoy = new Date();
        const porVencer = clientes.filter(c => {
            if (c.plan !== 'prueba' || !c.fechaVencimiento) return false;
            const vencimiento = new Date(c.fechaVencimiento);
            const diff = Math.ceil((vencimiento - hoy) / (1000 * 60 * 60 * 24));
            return diff <= 5 && diff >= 0;
        }).length;

        const clientesPago = clientes.filter(c => c.plan !== 'prueba').length;
        const tasaRetencion = total > 0 ? Math.round((clientesPago / total) * 100) : 0;

        const inicioSemana = new Date();
        inicioSemana.setDate(inicioSemana.getDate() - inicioSemana.getDay() + 1);
        inicioSemana.setHours(0, 0, 0, 0);

        const nuevosSemana = clientes.filter(c => {
            const instalacion = new Date(c.fechaInstalacion);
            return instalacion >= inicioSemana;
        }).length;

        const clientesConPago = clientes.filter(c => c.pago === 'si');
        const valorPromedio = clientesConPago.length > 0
            ? Math.round(clientesConPago.reduce((sum, c) => sum + (c.monto || 0), 0) / clientesConPago.length)
            : 0;

        document.getElementById('totalClientes').textContent = total;
        document.getElementById('ingresosMes').textContent = `$${ingresosMes.toLocaleString()}`;
        document.getElementById('porVencer').textContent = porVencer;
        document.getElementById('tasaRetencion').textContent = `${tasaRetencion}%`;
        document.getElementById('nuevosSemana').textContent = nuevosSemana;
        document.getElementById('valorPromedio').textContent = `$${valorPromedio.toLocaleString()}`;
    }

    // ========== GRÁFICOS MEJORADOS ==========
    function actualizarGraficos() {
        try {
            const ingresosPorMes = {};
            const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

            const hoy = new Date();
            for (let i = 5; i >= 0; i--) {
                const fecha = new Date(hoy);
                fecha.setMonth(hoy.getMonth() - i);
                const key = `${meses[fecha.getMonth()]} ${fecha.getFullYear()}`;
                ingresosPorMes[key] = 0;
            }

            clientes.forEach(c => {
                if (c.fechaPago && c.monto) {
                    const fecha = new Date(c.fechaPago);
                    const key = `${meses[fecha.getMonth()]} ${fecha.getFullYear()}`;
                    if (ingresosPorMes.hasOwnProperty(key)) {
                        ingresosPorMes[key] += c.monto;
                    }
                }
            });

            const labels = Object.keys(ingresosPorMes);
            const datos = Object.values(ingresosPorMes);

            if (chartTendencia) chartTendencia.destroy();
            const ctxTendencia = document.getElementById('chartTendencia')?.getContext('2d');
            if (ctxTendencia) {
                chartTendencia = new Chart(ctxTendencia, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Ingresos Mensuales',
                            data: datos,
                            borderColor: '#00c2ff',
                            backgroundColor: 'rgba(0, 194, 255, 0.1)',
                            tension: 0.4,
                            fill: true
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: { legend: { display: false } },
                        scales: {
                            y: {
                                beginAtZero: true,
                                grid: { color: '#2d3748' },
                                ticks: {
                                    color: '#94a3b8',
                                    callback: value => '$' + value.toLocaleString()
                                }
                            },
                            x: { ticks: { color: '#94a3b8' } }
                        }
                    }
                });
            }

            const planes = ['prueba', 'basico', 'pro', 'full', 'premium'];
            const datosPlanes = planes.map(p => clientes.filter(c => c.plan === p).length);

            if (chartPlanes) chartPlanes.destroy();
            const ctxPlanes = document.getElementById('chartPlanes')?.getContext('2d');
            if (ctxPlanes) {
                chartPlanes = new Chart(ctxPlanes, {
                    type: 'doughnut',
                    data: {
                        labels: ['Prueba', 'Básico', 'Pro', 'Full', 'Premium'],
                        datasets: [{
                            data: datosPlanes,
                            backgroundColor: ['#f39c12', '#3498db', '#2ecc71', '#9b59b6', '#f1c40f'],
                            borderWidth: 0
                        }]
                    },
                    options: {
                        responsive: true,
                        plugins: {
                            legend: { labels: { color: '#94a3b8' } }
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Error al actualizar gráficos:', error);
        }
    }

    // ========== RECORDATORIOS AUTOMÁTICOS ==========
    function actualizarRecordatorios() {
        const hoy = new Date();
        const porVencer = clientes.filter(c => {
            if (!c.fechaVencimiento || c.plan !== 'prueba') return false;
            const vencimiento = new Date(c.fechaVencimiento);
            const diff = Math.ceil((vencimiento - hoy) / (1000 * 60 * 60 * 24));
            return diff <= 5 && diff >= 0;
        });

        actualizarBadgeRecordatorios(porVencer.length);
    }

    function programarRecordatorios() {
        if (intervalRecordatorios) clearInterval(intervalRecordatorios);

        intervalRecordatorios = setInterval(() => {
            const hoy = new Date();

            clientes.forEach(cliente => {
                if (cliente.fechaVencimiento && cliente.plan === 'prueba') {
                    const vencimiento = new Date(cliente.fechaVencimiento);
                    const diff = Math.ceil((vencimiento - hoy) / (1000 * 60 * 60 * 24));

                    if ([5, 3, 2, 1, 0].includes(diff)) {
                        registrarCambio('recordatorio_hito', {
                            cliente: cliente.nombre,
                            dias: diff,
                            fecha: new Date().toISOString()
                        });
                        mostrarToast(`⚠️ ${cliente.nombre} vence en ${diff} días`, 'warning');
                    }
                }
            });

            actualizarRecordatorios();
        }, 1000 * 60 * 60 * 6); // Cada 6 horas
    }

    function actualizarBadgeRecordatorios(cantidad) {
        const badge = document.getElementById('recordatoriosBadge');
        if (badge) {
            if (cantidad > 0) {
                badge.textContent = cantidad;
                badge.style.display = 'inline';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    function verRecordatorios() {
        const hoy = new Date();
        const porVencer = clientes.filter(c => {
            if (!c.fechaVencimiento || c.plan !== 'prueba') return false;
            const vencimiento = new Date(c.fechaVencimiento);
            const diff = Math.ceil((vencimiento - hoy) / (1000 * 60 * 60 * 24));
            return diff <= 5 && diff >= 0;
        });

        const lista = document.getElementById('recordatoriosLista');
        if (!lista) return;

        if (porVencer.length === 0) {
            lista.innerHTML = '<p style="text-align:center; padding:20px; color:#94a3b8;">No hay recordatorios pendientes</p>';
        } else {
            lista.innerHTML = porVencer.map(c => {
                const dias = calcularDiasRestantes(c);
                const claseDias = dias <= 1 ? 'urgente' : dias <= 3 ? 'alerta' : 'normal';
                const telefonoEscapado = escaparComillas(c.telefono);
                const nombreEscapado = escaparComillas(c.nombre);
                const emailEscapado = escaparComillas(c.email || '');

                return `
                    <div class="recordatorio-item">
                        <div class="recordatorio-header">
                            <span class="recordatorio-nombre">${c.nombre}</span>
                            <span class="recordatorio-dias ${claseDias}">${dias} día${dias !== 1 ? 's' : ''}</span>
                        </div>
                        <div style="display:flex; gap:10px; margin-top:10px;">
                            <button class="btn-icon whatsapp" onclick="enviarWhatsApp('${telefonoEscapado}', '${nombreEscapado}', 'Recordatorio: tu plan vence en ${dias} días. Contactanos para renovar.')" title="WhatsApp">
                                <i class="fab fa-whatsapp"></i>
                            </button>
                            ${c.email ? `
                                <button class="btn-icon email" onclick="enviarEmail('${emailEscapado}', '${nombreEscapado}', 'vencimiento')" title="Enviar email">
                                    <i class="fas fa-envelope"></i>
                                </button>
                            ` : ''}
                            <button class="btn-icon" onclick="editarCliente('${c.id}')" title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }

        document.getElementById('modalRecordatorios').classList.add('active');
    }

    function cerrarModalRecordatorios() {
        document.getElementById('modalRecordatorios').classList.remove('active');
    }

    // ========== WHATSAPP ==========
    function enviarWhatsApp(telefono, nombre, mensajePersonalizado = null) {
        if (!telefono) {
            mostrarToast('El cliente no tiene teléfono', 'warning');
            return;
        }

        let numero = telefono.replace(/\D/g, '');

        if (numero.length < 10) {
            mostrarToast('Número inválido', 'error');
            return;
        }

        if (!numero.startsWith('54')) {
            numero = '54' + numero;
        }

        const mensaje = mensajePersonalizado || `Hola ${nombre}, te escribo desde GTC Pro. ¿Cómo estás?`;

        window.open(`https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`, '_blank');
        registrarCambio('whatsapp_enviado', { nombre, telefono });
    }

    function abrirWhatsAppMasivo() {
        const mensaje = encodeURIComponent(
            'Hola, te contactamos desde GTC Pro. Recordá que tenemos promociones especiales para vos.'
        );
        window.open(`https://wa.me/?text=${mensaje}`, '_blank');
        registrarCambio('whatsapp_masivo');
    }

    // ========== EMAIL ==========
    function enviarEmail(email, nombre, tipo = 'general') {
        if (!email) {
            mostrarToast('El cliente no tiene email', 'warning');
            return;
        }

        let asunto = '';
        let cuerpo = '';

        if (tipo === 'vencimiento') {
            asunto = 'Tu plan está por vencer';
            cuerpo = `Hola ${nombre},\n\nTe recordamos que tu plan está por vencer. Contactanos para renovar y no perder los beneficios.\n\nSaludos,\nEquipo GTC Pro`;
        } else {
            asunto = 'Información de GTC Pro';
            cuerpo = `Hola ${nombre},\n\nTe contactamos para ofrecerte nuestras últimas novedades y promociones.\n\nSaludos,\nEquipo GTC Pro`;
        }

        window.location.href = `mailto:${email}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
        registrarCambio('email_enviado', { email, tipo });
    }

    function enviarEmailMasivo() {
        const emails = clientes
            .filter(c => c.email && c.plan !== 'prueba')
            .map(c => c.email)
            .join(',');

        if (emails.length === 0) {
            mostrarToast('No hay emails válidos', 'warning');
            return;
        }

        const asunto = encodeURIComponent('Novedades GTC Pro');
        const cuerpo = encodeURIComponent(
            'Hola,\n\nTe contactamos para ofrecerte nuestras últimas novedades y promociones especiales para clientes.\n\nSaludos,\nEquipo GTC Pro'
        );

        window.location.href = `mailto:${emails}?subject=${asunto}&body=${cuerpo}`;
        registrarCambio('email_masivo', { cantidad: clientes.length });
    }

    // ========== EXPORTAR PDF ==========
    function exportarPDF() {
        if (clientes.length === 0) {
            mostrarToast('No hay datos para exportar', 'warning');
            return;
        }

        const totalIngresos = clientes.reduce((sum, c) => sum + (c.monto || 0), 0);
        const activos = clientes.filter(c => c.plan !== 'prueba').length;
        const enPrueba = clientes.filter(c => c.plan === 'prueba').length;

        const contenido = `
            <div style="padding: 20px; font-family: Arial;">
                <h1 style="color: #00c2ff; text-align: center;">GTC Pro - Reporte de Clientes</h1>
                <p style="text-align: center; color: #666;">Fecha: ${new Date().toLocaleDateString('es-AR')}</p>
                
                <h3 style="margin-top: 30px;">📊 Estadísticas Generales</h3>
                <ul style="list-style: none; padding: 0;">
                    <li style="margin: 10px 0;">📈 Total Clientes: <strong>${clientes.length}</strong></li>
                    <li style="margin: 10px 0;">💰 Ingresos Totales: <strong>$${totalIngresos.toLocaleString()}</strong></li>
                    <li style="margin: 10px 0;">✅ Clientes Activos: <strong>${activos}</strong></li>
                    <li style="margin: 10px 0;">⏳ En Prueba: <strong>${enPrueba}</strong></li>
                </ul>
                
                <h3 style="margin-top: 30px;">📋 Listado de Clientes</h3>
                <table border="1" cellpadding="8" style="border-collapse: collapse; width: 100%;">
                    <thead>
                        <tr style="background: #00c2ff; color: white;">
                            <th>Negocio</th>
                            <th>Contacto</th>
                            <th>Teléfono</th>
                            <th>Plan</th>
                            <th>Instalación</th>
                            <th>Monto</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${clientes.map(c => `
                            <tr>
                                <td>${c.nombre}</td>
                                <td>${c.contacto || '-'}</td>
                                <td>${c.telefono}</td>
                                <td>${c.plan.toUpperCase()}</td>
                                <td>${formatearFecha(c.fechaInstalacion)}</td>
                                <td>${c.pago === 'si' ? `$${c.monto?.toLocaleString()}` : '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <p style="margin-top: 30px; color: #666; font-size: 0.9rem;">Generado automáticamente por GTC Pro Panel</p>
            </div>
        `;

        const ventana = window.open('', '_blank');
        ventana.document.write(`
            <html>
                <head>
                    <title>GTC Pro - Reporte</title>
                    <style>
                        body { font-family: Arial; padding: 20px; }
                        h1 { color: #00c2ff; }
                        table { width: 100%; border-collapse: collapse; }
                        th { background: #00c2ff; color: white; padding: 8px; }
                        td { padding: 8px; border: 1px solid #ddd; }
                    </style>
                </head>
                <body>
                    ${contenido}
                    <script>
                        window.onload = () => window.print();
                    <\/script>
                </body>
            </html>
        `);
        ventana.document.close();

        registrarCambio('exportacion_pdf');
        mostrarToast('✅ Reporte PDF generado', 'success');
    }

    // ========== ANÁLISIS DE RETENCIÓN ==========
    function analizarRetencion() {
        const hoy = new Date();
        const seisMesesAtras = new Date(hoy);
        seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);

        const clientesUltimos6Meses = clientes.filter(c => {
            const instalacion = new Date(c.fechaInstalacion);
            return instalacion >= seisMesesAtras;
        });

        const convertidos = clientesUltimos6Meses.filter(c => c.plan !== 'prueba' && c.pago === 'si');
        const tasaConversion = clientesUltimos6Meses.length > 0
            ? (convertidos.length / clientesUltimos6Meses.length * 100).toFixed(1)
            : 0;

        const ingresosPromedio = convertidos.length > 0
            ? (convertidos.reduce((sum, c) => sum + (c.monto || 0), 0) / convertidos.length).toFixed(0)
            : 0;

        const mensaje = `
📊 ANÁLISIS DE RETENCIÓN (últimos 6 meses)
═════════════════════════════════════════
📈 Clientes nuevos: ${clientesUltimos6Meses.length}
💰 Convertidos a pago: ${convertidos.length}
📊 Tasa de conversión: ${tasaConversion}%
💰 Ingreso promedio por cliente: $${Number(ingresosPromedio).toLocaleString()}
        `;

        alert(mensaje);
        registrarCambio('analisis_retencion');
    }

    // ========== HISTORIAL / AUDITORÍA ==========
    function registrarCambio(accion, detalles) {
        const registro = {
            fecha: new Date().toISOString(),
            accion: accion,
            detalles: detalles,
            usuario: 'admin'
        };

        historialCambios.unshift(registro);

        if (historialCambios.length > 100) {
            historialCambios = historialCambios.slice(0, 100);
        }

        localStorage.setItem('gtc_historial', JSON.stringify(historialCambios));
    }

    // ========== BACKUP Y RESTAURACIÓN ==========
    function backupDatos() {
        const backup = {
            fecha: new Date().toISOString(),
            clientes: clientes,
            version: '2.0',
            totalClientes: clientes.length,
            ingresosTotales: clientes.reduce((s, c) => s + (c.monto || 0), 0)
        };

        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup_gtc_${new Date().toISOString().split('T')[0]}.json`;
        a.click();

        registrarCambio('backup_realizado');
        mostrarToast('✅ Backup creado', 'success');
    }

    function restaurarBackup(event) {
        const file = event.target.files[0];
        if (!file) return;

        if (!confirm('¿Restaurar backup? Se perderán los datos actuales.')) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const backup = JSON.parse(e.target.result);
                if (backup.clientes) {
                    clientes = backup.clientes;
                    guardarClientes();
                    mostrarToast(`✅ Backup restaurado: ${clientes.length} clientes`, 'success');
                    registrarCambio('backup_restaurado', { fecha: backup.fecha });
                }
            } catch (error) {
                mostrarToast('❌ Error al restaurar', 'error');
            }
        };
        reader.readAsText(file);
    }

    // ========== MODAL CLIENTE ==========
    function abrirModal(cliente = null) {
        clienteEditando = cliente;
        document.getElementById('modalTitulo').textContent = cliente ? 'Editar Cliente' : 'Nuevo Cliente';

        if (cliente) {
            document.getElementById('clienteId').value = cliente.id || '';
            document.getElementById('clienteNombre').value = cliente.nombre || '';
            document.getElementById('clienteContacto').value = cliente.contacto || '';
            document.getElementById('clienteTelefono').value = cliente.telefono || '';
            document.getElementById('clienteEmail').value = cliente.email || '';
            document.getElementById('clienteDireccion').value = cliente.direccion || '';
            document.getElementById('clienteRubro').value = cliente.rubro || 'barberia';
            document.getElementById('clientePlan').value = cliente.plan || 'prueba';
            document.getElementById('fechaInstalacion').value = cliente.fechaInstalacion || '';
            document.getElementById('fechaVencimiento').value = cliente.fechaVencimiento || '';
            document.getElementById('clientePago').value = cliente.pago || 'no';
            document.getElementById('clienteMonto').value = cliente.monto || 0;
            document.getElementById('fechaPago').value = cliente.fechaPago || '';
            document.getElementById('clienteObservaciones').value = cliente.observaciones || '';
        } else {
            document.getElementById('clienteId').value = '';
            document.getElementById('clienteNombre').value = '';
            document.getElementById('clienteContacto').value = '';
            document.getElementById('clienteTelefono').value = '';
            document.getElementById('clienteEmail').value = '';
            document.getElementById('clienteDireccion').value = '';
            document.getElementById('clienteRubro').value = 'barberia';
            document.getElementById('clientePlan').value = 'prueba';
            document.getElementById('fechaInstalacion').value = new Date().toISOString().split('T')[0];
            document.getElementById('fechaVencimiento').value = '';
            document.getElementById('clientePago').value = 'no';
            document.getElementById('clienteMonto').value = 0;
            document.getElementById('fechaPago').value = '';
            document.getElementById('clienteObservaciones').value = '';
        }

        actualizarVencimiento();
        toggleMonto();
        document.getElementById('modalCliente').classList.add('active');
    }

    function cerrarModal() {
        document.getElementById('modalCliente').classList.remove('active');
        clienteEditando = null;
    }

    function actualizarVencimiento() {
        const plan = document.getElementById('clientePlan').value;
        const fechaInst = document.getElementById('fechaInstalacion').value;

        if (plan === 'prueba' && fechaInst) {
            const fecha = new Date(fechaInst);
            fecha.setDate(fecha.getDate() + 15);
            document.getElementById('fechaVencimiento').value = fecha.toISOString().split('T')[0];
        } else {
            document.getElementById('fechaVencimiento').value = '';
        }
    }

    function toggleMonto() {
        const pago = document.getElementById('clientePago').value;
        const montoInput = document.getElementById('clienteMonto');
        montoInput.disabled = pago === 'no';
        if (pago === 'no') montoInput.value = 0;
    }

    function guardarCliente(event) {
        event.preventDefault();

        const cliente = {
            id: document.getElementById('clienteId').value || Date.now().toString(),
            nombre: document.getElementById('clienteNombre').value,
            contacto: document.getElementById('clienteContacto').value,
            telefono: document.getElementById('clienteTelefono').value,
            email: document.getElementById('clienteEmail').value,
            direccion: document.getElementById('clienteDireccion').value,
            rubro: document.getElementById('clienteRubro').value,
            plan: document.getElementById('clientePlan').value,
            fechaInstalacion: document.getElementById('fechaInstalacion').value,
            fechaVencimiento: document.getElementById('fechaVencimiento').value || null,
            pago: document.getElementById('clientePago').value,
            monto: parseFloat(document.getElementById('clienteMonto').value) || 0,
            fechaPago: document.getElementById('fechaPago').value || new Date().toISOString().split('T')[0],
            observaciones: document.getElementById('clienteObservaciones').value
        };

        if (clienteEditando) {
            const index = clientes.findIndex(c => c.id === clienteEditando.id);
            if (index !== -1) clientes[index] = cliente;
            registrarCambio('cliente_editado', { nombre: cliente.nombre });
        } else {
            clientes.push(cliente);
            registrarCambio('cliente_creado', { nombre: cliente.nombre });
        }

        guardarClientes();
        cerrarModal();
        mostrarToast(clienteEditando ? '✅ Cliente actualizado' : '✅ Cliente creado', 'success');
    }

    function editarCliente(id) {
        const cliente = clientes.find(c => c.id === id);
        if (cliente) abrirModal(cliente);
    }

    function eliminarCliente(id) {
        if (confirm('¿Eliminar este cliente?')) {
            const cliente = clientes.find(c => c.id === id);
            clientes = clientes.filter(c => c.id !== id);
            guardarClientes();
            registrarCambio('cliente_eliminado', { nombre: cliente?.nombre });
            mostrarToast('✅ Cliente eliminado', 'success');
        }
    }

    function verDetalle(id) {
        const c = clientes.find(c => c.id === id);
        if (!c) return;

        const estado = calcularEstado(c);
        const mensaje = `
📋 DETALLE DEL CLIENTE
═════════════════════
🏪 Negocio: ${c.nombre}
👤 Contacto: ${c.contacto || '-'}
📞 Teléfono: ${c.telefono}
📧 Email: ${c.email || '-'}
📍 Dirección: ${c.direccion || '-'}
🏷️ Rubro: ${traducirRubro(c.rubro)}
💳 Plan: ${c.plan.toUpperCase()}
📅 Instalación: ${formatearFecha(c.fechaInstalacion)}
⏰ Vencimiento: ${c.fechaVencimiento ? formatearFecha(c.fechaVencimiento) : '-'}
📊 Estado: ${estado === 'activo' ? '✅ Activo' : estado === 'vencido' ? '❌ Vencido' : '⚠️ Por vencer'}
💰 Pago: ${c.pago === 'si' ? `✅ $${c.monto?.toLocaleString()}` : '❌ Pendiente'}
📝 Observaciones: ${c.observaciones || '-'}
        `;

        alert(mensaje);
    }

    // ========== TABLA Y FILTROS ==========
    function filtrarClientes() {
        actualizarTabla();
    }

    function actualizarTabla() {
        const tbody = document.getElementById('clientesBody');
        if (!tbody) return;

        const filtroRubro = document.getElementById('filtroRubro').value;
        const filtroPlan = document.getElementById('filtroPlan').value;
        const filtroEstado = document.getElementById('filtroEstado').value;
        const busqueda = document.getElementById('searchInput').value.toLowerCase();
        const fechaDesde = document.getElementById('filtroFechaDesde').value;
        const fechaHasta = document.getElementById('filtroFechaHasta').value;

        let clientesFiltrados = clientes.filter(c => {
            if (busqueda) {
                const coincide = [
                    c.nombre,
                    c.contacto,
                    c.telefono,
                    c.email,
                    c.direccion,
                    traducirRubro(c.rubro)
                ].some(valor => valor && valor.toString().toLowerCase().includes(busqueda));

                if (!coincide) return false;
            }

            if (filtroRubro !== 'todos' && c.rubro !== filtroRubro) return false;
            if (filtroPlan !== 'todos' && c.plan !== filtroPlan) return false;

            const estado = calcularEstado(c);
            if (filtroEstado !== 'todos') {
                if (filtroEstado === 'activo' && estado !== 'activo') return false;
                if (filtroEstado === 'vencido' && estado !== 'vencido') return false;
                if (filtroEstado === 'por-vencer' && estado !== 'por-vencer') return false;
            }

            if (fechaDesde && c.fechaInstalacion < fechaDesde) return false;
            if (fechaHasta && c.fechaInstalacion > fechaHasta) return false;

            return true;
        });

        clientesFiltrados.sort((a, b) => {
            if (!a.fechaVencimiento) return 1;
            if (!b.fechaVencimiento) return -1;
            return new Date(a.fechaVencimiento) - new Date(b.fechaVencimiento);
        });

        if (clientesFiltrados.length === 0) {
            tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; padding: 40px;">
                <i class="fas fa-folder-open" style="font-size: 2rem; color: #4a5568; margin-bottom: 10px; display: block;"></i>
                No hay clientes para mostrar
            </td></tr>`;
        } else {
            tbody.innerHTML = clientesFiltrados.map(c => {
                const estado = calcularEstado(c);
                const estadoClass = estado === 'activo' ? 'activo' : estado === 'vencido' ? 'vencido' : 'por-vencer';
                const estadoTexto = estado === 'activo' ? 'Activo' : estado === 'vencido' ? 'Vencido' : 'Por vencer';
                const diasRestantes = c.fechaVencimiento ? calcularDiasRestantes(c) : null;
                const telefonoEscapado = escaparComillas(c.telefono);
                const nombreEscapado = escaparComillas(c.nombre);
                const emailEscapado = escaparComillas(c.email || '');

                return `
                    <tr>
                        <td><strong>${c.nombre}</strong></td>
                        <td>${c.contacto || '-'}</td>
                        <td>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span>${c.telefono}</span>
                                <button class="btn-icon whatsapp" onclick="enviarWhatsApp('${telefonoEscapado}', '${nombreEscapado}')" title="WhatsApp">
                                    <i class="fab fa-whatsapp"></i>
                                </button>
                            </div>
                        </td>
                        <td>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span>${c.email || '-'}</span>
                                ${c.email ? `
                                    <button class="btn-icon email" onclick="enviarEmail('${emailEscapado}', '${nombreEscapado}', 'general')" title="Enviar email">
                                        <i class="fas fa-envelope"></i>
                                    </button>
                                ` : ''}
                            </div>
                        </td>
                        <td>${traducirRubro(c.rubro)}</td>
                        <td><span class="badge ${c.plan}">${c.plan.toUpperCase()}</span></td>
                        <td>${formatearFecha(c.fechaInstalacion)}</td>
                        <td>
                            ${c.fechaVencimiento ? formatearFecha(c.fechaVencimiento) : '-'}
                            ${diasRestantes !== null && diasRestantes <= 5 ? `
                                <span style="color: #e74c3c; font-size: 0.75rem; display: block;">
                                    ⏳ ${diasRestantes} día${diasRestantes !== 1 ? 's' : ''}
                                </span>
                            ` : ''}
                        </td>
                        <td><span class="badge ${estadoClass}">${estadoTexto}</span></td>
                        <td>${c.pago === 'si' ? `$${c.monto?.toLocaleString()}` : '-'}</td>
                        <td class="actions-cell">
                            <button class="btn-icon" onclick="editarCliente('${c.id}')" title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-icon" onclick="verDetalle('${c.id}')" title="Detalles">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="btn-icon whatsapp" onclick="enviarWhatsApp('${telefonoEscapado}', '${nombreEscapado}')" title="WhatsApp">
                                <i class="fab fa-whatsapp"></i>
                            </button>
                            <button class="btn-icon delete" onclick="eliminarCliente('${c.id}')" title="Eliminar">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
        }
    }

    // ========== EXPORTAR EXCEL ==========
    function exportarExcel() {
        const headers = ['Negocio', 'Contacto', 'Teléfono', 'Email', 'Dirección', 'Rubro', 'Plan',
            'Instalación', 'Vencimiento', 'Estado', 'Pagó', 'Monto', 'Observaciones'];

        const rows = clientes.map(c => {
            const estado = calcularEstado(c);
            const estadoTexto = estado === 'activo' ? 'Activo' : estado === 'vencido' ? 'Vencido' : 'Por vencer';

            return [
                c.nombre,
                c.contacto || '',
                c.telefono,
                c.email || '',
                c.direccion || '',
                traducirRubro(c.rubro),
                c.plan.toUpperCase(),
                formatearFecha(c.fechaInstalacion),
                c.fechaVencimiento ? formatearFecha(c.fechaVencimiento) : '',
                estadoTexto,
                c.pago === 'si' ? 'Sí' : 'No',
                c.monto || 0,
                c.observaciones || ''
            ];
        });

        let csv = headers.join(',') + '\n';
        csv += rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `GTC_Clientes_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();

        registrarCambio('exportacion_excel');
        mostrarToast('✅ Excel exportado', 'success');
    }

    // ========== DATOS DE EJEMPLO ==========
    function cargarDatosEjemplo() {
        const ejemplos = [
            {
                id: '1',
                nombre: 'Barbería El Corte',
                contacto: 'Carlos Pérez',
                telefono: '1156789012',
                email: 'carlos@elcorte.com',
                direccion: 'Av. Corrientes 1234',
                rubro: 'barberia',
                plan: 'prueba',
                fechaInstalacion: '2026-03-01',
                fechaVencimiento: '2026-03-16',
                pago: 'no',
                monto: 0,
                observaciones: 'Interesado en plan Pro'
            },
            {
                id: '2',
                nombre: 'Veterinaria San Roque',
                contacto: 'Dra. Martínez',
                telefono: '1145678901',
                email: 'sanroque@vet.com',
                direccion: 'Belgrano 789',
                rubro: 'veterinaria',
                plan: 'full',
                fechaInstalacion: '2026-02-15',
                fechaVencimiento: null,
                pago: 'si',
                monto: 65000,
                fechaPago: '2026-02-15',
                observaciones: 'Pagó plan Full'
            },
            {
                id: '3',
                nombre: 'Kiosco Don Juan',
                contacto: 'Juan González',
                telefono: '1134567890',
                email: 'juan@kiosco.com',
                direccion: 'San Martín 456',
                rubro: 'kiosco',
                plan: 'prueba',
                fechaInstalacion: '2026-03-07',
                fechaVencimiento: '2026-03-22',
                pago: 'no',
                monto: 0,
                observaciones: 'Le quedan 13 días'
            },
            {
                id: '4',
                nombre: 'Lubricentro El Turbo',
                contacto: 'Roberto Sánchez',
                telefono: '1123456789',
                email: 'roberto@elturbo.com',
                direccion: 'Ruta 8 km 23',
                rubro: 'lubricentro',
                plan: 'pro',
                fechaInstalacion: '2026-02-28',
                fechaVencimiento: null,
                pago: 'si',
                monto: 45000,
                fechaPago: '2026-02-28',
                observaciones: 'Plan Pro, muy contento'
            },
            {
                id: '5',
                nombre: 'Estética Divine',
                contacto: 'Laura Medina',
                telefono: '1167890123',
                email: 'laura@divine.com',
                direccion: 'Palermo 321',
                rubro: 'unas',
                plan: 'premium',
                fechaInstalacion: '2026-03-05',
                fechaVencimiento: null,
                pago: 'si',
                monto: 85000,
                fechaPago: '2026-03-05',
                observaciones: 'Pago único Premium'
            }
        ];

        clientes = ejemplos;
        guardarClientes();
        registrarCambio('datos_ejemplo_cargados');
        mostrarToast('✅ Datos de ejemplo cargados', 'success');
    }

    // ========== TEMA OSCURO/CLARO ==========
    function toggleTema() {
        document.body.classList.toggle('light-mode');
        const esClaro = document.body.classList.contains('light-mode');
        localStorage.setItem('gtc_tema', esClaro ? 'light' : 'dark');
    }

    function cargarTema() {
        const temaGuardado = localStorage.getItem('gtc_tema');
        if (temaGuardado === 'light') {
            document.body.classList.add('light-mode');
        }
    }

    // ========== TOAST ==========
    function mostrarToast(mensaje, tipo = 'info') {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.textContent = mensaje;
        toast.className = `toast ${tipo}`;
        toast.style.display = 'block';
        setTimeout(() => toast.style.display = 'none', 3000);
    }

    // ========== PWA INSTALL ==========
    let deferredPrompt;

    function configurarPWA() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            const installPrompt = document.getElementById('installPrompt');
            if (installPrompt) installPrompt.style.display = 'flex';
        });
    }

    function instalarPWA() {
        if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('✅ PWA instalada');
                }
                deferredPrompt = null;
                document.getElementById('installPrompt').style.display = 'none';
            });
        }
    }

    function cerrarInstallPrompt() {
        document.getElementById('installPrompt').style.display = 'none';
    }
