---
marp: true
theme: corporate
paginate: true
size: 16:9
---

<!-- _class: title -->

# Slide Generator

## Markdown から Marp でスライドを自動生成

2026-06-17 / Your Name

---

# このツールでできること

- **Markdown** を書くだけでスライドを生成
- `corporate` などの独自テーマを適用
- **HTML / PDF / PPTX / PNG** に出力
- PPTX からブランドテーマを抽出して再利用
- ワンライン実行 & ライブプレビュー

---

<!-- _class: section -->

# 1. 基本の書き方

---

# スライドの区切り

スライドは `---`（水平線）で区切ります。

```markdown
# スライド1

---

# スライド2
```

先頭の **フロントマター** で `theme` や `paginate` を指定します。

---

# 箇条書きと強調

- 第一の要点
- **太字** で重要語を強調
- `インラインコード` も使える
  - ネストした項目
  - さらにネスト

> 引用ブロックはアクセントカラーの縦線付きで表示されます。

---

# 表とコード

| 項目     | 説明                     |
| -------- | ------------------------ |
| 入力     | Markdown                 |
| 変換     | Marp                     |
| 出力     | HTML / PDF / PPTX / PNG  |

```js
console.log("Hello, Marp!");
```

---

<!-- _class: section -->

# 2. レイアウトのコツ

---

# 2カラムレイアウト

<div style="display:grid; grid-template-columns:1fr 1fr; gap:2rem;">
<div>

### 左カラム
- テキスト
- リスト
- 画像

</div>
<div>

### 右カラム
- 比較
- 補足
- まとめ

</div>
</div>

---

# クラスでスライドを装飾

各スライド先頭のコメントでクラスを指定できます。

```markdown
<!-- _class: title -->     タイトルスライド
<!-- _class: section -->   セクション区切り
```

`corporate` テーマには `title` と `section` を用意しています。

---

<!-- _class: title -->

# ありがとうございました

## Questions?
