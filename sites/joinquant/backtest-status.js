/* @meta
{
  "name": "joinquant/backtest-status",
  "description": "Check backtest runtime status. Use before exporting to confirm backtest has finished.",
  "domain": "www.joinquant.com",
  "args": {
    "backtestId": {"required": true, "description": "Backtest id"}
  },
  "capabilities": ["network"],
  "readOnly": true,
  "example": "bb-browser site joinquant/backtest-status BACKTEST_ID"
}
*/

async function(args) {
  if (!args.backtestId) return {error: 'Missing argument: backtestId'};

  // Fetch runtime info
  var resp = await fetch('https://www.joinquant.com/algorithm/backtest/runTimeInfo?backtestId=' + encodeURIComponent(args.backtestId), {
    credentials: 'include', headers: {'X-Requested-With': 'XMLHttpRequest'}
  });
  if (!resp.ok) return {error: 'HTTP ' + resp.status};
  var data = await resp.json();

  var info = data.data || {};
  var state = info.status != null ? parseInt(info.status) : (info.state != null ? parseInt(info.state) : null);

  // JoinQuant backtest state codes (observed):
  // 0 = not started, 1 = running, 2 = completed
  var stateLabel;
  if (state === 0) stateLabel = 'not_started';
  else if (state === 1) stateLabel = 'running';
  else if (state === 2) stateLabel = 'completed';
  else stateLabel = 'unknown (' + state + ')';

  return {
    backtest_id: args.backtestId,
    code: data.code,
    state: state,
    state_label: stateLabel,
    ready_for_export: state === 2,
    elapsed: info.elapsed || info.runTime || null,
    progress: info.progress || null,
    data: info
  };
}
