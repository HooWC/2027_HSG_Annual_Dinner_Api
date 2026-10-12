const express = require('express');
const router = express.Router();
const deviceCheckinsService = require('./devicecheckins.service');

router.get('/', getAll);
router.get('/:deviceId', getByDeviceId);

module.exports = router;

function getAll(req, res, next) {
    deviceCheckinsService.getAll()
        .then(records => res.json(records))
        .catch(next);
}

function getByDeviceId(req, res, next) {
    const deviceId = (req.params.deviceId || '').trim();
    if (!deviceId) {
        return res.status(400).json({
            source: 'api',
            error: 'Device ID is required'
        });
    }

    deviceCheckinsService.getByDeviceId(deviceId)
        .then(record => {
            if (!record) {
                return res.json({ checkedIn: false, deviceId });
            }
            res.json({
                checkedIn: true,
                deviceId: record.DeviceId,
                employeeId: record.EmployeeId,
                checkedInAt: record.CheckedInAt
            });
        })
        .catch(next);
}
