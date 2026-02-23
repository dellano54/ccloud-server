// files and thumbnail generations;
import express from "express";
import middleware from "../middlewares/auth.js";
import {verifyIfUserOwns, GetFilesMetaData} from "../utils/fileoperations.js";
import {streamThumbnailZip} from "../utils/thumbnailGeneration.js";
import path from 'path';


const THUMBNAIL_FOLDER = process.env.THUMBNAIL_STORAGE || "./thumbnail";

const router = express.Router();


router.post("/thumbnails/batch", middleware, async (req, res) => {
    try{
        const user = req.user;
        console.log(req.body);
        const fileIds: string[] = req.body.fileIds;

        if (await verifyIfUserOwns(user.id, fileIds)){
           const meta = await GetFilesMetaData(user.id, fileIds);
           return await streamThumbnailZip(fileIds, meta, res, user.id);
        }
    } catch (err: any){
        return res.status(500).json({error: err.message})
    }

})


router.post("/:id/thumbnail", middleware, async (req, res) => {
    try{
        const fileId: string[] = [req.query.id as string];

        if (await verifyIfUserOwns(req.user.id, fileId)){
            const meta = await GetFilesMetaData(req.user.id, fileId);
            const metaData = meta[0].mime_type;
            
            res.set("Content-Type", metaData);
            return res.sendFile(path.resolve(THUMBNAIL_FOLDER, req.user.id, fileId[0]));

        } else {
            return res.status(400).json({error: "file is not owned by you"});
        }


    } catch (err: any){
        return res.status(500).json({error: err.message});
    }
})


export default router;