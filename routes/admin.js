'use strict';

const { Router } = require('express');
const adminAuth = require('../middleware/admin');

module.exports = (models) => {
  const router = Router();
  const controller = require('../controller/admin')(models); // ← pass models here

  // Public
  router.post('/register',       controller.register);
  router.post('/login',          controller.login);
  router.post('/reset-password', controller.resetPassword);

  // Protected
  router.use(adminAuth);

  // Partners
  router.get   ('/partners',     controller.getAllPartners);
  router.get   ('/partners/:id', controller.getPartner);
  router.put   ('/partners/:id', controller.updatePartner);
  router.delete('/partners/:id', controller.deletePartner);

  // Requests
  router.get  ('/requests',            controller.getAllRequests);
  router.get  ('/requests/:id',        controller.getRequest);
  router.patch('/requests/:id/status', controller.updateRequestStatus);

  return router;
};