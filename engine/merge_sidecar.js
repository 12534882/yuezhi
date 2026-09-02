// 合并国聘 sidecar 进主库 job_db（云端 workflow 用；也可本机手动跑合并+发布）
// 用法: node engine/merge_sidecar.js [--publish]
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const DB = path.join(ROOT, 'data', 'job_db.json');
const SIDECAR = path.join(ROOT, 'data', 'iguopin_jobs.json');

function main() {
  if (!fs.existsSync(SIDECAR)) { console.log('无 sidecar（本机国聘未运行过或已合并），跳过'); return; }
  const side = JSON.parse(fs.readFileSync(SIDECAR, 'utf8'));
  const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
  const before = db.length;
  const existing = new Set(db.map((j) => j.src_url + '|' + (j.position || '')));
  let added = 0;
  side.forEach((j) => {
    const k = (j.src_url || '') + '|' + (j.position || '');
    if (existing.has(k)) return;
    existing.add(k);
    db.push(Object.assign({}, j, {
      src_level: 'B', status: '', batch: '', track: '国企主攻',
      cond_text: '', exam_text: '', cond_note: '国聘平台岗位，详见官方链接',
    }));
    added++;
  });
  if (added) {
    fs.writeFileSync(DB, JSON.stringify(db, null, 2), 'utf8');
    console.log(`合并 sidecar → 主库: 新增 ${added} 条（${before} -> ${db.length}）`);
  } else {
    console.log('sidecar 无新增（均已入库）');
  }
  // 合并后清空 sidecar（避免重复），云端 push 时也会将空 sidecar 同步
  fs.writeFileSync(SIDECAR, JSON.stringify([], null, 2), 'utf8');

  // --publish：本机手动合并后直接发布（云端不需要，云端最后统一 build/push）
  if (process.argv.includes('--publish')) {
    spawnSync(process.execPath, [path.join('engine', 'build_standalone.js')], { cwd: ROOT, stdio: 'inherit' });
    const p = spawnSync('git', ['pull', 'origin', 'main'], { cwd: ROOT, encoding: 'utf8', stdio: 'ignore' });
    spawnSync('git', ['add', path.relative(ROOT, DB).replace(/\\/g, '/'), 'data/iguopin_jobs.json', 'dist'], { cwd: ROOT, stdio: 'ignore' });
    spawnSync('git', ['commit', '-m', `iguopin merge: ${new Date().toLocaleString('zh-CN', { hour12: false })}`], { cwd: ROOT, stdio: 'ignore' });
    spawnSync('git', ['push', 'origin', 'HEAD:main'], { cwd: ROOT, stdio: 'ignore' });
    console.log('--publish 完成');
  }
}

main();