import db from "../database/db.js";
import { one, many } from "cgress";


const createAlbum = async (user_id: string, title: string) => {
    const id = await one<{id: string}>(db, {
        text: `INSERT INTO albums (user_id, title) VALUES ($1, $2) RETURNING id`,
        values:[user_id, title]
    });

    if (!id){
        throw new Error("failed creation");
    }

    return id;
}



const addFilesToAlbum = async (albumId: string, fileList: string[], userId: string) => {
    const ids = await many(db, {
        text: `INSERT INTO album_files (album_id, file_id)
            SELECT a.id, unnest($2::text[])
            FROM albums a
            WHERE a.id = $1 AND a.user_id = $3
            ON CONFLICT DO NOTHING
            RETURNING album_id;`,
        values: [albumId, fileList, userId]
    })

    if (!ids){
        throw new Error("failed creating id");
    }


    return ids;
}



const syncAlbum = async (userid: string) => {
    const albumData = await many(db, {
        text: `SELECT
            a.id,
            a.title,
            COUNT(af.file_id) AS count,
            COALESCE(
                ARRAY_AGG(af.file_id) FILTER (WHERE af.file_id IS NOT NULL),
                '{}'
            ) AS "fileIds"
        FROM albums a
        LEFT JOIN album_files af ON a.id = af.album_id
        WHERE a.user_id = $1
        GROUP BY a.id
        ORDER BY a.created_at DESC;`,
        values: [userid]

    });

    if (!albumData){
        throw new Error("failed fetching data");
    }


    return albumData;
}


export {createAlbum, addFilesToAlbum, syncAlbum}