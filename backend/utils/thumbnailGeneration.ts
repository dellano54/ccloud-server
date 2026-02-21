import fs from "fs/promises";
import { constants } from "fs";
import sharp from "sharp";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { ZipFile } from "yazl";
import pLimit from "p-limit";

const THUMBNAIL_FOLDER = process.env.THUMBNAIL_STORAGE || "./thumbnails";
const THUMBNAIL_SIZE = 300;
const STORAGE_PATH = process.env.CONTENTSTORAGE || "./storage";
const CONCURRENCY_LIMIT = 4;

async function checkDir(userID: string) {
  await fs.mkdir(path.join(THUMBNAIL_FOLDER, userID), { recursive: true });
}

function getThumbnailPath(userID: string, fileId: string) {
  return path.join(THUMBNAIL_FOLDER, userID, `${fileId}.webp`);
}

function getSourcePath(userID: string, fileId: string) {
  return path.join(STORAGE_PATH, userID, fileId);
}

async function generateImageThumbnail(userID: string, fileId: string) {
  const source = getSourcePath(userID, fileId);
  const target = getThumbnailPath(userID, fileId);

  await sharp(source, { failOnError: false })
    .rotate()
    .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
      fit: "cover",
      withoutEnlargement: true
    })
    .webp({ quality: 80, effort: 4 })
    .toFile(target);

  return target;
}

function generateVideoThumbnail(userID: string, fileId: string): Promise<string> {
  const source = getSourcePath(userID, fileId);
  const target = getThumbnailPath(userID, fileId);

  return new Promise((resolve, reject) => {
    ffmpeg(source)
      .on("end", () => resolve(target))
      .on("error", reject)
      .screenshots({
        timestamps: ["10%"],
        filename: `${fileId}.webp`,
        folder: path.join(THUMBNAIL_FOLDER, userID),
        size: `${THUMBNAIL_SIZE}x?`
      });
  });
}

async function fileExists(filePath: string) {
  try {
    await fs.access(filePath, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function generateThumbnails(
  fileIds: string[],
  mimeTypes: { mime_type: string }[],
  userID: string
): Promise<string[]> {
  await checkDir(userID);

  const limit = pLimit(CONCURRENCY_LIMIT);

  const jobs = fileIds.map((fileId, index) =>
    limit(async () => {
      const mime = mimeTypes[index]?.mime_type;
      if (!mime) return null;

      const thumbnailPath = getThumbnailPath(userID, fileId);

      if (await fileExists(thumbnailPath)) {
        return thumbnailPath;
      }

      if (mime.startsWith("image/")) {
        return generateImageThumbnail(userID, fileId);
      }

      if (mime.startsWith("video/")) {
        return generateVideoThumbnail(userID, fileId);
      }

      return null;
    })
  );

  const results = await Promise.allSettled(jobs);

  return results
    .filter(r => r.status === "fulfilled" && r.value)
    .map(r => (r as PromiseFulfilledResult<string>).value);
}

export async function streamThumbnailZip(
  fileIds: string[],
  mimeTypes: { mime_type: string }[],
  res: any,
  userID: string
) {
  try {
    const thumbnailPaths = await generateThumbnails(fileIds, mimeTypes, userID);

    if (!thumbnailPaths.length) {
      return res.status(404).json({ message: "No thumbnails available" });
    }

    const zip = new ZipFile();

    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="thumbnails.zip"'
    );

    zip.outputStream
      .on("error", (err: any) => {
        if (!res.headersSent) {
          res.status(500).end();
        }
      })
      .pipe(res)
      .on("error", () => {});

    res.on("close", () => {
      if (!res.writableEnded) {
        zip.end();
      }
    });

    for (const filePath of thumbnailPaths) {
      const fileName = path.basename(filePath);
      zip.addFile(filePath, fileName);
    }

    zip.end();
  } catch {
    if (!res.headersSent) {
      res.status(500).json({ message: "Failed to generate ZIP" });
    }
  }
}