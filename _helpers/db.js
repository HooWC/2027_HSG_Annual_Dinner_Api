const mssql = require('mssql');

let sqlConfig;
if (process.env.DB_SERVER) {
    sqlConfig = {
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        server: process.env.DB_SERVER,
        pool: { max: 40, min: 2, idleTimeoutMillis: 30000 },
        connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT, 10) || 30000,
        requestTimeout: parseInt(process.env.DB_REQUEST_TIMEOUT, 10) || 180000,
        options: {
            port: parseInt(process.env.DB_PORT) || 1433,
            encrypt: process.env.DB_ENCRYPT === 'true',
            trustServerCertificate: process.env.DB_TRUST_CERT === 'true',
            enableArithAbort: true,
            cancelTimeout: parseInt(process.env.DB_CANCEL_TIMEOUT, 10) || 180000
        }
    };
} else {
    const { dbName, dbConfig } = require('../config.json');
    const fileOpts = dbConfig.options || {};
    sqlConfig = {
        user: dbConfig.authentication.options.userName,
        password: dbConfig.authentication.options.password,
        database: dbName,
        server: dbConfig.server,
        pool: { max: 40, min: 2, idleTimeoutMillis: 30000 },
        connectionTimeout: fileOpts.connectionTimeout != null ? fileOpts.connectionTimeout : 30000,
        requestTimeout: fileOpts.requestTimeout != null ? fileOpts.requestTimeout : 180000,
        options: {
            port: fileOpts.port || 1433,
            encrypt: fileOpts.encrypt != null ? fileOpts.encrypt : false,
            trustServerCertificate: fileOpts.trustServerCertificate != null ? fileOpts.trustServerCertificate : true,
            enableArithAbort: fileOpts.enableArithAbort != null ? fileOpts.enableArithAbort : true,
            cancelTimeout: fileOpts.cancelTimeout != null ? fileOpts.cancelTimeout : 180000
        }
    };
}

class DBConnection {
    async getConnection() {
        try {
            return await mssql.connect(sqlConfig);
        } catch (error) {
            console.error('Database connection error:', error);
            throw error;
        }
    }
}

module.exports = new DBConnection();
