// 源适配器：华润集团官方校园招聘（wintalent 北森系统，Playwright 渲染）
// 官网: https://crc.wintalent.cn/wt/CRC/web/index/CompCRCRecruitSchool (校园招聘)
// 职位列表API: corpwebPosition1000CRC!getPostListByCondition (SSR HTML)
// 职位详情API: corpwebPosition1000CRC!getOnePosition?postIdEnc=xxx
// 数据等级: A (集团官网)
'use strict';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const id = 'soe_crc';
const name = '华润集团官方校招(官网)';
const cat = 'soe';
const LIST_URL = 'https://crc.wintalent.cn/wt/CRC/web/index/CompCRCRecruitSchool';
const GD_CITIES = ['广州', '深圳', '珠海', '佛山', '东莞', '中山', '惠州', '江门', '肇庆', '湛江', '汕头', '韶关', '清远', '揭阳', '潮州', '梅州', '河源', '汕尾', '阳江', '云浮', '广东'];

// 可选：Playwright (chrome) 渲染。若不可用则退回 fetch SSR HTML。
async function fetchWithPW(url) {
  try {
    const { chromium } = require('playwright');
    const b = await chromium.launch({ headless: true, executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe' });
    try {
      const p = await b.newPage();
      await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await p.waitForTimeout(3500);
      const html = await p.content();
      return html;
    } finally { await b.close(); }
  } catch (e) {
    // 退回 fetch
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000), redirect: 'follow' });
    return await r.text();
  }
}

function parseList(html) {
  // SSR HTML 直接含职位（.positionLine 或相似结构）；Playwright 渲染后直接内嵌
  // 尝试从页面提取职位块：名称/业务单元/数量/工作地点/发布时间
  const out = [];
  // 方案1: 找 "职位详情" 链接 (Playwright content 里有完整 a[href])
  const re = /<a[^>]*href=["']([^"']*getOnePosition\?postIdEnc=([a-f0-9]+)[^"']*)["'][^>]*>([\s\S]*?)<\/a>/g;
  let m;
  const seen = new Set();
  while ((m = re.exec(html)) && out.length < 80) {
    const enc = m[2];
    if (seen.has(enc)) continue;
    seen.add(enc);
    // 抓职位行容器：向上回溯找最近含 业务单元/工作地点 的文本块
    // 简化：整页文本里找该职位名附近的 业务单元：XX 数量：X 工作地点：XX 发布时间：XXX
    out.push({ enc, url: m[1].startsWith('http') ? m[1] : 'https://crc.wintalent.cn' + m[1] });
  }
  // 方案2: 从纯文本块解析职位行（SSR HTML 没有链接时）
  if (!out.length) {
    const text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*>/g, '\n').replace(/&nbsp;/gi, ' ').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n');
    const lines = text.split('\n').map((s) => s.trim()).filter(Boolean);
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (/岗|管培生|培训生|工程师|专员|经理|助理|顾问|管理/.test(l) && l.length > 4 && l.length < 60 && !/业务单元|工作地点|发布时间|职位详情/.test(l)) {
        // 找后续3行内的业务单元/地点
        const ctx = lines.slice(i, i + 6).join(' ');
        out.push({ enc: 'txt_' + i, url: LIST_URL, title: l, ctx });
      }
    }
  }
  return out;
}

async function collect() {
  const html = await fetchWithPW(LIST_URL);
  const raw = parseList(html);
  console.log(`  华润职位块: ${raw.length}`);
  // 对每个职位详情请求完整信息（含 地点/学历），广东过滤
  const jobs = [];
  for (const r of raw.slice(0, 60)) {
    try {
      if (!r.enc || r.enc.startsWith('txt_')) continue;
      const det = await fetch(`https://crc.wintalent.cn/wt/CRC/web/templet1000/index/corpwebPosition1000CRC!getOnePosition?postIdEnc=${r.enc}&brandCode=1&recruitType=1&lanType=1&showComp=true`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(12000) });
      const txt = await det.text();
      const clean = txt.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]*>/g, '\n').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
      const lines = clean.split('\n').map((s) => s.trim()).filter(Boolean);
      // 职位名：第一个含"岗|管培|培训生|工程师"且长度<60的行(在"马上申请"前)
      let title = '', ui = -1;
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (/岗|管培生|培训生|工程师|专员|经理|助理|顾问|管理生/.test(l) && l.length > 3 && l.length < 60 && !/^[0-9、.\d]/.test(l) && !/华润置地|华润水泥|华润创业|香港|地址|电话|岗位职责|任职资格/.test(l)) { title = l; ui = i; break; }
      }
      if (!title) { console.log('  ⚠️ 未识别职位名, enc=', r.enc); continue; }
      // 找 工作地点/招聘人数/业务单元（职位名下方）
      const seg = lines.slice(ui, ui + 24).join(' | ');
      const getVal = (key) => {
        // 支持 "工作地点：广州市" 同行 或 "工作地点：\n广州市" 跨行
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(key)) {
            let v = lines[i].replace(key + '', '').replace(/[：:]\s*/, '').trim();
            if (!v) { for (let j = i + 1; j < Math.min(i + 3, lines.length); j++) { v = lines[j]; if (v && !/^[| ]*$/.test(v) && !/^(岗位职责|任职资格|马上申请|分享)/.test(v)) break; } }
            return v.replace(/[|]/g, '').trim();
          }
        }
        return '';
      };
      const loc = getVal('工作地点') || getVal('工作地址') || '';
      const cnt = getVal('招聘人数') || '';
      const bizRaw = (getVal('业务单元') || getVal('所属公司') || '').replace(/^[：:\s]*/, '');
      // 业务单元常为空 → 标题推断
      let biz = bizRaw;
      if (!biz || biz.includes('所属部门')) biz = '';
      if (!biz) biz = /三九/.test(title) ? '华润三九' : (/水泥/.test(title) ? '华润水泥' : (/电力/.test(title) ? '华润电力' : '')) || '华润集团';
      const dutyIdx = clean.indexOf('岗位职责');
      const duty = dutyIdx > -1 ? clean.slice(dutyIdx, dutyIdx + 500).split('\n').slice(0, 20).join(' ').trim() : seg.slice(0, 300);
      const eduM = clean.match(/任职资格[：:][\s\S]{0,400}?((?:本科|硕士|博士|大专)[^，。；；]{0,20}?(?:学历|及以上))/);
      const edu = eduM ? eduM[1] : (/本科及以上/.test(clean) ? '本科及以上' : (/硕士/.test(clean) ? '硕士' : ''));
      // 广东过滤（工作地点含广东城市 或 华南）
      const isGD = GD_CITIES.some((c) => loc.includes(c)) || /华南大区/.test(loc + title);
      if (!isGD) continue;
      jobs.push({
        unit: '华润集团·' + (biz || '华润'), position: title,
        duty: duty, city: loc, edu: edu,
        headcount: cnt.replace(/[^0-9]/g, '') || '',
        src_url: `https://crc.wintalent.cn/wt/CRC/web/templet1000/index/corpwebPosition1000CRC!getOnePosition?postIdEnc=${r.enc}&brandCode=1&recruitType=1&lanType=1&showComp=true`,
        src_title: title, src_name: name, src_cat: cat,
        src_level: 'A', status: '在招', batch: '', track: '国企主攻',
        note: '华润集团官网校园招聘（2027届），点击"官方原文"投递',
      });
      console.log(`  ✅ ${title.slice(0, 28)} | ${loc.slice(0, 30)}`);
      await new Promise((s) => setTimeout(s, 120));
    } catch (e) { console.log('  ⚠️', e.message.slice(0, 60)); }
  }
  return jobs;
}

module.exports = { id, name, collect };

if (require.main === module) {
  collect().then((j) => {
    console.log(`\n华润官方适配器: ${j.length} 条(广东)`);
    j.slice(0, 20).forEach((x) => console.log(`  ${x.unit.slice(0, 16)} | ${x.position.slice(0, 34)} | ${x.city.slice(0, 30)}`));
  }).catch((e) => { console.error(e); process.exit(1); });
}