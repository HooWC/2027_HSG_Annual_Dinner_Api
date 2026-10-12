const express = require('express');
const router = express.Router();
const usersService = require('./users.service');

router.get('/ping', (req, res) => {
    res.json({ source: 'api', status: 'ok', route: 'USERS/ping' });
});

router.get('/by-employee/:employeeId', getByEmployeeId);
router.post('/checkin', checkIn);
router.post('/scan-checkin', scanCheckIn);

module.exports = router;

function getByEmployeeId(req, res, next) {
    const employeeId = (req.params.employeeId || '').trim();
    if (!employeeId) {
        return res.status(400).json({
            source: 'api',
            error: 'Employee ID is required'
        });
    }

    usersService.getByEmployeeId(employeeId)
        .then(user => res.json(user))
        .catch(err => {
            if (err === 'Employee not found') {
                return res.status(404).json({
                    source: 'api',
                    error: err,
                    employeeId
                });
            }
            next(err);
        });
}

function checkIn(req, res, next) {
    const employeeId = (req.body.employeeId || '').trim();
    const deviceId = (req.body.deviceId || '').trim();
    if (!employeeId) {
        return res.status(400).json({
            source: 'api',
            error: 'Employee ID is required'
        });
    }
    if (!deviceId) {
        return res.status(400).json({
            source: 'api',
            error: 'Device ID is required'
        });
    }

    usersService.checkIn(employeeId, deviceId)
        .then(result => res.json(result))
        .catch(err => handleCheckInError(res, next, err, employeeId, deviceId));
}

function scanCheckIn(req, res, next) {
    const employeeId = (req.body.employeeId || '').trim();
    const fullName = (req.body.fullName || '').trim();

    if (!employeeId) {
        return res.status(400).json({
            source: 'api',
            error: 'Employee ID is required'
        });
    }

    usersService.scanCheckIn(employeeId, fullName)
        .then(result => res.json(result))
        .catch(err => handleCheckInError(res, next, err, employeeId));
}

function handleCheckInError(res, next, err, employeeId, deviceId) {
    if (err === 'Employee not found') {
        return res.status(404).json({
            source: 'api',
            error: err,
            employeeId
        });
    }
    if (err === 'Employee already checked in') {
        return res.status(409).json({
            source: 'api',
            error: err,
            employeeId
        });
    }
    if (err === 'Device already checked in') {
        return res.status(409).json({
            source: 'api',
            error: err,
            deviceId
        });
    }
    next(err);
}
