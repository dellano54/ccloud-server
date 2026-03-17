import express from "express";
import middleware from "../middlewares/auth.js";
import { calculateHash, addFile, calculateCombinedHash, SyncCloudDB, verifyIfUserOwns,
    readFilesRange, deleteFile
} from "../utils/fileoperations.js";
import multer from 'multer';
import path from 'path';
import fs from 'fs';


const router = express.Router();

const storageFolder = process.env.CONTENTSTORAGE || "./storage";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './temp');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

router.post("/upload", middleware, upload.single("file"), async (req, res) => {
    try{
        const LocalHash = req.headers['x-sha256-checksum'];

        if (!req.file) {
            return res.status(400).json({ error: "file missing" });
        }

        const {creationDate, mimeType, originalName} = req.body;

        // Corrected: Passing file path and awaiting the hash
        const recievedHash = await calculateHash(req.file.path);

        if (LocalHash != recievedHash){
            await fs.promises.unlink(req.file.path).catch(() => {});
            return res.status(400).json({
                error: "checksum mismatch",
                received: recievedHash,
                expected: LocalHash,
                details: "the file recieved by the server is corrupted or the checksum sent by the client is incorrect"
            });
        }

        // Corrected: Passing file path to addFile
        const FileID = await addFile(req.file.path, creationDate, mimeType, originalName, req.user?.id, recievedHash)
        
        return res.json({
            id: FileID,
            checksum: recievedHash,
            status: "processed"
        })
    } catch (err: any){
        if (req.file) await fs.promises.unlink(req.file.path).catch(() => {});
        return res.status(500).json({error: err.message});
    }
})


router.post("/state", middleware, async (req, res) => {
    try{
        const {hash, count} = await calculateCombinedHash(req.user.id);
        return res.status(200).json(
            {
                stateHash: hash,
                fileCount: count
            }
        );
        

    } catch (err: any){
        return res.status(500).json({error: err.message});
    }
})


router.get("/sync", middleware, async (req, res) => {
    try{

        var {version, limit } = req.query;

        if (!version){
            version = "0";
        }

        if (!limit){
            limit = "100";
        }


        const {items, deletedIds, nextVersion} = await SyncCloudDB(req.user.id, Number(version),
                                    Number(limit));

        return res.status(200).json({items, deletedIds, nextVersion});


    } catch (err: any){
        return res.status(500).json({error: err.message});
    }
})



// stream content
router.get("/:id/stream", middleware, async (req, res) => {
    try{

        const Fileid: string[] = [req.params.id as string];
        const userOwns = await verifyIfUserOwns(req.user.id, Fileid);

        if (userOwns){
            const finalPath = path.resolve(storageFolder, req.user.id, Fileid[0]);
            
            if (req.headers.range){
                return readFilesRange(req.user.id, Fileid[0], res);
            } else {
                // Fixed: Ensure we don't pass an absolute path to res.sendFile if we're also providing root
                res.sendFile(finalPath);
            }
        } else {
            return res.status(403).json({error: "you don't have access to this file"});
        }

    } catch (err: any){
        return res.status(500).json({error: err.message})
    }
})


router.delete("/:id", middleware, async (req, res) => {
    try {
        const fileId: string[] = [req.params.id as string];
        const userOwns: boolean = await verifyIfUserOwns(req.user.id, fileId);

        if (userOwns){
            const id = await deleteFile(req.user.id, fileId[0]);
            return res.status(200).json({
                message: "File deleted successfully",
                id: id
            });

        } else {
            return res.status(404).json({error: "File not Found"});
        }


    } catch (err: any){
        return res.status(500).json({err: err})
    }
})

export default router;
