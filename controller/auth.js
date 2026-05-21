'use strict';

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Partner } = require('../models');
const JWT_SECRET = process.env.JWT_SECRET;

// REGISTER
const register = async (req, res) => {
  try {
    const { username, password, role, fullName, organization, phone } = req.body;
    const email = username; // frontend sends email as username

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const existing = await Partner.findOne({ where: { email } });
    if (existing) {
      return res.status(409).json({ message: 'Email already registered.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const partner = await Partner.create({
      username: email,
      email,
      password: passwordHash,
      role: role === 'admin' ? 'admin' : 'partner',
      fullName,
      organization,
      phone,
    });

    return res.status(201).json({
      message: 'Account created successfully.',
      partner: { id: partner.id, username: partner.username, role: partner.role },
    });
  } catch (err) {
    console.log(err.message)
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};

// LOGIN
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const partner = await Partner.findOne({ where: { email } });

    if (!partner) {
      console.log('❌ No partner found for email:', email);
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    console.log('✅ Partner found:', partner.email);
    console.log('🔑 Password from DB:', partner.password);

    const isMatch = await bcrypt.compare(password, partner.password);
    console.log('🔐 Password match:', isMatch);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }
    console.log('🔑 JWT_SECRET:', JWT_SECRET);
    const token = jwt.sign(
      { id: partner.id, role: partner.role },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    return res.status(200).json({
      message: 'Login successful.',
      token,
      partner: { id: partner.id, username: partner.username, role: partner.role },
    });
  } catch (err) {
    console.log('💥 Login error:', err.message);
    return res.status(500).json({ message: 'Server error.', error: err.message });
  }
};


// RESET PASSWORD
const resetPassword = async (req, res) => {
    try {
      const { email, newPassword } = req.body;
  
      if (!email || !newPassword) {
        return res.status(400).json({ message: 'Email and new password are required.' });
      }
  
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        return res.status(400).json({ message: 'Please enter a valid email address.' });
      }
  
      if (newPassword.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters.' });
      }
  
  const partner = await Partner.findOne({ where: { email } });
      if (!partner) {
        return res.status(404).json({ message: 'No account found with that email.' });
      }
  
      const passwordHash = await bcrypt.hash(newPassword, 10);
      await partner.update({ password: passwordHash });
  
      return res.status(200).json({ message: 'Password updated successfully.' });
    } catch (err) {
      console.log(err.message);
      return res.status(500).json({ message: 'Server error.', error: err.message });
    }
  };

module.exports = { register, login , resetPassword};