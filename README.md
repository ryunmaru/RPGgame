# Pixel Monster Quest

ブラウザ表示の見た目を持ちながら、**EXE化して実行できる**ポケモン/ドラクエ風RPGです。

## 特徴
- フィールド探索（矢印キー / WASD）
- 草むらでランダムエンカウント
- ターン制バトル（命中率、攻撃、防御、回復）
- ドラクエ/ポケモン風のウィンドウUI
- SQLiteでモンスター・わざを管理
- 画面内フォームでモンスター/わざを追加

## 開発実行
```bash
python3 app.py
```

`http://localhost:3000` を開いてプレイします。

## EXE化（Windows向け）
1. PyInstallerをインストール
```bash
pip install pyinstaller
```

2. EXEビルド
```bash
pyinstaller --onefile --name PixelMonsterQuest \
  --add-data "public;public" \
  --add-data "data;data" \
  desktop_app.py
```

3. `dist/PixelMonsterQuest.exe` を実行
- 実行するとローカルサーバーが起動し、ブラウザでゲーム画面を開きます。
