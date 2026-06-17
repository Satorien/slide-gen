# 使い方

Markdown から Marp を用いてスライドを生成するツールの使い方をまとめます。

## 目次

- [前提環境](#前提環境)
- [初回セットアップ](#初回セットアップ)
- [基本: Markdown からスライド生成](#基本-markdown-からスライド生成)
- [出力フォーマット](#出力フォーマット)
- [ライブプレビュー / 監視](#ライブプレビュー--監視)
- [テーマ](#テーマ)
- [PPTX からテーマを抽出する](#pptx-からテーマを抽出する)
- [Markdown の書き方](#markdown-の書き方)
- [トラブルシューティング](#トラブルシューティング)

---

## 前提環境

| ツール | 用途 | 備考 |
| ------ | ---- | ---- |
| [fnm](https://github.com/Schniz/fnm) | Node のバージョン管理 | `.node-version` で固定 |
| Node (Marp CLI) | Markdown → スライド変換 | `npm install` でローカル導入 |
| [uv](https://docs.astral.sh/uv/) | Python 環境分離 | PPTX テーマ抽出に使用 |
| Chrome / Edge | PDF・PPTX・PNG 出力 | HTML 出力には不要 |

> Node 依存はすべてプロジェクト直下の `node_modules` に入り、Python 依存は
> `.venv` に隔離されます。グローバル環境は汚しません。

## 初回セットアップ

```powershell
./scripts/setup.ps1
```

これで fnm による Node 導入 + `npm install`、uv による `.venv` 作成までが完了します。

手動で行う場合:

```powershell
fnm use --install-if-missing   # .node-version の Node を導入・使用
npm install                    # Marp CLI をローカル導入
uv sync                        # Python 仮想環境を作成
```

## 基本: Markdown からスライド生成

`slides/` 配下の Markdown を変換し、`output/` に書き出します。

```powershell
# ワンライン(推奨)
./scripts/build.ps1

# npm 経由
npm run build

# 直接
node src/convert.mjs
```

特定のファイルだけ変換:

```powershell
./scripts/build.ps1 -Input slides/example.md
```

## 出力フォーマット

`-Format`(`-f`)で `html` / `pdf` / `pptx` / `png` を選べます(既定は `html`)。

```powershell
./scripts/build.ps1 -Format pdf
./scripts/build.ps1 -Format pptx
./scripts/build.ps1 -Format png
```

npm スクリプトでも同様:

```powershell
npm run pdf
npm run pptx
npm run png
```

> **PDF / PPTX / PNG は Chrome / Edge が必要**です。見つからない場合は
> 環境変数 `CHROME_PATH` でブラウザの実行ファイルを指定してください。
>
> ```powershell
> $env:CHROME_PATH = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
> ./scripts/build.ps1 -Format pdf
> ```

### 編集可能な PPTX

既定の PPTX は各スライドを画像として埋め込みます。テキストを後から編集できる
PPTX が必要な場合は `-PptxEditable` を付けます(LibreOffice Impress が必要)。

```powershell
./scripts/build.ps1 -Format pptx -PptxEditable
```

## ライブプレビュー / 監視

ブラウザで編集結果をリアルタイム確認:

```powershell
./scripts/preview.ps1
# → http://localhost:8080 を開く
```

ファイル出力を監視して自動再生成:

```powershell
./scripts/watch.ps1 -Format pdf
```

## テーマ

組み込みテーマ `default` / `gaia` / `uncover` に加え、`src/themes/` に置いた
独自テーマを使えます。標準で `corporate` を同梱しています。

利用可能なテーマを一覧:

```powershell
node src/convert.mjs --list-themes
# または
npm run themes
```

テーマの指定方法は 2 通り:

1. Markdown のフロントマターで指定(推奨)

   ```markdown
   ---
   marp: true
   theme: corporate
   ---
   ```

2. 変換時に指定(フロントマターを上書き)

   ```powershell
   ./scripts/build.ps1 -Theme corporate -Format pdf
   ```

独自テーマを追加するには `src/themes/<name>.css` を作り、先頭に
`/* @theme <name> */` を書きます。`corporate.css` をコピーして
色・フォント(`:root` の CSS 変数)を編集するのが簡単です。

## PPTX からテーマを抽出する

既存の PowerPoint のブランド配色・フォントを Marp テーマとして再利用できます。

1. PPTX を `data/pptx/` に置く
2. 抽出を実行

   ```powershell
   ./scripts/extract-theme.ps1 data/pptx/yourfile.pptx -Name mybrand
   ```

3. `src/themes/mybrand.css` が生成されるので、テーマとして指定

   ```powershell
   ./scripts/build.ps1 -Theme mybrand -Format pdf
   ```

抽出されるのは配色スキーム(accent / 背景 / 文字色など)とフォントです。
レイアウトそのものは移植されないため、生成後に CSS を微調整してください。

## Markdown の書き方

- スライドの区切りは `---`(水平線)
- 先頭のフロントマターで `theme` / `paginate` / `size` などを指定
- スライド個別の装飾はコメントで指定

  ```markdown
  <!-- _class: title -->     タイトルスライド
  <!-- _class: section -->   セクション区切り
  <!-- _backgroundColor: #000 -->  背景色を個別指定
  ```

詳細な記法は [Marp 公式ドキュメント](https://marpit.marp.app/) を参照してください。
サンプルは [`slides/example.md`](../slides/example.md) にあります。

## トラブルシューティング

| 症状 | 対処 |
| ---- | ---- |
| `marp` が見つからない | `npm install` を実行。`fnm use` で Node を有効化 |
| PDF 出力でブラウザエラー | `CHROME_PATH` に Chrome/Edge のパスを設定 |
| 日本語フォントが崩れる | テーマの `--font-base` に日本語フォントを追加 |
| `uv` コマンドが無い | uv を導入(PPTX 抽出のみで必要) |
| スクリプトが実行できない | `Set-ExecutionPolicy -Scope Process RemoteSigned` を実行 |
