const cors = require('cors');

const express = require('express');

const http = require('http');

const config = require('./config.json');
const deviceCheckinsService = require('./DEVICECHECKINS/devicecheckins.service');
const RequestQueue = require('./_helpers/requestQueue');
const app = express();


const checkinQueue = new RequestQueue(config.concurrency || 25);



app.use(express.json({ limit: '1mb' }));

app.use(express.urlencoded({ extended: true, limit: '1mb' }));

app.use(cors());



// Queue only check-in write paths under heavy concurrent scan load

app.use(['/USERS/checkin', '/USERS/scan-checkin'], checkinQueue.middleware());



app.get('/', (req, res) => {

    res.status(200).json({

        source: 'api',

        status: 'running',

        protocol: 'http',

        message: '2027 Annual Dinner API is running',

        time: new Date().toISOString()

    });

});



app.get('/health', (req, res) => {

    res.status(200).json({

        source: 'api',

        status: 'ok',

        time: new Date().toISOString()

    });

});



app.use('/USERS', require('./USERS/users.controller'));

app.use('/DEVICECHECKINS', require('./DEVICECHECKINS/devicecheckins.controller'));



app.use((req, res) => {

    res.status(404).json({

        source: 'api',

        error: 'Route not found',

        method: req.method,

        path: req.originalUrl

    });

});



app.use((err, req, res, next) => {

    console.error(`[API] ERROR ${req.method} ${req.originalUrl}:`, err);

    res.status(500).json({

        source: 'api',

        error: err.message || String(err) || 'Internal server error',

        method: req.method,

        path: req.originalUrl

    });

});



function createServer() {

    const port = parseInt(process.env.PORT, 10) || config.port || 5308;

    const host = '0.0.0.0';



    return deviceCheckinsService.ensureTable()

        .then(() => {

            return http.createServer(app).listen(port, host, () => {

                console.log(`[API] HTTP listening on http://0.0.0.0:${port}`);

            });

        })

        .catch(err => {

            console.error('[API] Failed to start server:', err);

            process.exit(1);

        });

}



const serverPromise = createServer();



serverPromise.then(s => {

    s.on('error', (err) => {

        if (err && err.code === 'EADDRINUSE') {

            console.error('Port is already in use. API is likely already running in another terminal.');

            process.exit(1);

        }

        console.error('Server failed to start:', err);

        process.exit(1);

    });



    s.on('close', () => {

        console.error('Server was closed unexpectedly.');

    });

}).catch(err => {

    console.error('Server failed to start:', err);

    process.exit(1);

});



process.on('uncaughtException', (err) => {

    console.error('Uncaught exception:', err);

});



process.on('unhandledRejection', (reason) => {

    console.error('Unhandled rejection:', reason);

});



process.stdin.resume();

