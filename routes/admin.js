'use strict';

const { Router } = require('express');
const adminAuth = require('../middleware/admin');

const { MemorialRequest, RequestPhoto,Partner } = require('../models');
module.exports = (models) => {
  const router = Router();
  const controller = require('../controller/admin')(models); // ← pass models here

 
  // Public
  router.get('/requests/:id/documents', async (req, res) => {
    const docs = await RequestPhoto.findAll({ where: { requestId: req.params.id } });
    res.json({ documents: docs });
  });
  router.post('/register',       controller.register);
  router.post('/login',          controller.login);
  router.post('/reset-password', controller.resetPassword);

  // Protected
  router.use(adminAuth);

  router.post('/requests/:id/documents', ...controller.uploadDocuments);
  router.post('/team-members/invite', controller.inviteTeamMember);
  // Partners
  router.get   ('/partners',     controller.getAllPartners);
  router.get   ('/partners/:id', controller.getPartner);
  router.put   ('/partners/:id', controller.updatePartner);
  router.delete('/partners/:id', controller.deletePartner);

  // Requests
  router.get  ('/requests',            controller.getAllRequests);
  router.get  ('/requests/:id',        controller.getRequest);
  router.patch('/requests/:id/status', controller.updateRequestStatus);
router.patch('/requests/:id/price',controller.updateRequestPrice)
  router.get('/me', controller.checkAdminRole);
  router.get('/team-members', controller.getTeamMembers);


  router.patch('/partner-team-members/:id/approve', controller.approvePartnerTeamMember);
  router.patch('/partner-team-members/:id/deny',    controller.denyPartnerTeamMember);
  router.get('/partner-team-members', controller.getAllPartnerTeamMembers);
  return router;
};