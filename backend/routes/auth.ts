import express from 'express';
import {createUser, checkUser, sendResetLink, resetPassword,
    generateVerifyToken, verifyEmail } from '../utils/auth.js';
import { createTokens, recreateRefreshToken } from '../utils/tokens.js';
import {verifyEmailMail} from '../utils/emailService.js';




const router = express.Router();

router.post("/register", async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const id = await createUser(name, email, password);
        const verifyToken = await generateVerifyToken(id, email);

        const { AccessToken, RefreshToken } = createTokens(id, email, name)

        verifyEmailMail(email, name, `${process.env.FRONTEND_URL}/verify-email?token=${verifyToken}`);

        return res.json({
            "id": id,
            "name": name,
            "email": email,
            "accessToken": AccessToken,
            "refreshToken": RefreshToken,
            "expiresIn": 10800
        });

    }catch(error: any){
        return res.status(400).json({ error: error.message });
    
    }
    
});


// login
router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    try{

        const { id, name } = await checkUser( email, password );
        
        const { AccessToken, RefreshToken } = createTokens(id, email, name);

        return res.json({ 
            "accessToken": AccessToken,
            "refreshToken": RefreshToken,
            "expiresIn": 10800
        })

    } catch (err: any){
        return res.status(400).json({error: err.message});
    }

})


// rotate refresh token and new token
router.post("/refresh", async (req, res) => {
    try{
        const {refreshToken} = req.body;
        const { AccessToken, RefreshToken } = recreateRefreshToken(refreshToken);

        return res.json({
            "accessToken": AccessToken,
            "refreshToken": RefreshToken,
            "expiresIn": 10800
        })

    } catch (err: any){
        return res.status(400).json({error: err.message});
    }
})


// forget password
router.post("/forgot-password", async (req, res) => {
    try{

        const { email } = req.body;
        sendResetLink(email);
        return res.status(200).json({message: "if the user exists an reset link has been send to the mail"});

    } catch (err: any){
        return res.status(400).json({error: err.message});
    }
})



// reset password
router.post("/reset-password", async (req, res) => {
    try{

        const { token } = req.query;
        const { newPassword } = req.body;

        if (typeof token !== "string") {
            return res.status(400).json({ error: "invalid token" })
        }

        const data = await resetPassword(token, newPassword);

        if (data){
            return res.status(200).json({message: "Password reset successfully"});
        }

        return res.status(400).json({error: "an error occured"});

    } catch (err: any) {
        return res.status(400).json({error: err.message});
    }
})


// verify email
router.get("/verify-email", async (req, res) => {
    try{
        const { token } = req.query;
        
        if (typeof token !== "string") {
            return res.status(400).json({ error: "invalid token" })
        }


        const data = await verifyEmail(token);

        if (data){
            return res.status(200).json({message: "mail sucessfully verified"});
        }

        return res.status(400).json({error: "invalid token"});



    } catch (err: any) {
        return res.status(400).json({error: "invalid token"});
    }

})

export default router;
