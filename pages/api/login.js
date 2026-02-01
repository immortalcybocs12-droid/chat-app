import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'chat.db');

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { username } = req.body;

    if (!username) {
        return res.status(400).json({ message: 'Username is required' });
    }

    const db = await open({
        filename: DB_PATH,
        driver: sqlite3.Database
    });

    try {
        // Try to get user
        let user = await db.get('SELECT * FROM users WHERE username = ?', username);

        if (!user) {
            // Create user
            const result = await db.run('INSERT INTO users (username) VALUES (?)', username);
            user = { id: result.lastID, username };
        }

        // Return user info ("Login")
        res.status(200).json({ user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
}
