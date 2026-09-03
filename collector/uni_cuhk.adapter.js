// 源适配器：香港中文大学(深圳)就业网 · 校招公告（含 结束时间）
// 列表: https://career.cuhk.edu.cn/job/search?page=N (每页20条)
// 详情: /job/view/id/{id} → 公司名称/工作地点/结束时间/公众号原文
'use strict';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const id = 'uni_cuhk';
const name = '港中深就业网·校招公告(官方)';
const cat = 'soe';
const PAGES = 8; // 前8页 ≈160条
const GD_CITIES = /广东|广州|深圳|珠海|佛山|东莞|中山|惠州|江门|肇庆|湛江|汕头|韶关|清远|揭阳|潮州|梅州|河源|汕尾|阳江|云浮/;
const SOE = /央企|国企|集团|银行|证券|保险|信托|电网|能源|电信|移动|联通|中建|中交|中铁|招商|华润|保利|广汽|越秀|轨道|航空|航天|船舶|石油|石化|电力|烟草|港口|邮政|国航|南航|东航|中广核|中核|中船|中粮|五矿|中化|国投|中远|招商局|交通|建设集团|开发银行|进出口银行|农发|太平|人寿|人保|太保|平安/;

async function fetchText(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(12000), redirect: 'follow' });
  return await r.text();
}

async function collect() {
  const all = [];
  const seenList = new Set();
  for (let pg = 1; pg <= PAGES; pg++) {
    try {
      const html = await fetchText('https://career.cuhk.edu.cn/job/search?page=' + pg);
      const items = [...html.matchAll(/<a[^>]*href=["']([^"']*\/job\/view\/id\/(\d+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)]
        .map((m) => ({ url: 'https://career.cuhk.edu.cn/job/view/id/' + m[2], id: m[2], title: m[3].replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim() }))
        .filter((x) => x.title.length > 5);
      let used = 0;
      for (const it of items) {
        const t = it.title;
        // 只收校园招聘类（2027届秋招优先）
        if (!/(2027届|2027年|2026届|2026年|校园招聘|秋招|校招|管培生|招聘启事)/.test(t)) continue;
        if (/实习|校园大使|宣讲会|大赛|训练营|实习生/.test(t)) continue;
        // 需央企/国企 or 广东
        const isSOE = SOE.test(t);
        const isGD = GD_CITIES.test(t);
        if (!isSOE && !isGD) continue;
        if (seenList.has(it.id)) continue;
        seenList.add(it.id);
        // 详情
        let batch = '', status = '在招', unit = '', loc = '';
        try {
          const dt = await fetchText(it.url);
          const dm = dt.match(/结束时间：\s*(20\d{2})-(\d{1,2})-(\d{1,2})/);
          if (dm) {
            const end = new Date(+dm[1], +dm[2] - 1, +dm[3], 23, 59, 59);
            batch = `至 ${+dm[1]}年${+dm[2]}月${+dm[3]}日`;
            status = end < new Date() ? '已截止' : (end - new Date() < 7 * 86400000 ? '即将' : '在招');
          }
          const um = dt.match(/公司名称[：:]\s*<[^>]*>\s*([^<\n]{1,30})/) || dt.match(/公司名称[：:]\s*([^<\n]{1,30})/);
          if (um) unit = um[1].replace(/<[^>]*>/g, '').trim();
          const lm = dt.match(/工作地点[：:]\s*<[^>]*>\s*([^<\n]{1,40})/) || dt.match(/工作地点[：:]\s*([^<\n]{1,40})/);
          if (lm) loc = lm[1].replace(/<[^>]*>/g, '').trim();
          await new Promise((s) => setTimeout(s, 100));
        } catch (e) {}
        if (status === '已截止') continue;
        // 广东岗位过滤（工作地点含广东）→ 但全国性央企也保留
        if (!isGD && !SOE.test(unit)) continue;
        let pos = t.slice(0, 55);
        // 去掉单位名前缀做position（保留原标题）
        all.push({
          unit: unit || t.replace(/(2027届|2026届|2027年|2026年|校园招聘|秋招|校招|招聘|公告|简章|正式启动|全面开启)/g, '').trim().slice(0, 25),
          position: pos, duty: '高校就业网发布校招公告，详见原文', city: loc.replace(/^不限\s*-\s*/, '').slice(0, 60),
          edu: '', headcount: '', src_url: it.url, src_title: t,
          src_name: name, src_cat: cat, src_level: 'A', status, batch,
          track: '国企主攻', note: '港中深就业网原文（官方公众号链接在详情内）',
        });
        used++;
      }
      console.log(`  第${pg}页: ${items.length} 条 → 采用 ${used} 条(累计${all.length})`);
      if (items.length < 15) break;
    } catch (e) { console.log(`  第${pg}页失败: ${e.message.slice(0, 50)}`); }
  }
  const seen = new Set();
  return all.filter((j) => { const k = j.src_url; if (seen.has(k)) return false; seen.add(k); return true; });
}

module.exports = { id, name, collect };

if (require.main === module) {
  collect().then((j) => {
    console.log(`\n港中深适配器: ${j.length} 条`);
    j.slice(0, 25).forEach((x) => console.log(`  ${x.unit.slice(0, 18)} | ${x.position.slice(0, 32)} | ${x.batch || '无截止'} | ${x.city.slice(0, 18)}`));
  }).catch((e) => { console.error(e); process.exit(1); });
}