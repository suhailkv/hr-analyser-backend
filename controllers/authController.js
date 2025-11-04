const db = require('../models');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const Admin = db.Admin;

const register = async (req, res) => {
  try {
    const { email, full_name, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'email & password required' });

    const existing = await Admin.findOne({ where: { email } });
    if (existing) return res.status(400).json({ message: 'email already exists' });

    const hash = await bcrypt.hash(password, 10);
    const admin = await Admin.create({ email, full_name, password_hash: hash });
    return res.status(201).json({ id: admin.id, email: admin.email });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'server error' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'email & password required' });

    const admin = await Admin.findOne({ where: { email } });
    if (!admin) return res.status(401).json({ message: 'invalid credentials' });

    const valid = await admin.validatePassword(password);
    if (!valid) return res.status(401).json({ message: 'invalid credentials' });

    const token = jwt.sign({ id: admin.id, email: admin.email }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
    return res.json({ token });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'server error' });
  }
};

module.exports = { register, login };
