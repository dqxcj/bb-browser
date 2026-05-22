/* @meta
{
  "name": "joinquant/backtest-list",
  "description": "List all backtests for a strategy (basic info + status). For numeric metrics (returns, sharpe), use joinquant/backtest-stats or joinquant/export.",
  "domain": "www.joinquant.com",
  "args": {
    "algorithmId": {"required": true, "description": "Strategy edit algorithmId (from joinquant/strategies)"},
    "page": {"required": false, "description": "Page number, default 1"}
  },
  "capabilities": ["network"],
  "readOnly": true,
  "example": "bb-browser site joinquant/backtest-list ALGORITHM_ID"
}
*/

async function(args) {
  if (!args.algorithmId) return {error: 'Missing argument: algorithmId'};
  var page = args.page || '1';
  var url = 'https://www.joinquant.com/algorithm/backtest/list?algorithmId=' + encodeURIComponent(args.algorithmId) + '&page=' + page;
  var resp = await fetch(url, {credentials: 'include'});
  if (!resp.ok) return {error: 'HTTP ' + resp.status, hint: 'Open JoinQuant and log in first'};
  var html = await resp.text();
  if (/<title>\s*用户登录\s*-/.test(html) || /class="formPwdLogin"/.test(html)) {
    return {error: 'Not logged in', hint: 'Open https://www.joinquant.com and log in'};
  }

  var doc = new DOMParser().parseFromString(html, 'text/html');
  var nameEl = doc.querySelector('.algo-title, .backtest-list__title, h2, h3');
  var strategyName = nameEl ? nameEl.textContent.trim() : '';

  var rows = Array.from(doc.querySelectorAll('#backtest-feed-table tbody tr.backtest-tr')).map(function(tr, i) {
    // _backtestId on tr is the main backtest identifier
    var backtestId = tr.getAttribute('_backtestId') || null;
    var backtestId2 = tr.getAttribute('_backtestId2') || null;
    var idx = tr.getAttribute('_idx') || null;
    var statusCode = tr.getAttribute('_status') || null;

    // Detail page backtestId from commented link
    var nameCell = tr.querySelector('td.align-left');
    var detailId = null;
    if (nameCell) {
      var commentMatch = nameCell.innerHTML.match(/backtestId=([a-f0-9]+)/);
      detailId = commentMatch ? commentMatch[1] : null;
    }

    // Name
    var nameSpan = tr.querySelector('.backtest-name');
    var name = nameSpan ? (nameSpan.getAttribute('title') || nameSpan.textContent).trim() : '';

    // Status
    var statusEl = tr.querySelector('.backtest-list__backtest-status');
    var status = statusEl ? statusEl.textContent.trim() : '';

    // Python version
    var pyEl = tr.querySelector('.pythonVersion');
    var pyVersion = pyEl ? pyEl.textContent.trim() : '';

    // Columns by order
    var cells = Array.from(tr.querySelectorAll('td'));
    function cellText(idx) {
      return cells[idx] ? cells[idx].textContent.replace(/\s+/g, ' ').trim() : '';
    }

    // Cell indices (0=checkbox, 1=index, 2=name, 3=create_time(hidden), 4=date_range, 5=capital(hidden), 6=runtime, 7=frequency, 8-10=return metrics(--), 11-15=hidden metrics(--), 16=status, 17=py_version(hidden))
    var dateRange = '';
    var frequency = '';
    if (cells.length >= 8) {
      // Find date range (cell with dates, not hidden)
      for (var k = 3; k < cells.length; k++) {
        var txt = cells[k].textContent.trim();
        if (/\d{4}-\d{2}-\d{2}/.test(txt) && txt.includes('-')) {
          dateRange = txt.replace(/\s+/g, ' ').trim();
          break;
        }
      }
      // Find frequency (cell with 分钟/天/日/etc)
      for (var k = 5; k < cells.length; k++) {
        var txt = cells[k].textContent.trim();
        if (/分钟|天|日|tick|minute|day|分钟线|日线/.test(txt)) {
          frequency = txt;
          break;
        }
      }
    }

    // Map status code
    var statusMap = {'0': 'not_started', '1': 'running', '2': 'completed'};
    var statusLabel = statusMap[statusCode] || ('code_' + statusCode);

    return {
      rank: i + 1,
      backtest_id: backtestId,
      detail_backtest_id: detailId,
      backtest_id2: backtestId2,
      name: name,
      date_range: dateRange,
      frequency: frequency,
      status: status || statusLabel,
      status_code: statusCode ? parseInt(statusCode) : null,
      python_version: pyVersion,
      url: detailId ? 'https://www.joinquant.com/algorithm/backtest/detail?backtestId=' + detailId : null,
      hint: 'For returns, sharpe, drawdown: use bb-browser site joinquant/backtest-stats ' + (detailId || backtestId || 'BACKTEST_ID')
    };
  }).filter(function(r) { return r.backtest_id; });

  return {
    algorithm_id: args.algorithmId,
    strategy_name: strategyName,
    page: parseInt(page, 10),
    count: rows.length,
    hint: 'Numeric metrics (returns, sharpe) load dynamically. Use joinquant/backtest-stats for each backtest.',
    backtests: rows
  };
}
