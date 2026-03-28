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

  // Admin always allowed; others must be approved
  if (user.role === 'admin') {
    // Auto-fix admin status if needed
    if (user.status !== 'approved') {
      db.prepare('UPDATE users SET status = ? WHERE id = ?').run('approved', user.id);
      user.status = 'approved';
    }
  } else {
    if (!user.status || user.status === 'pending') {
      return res.status(403).json({ error: 'حسابك بانتظار الموافقة من الإدارة' });
    }
    if (user.status === 'rejected') {
      return res.status(403).json({ error: 'تم رفض حسابك' });
    }
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, member_id: user.member_id },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: {
      id: user.id, username: user.username, full_name: user.full_name, role: user.role,
      member_id: user.member_id, status: user.status,
      permission_type: user.permission_type || 'own_subtree',
      allowed_subtrees: user.allowed_subtrees ? JSON.parse(user.allowed_subtrees) : [],
      is_fund_subscriber: !!user.is_fund_subscriber
    }
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
  const users = db.prepare('SELECT id, username, full_name, role, member_id, status, permission_type, allowed_subtrees, is_fund_subscriber, created_at FROM users ORDER BY created_at DESC').all();
  res.json(users.map(u => ({
    ...u,
    allowed_subtrees: u.allowed_subtrees ? JSON.parse(u.allowed_subtrees) : [],
    is_fund_subscriber: !!u.is_fund_subscriber
  })));
});

// Admin: toggle fund subscriber status
router.put('/users/:id/fund-subscriber', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });
  const { is_fund_subscriber } = req.body;
  db.prepare('UPDATE users SET is_fund_subscriber = ? WHERE id = ?').run(is_fund_subscriber ? 1 : 0, req.params.id);
  res.json({ message: 'تم التحديث', is_fund_subscriber: !!is_fund_subscriber });
});

// Admin: create user directly
router.post('/users', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });

  const { username, password, full_name, role, member_id, permission_type, allowed_subtrees } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'اسم المستخدم وكلمة المرور مطلوبان' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'اسم المستخدم مستخدم بالفعل' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const subtreesJson = allowed_subtrees && Array.isArray(allowed_subtrees) ? JSON.stringify(allowed_subtrees) : null;

  db.prepare(
    'INSERT INTO users (username, password_hash, full_name, role, status, member_id, permission_type, allowed_subtrees) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(username, hash, full_name || null, role || 'member', 'approved', member_id || null, permission_type || 'own_subtree', subtreesJson);

  const newUser = db.prepare('SELECT id, username, full_name, role, member_id, status, permission_type, allowed_subtrees FROM users WHERE username = ?').get(username);
  res.status(201).json({
    ...newUser,
    allowed_subtrees: newUser.allowed_subtrees ? JSON.parse(newUser.allowed_subtrees) : []
  });
});

// Admin: approve/reject/update user
router.put('/users/:id/status', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });

  const { status, role, member_id, permission_type, allowed_subtrees } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'المستخدم غير موجود' });

  const subtreesJson = allowed_subtrees !== undefined
    ? (Array.isArray(allowed_subtrees) ? JSON.stringify(allowed_subtrees) : null)
    : user.allowed_subtrees;

  db.prepare('UPDATE users SET status = ?, role = ?, member_id = ?, permission_type = ?, allowed_subtrees = ? WHERE id = ?').run(
    status || user.status,
    role || user.role,
    member_id !== undefined ? member_id : user.member_id,
    permission_type || user.permission_type || 'own_subtree',
    subtreesJson,
    req.params.id
  );

  const updated = db.prepare('SELECT id, username, full_name, role, member_id, status, permission_type, allowed_subtrees FROM users WHERE id = ?').get(req.params.id);
  res.json({
    ...updated,
    allowed_subtrees: updated.allowed_subtrees ? JSON.parse(updated.allowed_subtrees) : []
  });
});

// Admin: delete user
router.delete('/users/:id', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'غير مصرح' });
  db.prepare('DELETE FROM users WHERE id = ? AND role != ?').run(req.params.id, 'admin');
  res.json({ message: 'تم حذف المستخدم' });
});

module.exports = router;
