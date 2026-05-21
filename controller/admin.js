'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_env';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

// ─── Helper ───────────────────────────────────────────────────────────────────
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

  // ══════════════════════════════════════════════════════════════════════════
  // AUTH
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * POST /admin/register
   * Body: { email, password }
   * Creates the first / additional admin accounts.
   * Protect this endpoint in production (e.g. a one-time setup secret).
   */
  const register = safe(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required.' });

    const exists = await Admin.findOne({ where: { email } });
    if (exists)
      return res.status(409).json({ message: 'An admin with that email already exists.' });

    const hashed = await bcrypt.hash(password, 12);
    const admin = await Admin.create({ email, password: hashed });

    res.status(201).json({
      message: 'Admin account created.',
      admin: { id: admin.id, email: admin.email },
    });
  });

  /**
   * POST /admin/login
   * Body: { email, password }
   */
  const login = safe(async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: 'Email and password are required.' });

    const admin = await Admin.findOne({ where: { email } });
    if (!admin)
      return res.status(401).json({ message: 'Invalid credentials.' });

    const valid = await bcrypt.compare(password, admin.password);
    if (!valid)
      return res.status(401).json({ message: 'Invalid credentials.' });

    const token = jwt.sign(
      { id: admin.id, email: admin.email, role: 'admin' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    res.json({
      token,
      admin: { id: admin.id, email: admin.email },
    });
  });

  /**
   * POST /admin/reset-password
   * Body: { email, newPassword }
   */
  const resetPassword = safe(async (req, res) => {
    const { email, newPassword } = req.body;

    if (!email || !newPassword)
      return res.status(400).json({ message: 'Email and newPassword are required.' });

    const admin = await Admin.findOne({ where: { email } });
    if (!admin)
      return res.status(404).json({ message: 'Admin not found.' });

    admin.password = await bcrypt.hash(newPassword, 12);
    await admin.save();

    res.json({ message: 'Password updated successfully.' });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // PARTNERS  (all routes require adminAuth middleware)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * GET /admin/partners
   * Returns all partners (role = 'partner' | 'admin').
   */
  const getAllPartners = safe(async (req, res) => {
    const partners = await Partner.findAll({
      attributes: ['id', 'username', 'email', 'role', 'createdAt', 'updatedAt'],
      order: [['created_at', 'DESC']],
    });

    res.json({ partners });
  });

  /**
   * GET /admin/partners/:id
   * Returns a single partner with their requests.
   */
  const getPartner = safe(async (req, res) => {
    const partner = await Partner.findByPk(req.params.id, {
      attributes: ['id', 'username', 'email', 'role', 'createdAt', 'updatedAt'],
      include: [
        {
          model: MemorialRequest,
          as: 'requests',
          attributes: ['id', 'packageType', 'packagePrice', 'customerName', 'status', 'createdAt'],
        },
      ],
    });

    if (!partner)
      return res.status(404).json({ message: 'Partner not found.' });

    res.json({ partner });
  });

  /**
   * PUT /admin/partners/:id
   * Body: { username?, email?, role?, password? }
   * Updates partner fields. Password is re-hashed if provided.
   */
  const updatePartner = safe(async (req, res) => {
    const partner = await Partner.findByPk(req.params.id);
    if (!partner)
      return res.status(404).json({ message: 'Partner not found.' });

    const { username, email, role, password } = req.body;

    if (username !== undefined) partner.username = username;
    if (email     !== undefined) partner.email    = email;
    if (role      !== undefined) {
      if (!['partner', 'admin'].includes(role))
        return res.status(400).json({ message: "Role must be 'partner' or 'admin'." });
      partner.role = role;
    }
    if (password) partner.password = await bcrypt.hash(password, 12);

    await partner.save();

    res.json({
      message: 'Partner updated.',
      partner: {
        id: partner.id,
        username: partner.username,
        email: partner.email,
        role: partner.role,
      },
    });
  });

  /**
   * DELETE /admin/partners/:id
   * Deletes partner. Their requests have partnerId set to NULL (allowNull: true).
   */
  const deletePartner = safe(async (req, res) => {
    const partner = await Partner.findByPk(req.params.id);
    if (!partner)
      return res.status(404).json({ message: 'Partner not found.' });

    await partner.destroy();
    res.json({ message: 'Partner deleted.' });
  });

  // ══════════════════════════════════════════════════════════════════════════
  // REQUESTS  (all routes require adminAuth middleware)
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * GET /admin/requests
   * Returns all memorial requests with their partner and photos.
   */
  const getAllRequests = safe(async (req, res) => {
    const requests = await MemorialRequest.findAll({
      include: [
        {
          model: Partner,
          as: 'partner',
          attributes: ['id', 'username', 'email'],
        },
        {
          model: RequestPhoto,
          as: 'photos',
          attributes: ['id', 'storagePath'],
        },
      ],
      order: [['created_at', 'DESC']],
    });

    res.json({ requests });
  });

  /**
   * GET /admin/requests/:id
   * Returns a single request in full detail.
   */
  const getRequest = safe(async (req, res) => {
    const request = await MemorialRequest.findByPk(req.params.id, {
      include: [
        { model: Partner,      as: 'partner', attributes: ['id', 'username', 'email'] },
        { model: RequestPhoto, as: 'photos',  attributes: ['id', 'storagePath'] },
      ],
    });

    if (!request)
      return res.status(404).json({ message: 'Request not found.' });

    res.json({ request });
  });

  /**
   * PATCH /admin/requests/:id/status
   * Body: { status: 'pending_approval' | 'approved' | 'completed' }
   */
  const updateRequestStatus = safe(async (req, res) => {
    const { status } = req.body;
    const allowed = ['pending_approval', 'approved', 'completed', 'denied'];

    if (!allowed.includes(status))
      return res.status(400).json({ message: `status must be one of: ${allowed.join(', ')}.` });

    const request = await MemorialRequest.findByPk(req.params.id);
    if (!request)
      return res.status(404).json({ message: 'Request not found.' });

    request.status = status;
    await request.save();

    res.json({ message: 'Status updated.', request: { id: request.id, status: request.status } });
  });

  return {
    // auth
    register,
    login,
    resetPassword,
    // partners
    getAllPartners,
    getPartner,
    updatePartner,
    deletePartner,
    // requests
    getAllRequests,
    getRequest,
    updateRequestStatus,
  };
};