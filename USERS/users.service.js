const fs = require('fs');
const path = require('path');
const db = require('../_helpers/db');
const sql = require('mssql');
const config = require('../config.json');
const deviceCheckinsService = require('../DEVICECHECKINS/devicecheckins.service');

module.exports = {
    getByEmployeeId,
    findAvatarFile,
    checkIn,
    scanCheckIn
};

const AVATAR_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

const TABLE = 'Users';

function mapRow(r) {
    const employeeId = r.EmployeeId;
    const avatarFile = findAvatarFile(employeeId);
    return {
        Id: r.Id,
        EmployeeId: employeeId,
        FullName: r.FullName,
        Department: r.Department,
        Thumping: !!r.Thumping,
        avatarUrl: avatarFile
            ? `/USERS/avatar/${encodeURIComponent(String(employeeId).trim())}`
            : null
    };
}

const employeeLocks = new Map();

function withEmployeeLock(employeeId, task) {
    const key = String(employeeId || '').trim().toUpperCase();
    const previous = employeeLocks.get(key) || Promise.resolve();
    const current = previous.catch(() => {}).then(task);
    const tracked = current.finally(() => {
        if (employeeLocks.get(key) === tracked) {
            employeeLocks.delete(key);
        }
    });
    employeeLocks.set(key, tracked);
    return current;
}

function findAvatarFile(employeeId) {
    const id = String(employeeId || '').trim();
    if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) {
        return null;
    }

    const dir = config.avatarDir;
    if (!dir) {
        return null;
    }

    for (const ext of AVATAR_EXTENSIONS) {
        const filePath = path.join(dir, id + ext);
        try {
            if (fs.existsSync(filePath)) {
                return filePath;
            }
        } catch (err) {
            console.error('[API] Avatar lookup failed:', err.message);
            return null;
        }
    }

    return null;
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
async function scanCheckIn(employeeId) {
    return withEmployeeLock(employeeId, async () => {
        const conn = await db.getConnection();

        // One atomic write. Two scanners of the same person cannot both succeed.
        const updateResult = await conn.request()
            .input('employeeId', sql.NVarChar(50), employeeId)
            .query(`
                UPDATE ${TABLE}
                SET Thumping = 1
                OUTPUT INSERTED.EmployeeId, INSERTED.FullName, INSERTED.Department
                WHERE UPPER(LTRIM(RTRIM(EmployeeId))) = UPPER(LTRIM(RTRIM(@employeeId)))
                  AND (Thumping = 0 OR Thumping IS NULL)
            `);

        if (updateResult.recordset && updateResult.recordset.length > 0) {
            const row = updateResult.recordset[0];
            return {
                success: true,
                employeeId: row.EmployeeId,
                fullName: row.FullName,
                department: row.Department,
                message: `Check-in successful! Welcome, ${row.FullName}.`
            };
        }

        const existing = await conn.request()
            .input('employeeId', sql.NVarChar(50), employeeId)
            .query(`SELECT TOP 1 EmployeeId FROM ${TABLE} WHERE UPPER(LTRIM(RTRIM(EmployeeId))) = UPPER(LTRIM(RTRIM(@employeeId)))`);

        if (!existing.recordset || existing.recordset.length === 0) {
            throw 'Employee not found';
        }

        throw 'Employee already checked in';
    });
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
