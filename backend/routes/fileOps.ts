import express from "express";
import middleware from "../middlewares/auth.js";
import { calculateHash, addFile, calculateCombinedHash, SyncCloudDB} from "../utils/fileoperations.js";
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



        if (!items || !deletedIds || !nextVersion){
            return res.status(500).json({err: "No data returned"});
        }

        return res.status(200).json({items, deletedIds, nextVersion});


    } catch (err: any){
        return res.status(500).json({error: err.message});
    }
})




export default router;