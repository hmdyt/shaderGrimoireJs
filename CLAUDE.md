# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Shader Grimoire JSはThree.jsをベースにシェーダー（特にポストプロセス）を学習するための実験プロジェクトです。FPS風に動き回れる3Dシーンを土台に、深度テクスチャを利用したポストエフェクト（被写界深度・ブルーム等）を試作します。

## 開発コマンド

```bash
npm run dev      # Vite開発サーバー起動（ホットリロード）
npm run build    # TypeScriptコンパイル＆プロダクションビルド
npm run preview  # プロダクションビルドのプレビュー
npm run format   # Biomeでコードフォーマット
npm run lint     # Biomeでリント
npm run check    # Biomeチェック（自動修正付き）
```

Nix環境を使用する場合は`nix develop`または`direnv allow`で開発環境をロードできます。

## アーキテクチャ

### コア構造

- **src/main.ts** - 唯一のエントリポイント。Three.jsレンダラ初期化、シーン構築、入力処理、ポストプロセス用シーン構築、レンダリングループまでを単一ファイルで担う
- **index.html** - `#canvas`と操作ヘルプ用`#help`オーバーレイのみ
- ポストプロセス用シェーダーは現状`main.ts`内のテンプレートリテラル（`/* glsl */` タグ付き）として記述。`.glsl`ファイルや`vite-plugin-glsl`は未使用

### シーン構成

- カメラ: `PerspectiveCamera(45, aspect, 0.1, 200)`、初期位置`(0, 1.6, 15)`
- ライト: `AmbientLight(0.5)` + `DirectionalLight(1.5)`（位置`(5,10,7)`）
- 地面: 1000×1000の`PlaneGeometry` + `GridHelper(1000, 500)`
- オブジェクト: Box / Sphere / Cylinder / Torus / Cone / 縦長Box / 大Sphere / TorusKnot をz方向（0 ～ -40）に散らして配置。被写界深度の効果を確認しやすいレイアウト

### カメラ操作

OrbitControlsを「視点回転だけ使う」用途に流用している:
- `minDistance` / `maxDistance` を 0 / 0.01 に固定し、`target` をカメラのほぼ目前に置くことでFPSライクな視点回転として機能させる
- 並進はキーイベントで自前実装: `WASD`水平、`Space`/`Shift`垂直、`Ctrl`で3倍速
- カメラ移動時は `controls.target` も同じベクトルだけ加算して相対位置を維持

### レンダリングパイプライン

各フレームの`render()`で以下を実行:
1. キー入力からワールド空間の移動ベクトルを構築（カメラのquaternionを掛けて視線基準に変換、Y成分は別管理）
2. シーンを`renderTarget`（カラー + DepthTexture付き）に1パス目として描画
3. デフォルトフレームバッファに対して`depthScene`（フルスクリーンクアッド）を描画し、深度をリニア化して可視化
4. `controls.update()` → `requestAnimationFrame(render)`

### ポストプロセス（実装中）

- `WebGLRenderTarget`に`DepthTexture(DepthFormat, UnsignedIntType)`を持たせて深度を取得
- 現状の`depthMaterial`は深度を `(2*near*far) / (far + near - z*(far-near))` でリニア化し、`/ uFar`で正規化したグレースケール出力までで止まっている（被写界深度本体のCoC計算・ブラー合成は未実装）
- 直近のコミット履歴: 川瀬式ブルーム → 被写界深度の途中

### リサイズ対応

`resize`イベントでカメラのaspect、レンダラのpixelRatio/サイズ、`renderTarget`のサイズをまとめて更新。

## 技術スタック

- TypeScript 5.6 + Vite 6.0
- Three.js 0.172（`three/addons/controls/OrbitControls.js`含む）
- Biome（リンター/フォーマッター）
- Node.js 22（Nixフレーク経由）
