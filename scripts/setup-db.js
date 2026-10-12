const fs = require('fs');
const path = require('path');
const db = require('../_helpers/db');

async function setup() {
    const sqlPath = path.join(__dirname, '..', 'sql', 'DeviceCheckins.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const conn = await db.getConnection();

    const exists = await conn.request().query(`
        SELECT 1 AS found
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'DeviceCheckins'
    `);

    if (exists.recordset.length > 0) {
        console.log('[Setup] DeviceCheckins table already exists.');
        process.exit(0);
    }

    await conn.request().query(sql.replace(/\r?\nGO\r?\n?/gi, '\n'));
    console.log('[Setup] DeviceCheckins table created successfully.');
    process.exit(0);
}

setup().catch(err => {
    console.error('[Setup] Failed:', err.message || err);
    process.exit(1);
});
