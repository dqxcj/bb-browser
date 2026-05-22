/* @meta
{
  "name": "joinquant/new",
  "description": "Create a new JoinQuant strategy from a template",
  "domain": "www.joinquant.com",
  "args": {
    "type": {"required": false, "description": "Template type: empty, stock, future, fst, multiFactor, comp. Default empty"},
    "name": {"required": false, "description": "Strategy name to save after creation"},
    "code": {"required": false, "description": "Python source to save after creation"},
    "capital": {"required": false, "description": "Base capital, default 100000"}
  },
  "capabilities": ["network"],
  "readOnly": false,
  "example": "bb-browser site joinquant/new --type empty --name TestStrategy --code \"def initialize(context):\\n    pass\""
}
*/

async function(args) {
  const allowed = {empty: 1, stock: 1, future: 1, fst: 1, multiFactor: 1, comp: 1};
  const type = allowed[args.type] ? args.type : 'empty';
  const capital = args.capital || (type === 'future' || type === 'comp' ? '1000000' : '100000');
  const newUrl = 'https://www.joinquant.com/algorithm/index/new?restore=0&type=' + encodeURIComponent(type) +
    '&baseCapital=' + encodeURIComponent(capital);

  function base64Utf8(s) { return btoa(unescape(encodeURIComponent(s || ''))); }
  function tokenFrom(html) {
    return window.tokenData?.value || (html.match(/tokenData=\{name:"token",value:"([^"]+)"/) || [])[1] || '';
  }
  function collectForm(doc) {
    const body = new URLSearchParams();
    doc.querySelectorAll('input[name], select[name], textarea[name]').forEach(el => {
      const name = el.getAttribute('name');
      if (!name) return;
      if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) return;
      body.set(name, el.tagName === 'SELECT' ? (el.querySelector('option:checked')?.value || el.value || '') : (el.value || el.textContent || ''));
    });
    return body;
  }

  const resp = await fetch(newUrl, {credentials: 'include'});
  if (!resp.ok) return {error: 'HTTP ' + resp.status};
  const html = await resp.text();
  if (/<title>\s*用户登录\s*-/.test(html) || /class="formPwdLogin"/.test(html)) return {error: 'Not logged in'};
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const body = collectForm(doc);
  const algorithmId = body.get('algorithm[algorithmId]') || doc.querySelector('#algorithmId')?.getAttribute('value') || null;
  const currentCode = doc.querySelector('#code')?.value || doc.querySelector('#code')?.textContent || '';
  const title = doc.querySelector('.algo-title')?.textContent?.trim() || 'JoinQuant Strategy';

  if (!args.name && args.code == null) {
    return {
      created: true,
      algorithm_id: algorithmId,
      name: title,
      type,
      url: algorithmId ? 'https://www.joinquant.com/algorithm/index/edit?algorithmId=' + algorithmId : newUrl,
      saved: false,
      hint: 'Pass --name and/or --code to save custom content after creation.'
    };
  }

  body.set('code', base64Utf8(args.code != null ? args.code : currentCode));
  body.set('encrType', 'base64');
  body.set('ajax', '1');
  if (algorithmId) body.set('algorithm[algorithmId]', algorithmId);
  body.set('algorithm[name]', args.name || body.get('algorithm[name]') || title);
  const token = tokenFrom(html);
  if (token) body.set('token', token);

  const saveResp = await fetch('https://www.joinquant.com/algorithm/index/save', {
    method: 'POST',
    credentials: 'include',
    headers: {'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'},
    body
  });
  if (!saveResp.ok) return {error: 'Created but save failed: HTTP ' + saveResp.status, algorithm_id: algorithmId};
  const saveData = await saveResp.json();
  return {
    created: true,
    saved: saveData.code === '00000',
    algorithm_id: saveData.data?.algorithmId || algorithmId,
    name: args.name || title,
    type,
    save_code: saveData.code,
    save_status: saveData.status,
    msg: saveData.msg || '',
    data: saveData.data || null
  };
}
