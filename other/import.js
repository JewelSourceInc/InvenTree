
let rows = []; // parsed file rows as objects
let categoryParams = {}; // {categoryId: [{id: pk, name: 'Stone Type'}, ...]}

const fileInput    = document.getElementById('file-input');
const loadBtn      = document.getElementById('load-btn');
const previewTable = document.getElementById('preview-table');
const buildJsonBtn = document.getElementById('build-json-btn');
const sendBtn      = document.getElementById('send-btn');
const logArea      = document.getElementById('log');
const baseUrlInput = document.getElementById('base-url');
const checkApiBtn  = document.getElementById('check-api-btn');
const apiStatus    = document.getElementById('api-status');

// Category mapping: 3rd character of Style → Category ID
const categoryMap = {
  'R': 6,  // Ring
  'N': 7,  // Necklace  
  'E': 4,  // Earring
  'P': 5,  // Pendant
  'B': 8,  // Bangle or Bracelet
  'S': 9   // Set
};

function log(msg, type = 'info') {
  const div = document.createElement('div');
  div.className = `status ${type}`;
  div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logArea.appendChild(div);
  logArea.scrollTop = logArea.scrollHeight;
  console.log(msg);
}

logArea.style.height = '200px';
logArea.style.fontFamily = 'monospace';
logArea.style.fontSize = '11px';

// File loading
loadBtn.addEventListener('click', () => {
  const file = fileInput.files[0];
  if (!file) {
    alert('Please select a file first.');
    return;
  }

  const name = file.name.toLowerCase();
  if (name.endsWith('.csv')) {
    parseCsv(file);
  } else if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    parseXlsx(file);
  } else {
    alert('Unsupported file type: use CSV or Excel (.xlsx).');
  }
});

function parseCsv(file) {
  Papa.parse(file, {
    header: true,
    skipEmptyLines: true,
    complete: (results) => {
      rows = results.data;
      log(`Parsed CSV rows: ${rows.length}`, 'success');
      renderPreview();
    },
    error: (err) => {
      console.error(err);
      alert('Error parsing CSV: ' + err.message);
    }
  });
}

function parseXlsx(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, {type: 'array'});
    const firstSheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[firstSheetName];
    rows = XLSX.utils.sheet_to_json(sheet, {defval: ''});
    log(`Parsed Excel rows: ${rows.length}`, 'success');
    renderPreview();
  };
  reader.onerror = (err) => {
    console.error(err);
    alert('Error reading Excel: ' + err.message);
  };
  reader.readAsArrayBuffer(file);
}

// CRITICAL: Check API and fetch real parameter template IDs
async function checkApiAndFetchParams() {
  const baseUrl = baseUrlInput.value.trim();
  if (!baseUrl) {
    alert('Enter base URL first');
    return;
  }

  const username = prompt('InvenTree username:');
  const password = prompt('InvenTree password:');
  if (!username || !password) return;

  const auth = btoa(username + ':' + password);
  apiStatus.innerHTML = 'Checking API...';
  
  try {
    const categoriesUrl = baseUrl.replace(/\/+$/, '') + '/api/part/category/';
    const catRes = await fetch(categoriesUrl, {
      headers: { 'Authorization': 'Basic ' + auth }
    });

    if (!catRes.ok) throw new Error(`Categories API failed: ${catRes.status}`);

    const categories = await catRes.json();
    const validCategories = {};
    categories.forEach(cat => validCategories[cat.pk] = cat.name);

    // Fetch parameters for each of our categories
    categoryParams = {};
    const ourCategories = Object.values(categoryMap);
    
    for (const catId of ourCategories) {
      if (!validCategories[catId]) {
        log(`⚠️ Category ${catId} (${categoryMap[Object.keys(categoryMap).find(k => categoryMap[k] === catId)] || 'Unknown'}) not found`, 'warn');
        continue;
      }

      const paramsUrl = `${baseUrl.replace(/\/+$/, '')}/api/part/category/${catId}/parameters/`;
      const paramRes = await fetch(paramsUrl, {
        headers: { 'Authorization': 'Basic ' + auth }
      });

      if (paramRes.ok) {
        const params = await paramRes.json();
        categoryParams[catId] = params;
        log(`✅ Category ${catId}: ${params.length} parameter templates found`, 'success');
      } else {
        log(`❌ Failed to fetch parameters for category ${catId}: ${paramRes.status}`, 'error');
      }
    }

    apiStatus.innerHTML = `<span style="color:green">✅ API OK - Parameters loaded for ${Object.keys(categoryParams).length}/${ourCategories.length} categories</span>`;
    
  } catch (err) {
    log(`❌ API Error: ${err.message}`, 'error');
    apiStatus.innerHTML = `<span style="color:red">❌ API Error: ${err.message}</span>`;
  }
}

checkApiBtn.addEventListener('click', checkApiAndFetchParams);

// Preview table showing parameter mappings
function renderPreview() {
  previewTable.innerHTML = '';
  if (!rows.length) return;

  const headers = [
    'IPN (Style)', 'Name (Desc)', 'Category', 'Cat Params', 
    'Diam', 'Metal', 'Gms', 'CTW'
  ];

  const theadTr = document.createElement('tr');
  headers.forEach(h => {
    const th = document.createElement('th');
    th.textContent = h;
    theadTr.appendChild(th);
  });
  previewTable.appendChild(theadTr);

  rows.slice(0, 10).forEach(r => {
    const tr = document.createElement('tr');

    const style = (r['Style'] || '').toString();
    const thirdChar = style.length >= 3 ? style[2].toUpperCase() : '';
    const categoryId = categoryMap[thirdChar] || 0;
    const catParamsCount = categoryParams[categoryId]?.length || 0;

    const cells = [
      style || '',
      r['Desc'] || '',
      categoryId || 'NO MATCH',
      catParamsCount ? `${catParamsCount} params` : 'NO PARAMS',
      r['Diam'] || '',
      r['Metal'] || '',
      r['Gms'] || '',
      r['CTW'] || ''
    ];

    cells.forEach(text => {
      const td = document.createElement('td');
      td.textContent = text;
      tr.appendChild(td);
    });

    previewTable.appendChild(tr);
  });
}

// Build parts WITH REAL parameter template IDs from API
function buildParts() {
  const parts = [];

  rows.forEach(r => {
    const style = (r['Style'] || '').toString();
    if (!style) return;

    const thirdChar = style.length >= 3 ? style[2].toUpperCase() : '';
    const categoryId = categoryMap[thirdChar] || 0;
    const metalValueRaw = (r['Metal'] || '').toString();
    const metalValue = metalValueRaw.toUpperCase();
    const hasDiam = !!r['Diam'];

    // Skip if no category or no parameters loaded
    if (!categoryId || !categoryParams[categoryId]) {
      log(`⚠️ Skipping ${style}: No parameters for category ${categoryId}`, 'warn');
      return;
    }

    const parameters = [];

    // Map our data to ACTUAL parameter template IDs
    categoryParams[categoryId].forEach(paramTemplate => {
      const paramId = paramTemplate.pk;
      let value = '';

      // Match parameter name to our logic
      const paramName = paramTemplate.name.toLowerCase();
      
      if (paramName.includes('stone') || paramName.includes('gem')) {
        value = 'Diamond';
      } else if (paramName.includes('natural')) {
        value = hasDiam;
      } else if (paramName.includes('metal base') || paramName.includes('material')) {
        value = metalValueRaw || '';
      } else if (paramName.includes('purity')) {
        if (metalValue.includes('SILVER')) value = '925';
        else if (metalValue.includes('PLATINUM')) value = '950';
      } else if (paramName.includes('color')) {
        if (metalValue.endsWith('YP')) value = 'Yellow';
        else if (metalValue.endsWith('RP')) value = 'Rose';
      } else if (paramName.includes('finish')) {
        value = (metalValue.endsWith('YP') || metalValue.endsWith('RP')) ? 'Plated' : 'Solid';
      } else if (paramName.includes('weight') || paramName.includes('gms')) {
        value = r['Gms'] ? parseFloat(r['Gms']) : '';
      } else if (paramName.includes('carat') || paramName.includes('ctw')) {
        value = r['CTW'] ? parseFloat(r['CTW']) : '';
      }

      if (value !== '' && value !== null && value !== undefined) {
        parameters.push({ parameter: paramId, data: value });
      }
    });

    const part = {
      name: r['Desc'] || `Part ${style}`,
      IPN: style,
      description: r['Desc'] || `Imported from ${style}`,
      category: Number(categoryId),
      parameters: parameters
    };

    parts.push(part);
  });

  return parts;
}

// Build JSON (debug)
buildJsonBtn.addEventListener('click', () => {
  if (!rows.length) {
    alert('Load a file first.');
    return;
  }
  if (Object.keys(categoryParams).length === 0) {
    alert('Run "Check API & Fetch Parameter IDs" first!');
    return;
  }
  const parts = buildParts();
  log(`Built ${parts.length} parts with real parameter IDs`);
  console.log('Full JSON:', parts);
  alert('Check browser console (F12) for JSON structure with real parameter IDs');
});

// Send to InvenTree
sendBtn.addEventListener('click', async () => {
  if (!rows.length) {
    alert('Load a file first.');
    return;
  }
  if (Object.keys(categoryParams).length === 0) {
    alert('Run "Check API & Fetch Parameter IDs" first!');
    return;
  }

  const baseUrl = baseUrlInput.value.trim();
  const username = prompt('InvenTree username:');
  const password = prompt('InvenTree password:');
  
  if (!baseUrl || !username || !password) {
    alert('All fields required.');
    return;
  }

  const parts = buildParts();
  if (parts.length === 0) {
    alert('No valid parts to import (check categories/parameters)');
    return;
  }

  const partsUrl = baseUrl.replace(/\/+$/, '') + '/api/part/';
  const auth = btoa(username + ':' + password);

  log(`🚀 Sending ${parts.length} parts with real parameters...`);

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    try {
      const res = await fetch(partsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Basic ' + auth
        },
        body: JSON.stringify(part)
      });

      if (res.ok) {
        const data = await res.json();
        log(`✅ ${i+1}/${parts.length} ${part.IPN} (ID:${data.pk}) - ${part.parameters.length} params`, 'success');
      } else {
        const text = await res.text();
        log(`❌ ${i+1}/${parts.length} ${part.IPN}: ${res.status} ${text}`, 'error');
      }
    } catch (err) {
      log(`❌ ${i+1}/${parts.length} ${part.IPN}: ${err.message}`, 'error');
    }
  }
  log('✅ Import complete! Check InvenTree Parts → Parameters tab.');
});
