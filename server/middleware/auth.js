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
  } catch (err) {
    const isExpired = err.name === 'TokenExpiredError';
    return res.status(401).json({ error: isExpired ? 'انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً' : 'رمز غير صالح' });
  }
}

module.exports = { authenticateToken, JWT_SECRET };
