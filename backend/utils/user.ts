import {exec, one} from 'cgress';
import db from '../database/db.js';
import { statfs } from 'fs/promises';
import path from 'node:path';
import fs from 'node:fs';

const updateUserData = async (id: string, name: string) => {
    const updatedRow = exec(db, {
        text: `UPDATE users SET name = $1 where id = $2`,
        values: [name, id]
    })

    if (!updatedRow){
        throw new Error("invalid update");
    }

    return updatedRow;
}


const getUserData = async (id: string) => {
  const data = await one<{name: string, email: string}>(db, {
    text: `SELECT name, email FROM users WHERE id = $1`,
    values: [id]
  });

  if (!data) {
    throw new Error("User not found");
  }

  return data;
}


// get usage data



export interface SimpleDiskStats {
  usedBytes: number;
  totalBytes: number;
  percentage: number;
}

function resolveContentStorage(): string {
  const envPath = process.env.CONTENTSTORAGE;

  if (!envPath || typeof envPath !== 'string') {
    throw new Error('CONTENTSTORAGE environment variable not set');
  }

  const resolved = path.resolve(envPath);

  if (!path.isAbsolute(resolved)) {
    throw new Error('CONTENTSTORAGE must be an absolute path');
  }

  if (!fs.existsSync(resolved)) {
    throw new Error('CONTENTSTORAGE path does not exist');
  }

  return resolved;
}

export async function getDiskStats(): Promise<SimpleDiskStats> {
  try {
    const storagePath = resolveContentStorage();

    const stats = await statfs(storagePath);

    const totalBytes = stats.blocks * stats.bsize;
    const freeBytes = stats.bavail * stats.bsize;
    const usedBytes = totalBytes - freeBytes;
    const percentage = Math.round((usedBytes / totalBytes) * 10000) / 100;

    return {
      usedBytes,
      totalBytes,
      percentage
    };
  } catch {
    throw new Error('Unable to retrieve disk statistics');
  }
}



export {updateUserData, getUserData};
