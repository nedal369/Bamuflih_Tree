const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { JWT_SECRET, authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Login
router.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبان' });
  }

  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user) {
    return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
  }

  const validPassword = bcrypt.compareSync(password, user.password_hash);
  if (!validPassword) {
    return res.status(401).json({ error: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
  }

  if (user.status === 'pending') {
    return res.status(403).json({ error: 'حسابك بانتظار الموافقة من الإدارة' });
  }
  if (user.status === 'rejected') {
    return res.status(403).json({ error: 'تم رفض حسابك' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, member_id: user.member_id },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: { id: user.id, username: user.username, full_name: user.full_name, role: user.role, member_id: user.member_id, status: user.status }
  });
});

// Register
router.post('/register', (req, res) => {
  const { username, password, full_name } = req.body;

  if (!username || !password || !full_name) {
    return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'اسم المستخدم مستخدم بالفعل' });
  }

  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (username, password_hash, full_name, role, status) VALUES (?, ?, ?, ?, ?)').run(
    username, hash, full_name, 'pending', 'pending'
  );

  res.status(201).json({ message: 'تم إنشاء الحساب بنجاح. بانتظار موافقة الإدارة.' });
});

// Get current user info
router.get('/me', authenticateToken, (req, res) => {
  const user = db.prepare('SELECT id, username, full_name, role, member_id, status FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });
  res.json(user);
});

// Admin: list all users
router.get('/users', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });
  const users = db.prepare('SELECT id, username, full_name, role, member_id, status, created_at FROM users ORDER BY created_at DESC').all();
  res.json(users);
});

// Admin: approve/reject user
router.put('/users/:id/status', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });

  const { status, role, member_id } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });

  db.prepare('UPDATE users SET status = ?, role = ?, member_id = ? WHERE id = ?').run(
    status || user.status,
    role || user.role,
    member_id !== undefined ? member_id : user.member_id,
    req.params.id
  );

  const updated = db.prepare('SELECT id, username, full_name, role, member_id, status FROM users WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// Admin: delete user
router.delete('/users/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });
  db.prepare('DELETE FROM users WHERE id = ? AND role != ?').run(req.params.id, 'admin');
  res.json({ message: 'تم حذف المستخدم' });
});

module.exports = router;
