import { createHash } from "crypto";
import { one, many } from "cgress";
import db from "../database/db.js";
import path from "path";
import fs, {createReadStream} from "fs";

import {FileChangeRow} from "../types/filesOp.js";

const STORAGEFOLDER = process.env.CONTENTSTORAGE || "./storage";

/**
 * Calculate SHA-256 Checksum from a file path using streams (Memory-efficient)
 */
const calculateHash = (filePath: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", (err) => reject(err));
  });
};


import { generateThumbnails } from "./thumbnailGeneration.js";

const addFile = async (
  tempPath: string,
  creationDate: string,
  mimeType: string,
  originalName: string,
  userId: string,
  hash: string
): Promise<string> => {

  const stats = await fs.promises.stat(tempPath);

  const inserted = await one<{ id: string }>(db, {
    text: `
      INSERT INTO files (id, filename, creation_date, size, mime_type, user_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `,
    values: [hash, originalName, creationDate, stats.size, mimeType, userId]
  });

  if (!inserted) {
    throw new Error("DB insert failed");
  }

  const dir = path.resolve(STORAGEFOLDER, userId);
  const outPath = path.join(dir, hash);

  await fs.promises.mkdir(dir, { recursive: true });

  try {
    // Atomic rename (O(1) operation)
    await fs.promises.rename(tempPath, outPath);
    
    // Auto-generate thumbnail immediately after successful move
    console.log(`[Backend] Generating thumbnail for ${hash}...`);
    generateThumbnails([hash], [{ mime_type: mimeType }], userId).catch(err => {
        console.error(`[Backend] Background thumbnail generation failed for ${hash}:`, err);
    });

  } catch (err: any) {
    if (err.code === "EXDEV") {
      await fs.promises.copyFile(tempPath, outPath);
      await fs.promises.unlink(tempPath);
    } else if (err.code !== "EEXIST") {
      throw err;
    }
  }

  return inserted.id;
};


// generate combined hash for multiple files
const calculateCombinedHash = async (userId: string) => {
    try {
        // Get the max version from file_changes
        const versionResult = await one<{ max_version: number | null }>(db, {
            text: `SELECT COALESCE(MAX(version), 0) as max_version FROM file_changes WHERE user_id = $1`,
            values: [userId]
        });

        // Get the file count
        const countResult = await one<{ file_count: number }>(db, {
            text: `SELECT COUNT(*)::int as file_count FROM files WHERE user_id = $1`,
            values: [userId]
        });

        if (!versionResult || !countResult) {
            throw new Error("Failed to retrieve file stats from database");
        }

        const version = Number(versionResult.max_version || 0);
        const count = Number(countResult.file_count || 0);

        const stateString = `v:${version}|c:${count}`;
        const hash = createHash('sha256').update(stateString, 'utf8').digest('hex');

        return { 
            "hash": hash,
            "count": count 
        };

    } catch (err: any){
        console.error('calculateCombinedHash error:', err);
        throw err;
    }
}




function structureFileChanges(changes: FileChangeRow[]) {
  const files = [];
  const deletedIds = [];
  let nextVersion = 0;

  for (const change of changes) {
    const versionNum = Number(change.version);
    if (versionNum > nextVersion) nextVersion = versionNum;

    if (change.op === "insert" || change.op === "update") {
      if (change.snapshot) {
        files.push({
          id: change.snapshot.id,
          version: change.version,
          name: change.snapshot.name,
          mimeType: change.snapshot.mimeType,
          size: change.snapshot.size,
          creationDate: change.snapshot.creationDate,
          checksum: change.snapshot.checksum
        });
      }
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

    const rows = await many<FileChangeRow>(db, {
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


const verifyIfUserOwns = async (userId: string, fileIds: string[]): Promise<boolean> => {
  try {
    if (!Array.isArray(fileIds) || fileIds.length === 0) {
      return false;
    }

    const ver = await one<{ all_belong: boolean }>(db, {
      text: `
        SELECT COUNT(*)::bigint = $3::bigint AS all_belong
        FROM files
        WHERE user_id = $1
          AND id = ANY($2::text[])
      `,
      values: [userId, fileIds, fileIds.length],
    });

    if (!ver){
      throw new Error("DB query failed");
    }

    return ver.all_belong;


  } catch (err: any){
    throw err;
  }
}


const GetFilesMetaData = async (userId: string, filesId: string[]): Promise<{mime_type: string}[]> => {
  try{

    const data = await many<{mime_type: string}>(db, 
      {
        text:   `SELECT mime_type FROM files WHERE user_id = $1 AND id = ANY($2::text[])`,
        values: [userId, filesId]
      }
    );

    return data;

  } catch (err){
    throw err;
  }
}




const readFilesRange = (userId: string, fileId: string, res: any) => {
  const filePath = path.resolve(STORAGEFOLDER, userId, fileId);
  return createReadStream(filePath).pipe(res);
}



const deleteFile = async (userid: string, fileId: string) => {
  const result =  await one<{id: string}>(db, {
    text: 'DELETE FROM files where id = $1 AND user_id = $2 RETURNING id;',
    values: [fileId, userid]
  })

  if (!result){
    throw new Error("an error occured");
  }

  return result.id;
}




export { calculateHash, addFile, calculateCombinedHash,
  SyncCloudDB, verifyIfUserOwns, GetFilesMetaData, readFilesRange,
  deleteFile};
