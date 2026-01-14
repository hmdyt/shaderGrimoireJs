# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

Shader Grimoire JSはGLSLシェーダー開発を学習するためのWebGL2プロジェクトです。インタラクティブなカメラコントロールを備えた3Dグラフィックスレンダリングのサンプルを提供します。

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

- **src/main.ts** - アプリケーションエントリポイント。WebGL2コンテキスト初期化、シーン設定、メッシュ管理、レンダリングループを担当
- **src/webgl-utils.ts** - WebGL2ユーティリティ関数群。シェーダーコンパイル、プログラムリンク、mat4行列演算（perspective, lookAt, translate, rotateX/Y, multiply）、ジオメトリ生成（createCube, createSphere, createPlane）を提供
- **src/shaders/vertex.glsl** - 頂点シェーダー（GLSL 300 ES）。頂点変換と法線計算
- **src/shaders/fragment.glsl** - フラグメントシェーダー。Phongライティングモデル（アンビエント/ディフューズ/スペキュラー）を実装

### レンダリングパイプライン

各フレームで以下を実行:
1. マウス入力に基づくカメラ位置計算
2. ビュー・プロジェクション行列の設定
3. ライト位置の更新（軌道アニメーション）
4. 各メッシュに対してモデル行列設定 → VAOバインド → glDrawElements描画

### シェーダーインポート

vite-plugin-glslにより`.glsl`ファイルを直接importして文字列として使用可能。

## 技術スタック

- TypeScript 5.6 + Vite 6.0
- WebGL2 + GLSL 300 ES
- Biome（リンター/フォーマッター）
- Node.js 22（Nixフレーク経由）
