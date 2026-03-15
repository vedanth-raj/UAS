const os = require('os');
const fs = require('fs');
const path = require('path');

class SystemMonitor {
    constructor() {
        this.startTime = Date.now();
        this.healthChecks = [];
        this.alerts = [];
    }

    startMonitoring() {
        console.log('System monitoring started');
        
        // Perform health checks every 5 minutes
        setInterval(() => {
            this.performHealthCheck();
        }, 5 * 60 * 1000);
        
        // Initial health check
        this.performHealthCheck();
    }

    performHealthCheck() {
        const check = {
            timestamp: new Date().toISOString(),
            memory: this.getMemoryUsage(),
            cpu: this.getCPUUsage(),
            disk: this.getDiskUsage(),
            uptime: this.getUptime(),
            status: 'healthy'
        };

        // Check for issues
        if (check.memory.usagePercent > 90) {
            check.status = 'warning';
            this.addAlert('High memory usage detected', 'warning');
        }

        if (check.disk.usagePercent > 85) {
            check.status = 'warning';
            this.addAlert('High disk usage detected', 'warning');
        }

        this.healthChecks.push(check);
        
        // Keep only last 100 health checks
        if (this.healthChecks.length > 100) {
            this.healthChecks = this.healthChecks.slice(-100);
        }

        this.saveHealthData();
    }

    getMemoryUsage() {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        
        return {
            total: Math.round(totalMem / 1024 / 1024), // MB
            used: Math.round(usedMem / 1024 / 1024), // MB
            free: Math.round(freeMem / 1024 / 1024), // MB
            usagePercent: Math.round((usedMem / totalMem) * 100)
        };
    }

    getCPUUsage() {
        const cpus = os.cpus();
        return {
            cores: cpus.length,
            model: cpus[0].model,
            speed: cpus[0].speed
        };
    }

    getDiskUsage() {
        try {
            const stats = fs.statSync(process.cwd());
            // This is a simplified disk usage check
            // In production, you might want to use a more comprehensive solution
            return {
                total: 'N/A',
                used: 'N/A',
                free: 'N/A',
                usagePercent: 0
            };
        } catch (error) {
            return {
                total: 'Error',
                used: 'Error',
                free: 'Error',
                usagePercent: 0
            };
        }
    }

    getUptime() {
        const uptimeMs = Date.now() - this.startTime;
        const uptimeSeconds = Math.floor(uptimeMs / 1000);
        const hours = Math.floor(uptimeSeconds / 3600);
        const minutes = Math.floor((uptimeSeconds % 3600) / 60);
        const seconds = uptimeSeconds % 60;
        
        return {
            ms: uptimeMs,
            formatted: `${hours}h ${minutes}m ${seconds}s`
        };
    }

    addAlert(message, level = 'info') {
        const alert = {
            id: Date.now().toString(),
            message: message,
            level: level,
            timestamp: new Date().toISOString()
        };

        this.alerts.push(alert);
        
        // Keep only last 50 alerts
        if (this.alerts.length > 50) {
            this.alerts = this.alerts.slice(-50);
        }

        console.log(`[${level.toUpperCase()}] ${message}`);
        this.saveAlertData();
    }

    saveHealthData() {
        try {
            const logsDir = path.join(__dirname, '..', 'logs');
            if (!fs.existsSync(logsDir)) {
                fs.mkdirSync(logsDir, { recursive: true });
            }
            
            const healthFile = path.join(logsDir, 'health.log');
            const latestCheck = this.healthChecks[this.healthChecks.length - 1];
            const logEntry = `${latestCheck.timestamp} - ${JSON.stringify(latestCheck)}\n`;
            
            fs.appendFileSync(healthFile, logEntry);
        } catch (error) {
            console.error('Error saving health data:', error);
        }
    }

    saveAlertData() {
        try {
            const logsDir = path.join(__dirname, '..', 'logs');
            if (!fs.existsSync(logsDir)) {
                fs.mkdirSync(logsDir, { recursive: true });
            }
            
            const alertFile = path.join(logsDir, 'alerts.log');
            const latestAlert = this.alerts[this.alerts.length - 1];
            const logEntry = `${latestAlert.timestamp} - [${latestAlert.level}] ${latestAlert.message}\n`;
            
            fs.appendFileSync(alertFile, logEntry);
        } catch (error) {
            console.error('Error saving alert data:', error);
        }
    }

    getSystemStatus(req, res) {
        try {
            const latestCheck = this.healthChecks[this.healthChecks.length - 1];
            
            res.json({
                success: true,
                status: latestCheck ? latestCheck.status : 'unknown',
                uptime: this.getUptime(),
                memory: this.getMemoryUsage(),
                cpu: this.getCPUUsage(),
                disk: this.getDiskUsage(),
                alerts: this.alerts.slice(-10), // Last 10 alerts
                lastHealthCheck: latestCheck ? latestCheck.timestamp : null,
                nodeVersion: process.version,
                platform: os.platform(),
                arch: os.arch()
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to get system status'
            });
        }
    }

    healthCheck(req, res) {
        try {
            const latestCheck = this.healthChecks[this.healthChecks.length - 1];
            const status = latestCheck ? latestCheck.status : 'unknown';
            
            if (status === 'healthy') {
                res.json({
                    success: true,
                    status: 'healthy',
                    timestamp: new Date().toISOString()
                });
            } else {
                res.status(503).json({
                    success: false,
                    status: status,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Health check failed'
            });
        }
    }
}

module.exports = new SystemMonitor();