# netease-cloud-music-syncer

将本地文件夹中的音乐（mp3/flac）上传到网易云音乐中`我的音乐云盘`

## 特性

- 扫码登陆

- 自动保存登陆后的 cookie，避免重复扫码

- 自动跳过云盘中已有的音乐

## 使用方法

```sh
npm install

node index.js -h

usage: index.js [-h] [-v] [-c COOKIE_PATH] [-m MUSIC_DIR]

Argparse example

optional arguments:
  -h, --help            show this help message and exit
  -v, --version         show program's version number and exit
  -c COOKIE_PATH, --cookie-path COOKIE_PATH
                        保存cookie的文件路径，默认为：./cookie.txt
  -m MUSIC_DIR, --music-dir MUSIC_DIR
                        音乐文件夹路径，默认为：~/Music
```
