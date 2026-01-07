# 1
```
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>InvenTree Parts Import - Username/Password</title>
  <script src="https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
  <style>
    body { font-family: sans-serif; margin: 20px; }
    label { display: block; margin: 8px 0 4px; }
    input, button { margin-bottom: 8px; }
    table, th, td { border: 1px solid #ccc; border-collapse: collapse; padding: 3px 6px; font-size: 12px; }
    th { background: #f3f3f3; }
    .section { margin-top: 20px; }
    textarea { width: 100%; height: 80px; }
    .category-info { font-size: 11px; color: #666; margin-top: 4px; }
  </style>
</head>
```
papaparse = parser for CSV
xlsx.full = parser for excel
Style = basic styling commands
Head start and end

# 2
```
<body>
  <h1>InvenTree Parts Import (Username/Password)</h1>

  <!-- InvenTree Server -->
  <div class="section">
    <h2>InvenTree Server</h2>
    <label>InvenTree Base URL (no trailing slash)</label>
    <input id="base-url" type="text" placeholder="https://inventree.jsistock.com" size="40" value="https://inventree.jsistock.com" />
  </div>

  <!-- File upload -->
  <div class="section">
    <h2>Upload Excel / CSV</h2>
    <input id="file-input" type="file" accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" />
    <button id="load-btn">Load File</button>
  </div>

  <!-- Preview -->
  <div class="section">
    <h2>Preview (first 10 rows) - Mapped Fields</h2>
    <div class="category-info">
      Category mapping: 3rd char of Style → R=Ring(6), N=Necklace(7), E=Earring(4), P=Pendant(5), B=Bangle(8), S=Set(9)
    </div>
    <table id="preview-table"></table>
  </div>

  <!-- Actions -->
  <div class="section">
    <h2>Import Parts</h2>
    <button id="build-json-btn">Build Parts JSON</button>
    <button id="send-btn">Send Parts to InvenTree</button>
    <p>Log:</p>
    <textarea id="log" readonly></textarea>
  </div>
  ```
Input fiels are described here
Server link: connects to our server only
File upload: to upload files for future mapping
Preview: to display the final table after mapping is done
Build Json and Send parts button: two step for safety and final confirmation

#3
  ```
  <script>
    let rows = []; // parsed file rows as objects

    const fileInput    = document.getElementById('file-input');
    const loadBtn      = document.getElementById('load-btn');
    const previewTable = document.getElementById('preview-table');
    const buildJsonBtn = document.getElementById('build-json-btn');
    const sendBtn      = document.getElementById('send-btn');
    const logArea      = document.getElementById('log');
    const baseUrlInput = document.getElementById('base-url');
    ```
rows: global array that will hold the parsed data from the CSV/Excel file as an array of objects, one per row.
fileInput, loadBtn, previewTable, buildJsonBtn, sendBtn, logArea, baseUrlInput: references to specific HTML elements (inputs, buttons, table, textarea) by their id, so the script can read/write them and attach events.

#4
    '''
    // Category mapping: 3rd character of Style → Category ID
    const categoryMap = {
      'R': 6,  // Ring
      'N': 7,  // Necklace  
      'E': 4,  // Earring
      'P': 5,  // Pendant
      'B': 8,  // Bangle or Bracelet
      'S': 9   // Set
    };
    '''
Finds category by using Styles 3rd character and what their values are
Example: if Style is "AABR100...", the 3rd character is "B", so categoryMap['B'] gives 8 (Bangle category ID).

#5
    '''
    function log(msg) {
      logArea.value += msg + "\n";
      logArea.scrollTop = logArea.scrollHeight;
    }
    '''
this creates the log window at the bottom of the page. Useful to see the status, parsing results, errors etc.

#6
    '''
    // Load & parse file
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
    '''
When the user clicks “Load File”:
Gets the first selected file from the file input.
If no file is selected: shows an alert.
Checks the filename extension:
- csv → use the CSV parser.
- xlsx / .xls → use the Excel parser.
Otherwise: alert unsupported type.
Useful as it routes to the appropriate parsing function depending on the file type.

#7
    '''
    function parseCsv(file) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          rows = results.data;
          log('Parsed CSV rows: ' + rows.length);
          renderPreview();
        },
        error: (err) => {
          console.error(err);
          alert('Error parsing CSV: ' + err.message);
        }
      });
    }
    '''
Parses CSV with papaverse
header: true: treats the first row as header and returns an array of objects {ColumnName: value}.
skipEmptyLines: true: ignores blank lines.
On success (complete):
- Assigns rows = results.data (all row objects).
- Logs how many rows were parsed.
- Calls renderPreview() to show a preview table.
On error: prints error to console and shows an alert.
It converts the raw CSV file into a usable JavaScript data structure (array of row objects) and triggers preview.

#8
    '''
    function parseXlsx(file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {type: 'array'});
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[firstSheetName];
        rows = XLSX.utils.sheet_to_json(sheet, {defval: ''});
        log('Parsed Excel rows: ' + rows.length);
        renderPreview();
      };
      reader.onerror = (err) => {
        console.error(err);
        alert('Error reading Excel: ' + err.message);
      };
      reader.readAsArrayBuffer(file);
    }
    '''
Parses excel
Uses FileReader to read the Excel file as an ArrayBuffer.
Converts it to Uint8Array and feeds it into XLSX.read (from SheetJS).
Picks the first sheet (SheetNames[0]).
Converts the sheet to JSON row objects with sheet_to_json, using defval: '' to fill empty cells with empty strings.
Stores into rows, logs count, calls renderPreview().
It allows importing from Excel exports directly without manually converting to CSV.

#9
    '''
    // Preview first 10 rows with mapped columns only
    function renderPreview() {
      previewTable.innerHTML = '';
      if (!rows.length) return;

      const headers = ['IPN (Style)', 'Name/Desc (Desc)', 'Category (auto)', 'Diam', 'Gms', 'CTW'];
      const theadTr = document.createElement('tr');
      headers.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        theadTr.appendChild(th);
      });
      previewTable.appendChild(theadTr);

      rows.slice(0, 10).forEach(r => {
        const tr = document.createElement('tr');
        
        // IPN from Style column
        const ipnCell = document.createElement('td');
        ipnCell.textContent = r['Style'] || '';
        tr.appendChild(ipnCell);

        // Name/Description from Desc column  
        const nameCell = document.createElement('td');
        nameCell.textContent = r['Desc'] || '';
        tr.appendChild(nameCell);

        // Auto-calculated Category from 3rd char of Style (number only)
        const style = (r['Style'] || '').toString();
        const thirdChar = style.length >= 3 ? style[2].toUpperCase() : '';
        const categoryId = categoryMap[thirdChar] || 0;
        const catCell = document.createElement('td');
        catCell.textContent = categoryId || 'NO MATCH';
        catCell.style.color = categoryId ? 'green' : 'red';
        tr.appendChild(catCell);

        // Additional columns for reference
        ['Diam', 'Gms', 'CTW'].forEach(col => {
          const td = document.createElement('td');
          td.textContent = r[col] || '';
          tr.appendChild(td);
        });

        previewTable.appendChild(tr);
      });
    }
    '''
Clears any previous table content.
If there are no rows, stops.
Defines the preview headers – these are mapped fields, not raw CSV headers:
- IPN (Style): Style column used as IPN.
- Name/Desc (Desc): Desc column.
- Category (auto): calculated from Style.
- Diam, Gms, CTW: additional informational columns.
For each of the first 10 rows:
- Creates a row:
    - Shows Style as IPN.
    - Shows Desc as name/description.
    - Calculates category:
        - Takes 3rd character of Style (style[2]), uppercases it.
        - Looks up categoryMap[thirdChar].
        - Shows category ID or NO MATCH if mapping not found.
        - Colors category cell green if valid, red if no mapping.
    - Displays the values of Diam, Gms, CTW straight from the row.
This gives the user a quick visual sanity‑check: Are we mapping the fields correctly and is the auto category logic doing what we expect?

#10
    '''
    // Build Parts array from rows with new mapping
    function buildParts() {
      const parts = [];

      rows.forEach(r => {
        const style = (r['Style'] || '').toString();
        if (!style) return; // Skip rows without Style

        // Extract 3rd character for category
        const thirdChar = style.length >= 3 ? style[2].toUpperCase() : '';
        const categoryId = categoryMap[thirdChar];

        const part = {
          name: r['Desc'] || '',
          IPN: style,
          description: r['Desc'] || ''
        };

        // Only add category if valid mapping found
        if (categoryId) {
          part.category = Number(categoryId);
        }

        parts.push(part);
      });

      return parts;
    }
    '''
Creates an array parts that will hold InvenTree part objects.
Iterates through each row in rows:
    - Reads Style, ensures it’s a string.
    - Skips the row if Style is missing (cannot create part without IPN/identifier).
    - Computes thirdChar and categoryId using categoryMap as before.
    - Constructs a part object:
        - name: from Desc.
        - IPN: from Style.
        - description: from Desc again (so name and description match).
    - If categoryId exists, sets part.category as a number.
    - Pushes this part into parts.
Returns parts, which is now the ready‑to‑POST payload array.
It converts the CSV concept of a row into an InvenTree API part object (this is the bridge between the file schema and the server’s JSON schema).

#11
    '''
    buildJsonBtn.addEventListener('click', () => {
      if (!rows.length) {
        alert('Load a file first.');
        return;
      }
      const parts = buildParts();
      log('Built Parts JSON: ' + parts.length + ' entries');
      console.log('Parts:', parts);
      alert('Parts JSON built. Check console for details.');
    });
    '''
When the user clicks “Build Parts JSON”:
    - If no rows are loaded, shows an alert.
    - Calls buildParts() to create the part objects.
    - Logs how many parts were built.
    - Writes them to the browser console.
    - Alerts the user that JSON is ready.
A safe step to inspect data before actually sending it, useful for debugging and training others.

#12
    '''
    // Send Parts to InvenTree - USERNAME/PASSWORD AUTH
    sendBtn.addEventListener('click', async () => {
      if (!rows.length) {
        alert('Load a file first.');
        return;
      }

      const baseUrl = baseUrlInput.value.trim();
      const username = prompt('Enter your InvenTree username:');
      const password = prompt('Enter your InvenTree password:');
      
      if (!baseUrl || !username || !password) {
        alert('Fill all fields.');
        return;
      }

      const parts = buildParts();
      const partsUrl = baseUrl.replace(/\/+$/, '') + '/api/part/';

      const auth = btoa(username + ':' + password);  // Basic auth

      log('Sending ' + parts.length + ' parts...');
      
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        try {
          const res = await fetch(partsUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': 'Basic ' + auth
            },
            body: JSON.stringify(p)
          });

          if (!res.ok) {
            const text = await res.text();
            log(`Part ${i+1} ❌ ${p.IPN}: ${res.status} - ${text.slice(0,50)}`);
          } else {
            const data = await res.json();
            log(`Part ${i+1} ✅ ${p.IPN}: ID ${data.pk}`);
          }
        } catch (err) {
          log(`Part ${i+1} ❌ ${p.IPN}: ${err.message}`);
        }
      }
      log('Import complete.');
    });
    '''
Step‑by‑step:
1. Pre‑checks
Ensures you have loaded some rows.
Reads baseUrl from the input.
Prompts for username and password via prompt().

2. Validation
If any of base URL, username or password are missing, shows an alert and cancels.

3. Build part payload
Calls buildParts() again to get the latest parts array.
Constructs the API endpoint:

    '''
    const partsUrl = baseUrl.replace(/\/+$/, '') + '/api/part/';
    '''
 
    - replace(/\/+$/, '') strips any trailing slashes from the base URL to avoid double slashes when concatenating.

4. Basic Authentication string

    '''
    const auth = btoa(username + ':' + password);
    '''

btoa converts the string "username:password" into Base64.
The header Authorization: Basic <base64> is how HTTP Basic Auth works.

5. Loop over parts and POST each one

    '''
    for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const res = await fetch(partsUrl, {
        method: 'POST',
        headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + auth
        },
        body: JSON.stringify(p)
    });
    ...
    }
    '''

Uses fetch with:
    - method: 'POST'
    - Content-Type: 'application/json'
    - Authorization: 'Basic ' + auth
    - body: JSON string of the part object.
Waits for each request to complete (await) before moving to the next.

6. Handling responses

    '''
    if (!res.ok) {
    const text = await res.text();
    log(`Part ${i+1} ❌ ${p.IPN}: ${res.status} - ${text.slice(0,50)}`);
    } else {
    const data = await res.json();
    log(`Part ${i+1} ✅ ${p.IPN}: ID ${data.pk}`);
    }
    '''

If HTTP response is not OK (status not 2xx):
    - Reads response text.
    - Logs a failure message with part index, IPN, status code, and a short snippet of the error body.
If OK:
    - Parses JSON.
    - Logs success with the returned part primary key data.pk.

7. Error catching

    '''
    } catch (err) {
    log(`Part ${i+1} ❌ ${p.IPN}: ${err.message}`);
    }
    '''

Catches network or runtime errors and logs them.

8. Final log

    '''
    log('Import complete.');
    '''

It implements the actual import. It is designed to be:
    - Explicit: one log line per part so you can see which ones failed.
    - Safe: stops only at user input errors or hard JavaScript errors; keeps going part‑by‑part otherwise.
    - Simple: uses Basic Auth so you can reuse your existing web credentials.

#13
'''  
</script>
</body>
</html>
'''
The end of script, body and html page.