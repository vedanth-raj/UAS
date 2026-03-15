const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Admin authentication middleware (simplified for demo)
const authenticateAdmin = (req, res, next) => {
    // In production, implement proper JWT authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== 'Bearer admin-token') {
        return res.status(401).json({
            success: false,
            error: 'Admin authentication required'
        });
    }
    next();
};

// Get system statistics
router.get('/stats', authenticateAdmin, (req, res) => {
    try {
        // Load employee data
        const employeesPath = path.join(__dirname, '..', 'data', 'employees', 'employees.json');
        let employeeCount = 0;
        if (fs.existsSync(employeesPath)) {
            const employees = JSON.parse(fs.readFileSync(employeesPath, 'utf8'));
            employeeCount = employees.length;
        }

        // Load attendance data
        const attendancePath = path.join(__dirname, '..', 'data', 'attendance.json');
        let attendanceCount = 0;
        let todayAttendance = 0;
        if (fs.existsSync(attendancePath)) {
            const attendance = JSON.parse(fs.readFileSync(attendancePath, 'utf8'));
            attendanceCount = attendance.length;
            
            const today = new Date().toDateString();
            todayAttendance = attendance.filter(record => 
                new Date(record.timestamp).toDateString() === today
            ).length;
        }

        res.json({
            success: true,
            stats: {
                totalEmployees: employeeCount,
                totalAttendanceRecords: attendanceCount,
                todayAttendance: todayAttendance,
                systemUptime: process.uptime(),
                nodeVersion: process.version,
                memoryUsage: process.memoryUsage()
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get system statistics'
        });
    }
});

// Get system logs
router.get('/logs', authenticateAdmin, (req, res) => {
    try {
        const { type = 'errors', limit = 50 } = req.query;
        const logsDir = path.join(__dirname, '..', 'logs');
        const logFile = path.join(logsDir, `${type}.log`);

        if (!fs.existsSync(logFile)) {
            return res.json({
                success: true,
                logs: [],
                message: 'No logs found'
            });
        }

        const logContent = fs.readFileSync(logFile, 'utf8');
        const logLines = logContent.split('\n').filter(line => line.trim());
        
        // Get the most recent logs
        const recentLogs = logLines.slice(-parseInt(limit));

        res.json({
            success: true,
            logs: recentLogs,
            total: logLines.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve logs'
        });
    }
});

// Clear logs
router.delete('/logs/:type', authenticateAdmin, (req, res) => {
    try {
        const { type } = req.params;
        const logsDir = path.join(__dirname, '..', 'logs');
        const logFile = path.join(logsDir, `${type}.log`);

        if (fs.existsSync(logFile)) {
            fs.writeFileSync(logFile, '');
        }

        res.json({
            success: true,
            message: `${type} logs cleared successfully`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to clear logs'
        });
    }
});

// Get configuration
router.get('/config', authenticateAdmin, (req, res) => {
    try {
        const config = {
            faceRecognitionEnabled: process.env.FACE_RECOGNITION_ENABLED === 'true',
            confidenceThreshold: parseFloat(process.env.FACE_RECOGNITION_CONFIDENCE_THRESHOLD) || 0.6,
            maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760,
            rateLimitWindow: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
            rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
            logLevel: process.env.LOG_LEVEL || 'info'
        };

        res.json({
            success: true,
            config: config
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to get configuration'
        });
    }
});

// Update configuration
router.put('/config', authenticateAdmin, (req, res) => {
    try {
        const updates = req.body;
        
        // In a real application, you would update the configuration file
        // For this demo, we'll just return success
        
        res.json({
            success: true,
            message: 'Configuration updated successfully',
            updates: updates
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to update configuration'
        });
    }
});

// Backup data
router.post('/backup', authenticateAdmin, (req, res) => {
    try {
        const backupDir = path.join(__dirname, '..', 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(backupDir, `backup-${timestamp}.json`);

        const backup = {
            timestamp: new Date().toISOString(),
            employees: [],
            attendance: []
        };

        // Backup employees
        const employeesPath = path.join(__dirname, '..', 'data', 'employees', 'employees.json');
        if (fs.existsSync(employeesPath)) {
            backup.employees = JSON.parse(fs.readFileSync(employeesPath, 'utf8'));
        }

        // Backup attendance
        const attendancePath = path.join(__dirname, '..', 'data', 'attendance.json');
        if (fs.existsSync(attendancePath)) {
            backup.attendance = JSON.parse(fs.readFileSync(attendancePath, 'utf8'));
        }

        fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));

        res.json({
            success: true,
            message: 'Backup created successfully',
            backupFile: `backup-${timestamp}.json`
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to create backup'
        });
    }
});

module.exports = router;