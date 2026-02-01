import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'chat.db');

export default async function handler(req, res) {
    const db = await open({
        filename: DB_PATH,
        driver: sqlite3.Database
    });

    const users = await db.all('SELECT id, username FROM users');
    res.status(200).json(users);
}
