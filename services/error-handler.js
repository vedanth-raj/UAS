const fs = require('fs');
const path = require('path');

class ErrorHandler {
    constructor() {
        this.setupErrorLogging();
    }

    setupErrorLogging() {
        const logsDir = path.join(__dirname, '..', 'logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
    }

    logError(error, req = null) {
        try {
            const timestamp = new Date().toISOString();
            const errorLog = {
                timestamp,
                message: error.message,
                stack: error.stack,
                url: req ? req.url : null,
                method: req ? req.method : null,
                ip: req ? req.ip : null,
                userAgent: req ? req.get('User-Agent') : null
            };

            const logFile = path.join(__dirname, '..', 'logs', 'errors.log');
            const logEntry = `${timestamp} - ${JSON.stringify(errorLog)}\n`;
            
            fs.appendFileSync(logFile, logEntry);
            console.error('Error logged:', errorLog);
        } catch (logError) {
            console.error('Failed to log error:', logError);
        }
    }

    notFound(req, res, next) {
        const error = new Error(`Not Found - ${req.originalUrl}`);
        error.status = 404;
        next(error);
    }

    errorHandler(error, req, res, next) {
        // Log the error
        this.logError(error, req);

        // Set default error status
        let statusCode = error.status || error.statusCode || 500;
        let message = error.message || 'Internal Server Error';

        // Handle specific error types
        if (error.name === 'ValidationError') {
            statusCode = 400;
            message = 'Validation Error';
        } else if (error.name === 'UnauthorizedError') {
            statusCode = 401;
            message = 'Unauthorized';
        } else if (error.code === 'ENOENT') {
            statusCode = 404;
            message = 'File not found';
        } else if (error.code === 'EACCES') {
            statusCode = 403;
            message = 'Access denied';
        }

        // Don't expose internal errors in production
        if (process.env.NODE_ENV === 'production' && statusCode === 500) {
            message = 'Internal Server Error';
        }

        // Send error response
        res.status(statusCode).json({
            success: false,
            error: message,
            ...(process.env.NODE_ENV === 'development' && {
                stack: error.stack,
                details: error
            })
        });
    }

    // Async error wrapper
    asyncHandler(fn) {
        return (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch(next);
        };
    }

    // Security error handler
    securityError(message, req) {
        const securityLog = {
            timestamp: new Date().toISOString(),
            message: message,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            url: req.url,
            method: req.method,
            headers: req.headers
        };

        try {
            const logFile = path.join(__dirname, '..', 'logs', 'security.log');
            const logEntry = `${securityLog.timestamp} - SECURITY: ${JSON.stringify(securityLog)}\n`;
            
            fs.appendFileSync(logFile, logEntry);
            console.warn('Security event logged:', securityLog);
        } catch (logError) {
            console.error('Failed to log security event:', logError);
        }
    }
}

const errorHandler = new ErrorHandler();

module.exports = {
    notFound: errorHandler.notFound.bind(errorHandler),
    errorHandler: errorHandler.errorHandler.bind(errorHandler),
    asyncHandler: errorHandler.asyncHandler.bind(errorHandler),
    logError: errorHandler.logError.bind(errorHandler),
    securityError: errorHandler.securityError.bind(errorHandler)
};