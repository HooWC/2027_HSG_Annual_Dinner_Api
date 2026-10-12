const db = require('../_helpers/db');
const sql = require('mssql');
const deviceCheckinsService = require('../DEVICECHECKINS/devicecheckins.service');

module.exports = {
    getByEmployeeId,
    checkIn,
    scanCheckIn
};

const TABLE = 'Users';

function mapRow(r) {
    return {
        Id: r.Id,
        EmployeeId: r.EmployeeId,
        FullName: r.FullName,
        Department: r.Department,
        Thumping: !!r.Thumping
    };
}

async function getByEmployeeId(employeeId) {
    const conn = await db.getConnection();
    const res = await conn.request()
        .input('employeeId', sql.NVarChar(50), employeeId)
        .query(`SELECT * FROM ${TABLE} WHERE UPPER(LTRIM(RTRIM(EmployeeId))) = UPPER(LTRIM(RTRIM(@employeeId)))`);

    if (!res.recordset || res.recordset.length === 0) {
        throw 'Employee not found';
    }

    return mapRow(res.recordset[0]);
}

/**
 * Scanner check-in: match EmployeeId, set Thumping = 1.
 * Atomic UPDATE prevents double check-in under concurrent scanners.
 */
async function scanCheckIn(employeeId, fullName) {
    const conn = await db.getConnection();

    const existing = await conn.request()
        .input('employeeId', sql.NVarChar(50), employeeId)
        .query(`SELECT * FROM ${TABLE} WHERE UPPER(LTRIM(RTRIM(EmployeeId))) = UPPER(LTRIM(RTRIM(@employeeId)))`);

    if (!existing.recordset || existing.recordset.length === 0) {
        throw 'Employee not found';
    }

    const user = mapRow(existing.recordset[0]);

    if (user.Thumping) {
        throw 'Employee already checked in';
    }

    // Atomic update: only one concurrent request can flip Thumping to 1
    const updateResult = await conn.request()
        .input('employeeId', sql.NVarChar(50), user.EmployeeId)
        .query(`
            UPDATE ${TABLE}
            SET Thumping = 1
            OUTPUT INSERTED.EmployeeId, INSERTED.FullName, INSERTED.Department
            WHERE EmployeeId = @employeeId
              AND (Thumping = 0 OR Thumping IS NULL)
        `);

    if (!updateResult.recordset || updateResult.recordset.length === 0) {
        throw 'Employee already checked in';
    }

    const row = updateResult.recordset[0];
    return {
        success: true,
        employeeId: row.EmployeeId,
        fullName: row.FullName,
        department: row.Department,
        message: `Check-in successful! Welcome, ${row.FullName}.`
    };
}

async function checkIn(employeeId, deviceId) {
    if (!deviceId) {
        throw 'Device ID is required';
    }

    const existingDevice = await deviceCheckinsService.getByDeviceId(deviceId);
    if (existingDevice) {
        throw 'Device already checked in';
    }

    const user = await getByEmployeeId(employeeId);

    if (user.Thumping) {
        throw 'Employee already checked in';
    }

    const conn = await db.getConnection();
    const transaction = new sql.Transaction(conn);
    await transaction.begin();

    try {
        const updateRequest = new sql.Request(transaction);
        const updateResult = await updateRequest
            .input('employeeId', sql.NVarChar(50), user.EmployeeId)
            .query(`
                UPDATE ${TABLE}
                SET Thumping = 1
                WHERE EmployeeId = @employeeId
                  AND (Thumping = 0 OR Thumping IS NULL)
            `);

        if (!updateResult.rowsAffected || updateResult.rowsAffected[0] === 0) {
            throw 'Employee already checked in';
        }

        await deviceCheckinsService.registerDevice(deviceId, user.EmployeeId, transaction);

        await transaction.commit();
    } catch (error) {
        await transaction.rollback();
        throw error;
    }

    return {
        success: true,
        employeeId: user.EmployeeId,
        fullName: user.FullName,
        department: user.Department,
        deviceId,
        message: 'Check-in successful! Welcome to the Annual Dinner.'
    };
}
