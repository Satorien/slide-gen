# data フォルダ

Marp テーマの素材となるファイルの保管庫です。

## 構成

- `pptx/` — テーマ抽出元の PowerPoint ファイル(`.pptx`)を置く場所

## 使い方

1. ブランドの配色・フォントが設定された `.pptx` を `pptx/` に置く
2. テーマを抽出する

   ```powershell
   ./scripts/extract-theme.ps1 data/pptx/yourfile.pptx -Name mybrand
   ```

3. `src/themes/mybrand.css` が生成される

抽出の仕組みと注意点は [`../docs/usage.md`](../docs/usage.md#pptx-からテーマを抽出する) を参照してください。

> ここに置いた `.pptx` は変換処理の入力ではなく、**テーマの素材**です。
> スライドの元になる Markdown は `slides/` に置きます。
