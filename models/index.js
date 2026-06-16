'use strict';

const sequelize = require('../db');
const defineModels = require('./model');
const defineAdmin = require('./adminmodel');
const defineTeamMember = require('./teammember');

const { Partner, MemorialRequest, RequestPhoto } = defineModels(sequelize);
const { Admin } = defineAdmin(sequelize);
const { TeamMember } = defineTeamMember(sequelize);

// Set up associations
TeamMember.belongsTo(Admin, { foreignKey: 'admin_id', as: 'admin' });
TeamMember.belongsTo(Admin, { foreignKey: 'invited_by_admin_id', as: 'invitedByAdmin' });

module.exports = { Admin, Partner, MemorialRequest, RequestPhoto, TeamMember };