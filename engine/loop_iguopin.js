// 国聘高频实时采集循环 v2（与云端分工，无冲突版）
// 本机职责：每 N 分钟采国聘 → 写入独立 sidecar data/iguopin_jobs.json（只增不删）→ push 到 git
// 云端职责：每日2次全量采集时，先拉取本机 push 的 sidecar → 合并进 job_db → build → push dist
// 用法: node engine/loop_iguopin.js [间隔分钟]  （默认 30 分钟）
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const SIDECAR = path.join(ROOT, 'data', 'iguopin_jobs.json'); // 独立国聘库，云端合并用
const INTERVAL_MIN = parseInt(process.argv[2], 10) || 30;

function mergeJobs(jobs) {
  // 只写 sidecar，不碰主库 job_db.json（避免与云端双写冲突）
  let db = [];
  if (fs.existsSync(SIDECAR)) {
    try { db = JSON.parse(fs.readFileSync(SIDECAR, 'utf8')); } catch (e) { db = []; }
  }
  const before = db.length;
  const existing = new Set(db.map((j) => j.src_url + '|' + (j.position || '')));
  let added = 0;
  jobs.forEach((j) => {
    const k = j.src_url + '|' + j.position;
    if (existing.has(k)) return;
    existing.add(k);
    db.push(Object.assign({}, j, {
      src_level: 'B', status: '', batch: '', track: '国企主攻',
      cond_text: '', exam_text: '', cond_note: '国聘平台岗位，详见官方链接',
      _at: new Date().toISOString().slice(0, 10),
    }));
    added++;
  });
  if (added) {
    fs.writeFileSync(SIDECAR, JSON.stringify(db, null, 2), 'utf8');
    pushSidecar();
  }
  return { before, added, after: before + added };
}

function pushSidecar() {
  // 只 push sidecar 文件（无冲突面：主库由云端写）
  const git = (args) => { const r = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' }); return r.status === 0; };
  try {
    git(['add', path.relative(ROOT, SIDECAR).replace(/\\/g, '/')]);
    const changed = git(['diff', '--cached', '--quiet']) === false;
    if (changed) {
      git(['commit', '-m', `iguopin live: ${new Date().toLocaleString('zh-CN', { hour12: false })}`]);
      let p = git(['push', 'origin', 'HEAD:main']);
      if (!p) { p = git(['push', 'origin', 'HEAD:main']); }
      console.log(p ? '  ✅ sidecar 已 push' : '  ⚠️ push 失败');
    }
  } catch (e) { console.log('  push 异常:', e.message.slice(0, 40)); }
}

async function oneRound() {
  const t0 = Date.now();
  try {
    const iguopin = require(path.join(ROOT, 'collector', 'iguopin.adapter.js'));
    const jobs = await iguopin.collect();
    if (!jobs.length) { console.log(`[${new Date().toLocaleTimeString()}] 国聘本次 0 条`); return; }
    const m = mergeJobs(jobs);
    console.log(`[${new Date().toLocaleTimeString()}] 国聘采 ${jobs.length} 条 → sidecar 新增 ${m.added}（${m.before}→${m.after}）`);
  } catch (e) { console.log(`[${new Date().toLocaleTimeString()}] 国聘循环异常: ${e.message.slice(0, 60)}`); }
  console.log(`  耗时 ${((Date.now() - t0) / 1000).toFixed(0)}s，下一轮 ${INTERVAL_MIN} 分钟后`);
}

async function main() {
  console.log(`===== 国聘实时采集循环 v2 启动（每 ${INTERVAL_MIN} 分钟，写 sidecar）=====`);
  // 首次：拉取远程最新 sidecar（防本地旧）→ 再采
  try { spawnSync('git', ['pull', 'origin', 'main'], { cwd: ROOT, encoding: 'utf8', stdio: 'ignore' }); } catch (e) {}
  await oneRound();
  setInterval(oneRound, INTERVAL_MIN * 60 * 1000);
}

main();