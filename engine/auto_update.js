// 粤职通 · 全流程自动更新（核心：采集→清洗→剔旧→补id→重建→热重载→日志）
// 用法:
//   node engine/auto_update.js            # 完整流程(推荐计划任务用)
//   node engine/auto_update.js --no-collect  # 只做本地清洗+重建+热重载(不联网采集)
// 输出: data/update_log.jsonl (更新日志, 追加)
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DB = path.join(ROOT, 'data', 'job_db.json');
const LOG = path.join(ROOT, 'data', 'update_log.jsonl');
const SERVER = 'http://localhost:9090';
const TODAY = new Date().toISOString().slice(0, 10);

// ---------- 日志 ----------
function log(entry) {
  const line = JSON.stringify(Object.assign({ at: new Date().toISOString() }, entry));
  fs.appendFileSync(LOG, line + '\n');
  console.log('📝', entry.step || '', entry.msg || '');
}

// ---------- 工具 ----------
function run(cmd, args) {
  console.log(`\n>>> ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit' });
  if (r.status !== 0) { log({ step: cmd, msg: `失败(status=${r.status})`, level: 'error' }); process.exit(1); }
}

function makeId(x) {
  return crypto.createHash('md5').update([x.src_url, x.code, x.unit, x.position, x.dept].filter(Boolean).join('|')).digest('hex').slice(0, 16);
}

// ---------- 数据治理（只留新数据、保准确） ----------
function govern() {
  let db = JSON.parse(fs.readFileSync(DB, 'utf8'));
  const before = db.length;

  // 1) 结果/公示类噪音（已完成阶段 → 剔除）
  const RESULT_NOISE = /(拟聘|拟录用|录用公示|公示名单|面试成绩|笔试成绩|综合成绩|体检公告|考察公告|结果公告|成绩公告|拟聘用人员|入围|资格复审|资格审查|递补|签约公告|报到公告|证书领取|遗失|注销|征求意见|废止|任免|资格审核|面试公告|面试事项|笔试公告|报名入口|重要提示|延期|延长报名)/;
  // 2) 软文/占位/活动 —— 注意: 不能含"启动/开启/启航/进行时/火热"等校招标题常用词(2027校招公告大量以"正式启动"结尾)
  const SOFT = /(招录更系统|人岗更匹配|选人更科学|招录更规范|聚焦高质量发展|一封信|走访|交流活动|培训班|会议|调研|慰问|书香节|工会活动|大会|论坛|峰会|开放日|夜市|诚邀|进驻|赋能行动|首家|\+1|揭牌|落成|签约|人才工作动态)/;
  const PLACEHOLDER = /^(广东组织工作网|佛山市禅城区人事招聘|东莞市政府公告|中山市雇员招聘|某栏目|首页|列表)$/;
  // 3) teacher 类错标：国企/企业/合同制岗混入教师编
  const NOT_TEACHER = /(总会计师|公有企业|国有资产监督管理局下属企业|城建集团|禅控园区|鼎域投资|副总经理|合同制|广湛公司)/;

  let rmResult = 0, rmSoft = 0, rmOld = 0, rmEmpty = 0, rmNotTeach = 0;
  db = db.filter((x) => {
    const unit = (x.unit || '').trim();
    const position = (x.position || '').trim();
    const title = (x.src_title || x.duty || x.unit || '').trim();
    // 全文判定：结果公示类（拟录用/成绩/体检等）——这些词出现在标题即代表已完成阶段
    const hay = (unit + ' ' + position + ' ' + title).trim();
    // 占位（unit 是栏目名且无具体职位名）
    if (PLACEHOLDER.test(unit) && !position) { rmEmpty++; return false; }
    if (RESULT_NOISE.test(hay)) { rmResult++; return false; }
    // 软文/活动类：只判标题（src_title/duty首行），避免误删职责里正常含"调研/活动"的岗位
    const titleOnly = (x.src_title || '').trim();
    if (SOFT.test(titleOnly)) { rmSoft++; return false; }
    // 旧年份：只对非事业编类别，且看标题开头的年份（如"广东省2024年考试录用公务员公告"）
    // 避免误删正文提及旧年份的 2026 有效事业编岗位
    if (x.src_cat !== 'sydw') {
      const m = title.match(/^(20\d{2})[年-]/);
      if (m && parseInt(m[1]) < 2026) { rmOld++; return false; }
      if (x.src_cat === 'gwy' && /20(2[0-5])年/.test(title)) { rmOld++; return false; }
    }
    // 全类别非2026：标题含 2021-2025 年份（"2023下半年"等变体）→ 剔
    const allTitle = (x.src_title || '') + (x.unit || '') + (x.position || '');
    if (/20(2[0-5])(年|下半年|年度|月|届)/.test(allTitle) && !/2026/.test(allTitle)) { rmOld++; return false; }
    // teacher 错标：国企/企业/合同制岗
    if (x.src_cat === 'teacher' && NOT_TEACHER.test(allTitle)) { rmNotTeach++; return false; }
    return true;
  });

  // 3) 补 id / track / level
  const TRACK = { soe: '国企主攻', teacher: '教师保底', gwy: '公务员升级', sydw: '文博保险', rcyj: '人才引进', xds: '选调', mq: '民企补充' };
  const seen = new Set(db.filter((x) => x.id).map((x) => x.id));
  let addedId = 0;
  db.forEach((x) => {
    if (!x.id) { let id = makeId(x); while (seen.has(id)) id += '-' + seen.size; seen.add(id); x.id = id; addedId++; }
    if (!x.track) x.track = TRACK[x.src_cat] || x.src_cat;
    if (!x.src_level) { x.src_level = /华图|中公|第三方|huatu|offcn/.test(x.src_name || '') ? 'C' : 'B'; x.level_note = x.src_level === 'C' ? '第三方聚合' : '官方平台/官网'; }
  });

  fs.writeFileSync(DB, JSON.stringify(db, null, 2), 'utf8');
  const byCat = {}; db.forEach((x) => { byCat[x.src_cat] = (byCat[x.src_cat] || 0) + 1; });
  return { before, after: db.length, removed: db.length - before, rmResult, rmSoft, rmOld, rmEmpty, addedId, byCat };
}

// ---------- URL 可用性抽验（保准确：防死链） ----------
async function verifyUrls(sampleRate = 0.08) {
  const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
  const unique = [...new Set(db.map((x) => x.src_url).filter(Boolean))];
  const sample = unique.filter(() => Math.random() < sampleRate).slice(0, 20);
  if (!sample.length) return { checked: 0, dead: [] };
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  const dead = [];
  let checked = 0;
  const concurrency = 3;
  let i = 0;
  async function worker() {
    while (i < sample.length) {
      const u = sample[i++];
      try {
        const r = await fetch(u, { signal: AbortSignal.timeout(10000), redirect: 'follow', headers: { 'User-Agent': UA } });
        if (r.status >= 400) dead.push(u);
        checked++;
      } catch (e) { dead.push(u); checked++; }
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return { checked, dead, sampleRate };
}

// ---------- 主流程 ----------
(async () => {
  const noCollect = process.argv.includes('--no-collect');
  const t0 = Date.now();
  console.log(`\n===== 粤职通自动更新 ${TODAY} ${noCollect ? '(仅本地治理)' : '(完整采集)'} =====`);

  // 1) 备份 + 采集
  const bak = path.join(ROOT, 'data', 'job_db.pre-auto-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '.json');
  fs.copyFileSync(DB, bak);
  log({ step: 'backup', msg: `已备份 -> ${path.basename(bak)}` });
  if (!noCollect) {
    run('node', [path.join('collector', 'index.js')]);
  } else {
    console.log('(无采集模式)');
  }

  // 2) 治理（剔旧/剔公示/补id）
  const g = govern();

  // 2.5) 公告考情/条件补全（增量：只处理未补全的新公告URL）
  const enrichRes = spawnSync(process.execPath, [path.join('engine', 'enrich_exam.js'), '--incremental'], { cwd: ROOT, stdio: 'inherit' });
  if (enrichRes.status === 0) log({ step: 'enrich', msg: '考情/条件补全完成(增量)' });
  else log({ step: 'enrich', msg: '考情/条件补全失败', level: 'warn' });

  // 2.6) 报名时间/状态补全（增量：新公告自动提取报名时间→A级+在招状态）
  const batchRes = spawnSync(process.execPath, [path.join('engine', 'enrich_batch.js'), '--incremental'], { cwd: ROOT, stdio: 'inherit' });
  if (batchRes.status === 0) log({ step: 'enrich-batch', msg: '报名时间/A级补全完成(增量)' });
  else log({ step: 'enrich-batch', msg: '报名时间补全失败', level: 'warn' });

  // 3) 重建单文件版
  run('node', [path.join('engine', 'build_standalone.js')]);

  // 3.5) 自动发布到永久网页（GitHub main 备份 + gh-pages 部署 GitHub Pages）
  try {
    const stamp = new Date().toLocaleString('zh-CN', { hour12: false });
    spawnSync('git', ['add', 'data/job_db.json', 'dist/index.html'], { cwd: ROOT, stdio: 'inherit' });
    const st = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: ROOT, encoding: 'utf8' });
    if (st.status === 0) {
      log({ step: 'publish', msg: '数据无变化，跳过推送' });
    } else {
      const cm = spawnSync('git', ['commit', '-m', `yuezhi auto: ${stamp}`], { cwd: ROOT, stdio: 'inherit' });
      if (cm.status === 0) {
        const pu = spawnSync('git', ['push', 'origin', 'HEAD:main'], { cwd: ROOT, stdio: 'inherit' });
        if (pu.status === 0) log({ step: 'publish', msg: '已推送 main' });
        else log({ step: 'publish', msg: 'push main 失败(代理?)', level: 'warn' });
      } else { log({ step: 'publish', msg: 'commit 失败', level: 'warn' }); }
    }
  } catch (e) {
    log({ step: 'publish', msg: `自动发布异常: ${e.message.slice(0, 60)}`, level: 'warn' });
  }
  // 3.6) gh-pages 部署（GitHub Pages 永久网址，替代已废的 Netlify）
  try {
    const pages = spawnSync(process.execPath, [path.join('engine', 'publish_pages.js'), '--skip-build'], { cwd: ROOT, stdio: 'inherit', timeout: 5 * 60 * 1000 });
    if (pages.status === 0) log({ step: 'gh-pages', msg: '已部署 GitHub Pages' });
    else log({ step: 'gh-pages', msg: 'gh-pages 部署失败', level: 'warn' });
  } catch (e) {
    log({ step: 'gh-pages', msg: `gh-pages 部署异常: ${e.message.slice(0, 60)}`, level: 'warn' });
  }

  // 4) 热重载 server
  try {
    const r = await fetch(SERVER + '/api/reload', { method: 'POST', signal: AbortSignal.timeout(10000) });
    const j = await r.json();
    log({ step: 'reload', msg: `server 热重载: ${j.ok ? j.total + ' 条' : j.msg}`, ok: j.ok });
  } catch (e) {
    log({ step: 'reload', msg: `热重载失败(server未运行?): ${e.message.slice(0, 50)}`, level: 'warn' });
  }

  // 5) URL 抽验（防死链）
  const v = await verifyUrls();
  log({ step: 'url-check', msg: `抽验 ${v.checked} 个URL，死链 ${v.dead.length} 个`, dead: v.dead.slice(0, 5) });

  // 6) 摘要
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  const summary = {
    step: 'summary',
    today: TODAY,
    mode: noCollect ? 'local' : 'full',
    timeSec: secs,
    before: g.before, after: g.after,
    removed: g.removed, rmResult: g.rmResult, rmSoft: g.rmSoft, rmOld: g.rmOld, rmEmpty: g.rmEmpty,
    addedId: g.addedId, byCat: g.byCat,
    deadLinks: v.dead.length,
  };
  log({ ...summary, msg: `✅ 完成: ${g.before} -> ${g.after} 条 (剔${g.removed}, 补id${g.addedId}, 死链${v.dead.length}), 耗时${secs}s` });
})();