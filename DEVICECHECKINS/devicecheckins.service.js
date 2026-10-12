const db = require('../_helpers/db');
const sql = require('mssql');

module.exports = {
    ensureTable,
    getByDeviceId,
    registerDevice,
    getAll
};

const TABLE = 'DeviceCheckins';
const PRIMARY_KEY = 'Id';

const FIELDS = [
    { name: 'Id', type: sql.Int },
    { name: 'DeviceId', type: sql.NVarChar(100) },
    { name: 'EmployeeId', type: sql.NVarChar(50) },
    { name: 'CheckedInAt', type: sql.DateTime2 }
];

async function ensureTable() {
    const conn = await db.getConnection();
    await conn.request().query(`
        IF NOT EXISTS (
            SELECT 1 FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = '${TABLE}'
        )
        BEGIN
            CREATE TABLE [dbo].[${TABLE}](
                [Id] [int] IDENTITY(1,1) NOT NULL,
                [DeviceId] [nvarchar](100) NOT NULL,
                [EmployeeId] [nvarchar](50) NOT NULL,
                [CheckedInAt] [datetime2] NOT NULL CONSTRAINT [DF_${TABLE}_CheckedInAt] DEFAULT (GETDATE()),
                CONSTRAINT [PK_${TABLE}] PRIMARY KEY CLUSTERED ([Id] ASC),
                CONSTRAINT [UQ_${TABLE}_DeviceId] UNIQUE NONCLUSTERED ([DeviceId] ASC)
            ) ON [PRIMARY]
        END
    `);
}

function mapRow(r) {
    return {
        Id: r.Id,
        DeviceId: r.DeviceId,
        EmployeeId: r.EmployeeId,
        CheckedInAt: r.CheckedInAt
    };
}

async function getByDeviceId(deviceId) {
    if (!deviceId) return null;

    const conn = await db.getConnection();
    const res = await conn.request()
        .input('deviceId', sql.NVarChar(100), deviceId)
        .query(`SELECT Id, DeviceId, EmployeeId, CheckedInAt FROM ${TABLE} WHERE DeviceId = @deviceId`);

    if (!res.recordset || res.recordset.length === 0) {
        return null;
    }

    return mapRow(res.recordset[0]);
}

async function registerDevice(deviceId, employeeId, transaction) {
    const request = transaction ? new sql.Request(transaction) : (await db.getConnection()).request();

    await request
        .input('deviceId', sql.NVarChar(100), deviceId)
        .input('employeeId', sql.NVarChar(50), employeeId)
        .query(`INSERT INTO ${TABLE} (DeviceId, EmployeeId) VALUES (@deviceId, @employeeId)`);
}

async function getAll() {
    const conn = await db.getConnection();
    const res = await conn.request().query(`SELECT Id, DeviceId, EmployeeId, CheckedInAt FROM ${TABLE} ORDER BY CheckedInAt DESC`);
    return (res.recordset || []).map(mapRow);
}
