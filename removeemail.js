'use strict';


const { Admin, sequelize } = require('./models');

const TARGET_EMAIL = 'Jay@AndersonMemorrialPark.com';

(async () => {
  try {
    const admin = await Admin.findOne({
      where: sequelize.where(
        sequelize.fn('LOWER', sequelize.col('email')),
        TARGET_EMAIL.toLowerCase()
      ),
    });

    if (!admin) {
      console.error(`No admin found with email: ${TARGET_EMAIL}`);
      process.exit(1);
    }

    await admin.update({ emailRemindersEnabled: false });

    console.log(`✓ Disabled email reminders for admin #${admin.id} (${admin.email})`);
    process.exit(0);
  } catch (err) {
    console.error('Failed to update admin:', err);
    process.exit(1);
  }
})();