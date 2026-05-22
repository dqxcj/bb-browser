/* @meta
{
  "name": "joinquant/strategies",
  "description": "List JoinQuant strategies from the strategy workbench",
  "domain": "www.joinquant.com",
  "args": {
    "query": {"required": false, "description": "Filter by strategy name"},
    "page": {"required": false, "description": "Page number, default 1"}
  },
  "capabilities": ["network"],
  "readOnly": true,
  "example": "bb-browser site joinquant/strategies --query ETF"
}
*/

async function(args) {
  const params = new URLSearchParams();
  if (args.query) params.set('query', args.query);
  if (args.page) params.set('page', args.page);
  const url = 'https://www.joinquant.com/algorithm/index/list' + (params.toString() ? '?' + params : '');
  const resp = await fetch(url, {credentials: 'include'});
  if (!resp.ok) return {error: 'HTTP ' + resp.status, hint: 'Open JoinQuant and log in first'};
  const html = await resp.text();
  if (/<title>\s*用户登录\s*-/.test(html) || /class="formPwdLogin"/.test(html)) {
    return {error: 'Not logged in', hint: 'Open https://www.joinquant.com/algorithm/index/list and log in'};
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');

  function param(href, name) {
    if (!href) return null;
    try { return new URL(href, 'https://www.joinquant.com').searchParams.get(name); } catch (e) { return null; }
  }

  const rows = Array.from(doc.querySelectorAll('#algo_table tbody tr')).map((tr, index) => {
    const nameLink = tr.querySelector('a.file_name');
    const buildLink = tr.querySelector('a[href*="/algorithm/backtest/buildList"]');
    const backtestLink = tr.querySelector('a[href*="/algorithm/backtest/list"]');
    const cells = Array.from(tr.querySelectorAll('td')).map(td => td.textContent.replace(/\s+/g, ' ').trim());
    const select = tr.querySelector('.select-box');
    const isFolder = !!select?.getAttribute('_fId');
    return {
      rank: index + 1,
      name: nameLink ? nameLink.textContent.trim() : (cells[1] || ''),
      type: cells[2] || null,
      modified_at: cells[3] || null,
      build_count: parseInt(buildLink?.textContent.trim() || cells[4] || '0', 10) || 0,
      backtest_count: parseInt(backtestLink?.textContent.trim() || cells[5] || '0', 10) || 0,
      edit_algorithm_id: param(nameLink?.getAttribute('href'), 'algorithmId'),
      row_algorithm_id: select?.getAttribute('_algorithmId') || null,
      folder_id: select?.getAttribute('_fId') || null,
      build_list_algorithm_id: param(buildLink?.getAttribute('href'), 'algorithmId'),
      backtest_list_algorithm_id: param(backtestLink?.getAttribute('href'), 'algorithmId'),
      url: nameLink ? new URL(nameLink.getAttribute('href'), 'https://www.joinquant.com').href : null,
      is_folder: isFolder
    };
  }).filter(x => x.name);

  return {
    query: args.query || null,
    page: parseInt(args.page || '1', 10),
    count: rows.length,
    results: rows
  };
}
