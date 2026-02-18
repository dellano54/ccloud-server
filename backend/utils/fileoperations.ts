import { createHash } from "crypto";
import { one, many } from "cgress";
import db from "../database/db.js";
import path from "path";
import fs from "fs";
import {FileSyncResponse} from "../types/filesOp.js";

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


// generate combined hash for multiple files
const calculateCombinedHash = async (userId: string) => {
    try {
        const filesHash = await one<{ combined_hash: string, file_count: Number }>(db, {
        text: `
            SELECT
                COUNT(*) AS file_count,
                string_agg(id, '' ORDER BY id) AS combined_hash
            FROM files
            WHERE user_id = $1;
        `,
        values: [userId]
        });

 
        if (!filesHash) {
            throw new Error("No files found");
        }

        filesHash.combined_hash = createHash('sha256').update(filesHash.combined_hash, 'utf8').digest('hex');

    return { "hash": filesHash.combined_hash,
            "count": filesHash.file_count };

    } catch (err: any){
        throw err;
    }
}




function structureFileChanges(changes: any) {
  const files = [];
  const deletedIds = [];
  let nextVersion = 0;

  for (const change of changes) {
    const versionNum = Number(change.version);
    if (versionNum > nextVersion) nextVersion = versionNum;

    if (change.op === "insert" && change.snapshot) {
      const s = change.snapshot;

      files.push({
        id: s.id,
        version: change.version,
        name: s.name,
        mimeType: s.mimeType,
        size: s.size,
        creationDate: s.creationDate,
        checksum: s.checksum
      });
    }

    if (change.op === "delete") {
      deletedIds.push(change.file_id);
    }
  }

  return {
    files,
    deletedIds,
    nextVersion
  };
}




const SyncCloudDB = async (userID: string, version: number, limit: number) => {
  try {

    const rows = await many<FileSyncResponse>(db, {
        text: `SELECT version, file_id, op, snapshot FROM file_changes 
      WHERE user_id = $1 AND version > $2 
      ORDER BY version ASC LIMIT $3`,
      values: [userID, version, limit]
    })


    const {files: items, deletedIds, nextVersion} = structureFileChanges(rows);



    return {items, deletedIds, nextVersion}

  } catch (err: any){
    throw err;
  }
}

export { calculateHash, addFile, calculateCombinedHash,
  SyncCloudDB};