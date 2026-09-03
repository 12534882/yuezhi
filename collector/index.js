// 粤职通规模化采集器 - 核心框架
// 统一管线：各适配器抓取 -> 标准化岗位对象 -> 汇总去重 -> 输出 job_db.json
// 用法:
//   node collector/index.js              # 跑所有已启用源
//   node collector/index.js grci gd_sydw # 只跑指定源
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const OUT_FILE = path.join(ROOT, 'data', 'job_db.json');
const ADAPTERS_DIR = __dirname;

// --- 标准岗位对象结构（所有适配器统一输出）---
// { unit, position, city, edu, major, major_pg, major_ug, headcount,
//   candidate, political, dept, duty, src_url, src_title, src_name, src_cat,
//   hc_headcount, degree, age }

async function loadAdapters() {
  const files = fs.readdirSync(ADAPTERS_DIR).filter((f) => f.endsWith('.adapter.js'));
  const adapters = [];
  for (const f of files) {
    try {
      const mod = require(path.join(ADAPTERS_DIR, f));
      if (mod && mod.id && typeof mod.collect === 'function') adapters.push(mod);
    } catch (e) { console.log(`  [加载失败] ${f}: ${e.message}`); }
  }
  return adapters;
}

function normalizeJob(j) {
  // 统一字段，去空白，补默认
  const out = {};
  for (const k of ['unit', 'position', 'city', 'edu', 'degree', 'major', 'major_pg', 'major_ug', 'headcount', 'candidate', 'political', 'dept', 'duty', 'src_url', 'src_title', 'src_name', 'src_cat']) {
    out[k] = (j[k] === undefined || j[k] === null) ? '' : String(j[k]).trim();
  }
  // 保留附加字段：报名时间/状态/数据等级（curated 详情页提取，避免合并时丢失 A 级）
  for (const k of ['batch', 'status', 'src_level', 'level_note']) {
    out[k] = (j[k] === undefined || j[k] === null) ? '' : String(j[k]).trim();
  }
  if (!out.src_cat) out.src_cat = j.cat || 'other';
  // 统一生成稳定 id（防后续按 id 去重时误丢无 id 新记录）
  if (!out.id) {
    out.id = crypto.createHash('md5').update([j.src_url, j.code, j.unit, j.position, j.dept].filter(Boolean).join('|')).digest('hex').slice(0, 16);
  }
  return out;
}

function dedupe(jobs) {
  const seen = new Set();
  const result = [];
  for (const j of jobs) {
    // 主 key 用 src_url，副 key 用 src_title 区分同一公告来源下的多条（如招聘系统公告列表）
    const key = (j.src_url || '') + '|' + (j.src_title || j.unit || '') + '|' + (j.headcount || '');
    if (key && !seen.has(key)) { seen.add(key); result.push(j); }
  }
  return result;
}

async function run(only) {
  const adapters = await loadAdapters();
  const all = [];
  console.log(`\n===== 粤职通规模化采集 =====\n源适配器总数: ${adapters.length}`);
  for (const a of adapters) {
    if (only && only.length && !only.includes(a.id)) continue;
    console.log(`\n--- ${a.name} (${a.id}) ---`);
    try {
      const jobs = await a.collect();
      const norm = jobs.map(normalizeJob);
      console.log(`  ✓ 采集 ${norm.length} 条`);
      all.push(...norm);
    } catch (e) { console.log(`  ✗ 失败: ${e.message.slice(0, 80)}`); }
  }
  const unique = dedupe(all);
  const byCat = {};
  unique.forEach((j) => { byCat[j.src_cat] = (byCat[j.src_cat] || 0) + 1; });
  console.log(`\n===== 汇总 =====\n共 ${unique.length} 条岗位`);
  console.log('  类别分布:', JSON.stringify(byCat));
  // 输出合并到现有库
  const existing = fs.existsSync(OUT_FILE) ? JSON.parse(fs.readFileSync(OUT_FILE, 'utf8')) : [];
  // 按 src_url+src_title 去重合并（避免同一公告来源的多条被误并）
  const existKeys = new Set(existing.map((j) => (j.src_url || '') + '|' + (j.src_title || j.unit || '')));
  const fresh = unique.filter((j) => !existKeys.has((j.src_url || '') + '|' + (j.src_title || j.unit || '')));
  const merged = existing.concat(fresh);
  fs.writeFileSync(OUT_FILE, JSON.stringify(merged, null, 2));
  console.log(`  新增 ${fresh.length} 条, 库现有 ${merged.length} 条 -> ${OUT_FILE}`);
  return { collected: unique.length, newAdded: fresh.length, total: merged.length };
}

module.exports = { run, normalizeJob, dedupe };

if (require.main === module) {
  const only = process.argv.slice(2);
  run(only).catch((e) => { console.error('采集异常:', e); process.exit(1); });
}
