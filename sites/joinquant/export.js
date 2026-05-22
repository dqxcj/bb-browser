/* @meta
{
  "name": "joinquant/export",
  "description": "Export full backtest data (trades, holdings, logs) via JoinQuant's zip export. Returns complete data, not truncated to 1000 rows.",
  "domain": "www.joinquant.com",
  "args": {
    "backtestId": {"required": true, "description": "Backtest id"},
    "type": {"required": false, "description": "Export type: transaction, position, log, or all. Default: all"},
    "timeout": {"required": false, "description": "Max poll time in seconds, default 120"}
  },
  "capabilities": ["network"],
  "readOnly": true,
  "example": "bb-browser site joinquant/export BACKTEST_ID --type all"
}
*/

async function(args) {
  if (!args.backtestId) return {error: 'Missing argument: backtestId'};

  const allowed = {transaction: 1, position: 1, log: 1};
  const types = (args.type && args.type !== 'all') ? [args.type] : ['transaction', 'position', 'log'];
  const timeout = parseInt(args.timeout || '120', 10) * 1000;

  async function addExportZip(backtestId, type) {
    const url = 'https://www.joinquant.com/algorithm/backtest/addExportZip?' +
      new URLSearchParams({backtestId, type, useCredit: '0'});
    const resp = await fetch(url, {credentials: 'include', headers: {'X-Requested-With': 'XMLHttpRequest'}});
    if (!resp.ok) throw new Error('addExportZip HTTP ' + resp.status);
    const data = await resp.json();
    if (data.code !== '00000') throw new Error('addExportZip failed: ' + (data.data || data.msg || data.code));
    return data.data;
  }

  async function pollStatus(task) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const resp = await fetch('https://www.joinquant.com/algorithm/backtest/getExportStatus?task=' + encodeURIComponent(task), {
        credentials: 'include', headers: {'X-Requested-With': 'XMLHttpRequest'}
      });
      if (!resp.ok) throw new Error('getExportStatus HTTP ' + resp.status);
      const data = await resp.json();
      if (data.code !== '00000') throw new Error('getExportStatus failed: ' + (data.msg || data.code));
      const status = parseInt(data.data);
      if (status === 1) return true;
      if (status === 2) return false;
      await new Promise(r => setTimeout(r, 2000));
    }
    throw new Error('Export timed out after ' + (timeout / 1000) + 's');
  }

  async function downloadZip(task) {
    const resp = await fetch('https://www.joinquant.com/algorithm/backtest/getExportZip?task=' + encodeURIComponent(task), {
      credentials: 'include'
    });
    if (!resp.ok) throw new Error('getExportZip HTTP ' + resp.status);
    return await resp.arrayBuffer();
  }

  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(function(l) { return l.trim(); });
    if (lines.length === 0) return [];
    const headers = lines[0].split(',').map(function(h) { return h.trim(); });
    return lines.slice(1).map(function(line) {
      var row = {};
      var cols = line.split(',');
      headers.forEach(function(h, i) { row[h] = (cols[i] || '').trim(); });
      return row;
    });
  }

  function parseLog(text) {
    return text.split(/\r?\n/).filter(function(l) { return l.trim(); });
  }

  function decodeText(bytes) {
    // Try UTF-8 first, fall back to GBK for Chinese CSV content
    var utf8 = new TextDecoder('utf-8').decode(bytes);
    // Check for replacement characters indicating encoding mismatch
    if (utf8.indexOf('�') >= 0 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(utf8.slice(0, 200))) {
      try { return new TextDecoder('gbk').decode(bytes); } catch(e) {}
      try { return new TextDecoder('gb2312').decode(bytes); } catch(e) {}
    }
    return utf8;
  }

  async function parseZipContent(zipBuffer, type) {
    if (zipBuffer.byteLength === 0) return {error: 'Empty zip'};

    var view = new DataView(zipBuffer);
    var entries = {};
    var offset = 0;
    var buffer = zipBuffer;

    while (offset < buffer.byteLength - 4) {
      var sig = view.getUint32(offset, true);
      if (sig === 0x04034b50) {
        var method = view.getUint16(offset + 8, true);
        var compSize = view.getUint32(offset + 18, true);
        var uncompSize = view.getUint32(offset + 22, true);
        var nameLen = view.getUint16(offset + 26, true);
        var extraLen = view.getUint16(offset + 28, true);

        var nameBytes = new Uint8Array(buffer, offset + 30, nameLen);
        var name = new TextDecoder().decode(nameBytes);
        var dataStart = offset + 30 + nameLen + extraLen;
        var rawBytes = new Uint8Array(buffer, dataStart, compSize);

        var content;
        if (method === 0) {
          content = decodeText(rawBytes);
        } else if (method === 8 && typeof DecompressionStream !== 'undefined') {
          try {
            var ds = new DecompressionStream('deflate-raw');
            var writer = ds.writable.getWriter();
            var reader = ds.readable.getReader();
            writer.write(rawBytes);
            writer.close();
            var chunks = [];
            while (true) {
              var readResult = await reader.read();
              if (readResult.done) break;
              chunks.push(readResult.value);
            }
            var totalLen = chunks.reduce(function(a, c) { return a + c.length; }, 0);
            var decompressed = new Uint8Array(totalLen);
            var pos = 0;
            chunks.forEach(function(c) { decompressed.set(c, pos); pos += c.length; });
            content = decodeText(decompressed);
          } catch (e) {
            content = '[decompress failed: ' + e.message + ']';
          }
        } else {
          content = '[compressed method=' + method + ' size=' + compSize + ']';
        }

        var ext = name.split('.').pop().toLowerCase();
        if (ext === 'csv') {
          entries[name] = {type: 'csv', rows: parseCSV(content), rawSize: uncompSize};
        } else if (ext === 'log' || ext === 'txt') {
          entries[name] = {type: 'log', lines: parseLog(content), lineCount: parseLog(content).length};
        } else {
          entries[name] = {type: ext, text: content.slice(0, 5000), rawSize: uncompSize};
        }
        offset = dataStart + compSize;
      } else if (sig === 0x02014b50 || sig === 0x06054b50) {
        break;
      } else {
        offset++;
      }
    }
    return entries;
  }

  var results = {};
  for (var i = 0; i < types.length; i++) {
    var type = types[i];
    if (!allowed[type]) {
      results[type] = {status: 'invalid_type', error: 'Unknown type: ' + type};
      continue;
    }
    try {
      var task = await addExportZip(args.backtestId, type);
      var hasData = await pollStatus(task);
      if (!hasData) {
        results[type] = {status: 'empty', message: 'No data for ' + type};
        continue;
      }
      var zipBuffer = await downloadZip(task);
      var files = await parseZipContent(zipBuffer, type);
      results[type] = {status: 'ok', task: task, files: files};
    } catch (e) {
      results[type] = {status: 'error', error: e.message || String(e)};
    }
  }

  return {
    backtest_id: args.backtestId,
    export_types: types,
    results: results
  };
}
