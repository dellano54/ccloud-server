import { createHash } from "crypto";
import { one } from "cgress";
import db from "../database/db.js";
import path from "path";
import fs from "fs";

const STORAGEFOLDER = process.env.CONTENTSTORAGE || "./storage";

const calculateHash = (bin: Buffer): string => {
  return createHash("sha256")
    .update(bin)
    .digest("hex");
};


const addFile = async (
  file: Buffer,
  creationDate: string,
  mimeType: string,
  originalName: string,
  userId: string,
  hash: string
): Promise<string> => {

  const inserted = await one<{ id: string }>(db, {
    text: `
      INSERT INTO files (id, filename, creation_date, size, mime_type, user_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
    values: [hash, originalName, creationDate, file.length, mimeType, userId]
  });

  if (!inserted) {
    throw new Error("DB insert failed");
  }

  const dir = path.resolve(STORAGEFOLDER, userId);
  const outPath = path.join(dir, hash);

  await fs.promises.mkdir(dir, { recursive: true });

  await fs.promises.writeFile(outPath, file, { flag: "wx" });

  return inserted.id;
};

export { calculateHash, addFile };