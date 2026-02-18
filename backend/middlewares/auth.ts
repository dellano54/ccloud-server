import express from 'express';
import jwt from 'jsonwebtoken';

const secret = process.env.JWT_ACCESS_SECRET;
if (!secret) {
    throw new Error('JWT_ACCESS_SECRET is not defined');
}

const app = express();

app.use((req, res, next) => {
    if (!req.headers.authorization){
        return res.status(401).json({error: "authorization key missing"});
    }


    try{
        const data = jwt.verify(req.headers.authorization.split(" ")[1], secret);
        req.user = data;

        return next();
    } catch (err) {
        return res.status(401).json({error: "invalid authorization key"});
    }
})


export default app;