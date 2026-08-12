'use strict';

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const mailgun = require('mailgun.js');
const FormData = require('form-data');
const authenticate = require('../middleware/middleware');
const { MemorialRequest, RequestPhoto } = require('../models');

const mg = new mailgun(FormData);
const client = mg.client({
  username: 'api',
  key: process.env.MAILGUN_API_KEY,
});
const domain = process.env.MAILGUN_DOMAIN;

const PACKAGE_LABELS = {
  basic_annual: { label: 'Basic Annual', price: '$549' },
  premium_annual: { label: 'Premium Annual', price: '$749' },
};

// storagePath is whatever createRequest saved it as. If it's already absolute
// it's used as-is; otherwise it's resolved relative to PHOTOS_ROOT.
// Adjust PHOTOS_ROOT if your uploadPhotos middleware saves files elsewhere.
const PHOTOS_ROOT = '/tmp/public/files';

router.post('/send-payment-request', authenticate, async (req, res) => {
  try {
    const { packageType, requestId } = req.body;

    if (!packageType || !PACKAGE_LABELS[packageType]) {
      return res.status(400).json({ message: 'Invalid or missing packageType.' });
    }
    if (!requestId) {
      return res.status(400).json({ message: 'Missing requestId.' });
    }

    // Confirm this request belongs to the logged-in partner before attaching anything
    const memorialRequest = await MemorialRequest.findOne({
      where: { id: requestId, partnerId: req.partner.id },
      include: [{ model: RequestPhoto, as: 'photos' }],
    });

    if (!memorialRequest) {
      return res.status(404).json({ message: 'Request not found.' });
    }

    const partnerName = req.partner?.contactName || req.partner?.username || 'Unknown Partner';
    const partnerEmail = req.partner?.email || 'Unknown Email';
    const { label, price } = PACKAGE_LABELS[packageType];

    const subject = `Payment Request — ${label} (${partnerName})`;
    const text = [
      `A partner has requested payment processing for a restoration package.`,
      ``,
      `Package: ${label}`,
      `Price: ${price}`,
      ``,
      `Partner Name: ${partnerName}`,
      `Partner Email: ${partnerEmail}`,
      ``,
      `Customer: ${memorialRequest.customerName}`,
      `Memorial Location: ${memorialRequest.memorialLocation}`,
    ].join('\n');

    // Build Mailgun attachments from photos that actually exist on disk
    const attachments = [];
    for (const photo of memorialRequest.photos || []) {
      const filePath = path.isAbsolute(photo.storagePath)
        ? photo.storagePath
        : path.join(PHOTOS_ROOT, photo.storagePath);

      if (fs.existsSync(filePath)) {
        attachments.push({
          filename: path.basename(filePath),
          data: fs.readFileSync(filePath),
        });
      } else {
        console.warn(`Photo file missing on disk, skipping: ${filePath}`);
      }
    }

    const messageData = {
      from: `Lasting Legacy Cleaners <no-reply@${domain}>`,
      to: ['Shipmate2134@gmail.com'],
      subject,
      text,
    };

    if (attachments.length > 0) {
      messageData.attachment = attachments;
    }

    await client.messages.create(domain, messageData);

    return res.status(200).json({ message: 'Payment request email sent.' });
  } catch (err) {
    console.error('Mailgun send failed:', err);
    return res.status(500).json({ message: 'Failed to send payment request email.' });
  }
});

module.exports = router;