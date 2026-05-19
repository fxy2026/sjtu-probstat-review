#!/usr/bin/env node
// 预渲染 KaTeX：构建时把 $...$ / $$...$$ 转成静态 HTML，前端不再依赖 KaTeX JS
const fs = require('fs');
const path = require('path');
const katex = require('katex');

const SRC = __dirname;
const DIST = path.join(SRC, 'dist');

const MACROS = {
  '\\dd': '\\mathrm{d}',
  '\\RR': '\\mathbb{R}',
  '\\E': '\\mathrm{E}',
  '\\D': '\\mathrm{D}',
  '\\Var': '\\mathrm{Var}',
  '\\Cov': '\\mathrm{Cov}',
  '\\Prob': '\\mathrm{P}',
};

function render(tex, displayMode) {
  try {
    return katex.renderToString(tex, {
      displayMode,
      macros: MACROS,
      throwOnError: false,
      strict: 'ignore',
      trust: true,
    });
  } catch (e) {
    console.error(`KaTeX error: ${tex.substring(0, 50)}... → ${e.message}`);
    return `<span style="color:red">[Math Error: ${tex.replace(/[<>]/g, '?')}]</span>`;
  }
}

function preRenderHTML(content) {
  // 1) 提取 <script>...</script> 和 <style>...</style> 的内容，避免误匹配
  const placeholders = [];
  let i = 0;
  const stash = (m) => { placeholders.push(m); return `\x00STASH${i++}\x00`; };
  content = content.replace(/<script[\s\S]*?<\/script>/g, stash);
  content = content.replace(/<style[\s\S]*?<\/style>/g, stash);

  // 2) 先匹配 $$...$$（display），再单 $...$（inline）
  content = content.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => render(tex.trim(), true));
  content = content.replace(/\$([^\$\n]+?)\$/g, (_, tex) => render(tex.trim(), false));

  // 3) 还原 placeholders
  content = content.replace(/\x00STASH(\d+)\x00/g, (_, idx) => placeholders[+idx]);

  // 4) 移除 KaTeX JS（auto-render + katex.min.js），仅保留 CSS
  content = content.replace(/<script defer src="[^"]*katex@[^"]*katex\.min\.js"[^>]*><\/script>\s*/g, '');
  content = content.replace(/<script defer src="[^"]*auto-render\.min\.js"[\s\S]*?<\/script>\s*/g, '');

  return content;
}

function copyFile(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

function writeFile(dst, content) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.writeFileSync(dst, content);
}

// 主流程
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST);

const entries = fs.readdirSync(SRC);
let htmlCount = 0, copyCount = 0;
for (const entry of entries) {
  if (entry.startsWith('.') || entry.startsWith('_') || entry === 'node_modules' || entry === 'dist' || entry === 'build.js' || entry === 'package.json' || entry === 'package-lock.json') continue;
  const src = path.join(SRC, entry);
  const dst = path.join(DIST, entry);
  const stat = fs.statSync(src);
  if (stat.isDirectory()) continue;
  if (entry.endsWith('.html')) {
    const content = fs.readFileSync(src, 'utf8');
    writeFile(dst, preRenderHTML(content));
    htmlCount++;
  } else {
    copyFile(src, dst);
    copyCount++;
  }
}

console.log(`✓ Pre-rendered ${htmlCount} HTML files, copied ${copyCount} assets to dist/`);
