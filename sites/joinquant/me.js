/* @meta
{
  "name": "joinquant/me",
  "description": "Check current JoinQuant login state",
  "domain": "www.joinquant.com",
  "args": {},
  "capabilities": ["network"],
  "readOnly": true,
  "example": "bb-browser site joinquant/me"
}
*/

async function(args) {
  const resp = await fetch('https://www.joinquant.com/user/index/isLogin', {
    credentials: 'include',
    headers: {'X-Requested-With': 'XMLHttpRequest'}
  });
  if (!resp.ok) return {error: 'HTTP ' + resp.status, hint: 'Open JoinQuant and log in first'};
  const text = await resp.text();
  let data;
  try { data = JSON.parse(text); } catch (e) { return {error: 'Invalid JSON response', raw: text.slice(0, 200)}; }
  return {
    logged_in: !!(data.data && data.data.isLogin),
    code: data.code,
    msg: data.msg || '',
    data: data.data || null
  };
}
