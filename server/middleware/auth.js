const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'bamuflih-secret';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'غير مصرح - يرجى تسجيل الدخول' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(403).json({ error: 'رمز غير صالح' });
  }
}

module.exports = { authenticateToken, JWT_SECRET };
