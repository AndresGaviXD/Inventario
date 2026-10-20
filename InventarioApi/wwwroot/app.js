const API = '/api';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g,
    c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => Number(n ?? 0).toLocaleString('es-CO');
const fechaFmt = d => new Date(d).toLocaleString('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false
});

const state = {
    token: localStorage.getItem('token'),
    user: localStorage.getItem('user'),
    rol: localStorage.getItem('rol'),
    inv: [], prods: [], hist: [], usuarios: []
};
const esAdmin = () => state.rol === 'admin';

function toast(msg, error = false) {
    const el = document.createElement('div');
    el.className = 'toast' + (error ? ' err' : '');
    el.textContent = msg;
    $('toasts').appendChild(el);
    setTimeout(() => el.remove(), 4000);
}

async function api(path, opts = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (state.token) headers.Authorization = 'Bearer ' + state.token;

    let res;
    try {
        res = await fetch(API + path, { ...opts, headers });
    } catch {
        throw new Error('No se pudo conectar con el servidor');
    }

    if (res.status === 401 && state.token) {
        salir();
        throw new Error('Sesión expirada. Inicie sesión nuevamente.');
    }
    if (res.status === 403) throw new Error('No tiene permisos para realizar esta acción');

    const data = await res.json().catch(() => null);
    if (!res.ok) {
        const validacion = data?.errors ? Object.values(data.errors).flat().join(' ') : null;
        throw new Error(data?.error || validacion || data?.title || `Error ${res.status}`);
    }
    return data;
}

function setEstado(ok) {
    $('stConn').classList.toggle('off', !ok);
    $('stConnTxt').textContent = ok ? 'CONECTADO' : 'SIN CONEXIÓN';
    if (ok) $('stSync').textContent = 'Última actualización: ' + new Date().toLocaleTimeString('es-CO', { hour12: false });
}

function mostrarLogin() {
    $('vistaApp').classList.add('hidden');
    $('vistaLogin').classList.remove('hidden');
}

function aplicarRol() {
    document.querySelectorAll('.solo-admin').forEach(el => el.classList.toggle('hidden', !esAdmin()));
    $('lblRol').textContent = esAdmin() ? 'ADMINISTRADOR' : 'OPERADOR';
}

async function iniciarApp() {
    $('vistaLogin').classList.add('hidden');
    $('vistaApp').classList.remove('hidden');
    $('lblUser').textContent = state.user;
    aplicarRol();
    ir('panel');
    await refrescar();
}

function salir() {
    state.token = null;
    state.user = null;
    state.rol = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('rol');
    mostrarLogin();
}

function ir(vista) {
    if (vista === 'usuarios' && !esAdmin()) vista = 'panel';
    document.querySelectorAll('.view').forEach(s => s.classList.toggle('hidden', s.id !== 'v-' + vista));
    document.querySelectorAll('.side button').forEach(b => b.classList.toggle('active', b.dataset.view === vista));
}

async function refrescar(silencioso = false) {
    try {
        const pedidos = [
            api('/inventario'),
            api('/productos' + (esAdmin() ? '?incluirInactivos=true' : '')),
            api('/movimientos?limite=200')
        ];
        if (esAdmin()) pedidos.push(api('/usuarios'));

        const [inv, prods, hist, usr] = await Promise.all(pedidos);
        state.inv = inv;
        state.prods = prods;
        state.hist = hist;
        state.usuarios = usr ?? [];
        renderTodo();
        setEstado(true);
    } catch (e) {
        setEstado(false);
        if (!silencioso) toast(e.message, true);
    }
}

function renderTodo() {
    renderKpis();
    renderAlertas();
    renderUltimos();
    renderInv();
    renderHist();
    renderProds();
    renderUsuarios();
    llenarSelect();
}

function filaMov(m, conUsuario) {
    const tag = m.tipo === 'E'
        ? '<span class="tag tag-ok">Entrada</span>'
        : '<span class="tag tag-bad">Salida</span>';
    return conUsuario
        ? `<tr>
         <td class="mono">${fechaFmt(m.fecha)}</td><td>${esc(m.producto)}</td><td>${tag}</td>
         <td class="num">${fmt(m.cantidad)}</td><td>${esc(m.usuario)}</td><td>${esc(m.observacion)}</td>
       </tr>`
        : `<tr>
         <td class="mono">${fechaFmt(m.fecha)}</td><td>${esc(m.producto)}</td><td>${tag}</td>
         <td class="num">${fmt(m.cantidad)}</td>
       </tr>`;
}

function renderKpis() {
    const hoy = new Date().toDateString();
    $('kProd').textContent = fmt(state.inv.length);
    $('kUni').textContent = fmt(state.inv.reduce((a, i) => a + Number(i.stockActual), 0));
    $('kBajo').textContent = fmt(state.inv.filter(i => i.bajoStock).length);
    $('kHoy').textContent = fmt(state.hist.filter(m => new Date(m.fecha).toDateString() === hoy).length);
}

function renderAlertas() {
    const bajos = state.inv.filter(i => i.bajoStock);
    $('tbAlertas').innerHTML = bajos.length
        ? bajos.map(i => `
        <tr>
          <td class="mono">${esc(i.codigo)}</td><td>${esc(i.nombre)}</td>
          <td class="num strong" style="color:var(--bad)">${fmt(i.stockActual)}</td>
          <td class="num">${fmt(i.stockMinimo)}</td>
        </tr>`).join('')
        : '<tr><td colspan="4" class="empty">Sin alertas. Todos los productos están sobre el mínimo.</td></tr>';
}

function renderUltimos() {
    const u = state.hist.slice(0, 6);
    $('tbUltimos').innerHTML = u.length
        ? u.map(m => filaMov(m, false)).join('')
        : '<tr><td colspan="4" class="empty">Sin movimientos registrados.</td></tr>';
}

function inventarioFiltrado() {
    const q = $('buscar').value.trim().toLowerCase();
    const soloBajo = $('soloBajo').checked;
    return state.inv.filter(i =>
        (!q || (i.codigo + ' ' + i.nombre).toLowerCase().includes(q)) &&
        (!soloBajo || i.bajoStock));
}

function renderInv() {
    const filas = inventarioFiltrado();
    $('cntInv').textContent = `${filas.length} de ${state.inv.length} productos`;
    $('tbInv').innerHTML = filas.length
        ? filas.map(i => {
            const ref = Math.max(i.stockMinimo * 3, 1);
            const pct = Math.max(0, Math.min(100, Math.round(i.stockActual / ref * 100)));
            const nivel = i.bajoStock ? 'bad' : pct < 50 ? 'warn' : 'ok';
            return `
        <tr>
          <td class="mono">${esc(i.codigo)}</td>
          <td>${esc(i.nombre)}</td>
          <td class="num">${fmt(i.entradas)}</td>
          <td class="num">${fmt(i.salidas)}</td>
          <td class="num strong">${fmt(i.stockActual)}</td>
          <td class="num">${fmt(i.stockMinimo)}</td>
          <td><div class="bar ${nivel}"><i style="width:${pct}%"></i></div></td>
          <td>${i.bajoStock
                    ? '<span class="tag tag-bad">Bajo mínimo</span>'
                    : '<span class="tag tag-ok">Normal</span>'}</td>
          <td class="acc">
            <button class="btn btn-sm btn-in"  data-act="E" data-id="${i.productoId}">Entrada</button>
            <button class="btn btn-sm btn-out" data-act="S" data-id="${i.productoId}">Salida</button>
          </td>
        </tr>`;
        }).join('')
        : '<tr><td colspan="9" class="empty">Sin resultados.</td></tr>';
}

function renderHist() {
    const tipo = $('fTipo').value;
    const q = $('fHist').value.trim().toLowerCase();
    const filas = state.hist.filter(m =>
        (!tipo || m.tipo === tipo) &&
        (!q || `${m.producto} ${m.usuario ?? ''} ${m.observacion ?? ''}`.toLowerCase().includes(q)));
    $('tbHist').innerHTML = filas.length
        ? filas.map(m => filaMov(m, true)).join('')
        : '<tr><td colspan="6" class="empty">Sin movimientos.</td></tr>';
}

function renderProds() {
    const verInactivos = esAdmin() && $('verInact').checked;
    const lista = state.prods.filter(p => p.activo || verInactivos);
    const activos = state.prods.filter(p => p.activo).length;
    const inactivos = state.prods.length - activos;
    $('cntProd').textContent = `${activos} activos` + (esAdmin() && inactivos ? ` · ${inactivos} inactivos` : '');

    $('tbProd').innerHTML = lista.length
        ? lista.map(p => `
        <tr class="${p.activo ? '' : 'inactiva'}">
          <td class="mono">${esc(p.codigo)}</td>
          <td>${esc(p.nombre)}</td>
          <td>${esc(p.descripcion)}</td>
          <td class="num">${fmt(p.stockMinimo)}</td>
          <td>${p.activo
                ? '<span class="tag tag-ok">Activo</span>'
                : '<span class="tag tag-gray">Inactivo</span>'}</td>
          ${esAdmin() ? `<td class="acc">
            <button class="btn btn-sm" data-pact="edit" data-id="${p.id}">Editar</button>
            ${p.activo
                    ? `<button class="btn btn-sm btn-out" data-pact="off" data-id="${p.id}">Desactivar</button>`
                    : `<button class="btn btn-sm btn-in" data-pact="on" data-id="${p.id}">Reactivar</button>`}
          </td>` : ''}
        </tr>`).join('')
        : '<tr><td colspan="6" class="empty">No hay productos.</td></tr>';
}

function renderUsuarios() {
    if (!esAdmin()) return;
    $('cntUsr').textContent = `${state.usuarios.length} usuarios`;
    $('tbUsr').innerHTML = state.usuarios.length
        ? state.usuarios.map(u => {
            const yo = u.username === state.user;
            return `
        <tr class="${u.activo ? '' : 'inactiva'}">
          <td class="mono">${esc(u.username)}</td>
          <td>${u.rol === 'admin'
                    ? '<span class="tag tag-info">Administrador</span>'
                    : '<span class="tag tag-gray">Operador</span>'}</td>
          <td>${u.activo
                    ? '<span class="tag tag-ok">Activo</span>'
                    : '<span class="tag tag-bad">Inactivo</span>'}</td>
          <td class="mono">${fechaFmt(u.createdAt)}</td>
          <td class="acc">${yo ? '<span class="muted">(usted)</span>' : `
            <button class="btn btn-sm" data-uact="rol" data-id="${u.id}" data-rol="${u.rol}">
              ${u.rol === 'admin' ? 'Pasar a operador' : 'Pasar a admin'}</button>
            <button class="btn btn-sm ${u.activo ? 'btn-out' : 'btn-in'}"
              data-uact="${u.activo ? 'off' : 'on'}" data-id="${u.id}">
              ${u.activo ? 'Desactivar' : 'Activar'}</button>`}
          </td>
        </tr>`;
        }).join('')
        : '<tr><td colspan="5" class="empty">Sin usuarios.</td></tr>';
}

function llenarSelect() {
    const sel = $('movProducto');
    const actual = sel.value;
    sel.innerHTML = '<option value="">Seleccione…</option>' +
        state.prods.filter(p => p.activo)
            .map(p => `<option value="${p.id}">${esc(p.codigo)}  |  ${esc(p.nombre)}</option>`).join('');
    sel.value = actual;
}

function limpiarFormProd() {
    $('formProd').reset();
    $('prodId').value = '';
    $('prodTitulo').textContent = 'Alta de producto';
    $('btnCancelProd').classList.add('hidden');
}

function editarProd(p) {
    $('prodId').value = p.id;
    $('prodCodigo').value = p.codigo;
    $('prodNombre').value = p.nombre;
    $('prodDesc').value = p.descripcion ?? '';
    $('prodMin').value = p.stockMinimo;
    $('prodTitulo').textContent = `Editando producto: ${p.codigo}`;
    $('btnCancelProd').classList.remove('hidden');
    $('prodCodigo').scrollIntoView({ block: 'center' });
    $('prodCodigo').focus();
}

function mostrarStockSel() {
    const it = state.inv.find(i => String(i.productoId) === $('movProducto').value);
    $('movStock').textContent = it
        ? `Stock actual: ${fmt(it.stockActual)}  ·  Mínimo: ${fmt(it.stockMinimo)}`
        : '';
}

function abrirMov(tipo = 'E', productoId = '') {
    $('movProducto').value = String(productoId);
    $('tipo' + tipo).checked = true;
    $('movCantidad').value = '';
    $('movObs').value = '';
    $('movErr').textContent = '';
    mostrarStockSel();
    $('dlgMov').showModal();
    $('movCantidad').focus();
}

function exportarCsv() {
    const filas = inventarioFiltrado();
    if (!filas.length) return toast('No hay datos para exportar', true);
    const datos = [['Codigo', 'Producto', 'Entradas', 'Salidas', 'Stock', 'Minimo', 'Estado']]
        .concat(filas.map(i => [i.codigo, i.nombre, i.entradas, i.salidas, i.stockActual, i.stockMinimo,
        i.bajoStock ? 'Bajo minimo' : 'Normal']));
    const csv = datos.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    const d = new Date();
    a.href = URL.createObjectURL(blob);
    a.download = `inventario_${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
}

$('formLogin').addEventListener('submit', async e => {
    e.preventDefault();
    $('loginErr').textContent = '';
    try {
        const r = await api('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username: $('loginUser').value.trim(), password: $('loginPass').value })
        });
        state.token = r.token;
        state.user = r.username;
        state.rol = r.rol;
        localStorage.setItem('token', r.token);
        localStorage.setItem('user', r.username);
        localStorage.setItem('rol', r.rol);
        e.target.reset();
        await iniciarApp();
    } catch (err) {
        $('loginErr').textContent = err.message;
    }
});

$('btnSalir').addEventListener('click', salir);
document.querySelectorAll('.side button').forEach(b => b.addEventListener('click', () => ir(b.dataset.view)));

$('buscar').addEventListener('input', renderInv);
$('soloBajo').addEventListener('change', renderInv);
$('btnCsv').addEventListener('click', exportarCsv);
$('btnRefrescar').addEventListener('click', async () => { await refrescar(); toast('Datos actualizados'); });
$('fTipo').addEventListener('change', renderHist);
$('fHist').addEventListener('input', renderHist);
$('verInact').addEventListener('change', renderProds);

$('btnNuevoMov').addEventListener('click', () => abrirMov('E'));
$('btnCancelMov').addEventListener('click', () => $('dlgMov').close());
$('movProducto').addEventListener('change', mostrarStockSel);

$('tbInv').addEventListener('click', e => {
    const b = e.target.closest('button[data-act]');
    if (b) abrirMov(b.dataset.act, b.dataset.id);
});

$('formMov').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.submitter;
    btn.disabled = true;
    $('movErr').textContent = '';
    try {
        const tipo = document.querySelector('input[name="tipo"]:checked').value;
        const r = await api(`/movimientos/${tipo}`, {
            method: 'POST',
            body: JSON.stringify({
                productoId: Number($('movProducto').value),
                cantidad: Number($('movCantidad').value),
                observacion: $('movObs').value.trim() || null
            })
        });
        $('dlgMov').close();
        toast(r.mensaje);
        await refrescar(true);
    } catch (err) {
        $('movErr').textContent = err.message;
    } finally {
        btn.disabled = false;
    }
});

// ---- Productos: guardar (crear o editar) ----
$('formProd').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.submitter;
    btn.disabled = true;
    try {
        const id = $('prodId').value;
        const body = JSON.stringify({
            codigo: $('prodCodigo').value,
            nombre: $('prodNombre').value,
            descripcion: $('prodDesc').value || null,
            stockMinimo: Number($('prodMin').value)
        });
        if (id) {
            await api(`/productos/${id}`, { method: 'PUT', body });
            toast('Producto actualizado');
        } else {
            await api('/productos', { method: 'POST', body });
            toast('Producto creado');
        }
        limpiarFormProd();
        await refrescar(true);
    } catch (err) {
        toast(err.message, true);
    } finally {
        btn.disabled = false;
    }
});
$('btnCancelProd').addEventListener('click', limpiarFormProd);

// ---- Productos: editar / desactivar / reactivar ----
$('tbProd').addEventListener('click', async e => {
    const b = e.target.closest('button[data-pact]');
    if (!b) return;
    const id = Number(b.dataset.id);
    const p = state.prods.find(x => x.id === id);
    if (!p) return;
    try {
        if (b.dataset.pact === 'edit') { editarProd(p); return; }

        if (b.dataset.pact === 'off') {
            if (!confirm(`¿Desactivar "${p.nombre}"?\nDejará de aparecer en el inventario y en los movimientos.`)) return;
            await api(`/productos/${id}/desactivar`, { method: 'POST' });
            toast('Producto desactivado');
        } else {
            await api(`/productos/${id}/reactivar`, { method: 'POST' });
            toast('Producto reactivado');
        }
        await refrescar(true);
    } catch (err) {
        toast(err.message, true);
    }
});

// ---- Usuarios ----
$('formUsr').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.submitter;
    btn.disabled = true;
    try {
        await api('/usuarios', {
            method: 'POST',
            body: JSON.stringify({
                username: $('usrNombre').value.trim(),
                password: $('usrPass').value,
                rol: $('usrRol').value
            })
        });
        toast('Usuario creado');
        e.target.reset();
        await refrescar(true);
    } catch (err) {
        toast(err.message, true);
    } finally {
        btn.disabled = false;
    }
});

$('tbUsr').addEventListener('click', async e => {
    const b = e.target.closest('button[data-uact]');
    if (!b) return;
    const id = b.dataset.id;
    try {
        let r;
        if (b.dataset.uact === 'rol') {
            const nuevo = b.dataset.rol === 'admin' ? 'operador' : 'admin';
            r = await api(`/usuarios/${id}/rol`, { method: 'PUT', body: JSON.stringify({ rol: nuevo }) });
        } else {
            r = await api(`/usuarios/${id}/estado`, {
                method: 'PUT', body: JSON.stringify({ activo: b.dataset.uact === 'on' })
            });
        }
        toast(r.mensaje);
        await refrescar(true);
    } catch (err) {
        toast(err.message, true);
    }
});

function tick() {
    $('reloj').textContent = new Date().toLocaleString('es-CO', {
        weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
}
setInterval(tick, 1000);
tick();
setInterval(() => { if (state.token && !$('dlgMov').open) refrescar(true); }, 30000);

if (state.token && state.rol) iniciarApp(); else salir();