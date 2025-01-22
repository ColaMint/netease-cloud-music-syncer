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
  help: "保存cookie的文件路径，默认为：./cookie.txt",
  default: "./cookie.txt",
});
parser.add_argument("-m", "--music-dir", {
  help: "音乐文件夹路径，默认为：~/Music",
  default:
    "/Users/liming/Library/Application Support/com.netease.mumu.nemux-global/MuMuPlayerProShared.localized/Download/KuwoMusic/music",
});

function renameFiles(dir) {
  fs.readdir(dir, (err, files) => {
    if (err) {
      console.error("读取歌曲目录失败:", err);
      return;
    }

    files.forEach((file) => {
      const oldFilePath = path.join(dir, file);
      const fileParts = file.split(".");
      const extension = fileParts.pop();
      const fileName = fileParts.join(".");
      const newFileName = fileName.replace(/-\d+/g, "") + "." + extension;

      const newFilePath = path.join(dir, newFileName);

      if (oldFilePath !== newFilePath) {
        fs.rename(oldFilePath, newFilePath, (err) => {
          if (err) {
            console.error(`重命名文件失败 ${file}:`, err);
          } else {
            console.log(`${file} 重命名为 ${newFileName}`);
          }
        });
      }
    });
  });
}

function getFileContent(filePath) {
  const name = path.basename(filePath);
  const data = fs.readFileSync(filePath);
  const mimeType = mime.getType(filePath);
  const birthtime = fs.statSync(filePath).birthtime;
  return { name, data, mimeType, birthtime };
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

    // 重命名本地歌曲文件
    renameFiles(args.music_dir);

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
        if (song.album == "未知专辑") {
          cloudSongs.add(song.songName);
        } else {
          cloudSongs.add(`${song.album}:${song.artist}:${song.songName}`);
        }
      });
    }

    // 上传云盘中不存在的本地歌曲
    const mm = await import("music-metadata");
    const pattern = path.join(
      expandHomeDir(args.music_dir),
      `/**/*.{mp3,flac,ogg,acc}`
    );
    const files = glob.sync(pattern);
    const filesToUpload = [];
    for (let i = 0; i < files.length; ++i) {
      const filePath = files[i];
      const fileName =
        path.basename(filePath, path.extname(filePath)) +
        path.extname(filePath).replace(".", "_");
      const songFile = getFileContent(filePath);
      const metadata = await mm.parseBuffer(songFile.data, songFile.mimetype);
      metadata.common.artist = metadata.common.artist
        ? metadata.common.artist.trim()
        : "";
      const key = `${
        metadata.common.album ? metadata.common.album : "未知专辑"
      }:${metadata.common.artist}:${metadata.common.title}`;
      if (
        !cloudSongs.has(key) &&
        !cloudSongs.has(fileName) &&
        !cloudSongs.has(metadata.common.title)
      ) {
        filesToUpload.push({
          filePath: filePath,
          songFile: songFile,
          metadata: metadata,
        });
      }
    }

    filesToUpload.sort((a, b) => {
      if (a.metadata.common.artist == b.metadata.common.artist) {
        return a.songFile.birthtime < b.songFile.birthtime ? -1 : 1;
      } else {
        return a.metadata.common.artist < b.metadata.common.artist ? -1 : 1;
      }
    });

    let finished = 0;
    let total = Object.keys(filesToUpload).length;
    for (let i in filesToUpload) {
      const file = filesToUpload[i];
      const filePath = file.filePath;
      const songFile = file.songFile;
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
