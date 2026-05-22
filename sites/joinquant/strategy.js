/* @meta
{
  "name": "joinquant/strategy",
  "description": "Get a JoinQuant strategy's editable metadata and code",
  "domain": "www.joinquant.com",
  "args": {
    "algorithmId": {"required": true, "description": "Strategy edit algorithmId from joinquant/strategies"}
  },
  "capabilities": ["network"],
  "readOnly": true,
  "example": "bb-browser site joinquant/strategy 3ffc73604a180e6840af284ed923189a"
}
*/

async function(args) {
  if (!args.algorithmId) return {error: 'Missing argument: algorithmId'};
  const url = 'https://www.joinquant.com/algorithm/index/edit?algorithmId=' + encodeURIComponent(args.algorithmId);
  const resp = await fetch(url, {credentials: 'include'});
  if (!resp.ok) return {error: 'HTTP ' + resp.status, hint: 'Open JoinQuant and log in first'};
  const html = await resp.text();
  if (/<title>\s*用户登录\s*-/.test(html) || /class="formPwdLogin"/.test(html)) return {error: 'Not logged in'};
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const fields = {};
  doc.querySelectorAll('input[name], select[name], textarea[name]').forEach(el => {
    const name = el.getAttribute('name');
    if (!name) return;
    if (el.tagName === 'SELECT') fields[name] = el.querySelector('option:checked')?.value || el.value || '';
    else fields[name] = el.value || el.textContent || '';
  });

  const codeEl = doc.querySelector('#code, textarea[name="code"], textarea[name="algorithm[code]"]');
  return {
    algorithm_id: args.algorithmId,
    title: doc.querySelector('.algo-title')?.textContent?.trim() || doc.title || null,
    page_algorithm_id: doc.querySelector('#algorithmId')?.getAttribute('value') || fields['algorithm[algorithmId]'] || args.algorithmId,
    backtest_id: doc.querySelector('#backtestId')?.getAttribute('value') || fields.backtestId || null,
    backtest: {
      start_time: fields['backtest[startTime]'] || doc.querySelector('#startTime')?.getAttribute('value') || null,
      end_time: fields['backtest[endTime]'] || doc.querySelector('#endTime')?.getAttribute('value') || null,
      base_capital: fields['backtest[baseCapital]'] || null,
      frequency: fields['backtest[frequency]'] || doc.querySelector('#frequency')?.getAttribute('value') || null,
      py_version: fields['backtest[pyVersion]'] || fields.pyVersion || null
    },
    code: codeEl ? (codeEl.value || codeEl.textContent || '') : '',
    fields
  };
}
