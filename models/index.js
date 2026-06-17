'use strict';

const sequelize = require('../db');
const defineModels = require('./model');
const defineAdmin = require('./adminmodel');
const defineTeamMember = require('./teammember');
const definePartnerTeamMember = require('./partnerteammember');

const { Partner, MemorialRequest, RequestPhoto } = defineModels(sequelize);
const { Admin } = defineAdmin(sequelize);
const { TeamMember } = defineTeamMember(sequelize);
const { PartnerTeamMember } = definePartnerTeamMember(sequelize);

// Set up associations
TeamMember.belongsTo(Admin, { foreignKey: 'admin_id', as: 'admin' });
TeamMember.belongsTo(Admin, { foreignKey: 'invited_by_admin_id', as: 'invitedByAdmin' });

PartnerTeamMember.belongsTo(Partner, { foreignKey: 'partner_id', as: 'partner' });
PartnerTeamMember.belongsTo(Partner, { foreignKey: 'invited_by_partner_id', as: 'invitedByPartner' });

module.exports = { Admin, Partner, MemorialRequest, RequestPhoto, TeamMember, PartnerTeamMember };