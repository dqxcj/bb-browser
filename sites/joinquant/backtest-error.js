/* @meta
{
  "name": "joinquant/backtest-error",
  "description": "Get COMPLETE backtest error/warning logs via export. Extracts ERROR/WARN lines from full log export.",
  "domain": "www.joinquant.com",
  "args": {
    "backtestId": {"required": true, "description": "Backtest id"},
    "quick": {"required": false, "description": "Use fast API for quick preview (may be truncated)"},
    "offset": {"required": false, "description": "Quick mode: error log offset, default 0"}
  },
  "capabilities": ["network"],
  "readOnly": true,
  "example": "bb-browser site joinquant/backtest-error BACKTEST_ID"
}
*/

async function(args) {
  if (!args.backtestId) return {error: 'Missing argument: backtestId'};

  // Quick mode: old paginated error API
  if (args.quick) {
    var offset = parseInt(args.offset || '0', 10) || 0;
    var resp = await fetch('https://www.joinquant.com/algorithm/backtest/error?backtestId=' + encodeURIComponent(args.backtestId) + '&offset=' + offset, {
      credentials: 'include', headers: {'X-Requested-With': 'XMLHttpRequest'}
    });
    if (!resp.ok) return {error: 'HTTP ' + resp.status};
    var data = await resp.json();
    return {
      backtest_id: args.backtestId, mode: 'quick', offset: offset,
      state: data.data?.state,
      logs: data.data?.logArr || [],
      hint: 'Quick mode shows partial errors. Remove --quick for full export.'
    };
  }

  // Full export: use log export, filter for errors
  async function addExportZip() {
    var url = 'https://www.joinquant.com/algorithm/backtest/addExportZip?' +
      new URLSearchParams({backtestId: args.backtestId, type: 'log', useCredit: '0'});
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

  async function extractErrors(zipBuffer) {
    var view = new DataView(zipBuffer);
    var errors = [];
    var offset = 0;
    var errorPattern = /ERROR|Error|error|WARN|Warn|warn|异常|错误|失败|Exception|Traceback|CRITICAL|FATAL/;

    while (offset < zipBuffer.byteLength - 4) {
      var sig = view.getUint32(offset, true);
      if (sig === 0x04034b50) {
        var method = view.getUint16(offset + 8, true);
        var compSize = view.getUint32(offset + 18, true);
        var nameLen = view.getUint16(offset + 26, true);
        var extraLen = view.getUint16(offset + 28, true);
        var dataStart = offset + 30 + nameLen + extraLen;
        var raw = new Uint8Array(zipBuffer, dataStart, compSize);

        var text = null;
        if (method === 0) {
          text = new TextDecoder('utf-8').decode(raw);
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
            text = new TextDecoder('utf-8').decode(decompressed);
          } catch (e) { text = null; }
        }

        if (text) {
          text.split(/\r?\n/).forEach(function(line) {
            if (line.trim() && errorPattern.test(line)) {
              errors.push(line.trim());
            }
          });
        }
        offset = dataStart + compSize;
      } else if (sig === 0x02014b50 || sig === 0x06054b50) {
        break;
      } else {
        offset++;
      }
    }
    return errors;
  }

  try {
    var task = await addExportZip();
    var hasData = await poll(task);
    if (!hasData) return {backtest_id: args.backtestId, mode: 'export', status: 'empty', message: 'No log data', errors: []};

    var zipBuffer = await download(task);
    var errors = await extractErrors(zipBuffer);

    return {
      backtest_id: args.backtestId, mode: 'export', task: task,
      error_count: errors.length,
      errors: errors
    };
  } catch (e) {
    return {backtest_id: args.backtestId, mode: 'export', error: e.message || String(e)};
  }
}
