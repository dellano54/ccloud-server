import { Resend } from 'resend';
import fs from 'node:fs';

const resend = new Resend(process.env.RESEND_API_KEY);

const verifyEmailMail = async (email: string, name: string, link: string) => {
    const {data, error} = await resend.emails.send({
        from: "CCLOUD <onboarding@resend.dev>",
        to: email,
        subject: "verify email for CCLOUD.",
        html: fs.readFileSync('../templates/verify-email.html', 'utf8').replace("{{name}}", name).replaceAll("{{magic_link}}", link)
    })

    if (error){
        throw error;
    }

    return data;
}


const forgetPasswordMail = async (email: string, name: string, link: string) => {
    const {data, error} = await resend.emails.send({
        from: "CCLOUD <onboarding@resend.dev>",
        to: email,
        subject: "password recover from CCLOUD",
        html: fs.readFileSync("../templates/forgot-password.html", 'utf-8').replace("{{name}}", name).replaceAll("{{magic_link}}", link)
    })

    if (error){
        throw error;
    }

    return data;
}





export {verifyEmailMail, forgetPasswordMail}