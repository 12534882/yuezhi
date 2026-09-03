// 自动发布到 GitHub Pages：重建 dist → 更新 gh-pages 分支根 index.html → push
// 替代 Netlify 自动部署（Netlify 免费额度已耗尽；GH Pages 免费无限）
// 用法: node engine/publish_pages.js [--skip-build]
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist', 'index.html');

function run(cmd, args, opts) {
  const r = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', ...(opts || {}) });
  if (r.status !== 0) return { ok: false, out: (r.stderr || r.stdout || '').trim() };
  return { ok: true, out: (r.stdout || '').trim() };
}

function publish() {
  const skipBuild = process.argv.includes('--skip-build');
  // 1) 构建（如需要）
  if (!skipBuild) {
    const b = run(process.execPath, [path.join('engine', 'build_standalone.js')]);
    if (!b.ok) { console.log('❌ 构建失败:', b.out.slice(0, 120)); return { ok: false }; }
  }
  if (!fs.existsSync(DIST)) { console.log('❌ dist/index.html 不存在'); return { ok: false }; }

  // 2) 更新 gh-pages 分支
  // 先取远程最新 gh-pages（防覆盖他人提交）
  run('git', ['fetch', 'origin', 'gh-pages']);
  // 在临时目录更新：用 git show 把远程 gh-pages 的 index 换掉重推（简单可靠：直接推整个文件）
  // 方法：切到 gh-pages，替换 index.html，提交，推回，再切回 master
  const cur = run('git', ['branch', '--show-current']);
  // 先读 dist 内容（切分支后 dist 可能不存在）
  const distBuf = fs.readFileSync(DIST);
  const ghp = spawnSync('git', ['checkout', '-f', 'gh-pages'], { cwd: ROOT, encoding: 'utf8' });
  if (ghp.status !== 0) { console.log('❌ 无法切 gh-pages:', ghp.stderr.slice(0, 100)); return { ok: false }; }
  try {
    fs.writeFileSync(path.join(ROOT, 'index.html'), distBuf);
    run('git', ['add', 'index.html']);
    const changed = run('git', ['diff', '--cached', '--quiet']);
    if (!changed.ok) {
      // 有变化才提交
      const c = run('git', ['commit', '-m', `deploy pages: ${new Date().toLocaleString('zh-CN', { hour12: false })}`]);
      if (!c.ok && !/nothing to commit/.test(c.out)) { console.log('⚠️ commit:', c.out.slice(0, 100)); }
      const p = run('git', ['push', 'origin', 'gh-pages']);
      console.log(p.ok ? '✅ 已推送到 gh-pages → Pages 自动更新' : '⚠️ push 失败: ' + p.out.slice(0, 120));
    } else {
      console.log('  index.html 无变化，跳过');
    }
  } finally {
    // 切回原分支
    run('git', ['checkout', '-f', cur.out || 'master']);
  }
  return { ok: true };
}

module.exports = { publish };

if (require.main === module) {
  const r = publish();
  process.exit(r.ok ? 0 : 1);
}