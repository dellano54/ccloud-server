// files and thumbnail generations;
import express from "express";
import middleware from "../middlewares/auth.js";
import {verifyIfUserOwns, GetFilesMetaData} from "../utils/fileoperations.js";
import {streamThumbnailZip} from "../utils/thumbnailGeneration.js";

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


export default router;