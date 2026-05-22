/* @meta
{
  "name": "joinquant/cancel",
  "description": "Cancel a running JoinQuant backtest",
  "domain": "www.joinquant.com",
  "args": {
    "backtestId": {"required": true, "description": "Backtest id to cancel"}
  },
  "capabilities": ["network"],
  "readOnly": false,
  "example": "bb-browser site joinquant/cancel BACKTEST_ID"
}
*/

async function(args) {
  if (!args.backtestId) return {error: 'Missing argument: backtestId'};
  const body = new URLSearchParams({backtestId: args.backtestId});
  const resp = await fetch('https://www.joinquant.com/algorithm/index/cancel', {
    method: 'POST',
    credentials: 'include',
    headers: {'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'},
    body
  });
  if (!resp.ok) return {error: 'HTTP ' + resp.status};
  const data = await resp.json();
  return {backtest_id: args.backtestId, code: data.code, status: data.status, msg: data.msg || '', data: data.data || null};
}
