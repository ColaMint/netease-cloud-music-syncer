const path = require("path");
const fs = require("fs");
const glob = require("glob");
const expandHomeDir = require("expand-home-dir");
const mime = require("mime");
const {
  login_status,
  login_qr_key,
  login_qr_create,
  login_qr_check,
  user_cloud,
  cloud,
} = require("NeteaseCloudMusicApi");
var qrcode = require("qrcode-terminal");
const { ArgumentParser } = require("argparse");
const { version } = require("./package.json");

const parser = new ArgumentParser({
  description: "Argparse example",
});
parser.add_argument("-v", "--version", { action: "version", version });
parser.add_argument("-c", "--cookie-path", {
  help: "path to cookie file",
  default: "./cookie.txt",
});
parser.add_argument("-m", "--music-dir", {
  help: "path to music directory",
  default: "~/Music",
});

function getFileContent(filePath) {
  const name = path.basename(filePath);
  const data = fs.readFileSync(filePath);
  const mimeType = mime.getType(filePath);
  return { name, data, mimeType };
}

async function main() {
  try {
    // 解析命令行参数
    const args = parser.parse_args();

    // 读取保存的cookie
    let cookie = "";
    if (fs.existsSync(args.cookie_path)) {
      cookie = fs.readFileSync(args.cookie_path).toString();
    }

    // 检查保存的cookie是否有效
    const loginStatusResult = await login_status({
      cookie: cookie,
    });
    if (loginStatusResult.body.data.profile) {
      console.log("保存的cookie有效，无需扫码登陆！");
    } else {
      console.log("保存的cookie失效，请重新扫码登陆！");

      const qrKeyResult = await login_qr_key();
      const key = qrKeyResult.body.data.unikey;

      const qrCreateResult = await login_qr_create({
        key: key,
      });
      const qrurl = qrCreateResult.body.data.qrurl;
      console.log(qrurl);
      qrcode.generate(qrurl);

      cookie = await new Promise((resolve, reject) => {
        const intervalID = setInterval(async function () {
          const result = await login_qr_check({
            key: key,
          });
          switch (result.body.code) {
            case 800:
              reject(result.body.message);
              break;
            case 801:
              break;
            case 802:
              break;
            case 803:
              clearInterval(intervalID);
              console.log(result);
              resolve(result.body.cookie);
          }
        }, 1000);
      });
      console.log("登陆成功！");

      // 保存cookie
      fs.writeFileSync(args.cookie_path, cookie);
    }

    // 获取云盘的歌曲列表
    let hasMore = true;
    const limit = 200;
    let offset = 0;
    const cloudSongs = new Set();
    while (hasMore) {
      const result = await user_cloud({
        limit: limit,
        offset: offset,
        cookie: cookie,
      });
      hasMore = result.body.hasMore;
      offset += limit;

      result.body.data.forEach(function (song) {
        cloudSongs.add(`${song.album}:${song.artist}:${song.songName}`);
      });
    }

    // 上传云盘中不存在的本地歌曲
    const mm = await import("music-metadata");
    const pattern = path.join(
      expandHomeDir(args.music_dir),
      `/**/*.{mp3,flac}`
    );
    const files = glob.sync(pattern);
    const filesToUpload = {};
    for (let i = 0; i < files.length; ++i) {
      const filePath = files[i];
      const songFile = getFileContent(filePath);
      const metadata = await mm.parseBuffer(songFile.data, songFile.mimetype);
      const key = `${
        metadata.common.album ? metadata.common.album : "未知专辑"
      }:${metadata.common.artist}:${metadata.common.title}`;
      if (!cloudSongs.has(key)) {
        filesToUpload[filePath] = songFile;
      }
    }

    let finished = 0;
    let total = Object.keys(filesToUpload).length;
    for (let filePath in filesToUpload) {
      const songFile = filesToUpload[filePath];
      for (let t = 0; t < 3; ++t) {
        try {
          await cloud({
            songFile: songFile,
            cookie: cookie,
          });
          finished += 1;
          console.log(`[${finished}/${total}]上传成功:`, filePath);
          break;
        } catch (err) {
          console.error(`[${finished}/${total}]上传失败:`, filePath, err);
        }
      }
    }
  } catch (error) {
    console.error(error);
  }
}
main();
