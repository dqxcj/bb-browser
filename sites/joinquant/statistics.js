/* @meta
{
  "name": "joinquant/statistics",
  "description": "Fetch JoinQuant strategy/backtest quota statistics",
  "domain": "www.joinquant.com",
  "args": {},
  "capabilities": ["network"],
  "readOnly": true,
  "example": "bb-browser site joinquant/statistics"
}
*/

async function(args) {
  const resp = await fetch('https://www.joinquant.com/algorithm/index/statistics', {
    method: 'POST',
    credentials: 'include',
    headers: {'X-Requested-With': 'XMLHttpRequest'}
  });
  if (!resp.ok) return {error: 'HTTP ' + resp.status};
  const data = await resp.json();
  return {code: data.code, msg: data.msg || '', data: data.data || null};
}
