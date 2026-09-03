// 粤职通调度器 v2 - 修复计划任务常驻崩溃问题
// 用法:
//   node collector/scheduler.js now     # 立即执行一次全流程(供计划任务用, 跑完即退出)
//   node collector/scheduler.js daemon  # 常驻守护(供开机自启用, 内部锁防并发)
'use strict';

const { spawnSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const LOCK = path.join(ROOT, 'data', 'scheduler.lock');
const LOG = path.join(ROOT, 'data', 'scheduler.log');

function log(msg) {
  const line = `${new Date().toLocaleString()} ${msg}\n`;
  fs.appendFileSync(LOG, line, 'utf8');
  console.log(msg);
}

// 互斥锁：已有别的调度在跑则跳过（解决 0x800710E0 撞实例）
function tryLock() {
  try {
    if (fs.existsSync(LOCK)) {
      const pid = parseInt(fs.readFileSync(LOCK, 'utf8'), 10);
      if (pid && Number.isInteger(pid)) {
        try { process.kill(pid, 0); return false; } catch (e) { /* 进程不存在, 锁可复用 */ }
      }
    }
    fs.writeFileSync(LOCK, String(process.pid), 'utf8');
    return true;
  } catch (e) { return true; } // 锁异常时允许跑
}
function releaseLock() {
  try { fs.unlinkSync(LOCK); } catch (e) {}
}

function runAutoUpdate(withCollect) {
  if (!tryLock()) { log('⏭ 已有调度实例在跑，本次跳过'); return false; }
  log(`⏰ ${new Date().toLocaleString()} 执行${withCollect ? '完整采集' : '本地治理'}…`);
  const args = [path.join('engine', 'auto_update.js')];
  if (!withCollect) args.push('--no-collect');
  const r = spawnSync(process.execPath, args, {
    cwd: ROOT, stdio: 'inherit', timeout: 40 * 60 * 1000, // 40分钟上限防挂死(完整采集含高校爬取)
  });
  releaseLock();
  if (r.error) { log(`❌ 自动更新异常: ${r.error.message.slice(0, 60)}`); return false; }
  if (r.status === 0) { log('✅ 自动更新完成'); return true; }
  log(`❌ 自动更新失败(status=${r.status})`);
  return false;
}

function main() {
  const mode = process.argv[2] || 'now';
  const wantCollect = process.argv[3] !== '--no-collect'; // 显式 --no-collect 才跳过采集
  if (mode === 'now') {
    const ok = runAutoUpdate(wantCollect);
    process.exit(ok ? 0 : 1);
  }
  if (mode === 'daemon') {
    log('🛡 守护进程启动(常驻, 每60秒检查时间)');
    if (!tryLock()) { log('⚠ 已有守护实例，退出'); process.exit(0); }
    // 守护模式注意: 不能持锁(要留给每日任务), 启动即释放
    releaseLock();
    const runAt = ['08:05', '18:05'];
    let last = {};
    setInterval(() => {
      const d = new Date();
      const hhmm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      if (runAt.includes(hhmm) && last[hhmm] !== d.toDateString()) {
        last[hhmm] = d.toDateString();
        runAutoUpdate(true); // 守护补跑也完整采集(与Daily任务错峰5分钟, 锁防重复)
      }
    }, 60000);
    return;
  }
  console.log('用法: node collector/scheduler.js now [--no-collect] | daemon');
}

main();
process.on('exit', releaseLock);
