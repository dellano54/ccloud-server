import { createHash } from "crypto";
import { one, many } from "cgress";
import db from "../database/db.js";
import path from "path";
import fs, {createReadStream} from "fs";

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
        const filesHash = await one<{ combined_hash: string | null; file_count: number }>(db, {
        text: `
            SELECT
                COUNT(*)::bigint AS file_count,
                string_agg(id, '' ORDER BY id) AS combined_hash
            FROM files
            WHERE user_id = $1;
        `,
        values: [userId]
        });

 
        if (!filesHash) {
            throw new Error("No files found");
        }

        if (filesHash.combined_hash){
          filesHash.combined_hash = createHash('sha256').update(filesHash.combined_hash, 'utf8').digest('hex');
        } else {
          throw Error("no file found");
        }

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