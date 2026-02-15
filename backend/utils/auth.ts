import db from "../database/db.js"
import {v7 as uuidv7} from "uuid";
import {one, exec} from 'cgress';
import bcrypt from 'bcrypt';
import {forgetPasswordMail } from './emailService.js';


// types

type UserDataLogin = {
    id: string;
    email: string;
    name: string;
    password: string;
};


type ResetEntry = {
  email: string
  timestamp: number
}


var resetDatabase: Record<string, ResetEntry> = {}
var verifyMail: Record<string, ResetEntry> = {}


// check if the user exists

const isExists = async (email: string) => {
    const user = await one<{email: string}>(db, {
        text: 'SELECT email FROM users WHERE email = $1',
        values: [email]
    })

    if (user){
        return true;
    }

    return false;
}


// check username

const userNameExists = async (name: string) => {
    const user = await one<{name: string}>(db, {
        text: 'SELECT name FROM users WHERE name = $1',
        values: [name]
    });

    if (user){
        return true;
    } 

    return false;
}





// create new user

const createUser = async ( name: string, email: string, password: string ) => {
    if (await isExists(email)){
        throw new Error('User already exists');
    }

    if (await userNameExists(name)){
        throw new Error("username is already taken by someone");
    }

    const id = uuidv7();
    const HashedPassword = await bcrypt.hash(password, Number(process.env.SALT_ROUNDS));


    await one<{ id: string; email: string, name: string}>(db, {
        text: 'INSERT INTO users (id, email, name, password) VALUES ($1, $2, $3, $4) RETURNING id, email, name',
        values: [id, email, name, HashedPassword]
    });

    return id;
}


// check for login
const checkUser = async (email: string, password: string) => {
    if (await isExists(email)){
        const data = await one<UserDataLogin>(db, {
            text: 'SELECT id, email, name, password FROM users WHERE email = $1',
            values: [email]
        })

        if (!data) {
            throw new Error("invalid username or password");
        }


        if (!await bcrypt.compare(password, data.password)){
            throw new Error("invalid username or password");
        }

        return {id: data.id, name: data.name};
    }

    else {
        throw new Error("invalid username or password");
    }
}


// reset password

const sendResetLink = async (email: string) => {
    if (await isExists(email)){
        const data = await one<{name: string, id: string}>(db, {
            text: "SELECT id, name FROM users WHERE email = $1",
            values: [email]
        })


        if (!data){
            return false;
        }

        const unqiueToken: string = await bcrypt.hash(data.id, 10);

        forgetPasswordMail(email, data.name, `${process.env.FRONTEND_URL}/reset-password?token=${unqiueToken}`);

        resetDatabase[unqiueToken] = {
            "email": email,
            "timestamp": Date.now()
        }

        return true;

    }

    return false;
}



const resetPassword = async (token: string, password: string) => {
    if (token in resetDatabase){
        const entry = resetDatabase[token];
        const email = entry.email;
        const timestamp = entry.timestamp;

        if (Date.now() - timestamp > 3600000){
            delete resetDatabase[token];
            throw new Error("token expired");
        }


        var password = await bcrypt.hash(password, Number(process.env.SALT_ROUNDS))


        await exec(db, {
            text: 'UPDATE users SET password = $1 WHERE email = $1',
            values: [password, email]
        })


        delete resetDatabase[token];

        return true;

    }
    return false;   
}


// verify email

const generateVerifyToken = async (id: string, email: string) => {
    const token = await bcrypt.hash(id, 10);
    verifyMail[token] = {
        email: email,
        timestamp: Date.now()
    }

    return token;
}



const verifyEmail = async (token: string) => {
    try{
        const { email, timestamp } = verifyMail[token];


        if (Date.now() - timestamp > 3600000){
            delete resetDatabase[token];
            throw new Error("token expired");
        }


        await exec(db, {
            text: "UPDATE users SET is_verified = $1 WHERE email = $2",
            values: [true, email]
        })


        delete resetDatabase[token];

        return true;

    } catch (err: any) {
        throw err;
    }
}



export {createUser, checkUser, sendResetLink, resetPassword, 
    generateVerifyToken, verifyEmail}