'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_env';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join('/tmp/public/files');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

const safe = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    console.error('[AdminController]', err);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = (models) => {
  const { Admin, Partner, MemorialRequest, RequestPhoto } = models;

  // ── AUTH ──────────────────────────────────────────────────────────────────

  const register = safe(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required.' });

    const exists = await Admin.findOne({ where: { email } });
    if (exists)
      return res.status(409).json({ message: 'An admin with that email already exists.' });

    const hashed = await bcrypt.hash(password, 12);
    const admin = await Admin.create({ email, password: hashed });

    res.status(201).json({ message: 'Admin account created.', admin: { id: admin.id, email: admin.email } });
  });

  const login = safe(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required.' });

    const admin = await Admin.findOne({ where: { email } });
    if (!admin) return res.status(401).json({ message: 'Invalid credentials.' });

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid) return res.status(401).json({ message: 'Invalid credentials.' });

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: 'admin' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    res.json({ token, admin: { id: admin.id, email: admin.email } });
  });

  const resetPassword = safe(async (req, res) => {
    const { email, newPassword } = req.body;
    if (!email || !newPassword)
      return res.status(400).json({ message: 'Email and newPassword are required.' });

    const admin = await Admin.findOne({ where: { email } });
    if (!admin) return res.status(404).json({ message: 'Admin not found.' });

    admin.password = await bcrypt.hash(newPassword, 12);
    await admin.save();

    res.json({ message: 'Password updated successfully.' });
  });

  // ── PARTNERS ──────────────────────────────────────────────────────────────

  const getAllPartners = safe(async (req, res) => {
    const partners = await Partner.findAll({
      attributes: ['id', 'username', 'email', 'role', 'createdAt', 'updatedAt'],
      order: [['created_at', 'DESC']],
    });
    res.json({ partners });
  });

  const getPartner = safe(async (req, res) => {
    const partner = await Partner.findByPk(req.params.id, {
      attributes: ['id', 'username', 'email', 'role', 'createdAt', 'updatedAt'],
      include: [{
        model: MemorialRequest,
        as: 'requests',
        attributes: ['id', 'packageType', 'packagePrice', 'customerName', 'status', 'createdAt'],
      }],
    });
    if (!partner) return res.status(404).json({ message: 'Partner not found.' });
    res.json({ partner });
  });

  const updatePartner = safe(async (req, res) => {
    const partner = await Partner.findByPk(req.params.id);
    if (!partner) return res.status(404).json({ message: 'Partner not found.' });

    const { username, email, role, password } = req.body;
    if (username !== undefined) partner.username = username;
    if (email !== undefined) partner.email = email;
    if (role !== undefined) {
      if (!['partner', 'admin'].includes(role))
        return res.status(400).json({ message: "Role must be 'partner' or 'admin'." });
      partner.role = role;
    }
    if (password) partner.password = await bcrypt.hash(password, 12);
    await partner.save();

    res.json({ message: 'Partner updated.', partner: { id: partner.id, username: partner.username, email: partner.email, role: partner.role } });
  });

  const deletePartner = safe(async (req, res) => {
    const partner = await Partner.findByPk(req.params.id);
    if (!partner) return res.status(404).json({ message: 'Partner not found.' });
    await partner.destroy();
    res.json({ message: 'Partner deleted.' });
  });

  // ── REQUESTS ──────────────────────────────────────────────────────────────

  const getAllRequests = safe(async (req, res) => {
    const requests = await MemorialRequest.findAll({
      include: [
        { model: Partner,      as: 'partner', attributes: ['id', 'username', 'email'] },
        { model: RequestPhoto, as: 'photos',  attributes: ['id', 'storagePath'] },
      ],
      order: [['created_at', 'DESC']],
    });
    res.json({ requests });
  });

  const getRequest = safe(async (req, res) => {
    const request = await MemorialRequest.findByPk(req.params.id, {
      include: [
        { model: Partner,      as: 'partner', attributes: ['id', 'username', 'email'] },
        { model: RequestPhoto, as: 'photos',  attributes: ['id', 'storagePath'] },
      ],
    });
    if (!request) return res.status(404).json({ message: 'Request not found.' });
    res.json({ request });
  });

  const updateRequestStatus = safe(async (req, res) => {
    const { status, adminNotes } = req.body;
    const allowed = ['pending_approval', 'approved', 'completed', 'denied'];

    if (!allowed.includes(status))
      return res.status(400).json({ message: `status must be one of: ${allowed.join(', ')}.` });

    const request = await MemorialRequest.findByPk(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found.' });

    // Use email directly from JWT — no Partner lookup needed
    const adminName = req.admin.email;

    request.status = status;
    if (adminNotes !== undefined) request.adminNotes = adminNotes;

    if (status === 'approved') {
      request.approvedBy = adminName;
      request.approvedAt = new Date();
      request.deniedBy   = null;
      request.deniedAt   = null;
    }
    if (status === 'denied') {
      request.deniedBy   = adminName;
      request.deniedAt   = new Date();
      request.approvedBy = null;
      request.approvedAt = null;
    }

    await request.save();

    res.json({
      message: 'Status updated.',
      request: {
        id:         request.id,
        status:     request.status,
        adminNotes: request.adminNotes,
        approvedBy: request.approvedBy,
        approvedAt: request.approvedAt,
        deniedBy:   request.deniedBy,
        deniedAt:   request.deniedAt,
      },
    });
  });

  // ── DOCUMENTS — must be an array, NOT wrapped in safe() ──────────────────

  const uploadDocuments = [
    upload.array('documents'),
    async (req, res) => {
      try {
        console.log('[uploadDocuments] called, files:', req.files?.length);
  
        if (!req.files || req.files.length === 0) {
          return res.status(400).json({ message: 'No files received.' });
        }
  
        const { id } = req.params;
  
        const request = await MemorialRequest.findByPk(id);
        if (!request) {
          return res.status(404).json({ message: 'Request not found.' });
        }
  
        // ← this part was missing from your debug version
        const records = await Promise.all(
          req.files.map(f => {
            const relativePath = path.relative(path.join(__dirname, '..'), f.path);
            console.log('[uploadDocuments] inserting:', relativePath);
            return RequestPhoto.create({ requestId: id, storagePath: relativePath });
          })
        );
  
        res.json({
          message: `${records.length} document(s) uploaded successfully.`,
          files: req.files.map(f => ({ originalName: f.originalname, filename: f.filename })),
          count: records.length,
        });
  
      } catch (e) {
        console.error('[uploadDocuments] error:', e);
        res.status(500).json({ message: e.message });
      }
    },
  ];
  return {
    register,
    login,
    resetPassword,
    getAllPartners,
    getPartner,
    updatePartner,
    deletePartner,
    getAllRequests,
    getRequest,
    updateRequestStatus,
    uploadDocuments,  
  };
};