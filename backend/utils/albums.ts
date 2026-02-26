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



const addFilesToAlbum = async (albumId: string, fileList: string[]) => {
    const ids = await many(db, {
        text: `INSERT INTO album_files (album_id, file_id) SELECT $1, unnest($2::text[]) RETURNING album_id ON CONFLICT DO NOTHING;`,
        values: [albumId, fileList]
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


    return userid;
}


export {createAlbum, addFilesToAlbum, syncAlbum}