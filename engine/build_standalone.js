// 粤职通 - 生成官网形态单文件 index.html（自包含：搜岗位+官方链接+招人数+画像匹配+央国企）
// 用法: node engine/build_standalone.js
// 输出: dist/index.html （可放任意静态托管，手机直接打开）
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'job_db.json'), 'utf8'));
const MATCHER = fs.readFileSync(path.join(__dirname, 'matcher_browser.js'), 'utf8');

// 公告内容全局表（条件/考情按唯一URL去重，岗位只存引用 → 大幅瘦身）
//   announceArr[i] = { u2: src_url, ct: cond_text, et: exam_text, cn: cond_note }
const announceMap = new Map();
DB.forEach((p) => {
  const url = p.src_url || '';
  if (!url || announceMap.has(url)) return;
  announceMap.set(url, {
    u2: url,
    ct: (p.cond_text || '').slice(0, 900),
    et: (p.exam_text || '').slice(0, 700),
    cn: p.cond_note || '',
  });
});
const announceArr = [...announceMap.values()];
const urlToAi = new Map(announceArr.map((a, i) => [a.u2, i]));

// 精简字段（短名减小体积），保留官网卡片所需字段
const slim = DB.map((p) => ({
  u: p.unit || '', n: p.position || p.unit || '', c: p.city || p.region || '',
  e: p.edu || '', a: (p.major_pg || p.major_ug || p.major || '').slice(0, 120),
  hc: p.headcount || '', cd: p.candidate || '', pl: p.political || '',
  d: (p.duty || '').slice(0, 600), u2: p.src_url || '', cat: p.src_cat || '',
  lv: p.src_level || '', tr: p.track || '', batch: (p.batch || '').slice(0, 42), st: p.status || '',
  // 详情弹窗完整字段
  dp: p.dept || '', dc: p.code || '', uc: p.unitCode || '', gd: p.grade || '',
  dd: p.degree || '', cd2: p.candidate || '', ag: p.age || '', ex: p.experience || '',
  mj: p.major || '', mpu: p.major_ug || '', mpp: p.major_pg || '', mpj: p.major_jz || '',
  rg: p.region || '', nt: p.note || '', tt: p.src_title || '', sn: p.src_name || '',
  ai: urlToAi.has(p.src_url || '') ? urlToAi.get(p.src_url || '') : -1, // 公告表引用
}));
const dbJson = JSON.stringify(slim);
console.log('岗位: ' + slim.length + ' 条, ' + Math.round(dbJson.length / 1024) + ' KB, 公告表: ' + announceArr.length + ' 条, 带链接 ' + slim.filter((x) => x.u2).length + ' 条');

const PROFESSION = require('../config/profession');

// 构建时间戳（展示数据新鲜度）
const _now = new Date();
const _pad = (n) => String(n).padStart(2, '0');
const BUILD_TIME = _now.getFullYear() + '-' + _pad(_now.getMonth() + 1) + '-' + _pad(_now.getDate()) + ' ' + _pad(_now.getHours()) + ':' + _pad(_now.getMinutes());

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
<meta http-equiv="Pragma" content="no-cache">
<meta http-equiv="Expires" content="0">
<title>粤职通 · 公职岗位智能匹配平台</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;background:#faf7f2;color:#3d3a36;line-height:1.65;background-image:radial-gradient(circle at 12% 8%,#ffe9d6 0,transparent 22%),radial-gradient(circle at 88% 14%,#dceafc 0,transparent 26%),radial-gradient(circle at 70% 90%,#fff0e5 0,transparent 24%)}
a{color:inherit;text-decoration:none}
.header{background:linear-gradient(135deg,#fff8ee,#fdeedb 55%,#e8f2fd);color:#3d3a36;border-bottom:1px solid #f3e8d8}.header-inner{max-width:1280px;margin:0 auto;padding:15px 18px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:10px}.logo{width:38px;height:38px;background:linear-gradient(135deg,#ffb35c,#ff935c);border-radius:12px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:19px;color:#fff;box-shadow:0 3px 10px rgba(255,147,92,.35)}
.brand-text b{font-size:18px;display:block;line-height:1.2;color:#2c2a27}.brand-text span{font-size:11px;color:#9a9288}
.nav{display:flex;gap:4px;flex-wrap:wrap}.nav-link{padding:7px 13px;border-radius:20px;font-size:13px;color:#6b6359;cursor:pointer;transition:all .2s}.nav-link:hover{background:#fff;box-shadow:0 2px 8px rgba(120,100,70,.12)}.nav-link.on{background:linear-gradient(135deg,#ffb35c,#ff935c);color:#fff;font-weight:700;box-shadow:0 3px 10px rgba(255,147,92,.35)}
.stats{font-size:12px;color:#9a9288;text-align:right}.fresh-badge{display:inline-block;margin-left:8px;padding:2px 9px;background:#eef7ee;color:#3d8b4f;border-radius:10px;font-size:11px;font-weight:600;white-space:nowrap}
.search-bar{background:rgba(255,255,255,.85);backdrop-filter:blur(6px);border-bottom:1px solid #f3e8d8;position:sticky;top:0;z-index:50}
.search-inner{max-width:1280px;margin:0 auto;padding:14px 18px 4px;display:flex;gap:9px}
#searchInput{flex:1;padding:12px 16px;border:1.5px solid #f0e4d2;border-radius:14px;font-size:14px;background:#fffdf9;box-shadow:inset 0 1px 3px rgba(120,90,40,.06)}#searchInput:focus{outline:none;border-color:#ffb35c;box-shadow:0 0 0 3px rgba(255,179,92,.18)}
.btn-primary{background:linear-gradient(135deg,#ffb35c,#ff935c);color:#fff;border:none;border-radius:14px;padding:12px 20px;font-size:14px;font-weight:700;cursor:pointer;box-shadow:0 3px 12px rgba(255,147,92,.3);transition:transform .15s,box-shadow .15s}.btn-primary:hover{transform:translateY(-1px);box-shadow:0 5px 16px rgba(255,147,92,.4)}.btn-primary.big{width:100%;padding:13px;border-radius:14px}
.filters{max-width:1280px;margin:0 auto;padding:8px 18px 12px;display:flex;gap:9px}.filters select{padding:8px 12px;border:1.5px solid #f0e4d2;border-radius:11px;font-size:13px;background:#fffdf9;color:#5c554b;cursor:pointer}
.layout{max-width:1280px;margin:18px auto;padding:0 18px 40px;display:grid;grid-template-columns:1fr 320px;gap:18px;align-items:start}
.list-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:13px;color:#9a9288;font-size:13px}.list-head b{color:#ff935c}
.cd-panel{margin:0 0 16px;padding:14px 16px;border:1px solid #ffe3c2;border-radius:14px;background:linear-gradient(135deg,#fff9f0,#fffdf9);box-shadow:0 2px 10px rgba(255,147,92,.08)}
.cd-head{font-size:14px;font-weight:800;color:#b3541e;display:flex;align-items:center;gap:8px;margin-bottom:10px}.cd-sub{font-size:11px;color:#c9a184;font-weight:400}
.cd-list{display:flex;flex-direction:column;gap:6px}
.cd-item{display:flex;align-items:center;gap:9px;padding:7px 10px;background:#fff;border:1px solid #f7ead8;border-radius:10px;cursor:pointer;transition:all .12s;font-size:12px}
.cd-item:hover{border-color:#ffb35c;transform:translateX(2px)}
.cd-days{flex:none;min-width:62px;text-align:center;padding:4px 7px;border-radius:8px;font-weight:800;font-size:12px}
.cd-hot{background:#fff0e6;color:#e8590c}.cd-ok{background:#e9f7ec;color:#2b8a3e}
.cd-u{font-weight:700;color:#3d3a36;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:26%}
.cd-n{color:#8a8175;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}
.cd-d{color:#b0a89c;font-size:11px;white-space:nowrap}
.ann-bar{margin:2px 24px 10px;padding:9px 13px;background:#fdf1ff;border:1px dashed #e2c8f0;border-radius:10px;font-size:12px;color:#8a5aa8;cursor:pointer;display:flex;justify-content:space-between;align-items:center}
.ann-bar b{color:#7a3fa0}.ann-bar span{color:#a45cd6;font-weight:700}
.ann-overlay{position:fixed;inset:0;background:rgba(46,38,26,.46);z-index:1100;display:flex;align-items:center;justify-content:center;padding:24px;animation:fadeIn .18s}
.ann-modal{background:#fff;border-radius:20px;max-width:780px;width:100%;max-height:88vh;overflow-y:auto;position:relative;box-shadow:0 24px 60px rgba(90,60,20,.25);animation:popIn .2s;display:flex;flex-direction:column}
.ann-body{overflow:auto;flex:1}
.ann-sep{margin:14px 0 8px;font-size:13px;font-weight:800;color:#7a3fa0;border-left:4px solid #d6b3ef;padding-left:8px}
.ann-item{padding:10px 13px;border:1px solid #f0e8f6;border-radius:10px;margin-bottom:7px;cursor:pointer;transition:all .12s;background:#fff}
.ann-item:hover{border-color:#c9a2e0;background:#fdf9ff}
.ann-pos{font-size:13px;font-weight:700;color:#3d3a36}
.ann-meta{font-size:11px;color:#8a8175;margin-top:3px}
.ann-foot2{display:flex;align-items:center;gap:9px;margin-top:7px}
.ann-batch{font-size:11px;color:#a0988c}
.ann-view{margin-left:auto;font-size:11px;color:#a45cd6;font-weight:700}
.job-list{display:grid;gap:12px}
.job{background:#fff;border-radius:16px;padding:16px 18px;box-shadow:0 2px 10px rgba(120,100,70,.08);border:1px solid #f6efe4;transition:transform .18s,box-shadow .18s;border-top:3px solid transparent}
.job:hover{transform:translateY(-2px);box-shadow:0 8px 22px rgba(120,100,70,.14)}
.job.cat-sydw{border-top-color:#7ec9a0}.job.cat-gwy{border-top-color:#8fb8e8}.job.cat-soe{border-top-color:#f0b27a}.job.cat-teacher{border-top-color:#cdb6e8}
.j-top{display:flex;justify-content:space-between;align-items:center;gap:9px;flex-wrap:wrap}.j-unit{font-size:15px;font-weight:700;color:#2c2a27}
.j-count{background:#fff3e4;color:#ff935c;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:700;white-space:nowrap}
.j-position{font-size:13px;margin-top:3px;font-weight:500;color:#5c554b}.j-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.tag{font-size:11px;padding:2px 9px;border-radius:6px;background:#f7f2ea;color:#8a8175}.tag.city{background:#e8f4ec;color:#3c8a5e}.tag.edu{background:#e9f3fd;color:#4a7fb8}.tag.pol{background:#fdeef0;color:#c96882}
.j-major{font-size:11px;color:#a0988c;margin-top:8px;background:#fffaf3;padding:7px 10px;border-radius:8px;border:1px dashed #f3e4cf}
.lv{font-size:11px;font-weight:700;padding:2px 8px;border-radius:6px;border:1px solid transparent}
.lv-a{background:#e8f7ee;color:#3c8a5e;border-color:#cdeeda}.lv-b{background:#fff7e6;color:#c08a2d;border-color:#f6e4bb}.lv-c{background:#f3eefb;color:#8a6ab5;border-color:#e2d6f2}.lv-d{background:#fdecec;color:#c96882;border-color:#f6d2d6}.lv-x{background:#f7f2ea;color:#8a8175;border-color:#ece3d3}
.tag.track{background:#fff0e3;color:#e08a3c}
.status{font-size:11px;font-weight:600;padding:2px 8px;border-radius:6px}.st-open{background:#e8f7ee;color:#3c8a5e}.st-soon{background:#fff7e6;color:#c08a2d}.st-closed{background:#fdecec;color:#c96882}.st-wait{background:#f3eefb;color:#8a6ab5}
.j-batch{font-size:11px;color:#a0988c;margin-top:7px}
.j-view{font-size:11px;color:#ff935c;font-weight:600;white-space:nowrap;background:#fff3e4;padding:3px 9px;border-radius:7px}
.match-banner{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;background:linear-gradient(135deg,#fff8ee,#fdeedb);color:#3d3a36;padding:12px 16px;border-radius:15px;font-size:13px;border:1px solid #f3e0c8}
.match-banner b{color:#ff935c}
.btn-exit{background:#fff;color:#ff935c;border:1px solid #ffd8b8;padding:5px 13px;border-radius:18px;font-size:12px;cursor:pointer;white-space:nowrap}
.score-badge{padding:3px 10px;border-radius:12px;font-size:12px;font-weight:800;white-space:nowrap}
.sc-a{background:#e8f7ee;color:#2e7d52;border:1px solid #cdeeda}.sc-b{background:#e9f3fd;color:#3a6fa8;border:1px solid #c9dff2}.sc-c{background:#fff7e6;color:#b8812a;border:1px solid #f6e4bb}.sc-d{background:#f3eefb;color:#7a5ca5;border:1px solid #e2d6f2}
.g-note{margin-top:8px;font-size:11px;color:#3c8a5e;background:#e8f7ee;padding:7px 10px;border-radius:8px}
.job{cursor:pointer}
.modal-overlay{position:fixed;inset:0;background:rgba(90,70,50,.35);backdrop-filter:blur(4px);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;animation:fadeIn .18s}
.modal{background:#fff;border-radius:20px;max-width:680px;width:100%;max-height:86vh;overflow-y:auto;position:relative;box-shadow:0 24px 60px rgba(90,60,20,.25);animation:popIn .2s}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes popIn{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}
.modal-close{position:absolute;top:13px;right:15px;background:#f7f2ea;border:none;color:#8a8175;width:32px;height:32px;border-radius:50%;font-size:15px;cursor:pointer;z-index:2}
.m-head{padding:22px 24px 15px;border-bottom:1px solid #f7f2ea;padding-right:58px}
.m-title{font-size:18px;font-weight:800;color:#2c2a27;line-height:1.35}
.m-sub{font-size:13px;color:#9a9288;margin-top:5px}
.m-tags{display:flex;gap:6px;flex-wrap:wrap;margin-top:11px}
.m-tags .tag.count{background:#fff3e4;color:#ff935c;font-weight:700}
.m-body{padding:17px 24px}
.d-row{display:flex;gap:10px;padding:7px 0;border-bottom:1px dashed #f2ece2;font-size:13px}
.d-row .d-k{flex:0 0 112px;color:#a0988c}
.d-row .d-v{flex:1;color:#4a453e;line-height:1.5;word-break:break-word}
.d-block{margin-top:11px}
.d-block .d-k{font-size:12px;color:#a0988c;margin-bottom:3px}
.d-block .d-v{font-size:13px;color:#4a453e;line-height:1.6;background:#fffaf3;padding:9px 12px;border-radius:9px;word-break:break-word}
.d-block .d-v.cond{background:#f2f8ff;border-left:3px solid #8fb8e8;white-space:pre-line}
.d-block .d-v.exam{background:#fff8ee;border-left:3px solid #f0b27a;white-space:pre-line}
.d-block .d-v.note{color:#a0988c;font-size:12px}
.m-foot{display:flex;gap:10px;align-items:center;padding:15px 24px 22px;border-top:1px solid #f7f2ea;flex-wrap:wrap}
.m-src{font-size:11px;color:#b9b1a6;max-width:100%}
.m-cd{margin:2px 24px 0;padding:7px 12px;background:#fff3e4;border-radius:9px;font-size:13px;font-weight:700;color:#e8590c;display:inline-block}
.m-link{flex:1;background:linear-gradient(135deg,#ffb35c,#ff935c);color:#fff;text-align:center;padding:12px 16px;border-radius:12px;font-size:14px;font-weight:700;box-shadow:0 3px 12px rgba(255,147,92,.3)}
.m-no-link{flex:1;color:#a0988c;text-align:center;font-size:13px}
.m-close2{background:#f7f2ea;color:#6b6359;border:none;padding:12px 18px;border-radius:12px;font-size:13px;font-weight:600;cursor:pointer}
.j-btm{display:flex;justify-content:space-between;align-items:center;margin-top:10px;gap:8px;flex-wrap:wrap}.j-duty{font-size:11px;color:#a0988c;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:55%}
.j-link{background:linear-gradient(135deg,#ffb35c,#ff935c);color:#fff;padding:6px 13px;border-radius:9px;font-size:12px;font-weight:600;white-space:nowrap;box-shadow:0 2px 8px rgba(255,147,92,.25)}.j-link:hover{filter:brightness(1.05)}
.panel{background:#fff;border-radius:18px;padding:20px;box-shadow:0 2px 12px rgba(120,100,70,.08);border:1px solid #f6efe4}
.match-panel h2{font-size:16px;margin-bottom:3px;color:#2c2a27}.match-panel .hint{font-size:11px;color:#a0988c;margin-bottom:13px}
.match-panel label{display:block;font-size:12px;color:#6b6359;margin-bottom:12px;font-weight:500}
.match-panel input,.match-panel select{width:100%;margin-top:4px;padding:8px 10px;border:1.5px solid #f0e4d2;border-radius:10px;font-size:13px;background:#fffdf9}.match-panel input:focus,.match-panel select:focus{outline:none;border-color:#ffb35c;box-shadow:0 0 0 3px rgba(255,179,92,.15)}
.match-panel label.chk{display:flex;align-items:center;gap:7px;color:#4a453e;font-weight:400}.match-panel label.chk input{width:auto;margin:0;accent-color:#ff935c}
.city-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}.chip{padding:4px 11px;border:1.5px solid #f0e4d2;border-radius:18px;font-size:11px;cursor:pointer;color:#8a8175;user-select:none;background:#fffdf9;transition:all .15s}.chip.on{background:linear-gradient(135deg,#ffb35c,#ff935c);color:#fff;border-color:transparent;box-shadow:0 2px 7px rgba(255,147,92,.3)}
.match-result{margin-top:13px;font-size:12px}.match-result .s-head2{font-size:13px;font-weight:700;margin-bottom:8px}.match-result .s-head2 b{color:#ff935c}.match-result .g-item{margin-bottom:8px}.match-result .g-item b{display:block;margin-bottom:3px;color:#e08a3c}.match-result .g-job{padding:3px 0;border-bottom:1px dashed #f2ece2;font-size:11px}.match-result .g-job u{color:#3c8a5e;margin-left:3px}
.pager{margin-top:16px;text-align:center}.pager button{margin:0 3px;padding:7px 13px;border:1.5px solid #f0e4d2;border-radius:10px;background:#fff;font-size:13px;color:#6b6359;cursor:pointer;transition:all .15s}.pager button:hover{border-color:#ffb35c;color:#ff935c}.pager button.on{background:linear-gradient(135deg,#ffb35c,#ff935c);color:#fff;border-color:transparent;box-shadow:0 2px 8px rgba(255,147,92,.3)}.empty-hint{text-align:center;padding:36px 16px;color:#a0988c}
.btn-major-expand{margin-top:7px;background:#fff7ee;border:1.5px dashed #f3cfa6;border-radius:9px;padding:6px 10px;font-size:12px;color:#e08a3c;cursor:pointer;width:100%;text-align:center;transition:background .15s}
.btn-major-expand:hover{background:#fff0e3}
.major-panel{margin-top:9px;border:1.5px solid #f3e4cf;border-radius:11px;padding:11px;background:#fffaf4;max-height:260px;overflow-y:auto}
.major-panel .m-grp{font-size:11px;font-weight:700;color:#e08a3c;margin:8px 0 4px}
.major-panel .m-chip{display:inline-block;padding:3px 10px;margin:2px 3px;border:1.5px solid #f0e4d2;border-radius:14px;font-size:12px;cursor:pointer;color:#6b6359;background:#fff;transition:all .12s}
.major-panel .m-chip:hover{border-color:#ffb35c;color:#e08a3c;background:#fff7ee}
.major-panel .m-chip.sel{background:linear-gradient(135deg,#ffb35c,#ff935c);color:#fff;border-color:transparent}
.tl-wrap{padding:4px 2px 10px}
.tl-head{background:linear-gradient(135deg,#fff8ee,#fdeedb 60%,#e8f2fd);color:#3d3a36;border-radius:16px;padding:17px 19px;margin-bottom:15px;border:1px solid #f3e0c8}
.tl-head b{font-size:16px;color:#2c2a27}.tl-sub{display:block;font-size:11px;color:#a0988c;margin-top:4px}
.tl-line{position:relative;padding-left:24px}
.tl-line:before{content:'';position:absolute;left:8px;top:6px;bottom:6px;width:3px;border-radius:3px;background:linear-gradient(#ffb35c,#8fb8e8)}
.tl-item{position:relative;margin-bottom:14px}
.tl-item:before{content:'';position:absolute;left:-20px;top:8px;width:12px;height:12px;border-radius:50%;background:linear-gradient(135deg,#ffb35c,#ff935c);border:2px solid #fff;box-shadow:0 0 0 2px #ffd8b8}
.tl-time{font-size:11px;font-weight:700;color:#e08a3c;margin-bottom:3px}
.tl-card{background:#fff;border:1px solid #f3e8d8;border-left:3px solid #ffb35c;border-radius:11px;padding:11px 14px}
.tl-top{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:5px}
.tl-top b{font-size:13px;color:#2c2a27}
.tl-phase{font-size:10px;color:#fff;background:linear-gradient(135deg,#ffb35c,#ff935c);border-radius:10px;padding:1px 8px}
.tl-desc{font-size:12px;color:#6b6359;line-height:1.6}
.tl-note{background:#fff9ef;border:1px dashed #f0c98f;border-radius:10px;padding:10px 13px;font-size:12px;color:#8a6a3a;line-height:1.65;margin-top:11px}
.tl-note b{color:#e08a3c}
.profile-bar{display:flex;gap:5px;align-items:center;margin-bottom:7px}
#profileSel{flex:1;padding:7px 9px;border:1.5px solid #f0e4d2;border-radius:9px;font-size:12px;background:#fffdf9}
.btn-mini{padding:6px 10px;border:1.5px solid #ffb35c;background:#fff;color:#e08a3c;border-radius:8px;font-size:11px;cursor:pointer;white-space:nowrap;transition:all .15s}
.btn-mini:hover{background:#fff7ee}
.btn-mini.danger{border-color:#e8b4b0;color:#c96882}
.btn-mini.danger:hover{background:#fdeef0}
.qual-chips{display:flex;flex-wrap:wrap;gap:5px;margin-top:5px}
.qual-chips .chip{padding:3px 10px;border:1.5px solid #f0e4d2;border-radius:15px;font-size:11px;cursor:pointer;background:#fffdf9;color:#8a8175;transition:all .12s}
.qual-chips .chip.on{background:linear-gradient(135deg,#ffb35c,#ff935c);color:#fff;border-color:transparent}
@media (max-width:820px){.layout{grid-template-columns:1fr}.match-panel{order:-1}.j-duty{max-width:100%}}
</style>
</head>
<body>
<header class="header"><div class="header-inner">
  <div class="brand"><span class="logo">粤</span><div class="brand-text"><b>粤职通</b><span>公职岗位智能匹配</span></div></div>
  <nav class="nav"><a href="#" class="nav-link on" data-cat="">全部</a><a href="#" class="nav-link" data-cat="sydw">事业编</a><a href="#" class="nav-link" data-cat="gwy">公务员</a><a href="#" class="nav-link" data-cat="soe">央国企</a><a href="#" class="nav-link" data-cat="teacher">教师</a><a href="#" class="nav-link" data-cat="timeline">备考时间线</a></nav>
  <div class="stats">岗位库 <b id="statTotal">${slim.length}</b> 个 <span class="fresh-badge" title="数据最后更新时间（每天 08:00 / 18:00 自动采集更新）">🕒 ${BUILD_TIME}</span></div>
</div></header>
<div class="search-bar">
  <div class="search-inner"><input id="searchInput" type="text" placeholder="搜索岗位 / 单位 / 专业，如「博物馆」「电网」…"><button id="searchBtn" class="btn-primary">🔍 搜索</button></div>
  <div class="filters"><select id="fCity"><option value="">全部城市</option></select><select id="fCat"><option value="">全部类别</option><option value="sydw">事业编</option><option value="soe">央国企</option><option value="gwy">公务员</option><option value="teacher">教师</option><option value="rcyj">人才引进</option></select></div>
</div>
<main class="layout">
  <section class="list-panel">
    <div id="cdPanel" class="cd-panel" style="display:none">
      <div class="cd-head">⏳ 报名倒计时 <span class="cd-sub">在招岗位按截止日期排序</span></div>
      <div id="cdList" class="cd-list"></div>
    </div>
    <div class="list-head"><span>搜索结果</span><span>共 <b id="totalCount">0</b> 个岗位</span></div>
    <div id="jobList" class="job-list"></div>
    <div id="pager" class="pager"></div>
  </section>
  <aside class="panel match-panel">
    <h2>🎯 按我的条件匹配</h2><p class="hint">保存多套「脸谱」画像，一键切换快速匹配</p>
    <div class="profile-bar"><select id="profileSel"><option value="">— 我的画像 —</option></select><button type="button" id="profileNew" class="btn-mini">➕ 新建</button><button type="button" id="profileSave" class="btn-mini">💾 保存</button><button type="button" id="profileDel" class="btn-mini danger">🗑️</button></div>
    <input id="profileName" placeholder="画像名称（如：我的主画像 / 党员版）" style="width:100%;margin:6px 0 10px;padding:6px 9px;border:1px solid #d7dee6;border-radius:7px;font-size:12px">
    <label>学历<select id="degree"><option value="博士">博士</option><option value="硕士" selected>硕士</option><option value="本科">本科</option><option value="大专">大专</option></select></label>
    <label>毕业学校层级<select id="schoolTier"><option value="双一流/211/985">985/211/双一流</option><option value="双非一本">双非一本</option><option value="普通本科">普通本科</option><option value="大专/职校">大专/职校</option></select></label>
    <label>专业名称<input id="majorName" value="中国史（历史文献学）" placeholder="如 中国史 / 计算机" list="prof-list"><datalist id="prof-list"></datalist>
      <button type="button" id="majorExpandBtn" class="btn-major-expand">▾ 展开全部专业选择</button>
      <div id="majorPanel" class="major-panel" style="display:none"></div>
    </label>
    <label>政治面貌<select id="political"><option value="共青团员" selected>共青团员</option><option value="中共党员">中共党员</option><option value="群众">群众</option></select></label>
    <label class="chk"><input type="checkbox" id="isFresh" checked> 应届毕业生</label>
    <label>职业资格<div class="qual-chips" id="qualChips"><span class="chip" data-q="教师资格证">📜 教资</span><span class="chip" data-q="普通话二甲">🗣️ 普通话二甲</span><span class="chip" data-q="英语六级">🇬🇧 英语六级</span><span class="chip" data-q="计算机二级">💻 计算机二级</span><span class="chip" data-q="初级会计">💰 初级会计</span></div></label>
    <label>偏好城市<div class="city-chips" id="cityChips"><span class="chip on" data-c="广州">广州</span><span class="chip on" data-c="深圳">深圳</span><span class="chip on" data-c="佛山">佛山</span><span class="chip on" data-c="东莞">东莞</span><span class="chip on" data-c="珠海">珠海</span></div></label>
    <label class="chk"><input type="checkbox" id="strictOnly"> 只看严格对口（排除专业不限）</label>
    <button id="matchBtn" class="btn-primary big">🚀 匹配可报岗位</button>
    <div id="matchResult" class="match-result"></div>
  </aside>
</main>
<script>window.__DB__=${dbJson};</script>
<script>window.__ANN__=${JSON.stringify(announceArr)};</script>
<script>${MATCHER}</script>
<script>
(function(){
  var DB=window.__DB__; var ANN=window.__ANN__||[]; var PROFESSION=${JSON.stringify(PROFESSION)}; var MATCH=window.YZTMatch.matchAll;
  var $=function(id){return document.getElementById(id);};
  var curPage=1, PAGE_SIZE=15;
  var matchList=[], matchMode=false; // 精准匹配模式：主列表=匹配结果
  var CITIES=['广州','深圳','珠海','佛山','东莞','中山','惠州','肇庆','韶关','湛江','茂名','江门'];
  // 专业
  var dl=$('prof-list'); Object.keys(PROFESSION).forEach(function(p){var o=document.createElement('option');o.value=p;dl.appendChild(o);});
  // 专业展开面板：按大类分组展示全部专业
  var CATS=[['🀄 文史哲',['历史','考古','文物','博物馆','文博','文献','古籍','汉语言','中文','汉语','语言','文学','新闻','传播','哲学','经典','秘书','国际中文']],
    ['⚖️ 法学政治',['法学','法律','政治','社会','思想','马克思主义']],
    ['🖥️ 计算机信息',['计算机','软件','网络','信息安全','电子','通信','信息','人工智能','数据','大数据','网络空间']],
    ['🔢 数理化生',['数学','物理','化学','生物','地理','地质','统计','理学']],
    ['🏗️ 工程建筑',['机械','电气','土木','建筑','城乡','水利','测绘','材料','环境','食品','交通运输','工程造','安全科学']],
    ['💰 经管会计',['会计','财务','审计','工商','企业管理','人力资源','市场','管理科学','工程管理','行政管理','公共管理','图书馆','档案','情报','金融','经济','管理学']],
    ['🏥 医学',['临床','内科','外科','儿科','麻醉','影像','护理','中医','中西医','药学','公共卫生','口腔','基础医学','医学']],
    ['📚 教育心理',['教育','小学','学前','课程','学科教学','心理','体育','教育学']],
    ['🎨 艺术',['美术','音乐','设计','艺术']],
    ['🌾 农林兽医',['农学','林学','水产','兽医','农业']],
    ['🌍 外语',['英语','日语','外语','英语笔译','英语口译','商务英语']]];
  var majorPanelHtml='';
  CATS.forEach(function(g){majorPanelHtml+='<div class="m-grp">'+g[0]+'</div>';g[1].forEach(function(kw){
    Object.keys(PROFESSION).forEach(function(p){ if(p.indexOf(kw)>-1) majorPanelHtml+='<span class="m-chip" data-m="'+p+'">'+p+'</span>'; });
  });});
  var mp=$('majorPanel'); if(mp) mp.innerHTML=majorPanelHtml;
  var expandBtn=$('majorExpandBtn');
  if(expandBtn) expandBtn.addEventListener('click',function(){
    var show=mp.style.display==='none';mp.style.display=show?'block':'none';expandBtn.textContent=show?'▴ 收起专业选择':'▾ 展开全部专业选择';
  });
  if(mp) mp.addEventListener('click',function(e){
    var chip=e.target.closest('.m-chip'); if(!chip)return;
    var sel=chip.classList.contains('sel');
    document.querySelectorAll('#majorPanel .m-chip').forEach(function(x){x.classList.remove('sel');});
    if(!sel){$('majorName').value=chip.dataset.m;chip.classList.add('sel');}
    else{$('majorName').value='';}
  });
  // 城市筛选
  var fCity=$('fCity'); CITIES.forEach(function(c){var o=document.createElement('option');o.value=c;o.textContent=c;fCity.appendChild(o);});
  document.querySelectorAll('.chip').forEach(function(c){c.classList.add('on');c.addEventListener('click',function(){c.classList.toggle('on');});});
  document.querySelectorAll('.nav-link').forEach(function(a){a.addEventListener('click',function(e){e.preventDefault();document.querySelectorAll('.nav-link').forEach(function(x){x.classList.remove('on');});a.classList.add('on');$('fCat').value=a.dataset.cat||'';curPage=1;if(matchMode)exitMatch();render();});});
  $('searchBtn').addEventListener('click',function(){curPage=1;if(matchMode)exitMatch();render();});
  $('searchInput').addEventListener('keydown',function(e){if(e.key==='Enter'){curPage=1;if(matchMode)exitMatch();render();}});
  fCity.addEventListener('change',function(){curPage=1;if(matchMode)exitMatch();render();});
  $('fCat').addEventListener('change',function(){var v=$('fCat').value;document.querySelectorAll('.nav-link').forEach(function(x){x.classList.toggle('on',x.dataset.cat===v);});curPage=1;if(matchMode)exitMatch();render();});
  $('matchBtn').addEventListener('click',doMatch);
  // ===== 多套画像（脸谱）管理 =====
  var PROFILES_KEY='yzt_profiles_v1', ACTIVE_KEY='yzt_active_profile_v1';
  function readProfiles(){ try{ return JSON.parse(localStorage.getItem(PROFILES_KEY)||'{}'); }catch(e){ return {}; } }
  function writeProfiles(p){ try{ localStorage.setItem(PROFILES_KEY,JSON.stringify(p)); }catch(e){} }
  function qualSel(){ return Array.prototype.map.call(document.querySelectorAll('#qualChips .chip.on'),function(c){return c.dataset.q;}); }
  function collectProfile(){ return { degree:$('degree').value, schoolTier:$('schoolTier').value, majorName:$('majorName').value.trim(), political:$('political').value, isFresh:$('isFresh').checked, cities:selCities(), quals:qualSel(), strictOnly:!!($('strictOnly')&&$('strictOnly').checked) }; }
  function applyProfile(p){
    if(!p) return;
    $('degree').value=p.degree||'硕士'; $('schoolTier').value=p.schoolTier||'双一流/211/985';
    $('majorName').value=p.majorName||'';
    $('political').value=p.political||'共青团员'; $('isFresh').checked=p.isFresh!==false;
    document.querySelectorAll('#cityChips .chip').forEach(function(c){ c.classList.toggle('on', (p.cities||[]).indexOf(c.dataset.c)>-1); });
    document.querySelectorAll('#qualChips .chip').forEach(function(c){ c.classList.toggle('on', (p.quals||[]).indexOf(c.dataset.q)>-1); });
    if($('strictOnly')) $('strictOnly').checked=!!p.strictOnly;
  }
  function refreshProfileSel(){
    var sel=$('profileSel'); var profs=readProfiles(); var cur=sel.value;
    sel.innerHTML='<option value="">— 我的画像 —</option>';
    Object.keys(profs).forEach(function(n){ var o=document.createElement('option'); o.value=n; o.textContent=n; sel.appendChild(o); });
    if(cur && profs[cur]) sel.value=cur;
    else sel.value=localStorage.getItem(ACTIVE_KEY)||'';
  }
  function saveProfile(){
    var name=($('profileName').value||'').trim(); if(!name){ $('profileName').placeholder='请先输入画像名称'; return; }
    var profs=readProfiles(); profs[name]=collectProfile(); writeProfiles(profs);
    localStorage.setItem(ACTIVE_KEY,name); refreshProfileSel(); $('profileSel').value=name;
    $('profileName').value='';
    var hint=$('matchResult'); if(hint) hint.innerHTML='<div class="g-note">✅ 画像「'+name+'」已保存（共 '+Object.keys(profs).length+' 套）</div>';
  }
  function loadProfile(){
    var name=$('profileSel').value; if(!name){ return; }
    var profs=readProfiles(); var p=profs[name]; if(!p){ return; }
    applyProfile(p); localStorage.setItem(ACTIVE_KEY,name);
    var hint=$('matchResult'); if(hint) hint.innerHTML='<div class="g-note">📋 已切换到画像「'+name+'」，点击 🚀 匹配</div>';
  }
  function deleteProfile(){
    var name=$('profileSel').value; if(!name) return;
    var profs=readProfiles(); delete profs[name]; writeProfiles(profs);
    refreshProfileSel(); $('profileName').value='';
    var hint=$('matchResult'); if(hint) hint.innerHTML='<div class="g-note">🗑️ 已删除画像「'+name+'」</div>';
  }
  // 资格 chips 切换
  document.querySelectorAll('#qualChips .chip').forEach(function(c){ if(!c.dataset.q) return; c.addEventListener('click',function(){ c.classList.toggle('on'); }); });
  $('profileNew').addEventListener('click',function(){ $('profileName').value=''; $('profileName').focus(); $('profileSel').value=''; });
  $('profileSave').addEventListener('click',saveProfile);
  $('profileDel').addEventListener('click',deleteProfile);
  $('profileSel').addEventListener('change',loadProfile);
  // 启动时恢复上次激活画像
  (function(){ refreshProfileSel(); var act=localStorage.getItem(ACTIVE_KEY); if(act){ var profs=readProfiles(); if(profs[act]) applyProfile(profs[act]); } })();
  function curCat(){var el=document.querySelector('.nav-link.on');return el?el.dataset.cat:($('fCat').value||'');}
  function selCities(){return Array.prototype.map.call(document.querySelectorAll('.chip.on'),function(c){return c.dataset.c;});}
  function search(){
    var q=($('searchInput').value||'').trim().toLowerCase(), cat=curCat(), city=$('fCity').value;
    var res=[];
    for(var i=0;i<DB.length;i++){var p=DB[i];
      if(cat && p.cat!==cat) continue;
      if(city && !((p.c||'').indexOf(city)>-1)) continue;
      if(q){var hay=((p.u||'')+(p.n||'')+(p.d||'')+(p.a||'')).toLowerCase(); if(hay.indexOf(q)<0) continue;}
      res.push(p);
    }
    // 排序：在招>即将>待核实(无状态)>已截止；同状态保持原序（先入库的新岗位在前）
    var w={在招:0,即将:1,'':2}; // ''=报名时间待核实
    res.sort(function(a,b){
      var sa=a.st||'',sb=b.st||'';
      var wa=(sa==='已截止')?3:((w[sa]!==undefined)?w[sa]:2);
      var wb=(sb==='已截止')?3:((w[sb]!==undefined)?w[sb]:2);
      return wa-wb;
    });
    return res;
  }
  var catLabel={sydw:'事业编',soe:'央国企',gwy:'公务员',teacher:'教师',rcyj:'人才引进'};
  // 类别计数（顶部 stats 显示各类别数量，让用户清楚类别分布）
  (function(){
    var counts={all:DB.length,sydw:0,gwy:0,soe:0,teacher:0,rcyj:0};
    DB.forEach(function(p){counts[p.cat]=(counts[p.cat]||0)+1;});
    var st=$('statTotal'); if(st) st.textContent=counts.all;
    document.querySelectorAll('.nav-link').forEach(function(a){
      var cat=a.dataset.cat||'all';
      if(cat==='timeline') return;
      a.title=(a.textContent+' '+counts[cat]+'个');
    });
  })();
  function renderCountdown(){
    var panel=$('cdPanel'),list=$('cdList');if(!panel||!list)return;
    var now=new Date();now.setHours(12,0,0,0);
    var items=[];
    DB.forEach(function(p){
      if(!(p.st==='在招'||p.st==='即将'))return;
      if(!p.batch)return;
      var bm=String(p.batch).match(/(20\\d{2})年(\\d{1,2})月(\\d{1,2})日/);
      if(!bm)return;
      var end=new Date(+bm[1],+bm[2]-1,+bm[3],23,59,59);
      if(end<now)return;
      var days=Math.round((end-now)/86400000);
      items.push({p:p,days:days});
    });
    items.sort(function(a,b){return a.days-b.days;});
    items=items.slice(0,10);
    if(!items.length){panel.style.display='none';return;}
    panel.style.display='block';
    var html='';
    items.forEach(function(it){
      var p=it.p,d=it.days;
      var cls=d<=5?'cd-hot':(d<=15?'cd-ok':'');
      html+='<div class="cd-item" data-i="'+DB.indexOf(p)+'">'+
        '<span class="cd-days '+cls+'">'+(d<=0?'今日截止':d+' 天')+'</span>'+
        '<span class="cd-u">'+esc(p.u||'')+'</span>'+
        '<span class="cd-n">'+esc((p.n||'').slice(0,34))+'</span>'+
        '<span class="cd-d">'+esc(p.batch.replace(/至/,'至 '))+'</span></div>';
    });
    list.innerHTML=html;
  }
  function render(){
    if(matchMode){ renderMatch(); return; }
    if(curCat()==='timeline'){ renderTimeline(); return; }
    renderCountdown();
    var all=search(), total=all.length; $('totalCount').textContent=total;
    var pages=Math.max(1,Math.ceil(total/PAGE_SIZE)); if(curPage>pages)curPage=pages;
    var slice=all.slice((curPage-1)*PAGE_SIZE,curPage*PAGE_SIZE);
    var list=$('jobList'); list.innerHTML='';
    if(!slice.length){list.innerHTML='<div class="empty-hint">未找到匹配岗位，试试更换关键词</div>';$('pager').innerHTML='';return;}
    slice.forEach(function(p){
      var div=document.createElement('div');div.className='job cat-'+(p&&p.cat||'x');
      var city=p.c||'—',edu=p.e||'不限',pol=p.pl&&p.pl!=='nan'?p.pl:'不限',count=p.hc?('招'+p.hc):(p.cat==='soe'?'':'人数待定');
      var major=p.a||'',duty=(p.d||'').slice(0,50),cl=catLabel[p.cat]||'';
      var lvCls={A:'lv-a',B:'lv-b',C:'lv-c',D:'lv-d'}[p.lv]||'lv-x';
      var lvTxt={A:'A·官网原文',B:'B·官方平台',C:'C·第三方',D:'D·历史推算'}[p.lv]||(p.lv?p.lv:'等级未知');
      var trTxt={'国企主攻':'🏛️ 国企主攻','教师保底':'🧑‍🏫 教师保底','公务员升级':'🏛️ 公务员升级','文博保险':'🏺 文博保险','人才引进':'🌟 人才引进','民企补充':'🏢 民企补充','选调':'🎓 选调'}[p.tr]||(p.tr||'');
      var st=p.st||(p.batch?'':'待核实');
      var stCls=st==='在招'?'st-open':st==='即将'?'st-soon':st==='已截止'?'st-closed':'st-wait';
      var stTxt=st==='已截止'?'已截止':st==='即将'?'即将报名':st==='在招'?'在招':'报名时间待核实';
      div.innerHTML='<div class="j-top"><span class="j-unit">'+(p.u||'未知单位').slice(0,30)+'</span><span class="j-count">'+count+'</span></div>'+
        '<div class="j-position">'+(p.n||'').slice(0,40)+'</div>'+
        '<div class="j-tags"><span class="lv '+lvCls+'">'+lvTxt+'</span>'+(trTxt?'<span class="tag track">'+trTxt+'</span>':'')+'<span class="status '+stCls+'">'+stTxt+'</span><span class="tag city">'+city+'</span><span class="tag edu">'+edu+'</span>'+(pol!=='不限'?'<span class="tag pol">'+pol.slice(0,9)+'</span>':'')+(cl?'<span class="tag">'+cl+'</span>':'')+'</div>'+
        (p.batch?'<div class="j-batch">🗓️ 报名：'+p.batch+'</div>':'')+
        (major?'<div class="j-major">📌 专业：'+major.slice(0,90)+'</div>':'')+
        '<div class="j-btm"><span class="j-duty">'+duty+'</span><span class="j-view">👁️ 查看详情</span>'+(p.u2?'<a class="j-link" href="'+p.u2+'" target="_blank" rel="noopener" data-stop>📄 官方原文 ↗</a>':'')+'</div>';
      div.addEventListener('click',function(e){if(e.target.closest('[data-stop]'))return;openModal(p);});
      list.appendChild(div);
    });
    $('pager').innerHTML='';
    if(pages>1){
      var totalPg=Math.min(pages,8),startPg=Math.max(1,Math.min(curPage-3,totalPg-7));
      // 上一页
      if(curPage>1){var bPrev=document.createElement('button');bPrev.textContent='‹';bPrev.addEventListener('click',function(){curPage--;render();});$('pager').appendChild(bPrev);}
      // 页码（用闭包函数捕获每页值，避免 var 共享）
      for(var i=startPg;i<=Math.min(pages,startPg+7);i++){(function(pg){var b=document.createElement('button');b.textContent=pg;if(pg===curPage)b.className='on';b.addEventListener('click',function(){curPage=pg;render();});$('pager').appendChild(b);})(i);}
      // 下一页
      if(curPage<totalPg){var bNext=document.createElement('button');bNext.textContent='›';bNext.addEventListener('click',function(){curPage++;render();});$('pager').appendChild(bNext);}
    }
  }
  // 备考时间线（2027届四线备考关键节点）
  function renderTimeline(){
    $('totalCount').textContent='—';
    var list=$('jobList'); list.innerHTML='';
    var html='<div class="tl-wrap">'+
      '<div class="tl-head"><b>🎓 2027届 · 广东公职四线备考时间线</b><span class="tl-sub">（按往年规律推算，具体以当年公告为准）</span></div>'+
      '<div class="tl-line">'+
      tlItem('2026-06 ~ 2026-08','🌟 暑期准备期','确定 4 条主攻线目标；备齐 教师资格证（笔试）报名材料；开始刷行测基础（粉笔/华图）；整理党员/奖助学金/学生干部资历','D·历年规律','备战期')+
      tlItem('2026-09 ~ 2026-10','🏛️ 央国企秋招（国企主攻线）','南网/中广核/铁投/广晟/南方传媒央企国企秋招网申+笔试；国聘网(iguopin)实时岗位每日刷新；同时关注 广东事业单位统考公告','A·官网原文','网申期')+
      tlItem('2026-11 ~ 2026-12','📜 国考 + 广东选调（公务员升级线）','国考报名(11月)；广东省选调优秀大学毕业生 报名(12月初，限制高校)；选调职位表按 A06 历史学类 查询对口职位','D·历年规律','报名笔试期')+
      tlItem('2027-01 ~ 2027-02','✍️ 广东省考 报名（公务员主力）','广东省考公告(1月)发布 → 职位表(附件1) → 按专业代码筛选可报职位；同步 教师资格证笔试(3月)备考','D·历年规律','报名期')+
      tlItem('2027-03 ~ 2027-04','🏛️ 广东省考笔试 + 教师编制','省考笔试(3月)；各地教师招聘(广州/深圳/佛山公办编制) 报名；省考成绩(4月)','D·历年规律','考试期')+
      tlItem('2027-04 ~ 2027-05','🏺 广东事业单位统考（事业编线）','广东事业单位集中招聘 公告(4月) → 职位表5表(含中央驻粤/专项)→ 5维匹配报名；文博线：博物馆/纪念馆/档案馆岗位集中在此','D·历年规律','报名期')+
      tlItem('2027-06 ~ 2027-07','✅ 事业编统考笔试 + 面试','事业编统考笔试(5-6月)；省考面试(6月)；央国企补招；教师资格证面试(5月)','D·历年规律','面试期')+
      tlItem('2027-08 ~ 2027-09','🎯 应届上岸冲刺','事业单位面试/体检/政审；2027秋招提前批（银行/国企）；选调/省考补录','D·历年规律','上岸期')+
      '</div>'+
      '<div class="tl-note">💡 四线并行策略：<b>国企主攻</b>(南网/国聘/铁路) ｜ <b>教师保底</b>(教资+公办编制) ｜ <b>公务员升级</b>(国考/省考/选调) ｜ <b>文博保险</b>(博物馆/纪念馆/档案馆，历史考古对口)。多线并行互不冲突，任一线上岸即保底。</div>'+
      '<div class="tl-note">⏰ 每日自动更新：本库 2 万+ 广东公职岗位（公务员/事业编/央国企/教师）每 30 分钟增量采集，报名窗口实时刷新。</div>'+
      '</div>';
    list.innerHTML=html;
    $('pager').innerHTML='';
  }
  function tlItem(ts,t,desc,lv,phase){
    return '<div class="tl-item"><div class="tl-time">'+ts+'</div><div class="tl-card"><div class="tl-top"><b>'+t+'</b><span class="tl-phase">'+phase+'</span><span class="lv lv-'+(lv.charAt(0).toLowerCase())+'">'+lv+'</span></div><div class="tl-desc">'+desc+'</div></div></div>';
  }
  // 精准匹配模式：主列表=全部匹配岗位，带分数徽章
  function renderMatch(){
    var total=matchList.length; $('totalCount').textContent=total;
    var pages=Math.max(1,Math.ceil(total/PAGE_SIZE)); if(curPage>pages)curPage=pages;
    var slice=matchList.slice((curPage-1)*PAGE_SIZE,curPage*PAGE_SIZE);
    var list=$('jobList'); list.innerHTML='';
    var banner=document.createElement('div');
    banner.className='match-banner';
    banner.innerHTML='🎯 <b>精准匹配模式</b>：为你量身筛选的 '+total+' 个可报岗位<button class="btn-exit" id="btnExitMatch2">✕ 返回全部岗位</button>';
    list.appendChild(banner);
    slice.forEach(function(p){
      var div=document.createElement('div');div.className='job cat-'+(p&&p.cat||'x');
      var city=p.c||'—',edu=p.e||'不限',pol=p.pl&&p.pl!=='nan'?p.pl:'不限',count=p.hc?('招'+p.hc):(p.cat==='soe'?'':'人数待定');
      var major=p.a||'',duty=(p.d||'').slice(0,50),cl=catLabel[p.cat]||'';
      var lvCls={A:'lv-a',B:'lv-b',C:'lv-c',D:'lv-d'}[p.lv]||'lv-x';
      var lvTxt={A:'A·官网原文',B:'B·官方平台',C:'C·第三方',D:'D·历史推算'}[p.lv]||(p.lv?p.lv:'等级未知');
      var sc=Number(p.score)||0;
      // 单文件版 matcher_browser 为百分制(0-100)
      var scCls=sc>=85?'sc-a':sc>=75?'sc-b':sc>=60?'sc-c':'sc-d';
      var scTxt=sc>=85?'强对口':sc>=75?'高匹配':sc>=60?'可投':'待核实';
      div.innerHTML='<div class="j-top"><span class="j-unit">'+(p.u||'未知单位').slice(0,28)+'</span><span class="score-badge '+scCls+'">'+sc.toFixed(1)+'分 · '+scTxt+'</span></div>'+
        '<div class="j-position">'+(p.n||'').slice(0,40)+'</div>'+
        '<div class="j-tags"><span class="lv '+lvCls+'">'+lvTxt+'</span><span class="tag city">'+city+'</span><span class="tag edu">'+edu+'</span>'+(cl?'<span class="tag">'+cl+'</span>':'')+'</div>'+
        (major?'<div class="j-major">📌 专业：'+major.slice(0,90)+'</div>':'')+
        '<div class="j-btm"><span class="j-duty">'+duty+'</span><span class="j-view">👁️ 查看详情</span>'+(p.u2?'<a class="j-link" href="'+p.u2+'" target="_blank" rel="noopener" data-stop>📄 官方原文 ↗</a>':'')+'</div>';
      div.addEventListener('click',function(e){if(e.target.closest('[data-stop]'))return;openModal(p);});
      list.appendChild(div);
    });
    var eb=document.getElementById('btnExitMatch2');
    if(eb)eb.addEventListener('click',exitMatch);
    $('pager').innerHTML='';
    if(pages>1){for(var i=1;i<=Math.min(pages,8);i++){var b=document.createElement('button');b.textContent=i;if(i===curPage)b.className='on';b.addEventListener('click',function(){curPage=i;renderMatch();});$('pager').appendChild(b);}}
  }
  function exitMatch(){ matchMode=false; matchList=[]; curPage=1; var box=$('matchResult'); if(box)box.innerHTML='<div class="s-head2">已退出匹配模式</div>'; render(); }
  function grade(it){var m=it.a||'';if(/A06(0?104)|古籍|文献学|敦煌|古文字/.test(m))return '强对口';if(/博物馆|纪念馆|考古|文物|文化遗产/.test((it.u||'')+m))return '文博馆方向';if(/历史学\\(A06\\)|历史学类|A06/.test(m))return '历史学大类';return '相近大类';}
  function doMatch(){
    var majorInput=$('majorName').value.trim();
    // 专业解析：精确命中词库 → 用其代码；未命中 → 模糊匹配最相近专业名 → 提示用户确认
    var majorCode=PROFESSION[majorInput];
    var matchedName=majorInput;
    if(!majorCode){
      var keys=Object.keys(PROFESSION);
      var best='', bestScore=0;
      for(var ki=0;ki<keys.length;ki++){
        var k=keys[ki];
        if(majorInput.length>=2){
          if(k.indexOf(majorInput)>-1){ best=k; bestScore=99; break; }
          if(majorInput.indexOf(k)>-1 && k.length>bestScore){ best=k; bestScore=k.length; }
        }
      }
      if(best){ majorCode=PROFESSION[best]; matchedName=best; }
      else { majorCode=null; matchedName=majorInput; }
    }
    if(!majorCode){
      $('matchResult').innerHTML='<div class="g-note">❌ 未识别专业「'+majorInput+'」，请从下拉列表选择或输入更常见的专业名（如 中国史/汉语言文学/计算机）</div>';
      return;
    }
    // 提示实际匹配的专业（模糊命中时）
    var hint=(matchedName!==majorInput)?('（已按「'+matchedName+'」匹配）'):'';
    var cust={degree:$('degree').value,majorName:matchedName,majorCode:majorCode,schoolTier:$('schoolTier')?$('schoolTier').value:'',political:$('political').value,isFresh:$('isFresh').checked,cities:selCities(),province:'广东省',quals:qualSel()};
    var box=$('matchResult');box.innerHTML='⏳ 匹配中…';
    setTimeout(function(){
      var res=MATCH(cust,DB);
      // 只看严格对口：排除专业要求为空的岗位（专业不限）
      var strictOnly=$('strictOnly') && $('strictOnly').checked;
      var filtered=res.matched;
      if(strictOnly){
        filtered=res.matched.filter(function(it){return it.a && String(it.a).trim();});
      }
      // 进入精准匹配模式：主列表 = 全部匹配岗位（按分数降序）
      matchList=filtered.slice().sort(function(a,b){return (b.score||0)-(a.score||0);});
      matchMode=true; curPage=1;
      var groups={'强对口':[],'文博馆方向':[],'历史学大类':[],'相近大类':[]};
      filtered.forEach(function(it){var g=it.way==='专业精准对口'?'强对口':grade(it);(groups[g]=groups[g]||[]).push(it);});
      var inner='<div class="s-head2">✅ 共匹配 <b>'+filtered.length+'</b> 个可报岗位 '+hint+(strictOnly?'（严格对口）':'')+'</div>';
      ['强对口','文博馆方向','历史学大类','相近大类'].forEach(function(k){
        var list=groups[k]||[];if(!list.length)return;
        var lbl={'强对口':'🎯 强对口','文博馆方向':'🏺 文博馆','历史学大类':'📚 历史学大类','相近大类':'🔸 相近大类'}[k];
        inner+='<div class="g-item"><b>'+lbl+' '+list.length+'</b>';
        list.slice(0,5).forEach(function(p){
          var dbIdx=DB.indexOf(p);
          inner+='<div class="g-job" data-i="'+dbIdx+'">'+(p.u||'').slice(0,16)+' '+(p.hc?('招'+p.hc+' '):'')+'<u>'+p.score+'分</u>'+(p.u2?' <a target="_blank" rel="noopener" href="'+p.u2+'" data-stop>📄</a>':'')+'</div>';
        });
        inner+='</div>';
      });
      inner+='<div class="g-note">👇 左侧列表已切换为全部匹配岗位</div>';
      box.innerHTML=inner;
      renderMatch();
    },50);
  }
  // ===== 详情弹窗（公考雷达式）=====
  function esc(s){return (s==null?'':String(s)).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  var LV_TXT={A:'A·官网原文',B:'B·官方平台',C:'C·第三方',D:'D·历史推算'};
  var LV_CLS={A:'lv-a',B:'lv-b',C:'lv-c',D:'lv-d'};
  var TR_TXT={'国企主攻':'🏛️ 国企主攻','教师保底':'🧑‍🏫 教师保底','公务员升级':'🏛️ 公务员升级','文博保险':'🏺 文博保险','人才引进':'🌟 人才引进','民企补充':'🏢 民企补充','选调':'🎓 选调'};
  var CAT_TXT={sydw:'事业编',gwy:'公务员',soe:'央国企',teacher:'教师'};
  function openModal(p){
    if(!p)return;
    var lv=LV_TXT[p.lv]||(p.lv||'等级未知'),lvCls=LV_CLS[p.lv]||'lv-x',tr=TR_TXT[p.tr]||(p.tr||''),cat=CAT_TXT[p.cat]||(p.sn||'');
    var st=p.st||(p.batch?'':'待核实');
    var stCls=st==='在招'?'st-open':st==='即将'?'st-soon':st==='已截止'?'st-closed':'st-wait';
    var rows=[['招聘单位',p.u],['岗位名称',p.n],['部门/科室',p.dp],['岗位代码',p.dc],['单位代码',p.uc],['岗位等级',p.gd],['招聘人数',p.hc?p.hc+'人':''],['学历要求',p.e],['学位要求',p.dd],['政治面貌',p.pl&&p.pl!=='nan'?p.pl:''],['考生类别',p.cd2&&p.cd2!=='nan'?p.cd2:''],['年龄',p.ag],['工作经历',p.ex],['专业要求',p.mj],['专业要求(本科)',p.mpu],['专业要求(研究生)',p.mpp],['专业要求(大专)',p.mpj],['工作地点',p.c||p.rg]]
      .filter(function(r){return r[1]&&String(r[1]).trim();});
    var rowHtml='';
    rows.forEach(function(r){rowHtml+='<div class="d-row"><span class="d-k">'+r[0]+'</span><span class="d-v">'+esc(r[1])+'</span></div>';});
    var duty=p.d?'<div class="d-block"><div class="d-k">岗位职责</div><div class="d-v">'+esc(p.d)+'</div></div>':'';
    // 备注/其他条件：内含网址则转可点链接
    function linkify0(s){
      if(!s)return'';
      return esc(s).replace(/(https?:\\/\\/[^\\s<"']+)/g,'<a href="$1" target="_blank" rel="noopener" style="color:#ff935c;word-break:break-all">$1</a>');
    }
    var nt=p.nt?'<div class="d-block"><div class="d-k">投递入口/备注</div><div class="d-v">'+linkify0(p.nt)+'</div></div>':'';
    var condHtml=p.ct?'<div class="d-block"><div class="d-k">📋 招聘/报考条件</div><div class="d-v cond">'+esc(p.ct)+'</div></div>':(p.cn?'<div class="d-block"><div class="d-k">📋 招聘/报考条件</div><div class="d-v cond note">'+esc(p.cn)+'</div></div>':'');
    var examHtml=p.et?'<div class="d-block"><div class="d-k">📝 考试内容（考什么）</div><div class="d-v exam">'+esc(p.et)+'</div></div>':'';
    // 公告表引用解析（瘦身版：条件/考情存在全局公告表 ANN，岗位按 ai 索引）
    if ((!condHtml || !examHtml) && p.ai !== undefined && p.ai >= 0 && ANN[p.ai]) {
      var ann = ANN[p.ai];
      if (!condHtml && ann.ct) condHtml = '<div class="d-block"><div class="d-k">📋 招聘/报考条件</div><div class="d-v cond">'+esc(ann.ct)+'</div></div>';
      if (!condHtml && ann.cn) condHtml = '<div class="d-block"><div class="d-k">📋 招聘/报考条件</div><div class="d-v cond note">'+esc(ann.cn)+'</div></div>';
      if (!examHtml && ann.et) examHtml = '<div class="d-block"><div class="d-k">📝 考试内容（考什么）</div><div class="d-v exam">'+esc(ann.et)+'</div></div>';
    }
    var ov=document.createElement('div');ov.className='modal-overlay';ov.id='jobModal';
    // 截止倒计时（batch "至 2026年10月31日" → 剩余天数）
    var countdown='';
    if(p.batch&&st==='在招'){
      var bm=p.batch.match(/(20\\d{2})年(\\d{1,2})月(\\d{1,2})日/);
      if(bm){var end=new Date(+bm[1],+bm[2]-1,+bm[3],23,59,59),days=Math.round((end-new Date())/86400000);
        if(days>0)countdown='⏳ 距报名截止还有 '+days+' 天';}
    }
    ov.innerHTML='<div class="modal"><button class="modal-close" data-close>✕</button>'+
      '<div class="m-head"><div class="m-title">'+esc(p.u||'岗位详情')+'</div><div class="m-sub">'+esc(p.n||'')+'</div>'+
      '<div class="m-tags"><span class="lv '+lvCls+'">'+lv+'</span>'+(tr?'<span class="tag track">'+tr+'</span>':'')+'<span class="status '+stCls+'">'+(st==='已截止'?'已截止':st==='即将'?'即将报名':st==='在招'?'在招':'报名时间待核实')+'</span>'+(cat?'<span class="tag">'+cat+'</span>':'')+(p.hc?'<span class="tag count">招 '+esc(p.hc)+' 人</span>':'')+'</div>'+(countdown?'<div class="m-cd">'+countdown+'</div>':'')+'</div>'+
      '<div class="m-body">'+rowHtml+condHtml+examHtml+duty+nt+(p.batch?'<div class="d-block"><div class="d-k">报名时间</div><div class="d-v">'+esc(p.batch)+(st==='已截止'?'<span style="color:#b0a89c;font-size:12px">（已截止）</span>':'')+'</div></div>':'')+'</div>'+
      '<div class="m-foot">'+(p.u2?'<a class="m-link" href="'+esc(p.u2)+'" target="_blank" rel="noopener">📄 '+(p.tt?esc(p.tt).slice(0,36):'查看官方招聘公告原文')+' ↗</a>':'<span class="m-no-link">暂无官方原文链接</span>')+(p.sn?'<span class="m-src">来源：'+esc(p.sn)+'</span>':'')+'<button class="m-close2" data-close>关闭</button></div></div>';
    document.body.appendChild(ov);document.body.style.overflow='hidden';
    ov.querySelectorAll('[data-close]').forEach(function(el){el.addEventListener('click',closeModal);});
    ov.addEventListener('click',function(e){if(e.target===ov)closeModal();});
    document.addEventListener('keydown',escCloseM);
    // 同公告岗位数>1 → 底部显示"同公告全部岗位"按钮
    if(p.u2){
      var cnt=0;DB.forEach(function(x){if(x.u2===p.u2)cnt++;});
      if(cnt>1){
        var bar=document.createElement('div');bar.className='ann-bar';
        bar.innerHTML='📂 该公告下共 <b>'+cnt+'</b> 个岗位 <span>查看全部 →</span>';
        var foot=ov.querySelector('.m-foot');
        ov.querySelector('.modal').insertBefore(bar,foot);
        bar.addEventListener('click',function(){showAnnounce(p.u2);});
      }
    }
  }
  // ===== 公告聚合页（同公告全部岗位）=====
  function showAnnounce(url){
    closeModal();
    var group=DB.filter(function(x){return x.u2===url;});
    var first=group[0]||{};
    var ov=document.createElement('div');ov.className='ann-overlay';ov.id='annModal';
    var items='';
    group.forEach(function(x,i){
      var stTxt=x.st||(x.batch?'':'待核实');
      var stCls=stTxt==='在招'?'st-open':stTxt==='即将'?'st-soon':stTxt==='已截止'?'st-closed':'st-wait';
      items+='<div class="ann-item" data-i="'+DB.indexOf(x)+'">'+
        '<div class="ann-pos">'+esc(x.n||'')+'</div>'+
        '<div class="ann-meta">'+(x.u?esc(x.u):'')+(x.hc?' · 招'+esc(x.hc)+'人':'')+(x.e?' · '+esc(x.e):'')+(x.pl&&x.pl!=='nan'?' · '+esc(x.pl):'')+'</div>'+
        '<div class="ann-foot2"><span class="status '+stCls+'">'+(stTxt==='已截止'?'已截止':stTxt==='即将'?'即将报名':stTxt==='在招'?'在招':'待核实')+'</span>'+(x.batch?'<span class="ann-batch">🗓️ '+esc(x.batch)+'</span>':'')+'<span class="ann-view">查看详情 →</span></div></div>';
    });
    ov.innerHTML='<div class="modal ann-modal"><button class="modal-close" data-close>✕</button>'+
      '<div class="m-head"><div class="m-title">📑 '+(first.tt?esc(first.tt).slice(0,60):(first.sn?esc(first.sn):'公告详情'))+'</div>'+
      '<div class="m-sub">'+esc(first.sn||'')+' · 共 '+group.length+' 个岗位</div>'+
      '<div class="m-tags"><span class="lv '+(first.lv?('lv-'+first.lv.toLowerCase()):'lv-x')+'">'+esc(LV_TXT[first.lv]||first.lv||'')+'</span>'+(first.u2?'<span class="tag">含官方原文 ↗</span>':'')+'</div></div>'+
      '<div class="m-body ann-body">'+(first.ct?'<div class="d-block"><div class="d-k">📋 招聘/报考条件</div><div class="d-v cond">'+esc(first.ct)+'</div></div>':'')+(first.et?'<div class="d-block"><div class="d-k">📝 考试内容（考什么）</div><div class="d-v exam">'+esc(first.et)+'</div></div>':'')+(first.cn?'<div class="d-block"><div class="d-k">📋 说明</div><div class="d-v cond note">'+esc(first.cn)+'</div></div>':'')+
      '<div class="ann-sep">本公告全部岗位 ('+group.length+')</div>'+items+'</div>'+
      '<div class="m-foot">'+(first.u2?'<a class="m-link" href="'+esc(first.u2)+'" target="_blank" rel="noopener">📄 查看官方原文 ↗</a>':'<span class="m-no-link">无官方链接</span>')+'<button class="m-close2" data-close>关闭</button></div></div>';
    document.body.appendChild(ov);document.body.style.overflow='hidden';
    ov.querySelectorAll('[data-close]').forEach(function(el){el.addEventListener('click',closeModal);});
    ov.addEventListener('click',function(e){if(e.target===ov)closeModal();});
    document.addEventListener('keydown',escCloseM);
    // ann-item 点击 → 该岗位详情
    ov.querySelectorAll('.ann-item').forEach(function(el){
      el.addEventListener('click',function(){var i=parseInt(el.getAttribute('data-i'));if(!isNaN(i)&&DB[i]){closeModal();openModal(DB[i]);}});
    });
  }
  function escCloseM(e){if(e.key==='Escape')closeModal();}
  function closeModal(){
    var m=document.getElementById('jobModal');if(m)m.remove();
    var a=document.getElementById('annModal');if(a)a.remove();
    document.body.style.overflow='';document.removeEventListener('keydown',escCloseM);
  }
  // 匹配结果岗位也可点开详情
  document.addEventListener('click',function(e){
    var g=e.target.closest('.g-job'); if(!g)return;
    if(e.target.closest('[data-stop]'))return;
    var i=parseInt(g.getAttribute('data-i'));
    if(!isNaN(i)&&DB[i])openModal(DB[i]);
  });
  // 倒计时榜点击 → 打开岗位详情
  document.addEventListener('click',function(e){
    var g=e.target.closest('.cd-item'); if(!g)return;
    var i=parseInt(g.getAttribute('data-i'));
    if(!isNaN(i)&&DB[i])openModal(DB[i]);
  });
  render();
})();
</script>
</body>
</html>`;

const outDir = path.join(ROOT, 'dist');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
console.log('✅ 官网单文件版已生成: dist/index.html (' + Math.round(html.length / 1024) + ' KB)');
