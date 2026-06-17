/**
 * Marp CLI 設定ファイル
 * https://github.com/marp-team/marp-cli#configuration-file
 *
 * convert.mjs はテーマ登録などを引数で渡すが、marp を直接叩く場合にも
 * 同じ挙動になるよう、ここでも既定値を定義しておく。
 */
export default {
  // 独自テーマ(CSS)の置き場所
  themeSet: ["./src/themes"],
  // Markdown 内の HTML を許可
  html: true,
  // 既定のエンジンオプション
  options: {
    markdown: {
      breaks: true,
    },
  },
  // PDF/PPTX 出力時にローカル画像を読み込めるようにする
  allowLocalFiles: true,
};
