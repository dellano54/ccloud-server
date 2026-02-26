import express from 'express';
import middleware from '../middlewares/auth.js';
import {updateUserData, getDiskStats, getUserData} from '../utils/user.js'



const router = express.Router();


// update profile

router.patch("/profile", express.json(), middleware, async (req, res) => {
    try{

        const updatedRow = await updateUserData(req.user.id, req.body.name);
        return res.status(200).json(updatedRow);

    } catch (err){
        return res.status(400).json({error: err});
    }
})


// get profile
router.get("/profile", express.json(), middleware, async (req, res) => {
    try {
        const userData = await getUserData(req.user.id);
        return res.status(200).json({id: req.user.id, name: userData.name, email: userData.email});
    } catch (err: any){
        return res.status(400).json({error: err});
    }
})


router.get("/quota", express.json(), middleware, async (req, res) => {
    try {
        return res.status(200).json(await getDiskStats())

    } catch (err: any){
        return res.status(400).json({error: err});
    }
})


export default router;
