/* @meta
{
  "name": "joinquant/backtest-result",
  "description": "Get COMPLETE backtest results: trades, holdings (via export), and summary stats (via API). Not truncated.",
  "domain": "www.joinquant.com",
  "args": {
    "backtestId": {"required": true, "description": "Backtest id"},
    "type": {"required": false, "description": "Data type: trades, holdings, summary, or all. Default: all"}
  },
  "capabilities": ["network"],
  "readOnly": true,
  "example": "bb-browser site joinquant/backtest-result BACKTEST_ID"
}
*/

async function(args) {
  if (!args.backtestId) return {error: 'Missing argument: backtestId'};

  async function fetchSummary() {
    var resp = await fetch('https://www.joinquant.com/algorithm/backtest/stats?backtestId=' + encodeURIComponent(args.backtestId), {
      credentials: 'include', headers: {'X-Requested-With': 'XMLHttpRequest'}
    });
    if (!resp.ok) return null;
    var data = await resp.json();
    return data.data || null;
  }

  async function addExportZip(type) {
    var url = 'https://www.joinquant.com/algorithm/backtest/addExportZip?' +
      new URLSearchParams({backtestId: args.backtestId, type: type, useCredit: '0'});
    var resp = await fetch(url, {credentials: 'include', headers: {'X-Requested-With': 'XMLHttpRequest'}});
    if (!resp.ok) throw new Error('addExportZip HTTP ' + resp.status);
    var data = await resp.json();
    if (data.code !== '00000') throw new Error('addExportZip failed: ' + (data.data || data.msg || data.code));
    return data.data;
  }

  async function poll(task) {
    var timeout = 120000;
    var start = Date.now();
    while (Date.now() - start < timeout) {
      var resp = await fetch('https://www.joinquant.com/algorithm/backtest/getExportStatus?task=' + encodeURIComponent(task), {
        credentials: 'include', headers: {'X-Requested-With': 'XMLHttpRequest'}
      });
      if (!resp.ok) throw new Error('getExportStatus HTTP ' + resp.status);
      var data = await resp.json();
      if (data.code !== '00000') throw new Error('getExportStatus failed: ' + (data.msg || data.code));
      var status = parseInt(data.data);
      if (status === 1) return true;
      if (status === 2) return false;
      await new Promise(function(r) { setTimeout(r, 2000); });
    }
    throw new Error('Export timed out after 120s');
  }

  async function download(task) {
    var resp = await fetch('https://www.joinquant.com/algorithm/backtest/getExportZip?task=' + encodeURIComponent(task), {
      credentials: 'include'
    });
    if (!resp.ok) throw new Error('getExportZip HTTP ' + resp.status);
    return await resp.arrayBuffer();
  }

  function decodeText(bytes) {
    var utf8 = new TextDecoder('utf-8').decode(bytes);
    if (utf8.indexOf('�') >= 0 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(utf8.slice(0, 200))) {
      try { return new TextDecoder('gbk').decode(bytes); } catch(e) {}
      try { return new TextDecoder('gb2312').decode(bytes); } catch(e) {}
    }
    return utf8;
  }

  async function parseZipCSV(zipBuffer) {
    var view = new DataView(zipBuffer);
    var results = {};
    var offset = 0;
    while (offset < zipBuffer.byteLength - 4) {
      var sig = view.getUint32(offset, true);
      if (sig === 0x04034b50) {
        var method = view.getUint16(offset + 8, true);
        var compSize = view.getUint32(offset + 18, true);
        var nameLen = view.getUint16(offset + 26, true);
        var extraLen = view.getUint16(offset + 28, true);
        var nameBytes = new Uint8Array(zipBuffer, offset + 30, nameLen);
        var name = new TextDecoder().decode(nameBytes);
        var dataStart = offset + 30 + nameLen + extraLen;
        var raw = new Uint8Array(zipBuffer, dataStart, compSize);

        var text = null;
        if (method === 0) {
          text = decodeText(raw);
        } else if (method === 8 && typeof DecompressionStream !== 'undefined') {
          try {
            var ds = new DecompressionStream('deflate-raw');
            var writer = ds.writable.getWriter();
            var reader = ds.readable.getReader();
            writer.write(raw);
            writer.close();
            var chunks = [];
            while (true) {
              var rd = await reader.read();
              if (rd.done) break;
              chunks.push(rd.value);
            }
            var total = chunks.reduce(function(a, c) { return a + c.length; }, 0);
            var decompressed = new Uint8Array(total);
            var pos = 0;
            chunks.forEach(function(c) { decompressed.set(c, pos); pos += c.length; });
            text = decodeText(decompressed);
          } catch (e) { text = null; }
        }

        if (text) {
          var lines = text.split(/\r?\n/).filter(function(l) { return l.trim(); });
          if (lines.length > 0) {
            var headers = lines[0].split(',').map(function(h) { return h.trim(); });
            results[name] = lines.slice(1).map(function(line) {
              var row = {};
              var cols = line.split(',');
              headers.forEach(function(h, i) { row[h] = (cols[i] || '').trim(); });
              return row;
            });
          } else {
            results[name] = [];
          }
        } else {
          results[name] = {compressed: true, method: method, size: compSize};
        }
        offset = dataStart + compSize;
      } else if (sig === 0x02014b50 || sig === 0x06054b50) {
        break;
      } else {
        offset++;
      }
    }
    return results;
  }

  var reqType = args.type || 'all';
  var result = {backtest_id: args.backtestId};

  // Summary stats (always fast, from API)
  if (reqType === 'all' || reqType === 'summary') {
    result.summary = await fetchSummary();
  }

  // Trades via export
  if (reqType === 'all' || reqType === 'trades') {
    try {
      var task = await addExportZip('transaction');
      var hasData = await poll(task);
      if (hasData) {
        var zipBuffer = await download(task);
        result.trades = await parseZipCSV(zipBuffer);
        result.trades_task = task;
      } else {
        result.trades = {status: 'empty'};
      }
    } catch (e) {
      result.trades = {error: e.message || String(e)};
    }
  }

  // Holdings via export
  if (reqType === 'all' || reqType === 'holdings') {
    try {
      var task = await addExportZip('position');
      var hasData = await poll(task);
      if (hasData) {
        var zipBuffer = await download(task);
        result.holdings = await parseZipCSV(zipBuffer);
        result.holdings_task = task;
      } else {
        result.holdings = {status: 'empty'};
      }
    } catch (e) {
      result.holdings = {error: e.message || String(e)};
    }
  }

  return result;
}
