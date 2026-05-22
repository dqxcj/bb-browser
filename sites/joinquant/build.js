/* @meta
{
  "name": "joinquant/build",
  "description": "Start a JoinQuant compile/run job for a strategy",
  "domain": "www.joinquant.com",
  "args": {
    "algorithmId": {"required": true, "description": "Strategy edit algorithmId"},
    "code": {"required": false, "description": "Python source. If omitted, uses current saved page code"}
  },
  "capabilities": ["network"],
  "readOnly": false,
  "example": "bb-browser site joinquant/build ALGORITHM_ID"
}
*/

async function(args) {
  if (!args.algorithmId) return {error: 'Missing argument: algorithmId'};

  function base64Utf8(s) { return btoa(unescape(encodeURIComponent(s || ''))); }
  function tokenFrom(html) {
    return window.tokenData?.value || (html.match(/tokenData=\{name:"token",value:"([^"]+)"/) || [])[1] || '';
  }
  async function loadBody(type) {
    const url = 'https://www.joinquant.com/algorithm/index/edit?algorithmId=' + encodeURIComponent(args.algorithmId);
    const resp = await fetch(url, {credentials: 'include'});
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const html = await resp.text();
    if (/<title>\s*用户登录\s*-/.test(html) || /class="formPwdLogin"/.test(html)) throw new Error('Not logged in');
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const body = new URLSearchParams();
    doc.querySelectorAll('input[name], select[name], textarea[name]').forEach(el => {
      const name = el.getAttribute('name');
      if (!name) return;
      if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) return;
      body.set(name, el.tagName === 'SELECT' ? (el.querySelector('option:checked')?.value || el.value || '') : (el.value || el.textContent || ''));
    });
    body.set('type', String(type));
    body.set('code', base64Utf8(args.code != null ? args.code : (doc.querySelector('#code')?.value || doc.querySelector('#code')?.textContent || '')));
    body.set('encrType', 'base64');
    body.set('ajax', '1');
    body.set('algorithm[algorithmId]', body.get('algorithm[algorithmId]') || doc.querySelector('#algorithmId')?.getAttribute('value') || args.algorithmId);
    body.set('algorithm[name]', body.get('algorithm[name]') || doc.querySelector('.algo-title')?.textContent?.trim() || 'JoinQuant Strategy');
    const token = tokenFrom(html);
    if (token) body.set('token', token);
    return body;
  }

  let body;
  try { body = await loadBody(1); } catch (e) { return {error: String(e.message || e)}; }

  const resp = await fetch('https://www.joinquant.com/algorithm/index/build', {
    method: 'POST',
    credentials: 'include',
    headers: {'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'},
    body
  });
  if (!resp.ok) return {error: 'HTTP ' + resp.status};
  const data = await resp.json();
  return {
    code: data.code,
    status: data.status,
    msg: data.msg || '',
    algorithm_id: data.data?.algorithmId || null,
    backtest_id: data.data?.backtestId || null,
    backtest_id_public: data.data?.backtestId_ || null,
    trade_days: data.data?.tradeDays || null,
    data: data.data || null
  };
}
