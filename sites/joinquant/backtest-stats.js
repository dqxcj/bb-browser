/* @meta
{
  "name": "joinquant/backtest-stats",
  "description": "Fetch JoinQuant backtest risk/return stats",
  "domain": "www.joinquant.com",
  "args": {
    "backtestId": {"required": true, "description": "Backtest id"}
  },
  "capabilities": ["network"],
  "readOnly": true,
  "example": "bb-browser site joinquant/backtest-stats BACKTEST_ID"
}
*/

async function(args) {
  if (!args.backtestId) return {error: 'Missing argument: backtestId'};
  const resp = await fetch('https://www.joinquant.com/algorithm/backtest/stats?backtestId=' + encodeURIComponent(args.backtestId), {
    credentials: 'include',
    headers: {'X-Requested-With': 'XMLHttpRequest'}
  });
  if (!resp.ok) return {error: 'HTTP ' + resp.status};
  const data = await resp.json();
  return {backtest_id: args.backtestId, code: data.code, msg: data.msg || '', stats: data.data || null};
}
