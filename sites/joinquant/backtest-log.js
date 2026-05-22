/* @meta
{
  "name": "joinquant/backtest-log",
  "description": "Get COMPLETE backtest log via export (not truncated). For quick tail check, use --quick flag.",
  "domain": "www.joinquant.com",
  "args": {
    "backtestId": {"required": true, "description": "Backtest id"},
    "quick": {"required": false, "description": "Use fast API for a quick preview of recent log lines"},
    "offset": {"required": false, "description": "Quick mode: log offset, default 0"}
  },
  "capabilities": ["network"],
  "readOnly": true,
  "example": "bb-browser site joinquant/backtest-log BACKTEST_ID"
}
*/

async function(args) {
  if (!args.backtestId) return {error: 'Missing argument: backtestId'};

  // Quick mode: use the old paginated API for fast preview
  if (args.quick) {
    var offset = parseInt(args.offset || '0', 10) || 0;
    var resp = await fetch('https://www.joinquant.com/algorithm/backtest/log?backtestId=' + encodeURIComponent(args.backtestId) + '&offset=' + offset, {
      credentials: 'include', headers: {'X-Requested-With': 'XMLHttpRequest'}
    });
    if (!resp.ok) return {error: 'HTTP ' + resp.status};
    var data = await resp.json();
    return {
      backtest_id: args.backtestId, mode: 'quick', offset: offset,
      state: data.data?.state,
      next_offset: data.data?.offset ?? offset + (data.data?.logArr?.length || 0),
      logs: data.data?.logArr || [],
      hint: 'Quick mode shows partial logs. Remove --quick for full export.'
    };
  }

  // Full export flow
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

  async function extractZipText(zipBuffer) {
    var view = new DataView(zipBuffer);
    var entries = {};
    var offset = 0;
    while (offset < zipBuffer.byteLength - 4) {
      var sig = view.getUint32(offset, true);
      if (sig === 0x04034b50) {
        var method = view.getUint16(offset + 8, true);
        var compSize = view.getUint32(offset + 18, true);
        var uncompSize = view.getUint32(offset + 22, true);
        var nameLen = view.getUint16(offset + 26, true);
        var extraLen = view.getUint16(offset + 28, true);
        var nameBytes = new Uint8Array(zipBuffer, offset + 30, nameLen);
        var name = new TextDecoder().decode(nameBytes);
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
          } catch (e) {
            text = null;
          }
        }
        entries[name] = {method: method, size: compSize, uncompSize: uncompSize, data: text};
        offset = dataStart + compSize;
      } else if (sig === 0x02014b50 || sig === 0x06054b50) {
        break;
      } else {
        offset++;
      }
    }
    return entries;
  }

  try {
    var task = await addExportZip();
    var hasData = await poll(task);
    if (!hasData) return {backtest_id: args.backtestId, mode: 'export', status: 'empty', message: 'No log data produced', logs: [], error_logs: []};

    var zipBuffer = await download(task);
    var files = await extractZipText(zipBuffer);

    var allLogs = [];
    var errorLogs = [];
    var fileNames = Object.keys(files).sort();

    fileNames.forEach(function(name) {
      var entry = files[name];
      if (entry.data == null) return;
      var lines = entry.data.split(/\r?\n/).filter(function(l) { return l.trim(); });
      lines.forEach(function(line) {
        allLogs.push(line);
        if (/ERROR|Error|error|WARN|Warn|warn|异常|错误|失败|Exception|Traceback/.test(line)) {
          errorLogs.push(line);
        }
      });
    });

    return {
      backtest_id: args.backtestId, mode: 'export', task: task,
      file_count: fileNames.length,
      files: fileNames,
      total_lines: allLogs.length,
      error_count: errorLogs.length,
      logs: allLogs,
      error_logs: errorLogs
    };
  } catch (e) {
    return {backtest_id: args.backtestId, mode: 'export', error: e.message || String(e)};
  }
}
