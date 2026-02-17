import express from "express";
import middleware from "../middlewares/auth.js";
import { calculateHash, addFile } from "../utils/fileoperations.js";
import multer from 'multer';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage()
});



router.post("/upload", middleware, upload.single("file"), async (req, res) => {
    try{
        const LocalHash = req.headers['x-sha256-checksum'];

        if (!req.file) {
            return res.status(400).json({ error: "file missing" });
        }


        const {creationDate, mimeType, originalName} = req.body;

        const recievedHash = calculateHash(req.file.buffer);

        if (LocalHash != recievedHash){
            return res.status(400).json({error: "try again. the file recieved by the server is corrupted"});
        }

        const FileID = await addFile(req.file.buffer, creationDate, mimeType, originalName, req.user?.id, recievedHash)
        return res.json({
            id: FileID,
            checksum: recievedHash,
            status: "processed"
        })
    } catch (err: any){
        return res.status(500).json({error: err.message});
    }

    
})

export default router;