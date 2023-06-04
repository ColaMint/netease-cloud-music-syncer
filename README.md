# netease-cloud-music-syncer

将本地文件夹中的音乐上传到网易云音乐中`我的音乐云盘`

会自动跳过云盘中已有的音乐

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
                        path to cookie file
  -m MUSIC_DIR, --music-dir MUSIC_DIR
                        path to music directory
```
