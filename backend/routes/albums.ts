import express from 'express';
import middleware from '../middlewares/auth.js'
import {createAlbum, addFilesToAlbum, syncAlbum} from '../utils/albums.js'
import {verifyIfUserOwns} from '../utils/fileoperations.js';

const router = express.Router();

router.post("/", express.json(), middleware, async (req, res) => {
    try{

        if (!req.body.title){
            return res.status(400).json({error: "malformed body"})
        }

        const userId = req.user.id as string;
        const {id} = await createAlbum(userId, req.body.title);

        return res.status(200).json({id: id});

    } catch(err: any){
        return res.status(500).json({error: err});
    }
})


router.post("/:id/files", express.json(), middleware, async (req, res) => {
    try{

        if (!req.body.fileIds || !Array.isArray(req.body.fileIds)){
            return res.status(400).json({error: "malformed body"})
        }

        if (!await verifyIfUserOwns(req.user.id, req.body.fileIds)){
            return res.status(404).json({error: "file not found"});

        }

        const data = await addFilesToAlbum(req.params.id as string, req.body.fileIds, req.user.id);
        return res.status(200).json(data);

        

    } catch (err: any){
        return res.status(500).json({error: err});
    }
})


router.get("/sync", express.json(), middleware, async (req, res) => {
    try{

        const albumData = await syncAlbum(req.user.id);

        return res.status(200).json(albumData);

    } catch (err: any){
        return res.status(500).json({error: err});
    }
})


export default router;