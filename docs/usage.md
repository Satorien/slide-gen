# 使い方ガイド

Markdown から Marp でスライドを生成するツールの詳細な使い方です。
**CLI** と **デスクトップアプリ**の両方に対応し、Windows / macOS / Linux で動作します。

## 目次

- [セットアップ](#セットアップ)
- [CLI](#cli)
- [デスクトップアプリ](#デスクトップアプリ)
- [テーマ](#テーマ)
- [PPTX からテーマを抽出](#pptx-からテーマを抽出)
- [Markdown の書き方](#markdown-の書き方)
- [出力形式の仕組み](#出力形式の仕組み)
- [ビルドと配布](#ビルドと配布)
- [トラブルシューティング](#トラブルシューティング)

---

## セットアップ

Node.js（バージョンは [`.node-version`](../.node-version) に固定）を [fnm](https://github.com/Schniz/fnm) などで用意し、依存をインストールします。

```bash
fnm use --install-if-missing   # または nvm use
npm install                    # workspace 全体の依存を導入
```

> 以前必要だった Python / uv は不要になりました（テーマ抽出を JS へ移植済み）。

## CLI

`slidegen` コマンド（= `packages/cli/src/convert.mjs`）が本体です。

```bash
# ./slides を ./output へ変換（既定 HTML）
npx slidegen
npm run build            # 同等（ルートの npm script）

# 形式を指定
npx slidegen -f pdf
npx slidegen -f pptx
npx slidegen -f png

# 単一ファイル / テーマ指定
npx slidegen slides/example.md -f pdf
npx slidegen --theme corporate -f pdf

# ライブプレビュー（保存で自動再描画, http://localhost:8080）
npx slidegen --server

# 変更を監視して自動再生成
npx slidegen --watch -f pdf
```

主なオプション:

| オプション | 説明 |
| ---------- | ---- |
| `-i, --input <path>` | 入力ファイル/ディレクトリ（既定 `./slides`） |
| `-o, --output <path>` | 出力ディレクトリ（既定 `./output`） |
| `-f, --format <fmt>` | `html` / `pdf` / `pptx` / `png`（既定 `html`） |
| `--theme <name>` | テーマ名 |
| `-w, --watch` | 監視して自動再生成 |
| `-s, --server` | プレビューサーバー |
| `--pptx-editable` | 編集可能 PPTX（要 LibreOffice） |
| `--` | 以降を marp CLI へそのまま渡す |

> **CLI の PDF / PPTX / PNG 出力には Chrome / Chromium / Edge が必要**です。
> PATH 上に無い場合は環境変数 `CHROME_PATH` で実行ファイルを指定します。
>
> ```bash
> # 例 (macOS)
> CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npx slidegen -f pdf
> ```
>
> デスクトップアプリはこの依存がありません（内蔵 Chromium を使用）。

## デスクトップアプリ

```bash
npm run desktop:dev      # 開発実行（ホットリロード）
npm run desktop:build    # アプリバンドルをビルド
```

画面構成:

- 左ペイン: Markdown エディタ
- 右ペイン: リアルタイムプレビュー
- ツールバー: 開く / 保存 / テーマ選択 / PPTX取込 / 形式選択 / エクスポート

エクスポートは PDF / PPTX / PNG / HTML に対応し、外部ブラウザを必要としません。
プレビューと出力は同じレンダラ（`@slidegen/core` の `renderDeck`）を使うため、見た目が一致します。

## テーマ

組み込みの Marp テーマ `default` / `gaia` / `uncover` に加え、独自テーマ `corporate` を同梱しています。

テーマの指定方法:

1. フロントマターで指定（推奨）

   ```markdown
   ---
   marp: true
   theme: corporate
   ---
   ```

2. CLI で指定（`--theme`）/ デスクトップのテーマ選択

独自テーマを追加するには、CSS ファイルの先頭に `/* @theme <name> */` を書きます。
CLI はカレントの `./themes/` を、デスクトップはユーザーデータの `themes/` フォルダを自動で読み込みます。
`packages/core/themes/corporate.css` をコピーして `:root` の CSS 変数（色・フォント）を編集するのが簡単です。

## PPTX からテーマを抽出

既存 PowerPoint のブランド配色・フォントを Marp テーマとして再利用できます。

```bash
# CLI
npx slidegen extract-theme data/pptx/yourfile.pptx -n mybrand
# → ./themes/mybrand.css を生成
npx slidegen --theme mybrand -f pdf
```

デスクトップではツールバーの **PPTX取込** から同じことができます（テーマはユーザーデータに保存）。

抽出されるのは配色スキーム（accent / 背景 / 文字色など）とフォントです。
レイアウトそのものは移植されないため、生成後に CSS を微調整してください。

## Markdown の書き方

- スライドの区切りは `---`（水平線）
- 先頭のフロントマターで `theme` / `paginate` / `size` などを指定
- スライド個別の装飾はコメントで指定

  ```markdown
  <!-- _class: title -->     タイトルスライド
  <!-- _class: section -->   セクション区切り
  <!-- _backgroundColor: #000 -->  背景色を個別指定
  ```

`corporate` テーマは `title` / `section` クラスを用意しています。
サンプルは [`slides/example.md`](../slides/example.md) を参照してください。
記法の詳細は [Marp 公式ドキュメント](https://marpit.marp.app/) を参照。

## 出力形式の仕組み

| | CLI | デスクトップ |
| --- | --- | --- |
| レンダリング | marp-cli | `@slidegen/core`（marp-core） |
| HTML | marp-cli | core の HTML 文書生成 |
| PDF | marp-cli（要ブラウザ） | Electron `printToPDF`（ベクター） |
| PNG | marp-cli（要ブラウザ） | Electron `capturePage`（スライド毎） |
| PPTX | marp-cli（要ブラウザ） | `pptxgenjs`（各スライド画像を全面背景） |

デスクトップの PPTX は画像ベース（テキスト非編集）で、marp-cli の既定 PPTX と同じ方式です。

## ビルドと配布

```bash
# 現在の OS 向けインストーラを作成（apps/desktop/dist/ に出力）
npm run package --workspace @slidegen/desktop -- --win    # / --mac / --linux
```

`v*` タグを push すると GitHub Actions が 3 OS でビルドし、GitHub Releases へ公開します
（[`.github/workflows/release.yml`](../.github/workflows/release.yml)）。

成果物:

- Windows: NSIS インストーラ + portable exe
- macOS: universal dmg（arm64 + x64）
- Linux: AppImage + deb

> **v1 は未署名**です。初回起動時は、macOS は「右クリック → 開く」、Windows は
> 「詳細情報 → 実行」（または portable exe）で起動します。署名/公証は後から
> ビルド構成を変えずに追加できます。macOS の自動更新には署名が必要です。

## トラブルシューティング

| 症状 | 対処 |
| ---- | ---- |
| CLI で PDF 出力がブラウザエラー | `CHROME_PATH` に Chrome/Edge のパスを設定 |
| `slidegen` が見つからない | `npm install` を実行し、`fnm use` で Node を有効化 |
| 日本語フォントが崩れる | テーマの `--font-base` に日本語フォントを追加 |
| デスクトップアプリが起動しない（未署名警告） | macOS: 右クリック→開く / Windows: 詳細情報→実行 |
| デスクトップ出力でフォントが置換される | システムに該当フォントを導入、またはテーマで利用可能なフォントを指定 |
