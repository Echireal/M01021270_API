import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { MongoClient, ServerApiVersion, ObjectId } from 'mongodb';
import 'dotenv/config';

const app = express();

app.use(cors());
app.use(express.json());// Caution: use JSON to post in postman, not text

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== logger middleware =====
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - startedAt;
    const time = new Date().toISOString();
    const ua = req.headers['user-agent'] || '';
    const ip = req.ip || req.socket?.remoteAddress || '';
    console.log(`[${time}] ${res.statusCode} ${req.method} ${req.originalUrl} ${ms}ms ip=${ip} ua=${ua}`);
  });
  next();
});

// ===== imgae middleware =====
app.get('/images/lessons/:file', (req, res) => {
  const file = req.params.file;
  const abs = path.join(__dirname, 'public', 'images', 'lessons', file);
  if (fs.existsSync(abs)) {
    return res.sendFile(abs);
  }
  return res.status(404).json({ error: 'Image not found', file });
});

app.use(express.static(path.join(__dirname, 'public')));

// ===== Connect MongoDB Atlas =====
const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error('Missing MONGODB_URI in .env');
}
const client = new MongoClient(uri, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

await client.connect();
const db = client.db();
await db.command({ ping: 1 });
console.log('✅ Connected to MongoDB Atlas');

// only update these fields
const ALLOWED_LESSON_FIELDS = new Set(['topic', 'price', 'location', 'space', 'desc']);

// ===== Health Check =====
app.get('/api/health', async (_req, res) => {
  try {
    await db.command({ ping: 1 });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

// GET lessons
app.get('/api/lessons', async (_req, res) => {
  try {
    const lessons = await db.collection('lessons').find().toArray();
    res.json(lessons);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// POST orders
app.post('/api/orders', async (req, res) => {
  try {
    let { name, phone, lessonIds, spaces, items } = req.body || {};

    // validation
    if (!name || !phone) {
      return res.status(400).json({ error: 'name and phone are required' });
    }

    if (Array.isArray(items) && items.length > 0) {
      const ids = [];
      let totalSpaces = 0;
      for (const it of items) {
        if (!it.lessonId || !it.qty) continue;
        ids.push(String(it.lessonId));
        totalSpaces += Number(it.qty) || 0;
      }
      lessonIds = ids;
      spaces = totalSpaces;
    }

    if (!Array.isArray(lessonIds) || typeof spaces !== 'number') {
      return res.status(400).json({ error: 'lessonIds(Array) and spaces(Number) are required' });
    }

    // Insert Order
    const doc = {
      name,
      phone,
      lessonIds,
      spaces,
      createdAt: new Date(),
    };
    const result = await db.collection('orders').insertOne(doc);
    res.status(201).json({ insertedId: result.insertedId, ...doc });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// PUT update lessons
app.put('/api/lessons/:id', async (req, res) => {
  try {
    const id = req.params.id;
    let oid;
    try {
      oid = new ObjectId(id);
    } catch {
      return res.status(400).json({ error: 'Invalid lesson id' });
    }

    // only update Allowed fields
    const updates = {};
    for (const [k, v] of Object.entries(req.body || {})) {
      if (ALLOWED_LESSON_FIELDS.has(k)) updates[k] = v;
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const result = await db.collection('lessons').updateOne(
      { _id: oid },
      { $set: updates }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Lesson not found' });
    }

    res.json({ ok: true, matchedCount: result.matchedCount, modifiedCount: result.modifiedCount });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const raw = (req.query.q ?? '').toString().trim();
    if (!raw) return res.status(400).json({ error: 'q is required' });

    // topic, location
    const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const ciRegex = new RegExp(escaped, 'i');

    // if q == number, consider, price/space
    const asNumber = Number(raw);
    const isNumeric = Number.isFinite(asNumber);

    const filter = {
      $or: [
        { topic: { $regex: ciRegex } },
        { location: { $regex: ciRegex } },
        ...(isNumeric ? [{ price: asNumber }, { space: asNumber }] : []),
      ],
    };

    const results = await db.collection('lessons').find(filter).toArray();
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ===== Start service =====
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`API listening at http://localhost:${port}`);
});
