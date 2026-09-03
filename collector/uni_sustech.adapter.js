// 源适配器：南方科技大学就业网 · 在线招聘公告（完整正文+投递入口提取）
// 首页: https://career.sustech.edu.cn/ → /detail/online?id=NNN
'use strict';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const id = 'uni_sustech';
const name = '南科大就业网·校招公告(官方)';
const cat = 'soe';

async function fetchText(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(12000), redirect: 'follow' });
  return await r.text();
}

async function collect() {
  const all = [];
  const seen = new Set();
  // 南科大首页抓在线招聘条目
  const home = await fetchText('https://career.sustech.edu.cn/');
  const items = [...home.matchAll(/<a[^>]*href=["']([^"']*\/detail\/online\?id=(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((m) => ({ url: 'https://career.sustech.edu.cn' + m[1], id: m[2], title: m[3].replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() }))
    .filter((x) => x.title.length > 5 && !/<|>/.test(x.title));
  console.log(`  南科大在线招聘条目: ${items.length}`);
  for (const it of items) {
    const t = it.title;
    // 只收 2027届/校园招聘/校招 且 央国企/广东
    if (!/(2027届|2027年|2026届|2026年|校园招聘|秋招|校招|招聘简章|管培生)/.test(t)) continue;
    if (/实习|宣讲|大赛|人才活动|云聘会|招才引智/.test(t)) continue;
    const isSOE = /集团|银行|证券|保险|信托|中|招商|华润|广|能源|电力|航空|航天|船舶|移动|电信|联通|南航|国航/.test(t);
    const isGD = /广东|广州|深圳|佛山|东莞|珠海|惠州|中山|江门|肇庆|湛江/.test(t);
    if (!isSOE && !isGD) continue;
    // 详情页（含完整正文）
    try {
      const dt = await fetchText(it.url);
      const clean = dt.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*>/g, '\n').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
      // 找 投递官网/网申链接
      const applyM = clean.match(/https?:\/\/[^\s|，。；）)\]]{8,80}/g);
      const applyUrl = applyM ? applyM.find((u) => !/sustech|edu.cn|qq.com/.test(u) && !/\.(png|jpg|css|js)/.test(u)) || '' : '';
      // 公司名：找 单位名称/公司 或标题第一个集团名
      let unit = '';
      const um = clean.match(/(?:单位名称|公司名称|招聘单位)[：:]\s*([^\n]{2,30})/) || clean.match(/([一-龥A-Za-z0-9]{2,20}(?:集团|有限公司|银行|证券|研究院))(?:\s|2027|届|校园|招聘|$)/);
      if (um) unit = um[1].trim();
      // 过期/截止时间
      let batch = '', status = '在招';
      const dm = dt.match(/(?:截止|结束|过期)(?:时间|日期)?[：:]\s*(20\d{2})[年\-.](\d{1,2})[月\-.](\d{1,2})/);
      if (dm) {
        const end = new Date(+dm[1], +dm[2] - 1, +dm[3], 23, 59, 59);
        batch = `至 ${+dm[1]}年${+dm[2]}月${+dm[3]}日`;
        status = end < new Date() ? '已截止' : (end - new Date() < 7 * 86400000 ? '即将' : '在招');
      }
      if (status === '已截止') continue;
      const duty = clean.slice(0, 700);
      all.push({
        unit: unit || t.replace(/(2027届|2027年|2026届|2026年|秋季|校园|招聘|公告|简章)/g, '').trim().slice(0, 25),
        position: t.slice(0, 55), duty, city: '', edu: '', headcount: '',
        src_url: it.url, src_title: t, src_name: name, src_cat: cat,
        src_level: 'A', status, batch, track: '国企主攻',
        note: applyUrl ? `投递官网：${applyUrl}` : '南科大就业网原文',
      });
      seen.add(it.id);
      await new Promise((s) => setTimeout(s, 150));
    } catch (e) {}
  }
  return all;
}

module.exports = { id, name, collect };

if (require.main === module) {
  collect().then((j) => {
    console.log(`\n南科大适配器: ${j.length} 条`);
    j.slice(0, 12).forEach((x) => console.log(`  ${x.unit.slice(0, 18)} | ${x.position.slice(0, 30)} | ${x.batch || '无截止'}`));
  }).catch((e) => { console.error(e); process.exit(1); });
}