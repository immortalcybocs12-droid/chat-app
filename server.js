const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const DB_PATH = path.join(__dirname, 'chat.db');

// Multer setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = path.join(__dirname, 'public', 'uploads');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

async function initDb() {
  const db = await open({
    filename: DB_PATH,
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE,
      password TEXT
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER,
      receiver_id INTEGER,
      content TEXT,
      type TEXT DEFAULT 'text',
      file_path TEXT,
      created_at INTEGER,
      seen_at INTEGER,
      is_seen BOOLEAN DEFAULT 0
    );
  `);

  // Migration: Check if columns exist, if not likely empty table or need fetch. 
  // For simplicity: We won't run migration because it's tricky in sqlite without separate logic. 
  // We'll rely on users having fresh start OR simplistic update.
  // Actually, let's try to add columns if they don't exist
  try {
    await db.run("ALTER TABLE messages ADD COLUMN type TEXT DEFAULT 'text'");
    await db.run("ALTER TABLE messages ADD COLUMN file_path TEXT");
  } catch (e) {
    // Ignore if columns already exist
  }

  return db;
}

app.prepare().then(async () => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);

    // Handle Uploads manually since we are using raw http server + next
    if (req.method === 'POST' && parsedUrl.pathname === '/api/upload') {
      upload.single('file')(req, res, (err) => {
        if (err) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: err.message }));
          return;
        }
        res.statusCode = 200;
        // File path relative to public
        const filePath = '/uploads/' + req.file.filename;
        res.end(JSON.stringify({ filePath, type: req.file.mimetype.startsWith('image/') ? 'image' : req.file.mimetype.startsWith('video/') ? 'video' : 'file' }));
      });
    } else {
      handle(req, res, parsedUrl);
    }
  });

  const io = new Server(server);
  const db = await initDb();

  // Cleanup job: Delete messages seen > 2 minutes ago
  setInterval(async () => {
    const timeThreshold = Date.now() - 2 * 60 * 1000; // 2 minutes ago
    const toDelete = await db.all('SELECT id, file_path FROM messages WHERE is_seen = 1 AND seen_at < ?', timeThreshold);

    if (toDelete.length > 0) {
      const ids = toDelete.map(m => m.id);
      console.log('Deleting expired messages:', ids);

      // Delete files
      toDelete.forEach(msg => {
        if (msg.file_path) {
          const fullPath = path.join(__dirname, 'public', msg.file_path);
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            console.log('Deleted file:', fullPath);
          }
        }
      });

      await db.run(`DELETE FROM messages WHERE id IN (${ids.join(',')})`);
      io.emit('messages_deleted', ids);
    }
  }, 5000); // Check every 5 seconds for snappier disappearance

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('join', (userId) => {
      console.log(`Socket ${socket.id} joining room user:${userId}`);
      socket.join(userId.toString());
    });

    socket.on('send_message', async (data) => {
      console.log('Server received message:', data);
      const { sender_id, receiver_id, content, type = 'text', file_path = null } = data;
      const created_at = Date.now();

      try {
        const result = await db.run(
          'INSERT INTO messages (sender_id, receiver_id, content, type, file_path, created_at, is_seen) VALUES (?, ?, ?, ?, ?, ?, 0)',
          sender_id, receiver_id, content, type, file_path, created_at
        );

        const message = { id: result.lastID, sender_id, receiver_id, content, type, file_path, created_at, is_seen: 0 };

        console.log(`Emitting to ${receiver_id} and ${sender_id}`);
        io.to(receiver_id.toString()).emit('new_message', message);
        io.to(sender_id.toString()).emit('new_message', message);
      } catch (e) {
        console.error('Error saving message:', e);
      }
    });

    socket.on('mark_seen', async (messageIds) => {
      console.log('Marking seen:', messageIds);
      if (!messageIds || messageIds.length === 0) return;

      const now = Date.now();
      const placeholders = messageIds.map(() => '?').join(',');
      await db.run(
        `UPDATE messages SET is_seen = 1, seen_at = ? WHERE id IN (${placeholders}) AND is_seen = 0`,
        now, ...messageIds
      );

      const messages = await db.all(`SELECT * FROM messages WHERE id IN (${placeholders})`, ...messageIds);
      messages.forEach(msg => {
        io.to(msg.sender_id.toString()).emit('message_status_update', { id: msg.id, is_seen: 1, seen_at: now });
        io.to(msg.receiver_id.toString()).emit('message_status_update', { id: msg.id, is_seen: 1, seen_at: now });
      });
    });

    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, (err) => {
    if (err) throw err;
    console.log(`> Ready on http://localhost:${PORT}`);
  });
});
