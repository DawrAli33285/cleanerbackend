'use strict';

const sequelize = require('../db');
const defineModels = require('./model');
const defineAdmin = require('./adminmodel');

const { Partner, MemorialRequest, RequestPhoto } = defineModels(sequelize);
const { Admin } = defineAdmin(sequelize);

module.exports = { Admin, Partner, MemorialRequest, RequestPhoto };