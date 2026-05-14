let currentSaleSession = null;
let currentSales = [];
let salesInterval = null;
let pendingImageData = null;
let catalogProducts = [];

async function renderSales(el) {
  App.updateTitle(I18n.t('title.sales'));
  currentSaleSession = null;
  currentSales = [];
  if (salesInterval) clearInterval(salesInterval);

  el.innerHTML = `
    <div id="sales-selector">
      <div class="section-title">Seleccionar Sesión</div>
      <div id="sales-sessions-list"></div>
      <button class="btn btn-primary" id="btn-new-session">+ Nueva Sesión de Venta</button>
    </div>
    <div id="sales-active" style="display:none;"></div>
  `;

  loadSaleSessions();

  document.getElementById('btn-new-session')?.addEventListener('click', () => {
    App.showModal(`
      <div class="modal-header">
        <h3>Nueva Sesión de Venta</h3>
        <button class="modal-close" onclick="App.hideModal()">✕</button>
      </div>
      <form id="form-new-session">
        <div class="input-group">
          <label>Empresa</label>
          <select id="session-company" required></select>
        </div>
        <div class="input-group">
          <label>Nombre de la sesión</label>
          <input type="text" id="session-name" placeholder="Ej: Ventas Cigüela 2026" required>
        </div>
        <div class="input-group">
          <label>Fecha</label>
          <input type="date" id="session-date" required>
        </div>
        <div class="input-group">
          <label>Notas (opcional)</label>
          <textarea id="session-notes" placeholder="Notas del día..."></textarea>
        </div>
        <button type="submit" class="btn btn-primary btn-block">Crear Sesión</button>
      </form>
    `);

    document.getElementById('session-date').valueAsDate = new Date();

    API.getCompanies().then(companies => {
      const select = document.getElementById('session-company');
      companies.forEach(c => {
        select.innerHTML += `<option value="${c.id}">${c.name}</option>`;
      });
    });

    document.getElementById('form-new-session').addEventListener('submit', async (e) => {
      e.preventDefault();
      const company_id = document.getElementById('session-company').value;
      const name = document.getElementById('session-name').value;
      const session_date = document.getElementById('session-date').value;
      const notes = document.getElementById('session-notes').value;

      try {
        const session = await API.createSession(company_id, name, session_date, notes);
        App.hideModal();
        App.showToast('Sesión creada correctamente', 'success');
        enterSaleSession(session);
      } catch (err) {
        App.showToast(err.message, 'error');
      }
    });
  });
}

async function loadSaleSessions() {
  const list = document.getElementById('sales-sessions-list');
  try {
    const sessions = await API.getSessions();
    if (sessions.length === 0) {
      list.innerHTML = '<div class="list-empty"><div class="empty-icon">📋</div><p>No hay sesiones aún. Crea una nueva.</p></div>';
      return;
    }

    const open = sessions.filter(s => !s.is_closed);
    const closed = sessions.filter(s => s.is_closed);

    let html = '';
    if (open.length) {
      html += '<div class="section-title">Sesiones activas</div>';
      open.slice(0, 5).forEach(s => {
        const date = new Date(s.session_date).toLocaleDateString('es');
        html += `
          <div class="list-item" data-session-id="${s.id}">
            <div class="item-icon">📋</div>
            <div class="item-content">
              <div class="item-title">${s.name}</div>
              <div class="item-subtitle">${date} · ${s.company_name} · ${s.item_count} productos</div>
            </div>
            <div class="item-right">
              <div class="item-amount">${s.total_amount.toFixed(2)}€</div>
            </div>
          </div>
        `;
      });
    }
    if (closed.length) {
      html += '<div class="section-title" style="margin-top:12px;">Cerradas</div>';
      closed.slice(0, 3).forEach(s => {
        const date = new Date(s.session_date).toLocaleDateString('es');
        html += `
          <div class="list-item" data-session-id="${s.id}">
            <div class="item-icon">✅</div>
            <div class="item-content">
              <div class="item-title">${s.name}</div>
              <div class="item-subtitle">${date} · ${s.company_name}</div>
            </div>
            <div class="item-right">
              <div class="item-amount">${s.total_amount.toFixed(2)}€</div>
            </div>
          </div>
        `;
      });
    }

    list.innerHTML = html;
    list.querySelectorAll('.list-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.sessionId;
        loadSessionDetails(id);
      });
    });
  } catch (err) {
    list.innerHTML = `<div class="list-empty"><div class="empty-icon">⚠️</div><p>Error: ${err.message}</p></div>`;
  }
}

async function loadSessionDetails(sessionId) {
  try {
    const data = await API.getSession(sessionId);
    enterSaleSession(data.session, data.sales, data.summary);
  } catch (err) {
    App.showToast(err.message, 'error');
  }
}

function enterSaleSession(session, sales = [], summary = null) {
  currentSaleSession = session;
  currentSales = sales;

  document.getElementById('sales-selector').style.display = 'none';
  const active = document.getElementById('sales-active');
  active.style.display = 'block';

  const date = new Date(session.session_date).toLocaleDateString('es', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  active.innerHTML = `
    <div class="session-header">
      <h3>${session.name}</h3>
      <div class="session-meta">${date} · ${session.company_name || ''}</div>
      ${session.notes ? `<div class="session-notes" style="margin-top:4px;font-size:12px;color:var(--text-secondary);background:var(--surface-2);padding:6px 10px;border-radius:var(--radius-sm);">📝 ${session.notes}</div>` : ''}
    </div>

    <div class="session-total" id="sale-grand-total">
      <div class="total-label">Total Ventas</div>
      <div class="total-value" id="sale-total-display">0.00€</div>
    </div>

    <div class="section-title">Añadir producto</div>
    <div class="sell-entry">
      <input type="text" id="sale-product" placeholder="Producto" autocomplete="off" list="product-suggestions">
      <datalist id="product-suggestions"></datalist>
      <button type="button" id="btn-scan-barcode" style="background:none;border:none;font-size:20px;cursor:pointer;padding:8px;border-radius:var(--radius-full);" title="Escanear código de barras">📸</button>
      <input type="number" id="sale-qty" placeholder="Cant" value="1" min="1" step="1" style="max-width:70px;">
      <input type="number" id="sale-price" placeholder="Precio" step="0.01" min="0" style="max-width:100px;">
      <button type="button" id="btn-sale-image" style="background:none;border:none;font-size:20px;cursor:pointer;padding:4px;" title="Añadir foto">📷</button>
      <button id="btn-add-sale">➕</button>
    </div>
    <div id="price-tiers-selector" style="display:none;margin-bottom:8px;">
      <div style="font-size:12px;color:var(--text-secondary);margin-bottom:4px;">Variantes de precio:</div>
      <div id="price-tiers-chips" style="display:flex;flex-wrap:wrap;gap:4px;"></div>
    </div>
    <video id="barcode-scanner" style="display:none;width:100%;max-height:200px;border-radius:var(--radius-md);margin-bottom:8px;background:#000;" autoplay playsinline></video>
    <input type="file" id="sale-image-input" class="file-input-hidden" accept="image/*">
    <div id="sale-image-preview" style="display:none;margin-bottom:8px;position:relative;width:80px;">
      <img id="sale-image-preview-img" style="width:80px;height:80px;object-fit:cover;border-radius:var(--radius-md);border:2px solid var(--primary);">
      <button id="btn-remove-sale-image" style="position:absolute;top:-6px;right:-6px;background:var(--danger);color:white;border:none;border-radius:50%;width:20px;height:20px;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;">✕</button>
    </div>

    <div class="section-title">Productos vendidos</div>
    <div id="sales-list"></div>

    <div class="pdf-actions">
      <button class="btn btn-success" id="btn-pdf">📄 PDF</button>
      <button class="btn btn-outline" id="btn-csv">📊 CSV</button>
      <button class="btn btn-outline" id="btn-xlsx">📗 Excel</button>
      <button class="btn btn-outline" id="btn-close-session">🔒 Cerrar</button>
    </div>
    <button class="btn btn-ghost" id="btn-back-sessions" style="margin-top:4px;">← Volver a sesiones</button>
  `;

  renderSalesList();
  updateTotal();

  // Load catalog products for autocomplete
  loadCatalogProducts(session.company_id);

  document.getElementById('btn-add-sale').addEventListener('click', addSaleItem);
  document.getElementById('sale-qty').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('sale-price').focus();
  });
  document.getElementById('sale-price').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addSaleItem();
  });
  document.getElementById('sale-product').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('sale-qty').focus();
  });

  // Image handling
  document.getElementById('btn-sale-image')?.addEventListener('click', () => {
    document.getElementById('sale-image-input').click();
  });
  document.getElementById('sale-image-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      pendingImageData = ev.target.result;
      const preview = document.getElementById('sale-image-preview');
      preview.style.display = 'block';
      document.getElementById('sale-image-preview-img').src = pendingImageData;
    };
    reader.readAsDataURL(file);
  });
  document.getElementById('btn-remove-sale-image')?.addEventListener('click', () => {
    pendingImageData = null;
    document.getElementById('sale-image-preview').style.display = 'none';
    document.getElementById('sale-image-input').value = '';
  });

  // Barcode scanner
  let scanStream = null;
  document.getElementById('btn-scan-barcode')?.addEventListener('click', async () => {
    const video = document.getElementById('barcode-scanner');
    if (video.style.display === 'block') {
      // Stop scanning
      if (scanStream) { scanStream.getTracks().forEach(t => t.stop()); scanStream = null; }
      video.style.display = 'none';
      return;
    }

    if (!('BarcodeDetector' in window)) {
      App.showToast('Escáner no disponible en este navegador', 'warning');
      return;
    }

    try {
      scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      video.srcObject = scanStream;
      video.style.display = 'block';
      const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'] });

      const scanLoop = async () => {
        if (!video.style.display || video.style.display === 'none') return;
        try {
          const barcodes = await detector.detect(video);
          if (barcodes.length > 0) {
            const code = barcodes[0].rawValue;
            // Stop scanner
            if (scanStream) { scanStream.getTracks().forEach(t => t.stop()); scanStream = null; }
            video.style.display = 'none';

            // Try to find product by barcode in catalog (store barcode in name temporarily)
            const match = catalogProducts.find(p => p.name.includes(code));
            document.getElementById('sale-product').value = match ? match.name : code;
            if (match) document.getElementById('sale-price').value = match.price.toFixed(2);
            document.getElementById('sale-qty').focus();
            App.showToast(`Código: ${code}`, 'success');
            return;
          }
        } catch (e) {}
        requestAnimationFrame(scanLoop);
      };
      scanLoop();
    } catch (err) {
      App.showToast('Error al acceder a la cámara: ' + err.message, 'error');
    }
  });

  document.getElementById('btn-pdf').addEventListener('click', generateSalePDF);
  document.getElementById('btn-csv').addEventListener('click', () => {
    API.downloadSessionCSV(currentSaleSession.id).catch(err => App.showToast(err.message, 'error'));
  });
  document.getElementById('btn-xlsx').addEventListener('click', () => {
    API.downloadSessionXLSX(currentSaleSession.id).catch(err => App.showToast(err.message, 'error'));
  });
  document.getElementById('btn-close-session').addEventListener('click', closeCurrentSession);
  document.getElementById('btn-back-sessions').addEventListener('click', () => {
    currentSaleSession = null;
    currentSales = [];
    document.getElementById('sales-selector').style.display = 'block';
    active.style.display = 'none';
    loadSaleSessions();
  });
}

async function addSaleItem() {
  const product = document.getElementById('sale-product').value.trim();
  const qty = parseInt(document.getElementById('sale-qty').value) || 1;
  const price = document.getElementById('sale-price').value;

  if (!product || !price) {
    App.showToast('Introduce producto y precio', 'warning');
    return;
  }

  try {
    const sale = await API.addSaleItem(currentSaleSession.id, product, parseFloat(price), qty, pendingImageData);
    currentSales.push(sale);
    renderSalesList();
    updateTotal();
    document.getElementById('sale-product').value = '';
    document.getElementById('sale-qty').value = '1';
    document.getElementById('sale-price').value = '';
    document.getElementById('sale-product').focus();
    pendingImageData = null;
    document.getElementById('sale-image-preview').style.display = 'none';
    document.getElementById('sale-image-input').value = '';
  } catch (err) {
    App.showToast(err.message, 'error');
  }
}

async function loadCatalogProducts(companyId) {
  try {
    catalogProducts = await API.getCompanyProducts(companyId);
    const datalist = document.getElementById('product-suggestions');
    if (!datalist) return;
    datalist.innerHTML = catalogProducts.map(p =>
      `<option value="${p.name}" data-price="${p.price}">${p.price.toFixed(2)}€${p.prices && p.prices.length > 0 ? ' +variantes' : ''}</option>`
    ).join('');

    // Autofill price when product is selected from datalist
    document.getElementById('sale-product').addEventListener('input', function() {
      const match = catalogProducts.find(p => p.name === this.value);
      if (match) {
        document.getElementById('sale-price').value = match.price.toFixed(2);
        document.getElementById('sale-qty').value = '1';
        showPriceTiers(match);
        document.getElementById('sale-qty').focus();
      } else {
        document.getElementById('price-tiers-selector').style.display = 'none';
      }
    });
  } catch (err) {
    // silently fail - autocomplete is optional
    catalogProducts = [];
  }
}

function showPriceTiers(product) {
  const selector = document.getElementById('price-tiers-selector');
  const chips = document.getElementById('price-tiers-chips');
  if (!selector || !chips) return;

  if (product.prices && product.prices.length > 0) {
    selector.style.display = 'block';
    chips.innerHTML = product.prices.map((t, i) =>
      `<button type="button" class="chip price-tier-chip ${i === 0 ? 'active' : ''}" data-price="${t.price}" data-qty="${t.quantity}" data-name="${t.name}" style="font-size:12px;">${t.name}: ${t.price.toFixed(2)}€ (×${t.quantity})</button>`
    ).join('');

    // Select first tier by default
    const first = product.prices[0];
    document.getElementById('sale-price').value = first.price.toFixed(2);
    document.getElementById('sale-qty').value = first.quantity;

    chips.querySelectorAll('.price-tier-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        chips.querySelectorAll('.price-tier-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        document.getElementById('sale-price').value = chip.dataset.price;
        document.getElementById('sale-qty').value = chip.dataset.qty;
      });
    });
  } else {
    selector.style.display = 'none';
  }
}

function renderSalesList() {
  const list = document.getElementById('sales-list');
  if (!list) return;

  if (currentSales.length === 0) {
    list.innerHTML = '<div class="list-empty"><div class="empty-icon">🛒</div><p>Aún no has vendido nada hoy</p></div>';
    return;
  }

  let html = '';
  currentSales.forEach((s) => {
    const canEdit = s.user_id === App.user?.id || s.sold_by_name === App.user?.name;
    const imgHtml = s.image_url ? `<img src="${s.image_url}" style="width:36px;height:36px;border-radius:var(--radius-sm);object-fit:cover;margin-right:8px;flex-shrink:0;">` : '';
    html += `
      <div class="sale-item" data-sale-id="${s.id}">
        ${imgHtml}
        <div class="sale-info">
          <div class="sale-name">
            <span class="sale-name-text">${s.product_name}</span>
            ${canEdit ? `<button class="btn-edit-sale-name" data-id="${s.id}" style="background:none;border:none;font-size:12px;cursor:pointer;padding:2px 4px;color:var(--primary);">✏️</button>` : ''}
          </div>
          <div class="sale-meta">${s.sold_by_name || 'Tú'} · 
            <span class="sale-qty-text" data-id="${s.id}">${s.quantity}</span>x
            ${canEdit ? `<button class="btn-edit-sale-qty" data-id="${s.id}" style="background:none;border:none;font-size:12px;cursor:pointer;padding:2px 4px;color:var(--primary);">✏️</button>` : ''}
          </div>
        </div>
        <div style="text-align:right;">
          <div class="sale-price">${(s.price * s.quantity).toFixed(2)}€</div>
          <div style="font-size:11px;color:var(--text-muted);">
            <span class="sale-price-text" data-id="${s.id}">${s.price.toFixed(2)}</span>€/ud
            ${canEdit ? `<button class="btn-edit-sale-price" data-id="${s.id}" style="background:none;border:none;font-size:12px;cursor:pointer;padding:2px 4px;color:var(--primary);">✏️</button>` : ''}
          </div>
        </div>
        <button class="sale-delete" data-id="${s.id}" ${!canEdit ? 'style="opacity:0.3;"' : ''}>✕</button>
      </div>
    `;
  });

  list.innerHTML = html;

  // Inline editing handlers
  list.querySelectorAll('.btn-edit-sale-name').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sale = currentSales.find(s => s.id === parseInt(btn.dataset.id));
      if (!sale) return;
      const newName = prompt('Nombre del producto:', sale.product_name);
      if (newName && newName.trim() !== sale.product_name) {
        editSaleItem(sale.id, { product_name: newName.trim() });
      }
    });
  });

  list.querySelectorAll('.btn-edit-sale-qty').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sale = currentSales.find(s => s.id === parseInt(btn.dataset.id));
      if (!sale) return;
      const newQty = prompt('Cantidad:', sale.quantity);
      if (newQty && parseInt(newQty) !== sale.quantity && parseInt(newQty) > 0) {
        editSaleItem(sale.id, { quantity: parseInt(newQty) });
      }
    });
  });

  list.querySelectorAll('.btn-edit-sale-price').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const sale = currentSales.find(s => s.id === parseInt(btn.dataset.id));
      if (!sale) return;
      const newPrice = prompt('Precio unitario (€):', sale.price);
      if (newPrice && parseFloat(newPrice) !== sale.price && parseFloat(newPrice) >= 0) {
        editSaleItem(sale.id, { price: parseFloat(newPrice) });
      }
    });
  });

  list.querySelectorAll('.sale-delete').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (btn.style.opacity === '0.3') return;
      if (!confirm('¿Eliminar esta venta?')) return;
      try {
        await API.deleteSaleItem(btn.dataset.id);
        currentSales = currentSales.filter(s => s.id !== parseInt(btn.dataset.id));
        renderSalesList();
        updateTotal();
      } catch (err) {
        App.showToast(err.message, 'error');
      }
    });
  });
}

async function editSaleItem(id, data) {
  try {
    const updated = await API.updateSaleItem(id, data);
    const idx = currentSales.findIndex(s => s.id === id);
    if (idx !== -1) currentSales[idx] = updated;
    renderSalesList();
    updateTotal();
    App.showToast('Venta actualizada', 'success');
  } catch (err) {
    App.showToast(err.message, 'error');
  }
}

function updateTotal() {
  const display = document.getElementById('sale-total-display');
  if (!display) return;
  const total = currentSales.reduce((sum, s) => sum + (s.price * s.quantity), 0);
  display.textContent = total.toFixed(2) + '€';
}

async function closeCurrentSession() {
  if (!confirm('¿Cerrar esta sesión? Ya no podrás añadir más productos.')) return;
  try {
    await API.closeSession(currentSaleSession.id);
    App.showToast('Sesión cerrada', 'success');
    currentSaleSession = null;
    currentSales = [];
    document.getElementById('sales-selector').style.display = 'block';
    document.getElementById('sales-active').style.display = 'none';
    loadSaleSessions();
  } catch (err) {
    App.showToast(err.message, 'error');
  }
}

async function generateSalePDF() {
  if (currentSales.length === 0) {
    App.showToast('No hay ventas para generar PDF', 'warning');
    return;
  }

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text(currentSaleSession.name, pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const date = new Date(currentSaleSession.session_date).toLocaleDateString('es');
    doc.text(`Fecha: ${date}`, pageWidth / 2, 28, { align: 'center' });

    if (currentSaleSession.company_name) {
      doc.text(`Empresa: ${currentSaleSession.company_name}`, pageWidth / 2, 34, { align: 'center' });
    }

    // Table
    const tableData = currentSales.map(s => [
      s.product_name,
      s.quantity + 'x',
      s.price.toFixed(2) + '€',
      (s.price * s.quantity).toFixed(2) + '€',
      s.sold_by_name || '—'
    ]);

    const total = currentSales.reduce((sum, s) => sum + (s.price * s.quantity), 0);

    doc.autoTable({
      startY: 40,
      head: [['Producto', 'Cant', 'Precio', 'Total', 'Vendedor']],
      body: tableData,
      foot: [['', '', '', `Total: ${total.toFixed(2)}€`, '']],
      theme: 'grid',
      headStyles: { fillColor: [18, 89, 243], textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 3 },
    });

    // Summary
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Resumen del Día`, pageWidth / 2, finalY, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const bySeller = {};
    currentSales.forEach(s => {
      const seller = s.sold_by_name || 'Desconocido';
      bySeller[seller] = (bySeller[seller] || 0) + (s.price * s.quantity);
    });

    let y = finalY + 8;
    doc.setFont('helvetica', 'bold');
    doc.text(`Total General: ${total.toFixed(2)}€`, 14, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.text(`Productos vendidos: ${currentSales.length}`, 14, y);
    y += 7;

    Object.entries(bySeller).forEach(([seller, amount]) => {
      doc.text(`  ${seller}: ${amount.toFixed(2)}€`, 14, y);
      y += 6;
    });

    // Footer
    const today = new Date().toLocaleString('es');
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Generado el ${today} · Notas de Venta`, pageWidth / 2, 285, { align: 'center' });

    doc.save(`${currentSaleSession.name.replace(/\s+/g, '_')}_${currentSaleSession.session_date}.pdf`);
    App.showToast('PDF generado correctamente', 'success');
  } catch (err) {
    console.error(err);
    App.showToast('Error al generar PDF: ' + err.message, 'error');
  }
}
