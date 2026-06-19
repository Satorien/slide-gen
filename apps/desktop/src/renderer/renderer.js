/**
 * レンダラ UI ロジック。preload が公開する window.api を使う。
 */
const api = window.api;

const els = {
  editor: document.getElementById("editor"),
  preview: document.getElementById("preview"),
  theme: document.getElementById("theme-select"),
  format: document.getElementById("format-select"),
  open: document.getElementById("btn-open"),
  save: document.getElementById("btn-save"),
  refresh: document.getElementById("btn-refresh"),
  export: document.getElementById("btn-export"),
  importTheme: document.getElementById("btn-import-theme"),
  indicator: document.getElementById("render-indicator"),
  statusFile: document.getElementById("status-file"),
  statusMsg: document.getElementById("status-msg"),
};

const state = { path: null, dirty: false };

const SAMPLE = `---
marp: true
theme: corporate
paginate: true
---

<!-- _class: title -->

# Slide Generator

## Markdown から素早く整った資料へ

---

<!-- _class: section -->

# 今日の流れ

---

# できること

- Markdown を書くだけでスライド化
- 右側でレイアウトをすぐ確認
- PDF / PPTX / PNG / HTML に出力

---

# テーマ取り込み

| 項目 | 反映される内容 |
| --- | --- |
| 配色 | ブランド色、背景、リンク |
| フォント | 見出し、本文 |
| サイズ | タイトル、本文 |

---

# 次の一歩

1. テンプレート PPTX を取り込む
2. Markdown を整える
3. 必要な形式で書き出す
`;

let renderTimer = null;
let renderSeq = 0;
function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(renderPreview, 250);
}

async function renderPreview() {
  const seq = ++renderSeq;
  if (els.indicator) els.indicator.hidden = false;
  try {
    const res = await api.render(els.editor.value, els.theme.value || undefined);
    if (seq !== renderSeq) return;
    if (!res || res.error) {
      setStatus(res?.error ? `描画エラー: ${res.error}` : "描画に失敗", "err");
      return;
    }
    els.preview.srcdoc = res.doc;
    setStatus(`${res.slideCount} スライド`);
  } catch (err) {
    if (seq === renderSeq) setStatus(`描画エラー: ${err?.message || String(err)}`, "err");
  } finally {
    if (seq === renderSeq && els.indicator) els.indicator.hidden = true;
  }
}

function setStatus(msg, kind = "") {
  els.statusMsg.textContent = msg || "";
  els.statusMsg.className = kind;
  if (kind === "ok") {
    setTimeout(() => {
      if (els.statusMsg.textContent === msg) els.statusMsg.className = "";
    }, 2500);
  }
}

function setFile(path) {
  state.path = path;
  els.statusFile.textContent = path ? path : "無題";
}

async function loadThemes(selectName) {
  const themes = await api.listThemes();
  const current = selectName ?? els.theme.value;
  els.theme.innerHTML = "";
  for (const t of themes) {
    const opt = document.createElement("option");
    opt.value = t.name;
    opt.textContent = t.source === "user" ? `${t.name} (取込)` : t.name;
    els.theme.appendChild(opt);
  }
  if (current && themes.some((t) => t.name === current)) els.theme.value = current;
}

// --- events ---
els.editor.addEventListener("input", () => {
  state.dirty = true;
  scheduleRender();
});

// Tab でスペース2つ挿入
els.editor.addEventListener("keydown", (e) => {
  if (e.key === "Tab") {
    e.preventDefault();
    const s = els.editor.selectionStart;
    const end = els.editor.selectionEnd;
    els.editor.setRangeText("  ", s, end, "end");
    scheduleRender();
  }
  if ((e.ctrlKey || e.metaKey) && e.key === "s") {
    e.preventDefault();
    doSave();
  }
});

els.theme.addEventListener("change", renderPreview);

els.refresh.addEventListener("click", () => {
  clearTimeout(renderTimer);
  renderPreview();
});

els.open.addEventListener("click", async () => {
  const res = await api.openFile();
  if (res?.canceled || !res) return;
  els.editor.value = res.content;
  setFile(res.path);
  state.dirty = false;
  await renderPreview();
  setStatus("読み込みました", "ok");
});

async function doSave() {
  const res = await api.saveFile(els.editor.value, state.path);
  if (res?.canceled || !res) return;
  setFile(res.path);
  state.dirty = false;
  setStatus("保存しました", "ok");
}
els.save.addEventListener("click", doSave);

els.export.addEventListener("click", async () => {
  const format = els.format.value;
  els.export.disabled = true;
  setStatus(`${format.toUpperCase()} を生成中...`);
  try {
    const res = await api.exportDeck(els.editor.value, els.theme.value || undefined, format);
    if (res?.canceled) return setStatus("");
    if (res?.error) return setStatus(`出力エラー: ${res.error}`, "err");
    const n = res.files?.length || 0;
    setStatus(`出力しました: ${n === 1 ? res.files[0] : n + " ファイル"}`, "ok");
  } catch (err) {
    setStatus(`出力エラー: ${err?.message || String(err)}`, "err");
  } finally {
    els.export.disabled = false;
  }
});

els.importTheme.addEventListener("click", async () => {
  const res = await api.importThemeFromPptx();
  if (res?.canceled) return;
  if (res?.error) return setStatus(`取込エラー: ${res.error}`, "err");
  await loadThemes(res.name);
  await renderPreview();
  setStatus(`テーマ "${res.name}" を取り込みました`, "ok");
});

// --- init ---
(async function init() {
  els.editor.value = SAMPLE;
  await loadThemes("corporate");
  await renderPreview();
})();
