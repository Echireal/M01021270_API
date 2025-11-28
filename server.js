// M01021270_API/server.js
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { MongoClient, ServerApiVersion, ObjectId } from 'mongodb';
import 'dotenv/config';

const app = express();

// ===== 基础中间件 =====
app.use(cors());
app.use(express.json());

// ===== 计算 __dirname（ESM 写法）=====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== 自定义 logger 中间件（要求 A）=====
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

// ===== 静态图片中间件（要求 B）=====
// 访问示例：GET /images/lessons/lesson1.jpg
app.get('/images/lessons/:file', (req, res) => {
  const file = req.params.file;
  const abs = path.join(__dirname, 'public', 'images', 'lessons', file);
  if (fs.existsSync(abs)) {
    return res.sendFile(abs);
  }
  return res.status(404).json({ error: 'Image not found', file });
});

// 可选：把 public 暴露出来（例如 /logo.png）
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
// 如果 URI 里已经带了 db 名（例如 .../fullstack-cw1?...），这里的 db() 就是那个库
const db = client.db();
await db.command({ ping: 1 });
console.log('✅ Connected to MongoDB Atlas');

// 小工具：只允许更新这些字段
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

// ===== A. GET /api/lessons —— 返回全部课程（要求）=====
app.get('/api/lessons', async (_req, res) => {
  try {
    const lessons = await db.collection('lessons').find().toArray();
    res.json(lessons);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ===== B. POST /api/orders —— 保存订单到 orders 集合（要求）=====
// 期望最小字段：name, phone, lessonIds(Array of ObjectId string), spaces(Number)
// 也支持传 items: [{ lessonId, qty }]，我们会自动派生 lessonIds 与 spaces
app.post('/api/orders', async (req, res) => {
  try {
    let { name, phone, lessonIds, spaces, items } = req.body || {};

    // 基础校验
    if (!name || !phone) {
      return res.status(400).json({ error: 'name and phone are required' });
    }

    // 兼容两种 body 形态
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

// 示例：PUT /api/lessons/6761f0...  body: { "space": 3 }
app.put('/api/lessons/:id', async (req, res) => {
  try {
    const id = req.params.id;
    let oid;
    try {
      oid = new ObjectId(id);
    } catch {
      return res.status(400).json({ error: 'Invalid lesson id' });
    }

    // 只允许白名单字段
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
    // 若你想要附带条数与原查询词，也可改为：
    // res.json({ query: raw, count: results.length, results });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// ===== Start service =====
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`🚀 API listening at http://localhost:${port}`);
});
