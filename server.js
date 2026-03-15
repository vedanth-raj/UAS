const express = require('express');
const cors = require('cors');
const path = require('path');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const http = require('http');
const socketIo = require('socket.io');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

// Import services
const faceRecognitionService = require('./services/face-recognition');
const employeeService = require('./services/employee-service');
const attendanceService = require('./services/attendance-service');
const systemMonitor = require('./services/system-monitor');
const errorHandler = require('./services/error-handler');

// Load environment variables
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false // Disable for development
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Logging
app.use(morgan('combined'));

// Compression
app.use(compression());

// Body parsing middleware
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// CORS configuration
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true
}));

// Static file serving
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Initialize services
faceRecognitionService.initialize();
systemMonitor.startMonitoring();

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Employee routes
app.get('/api/employees', employeeService.getAllEmployees);
app.post('/api/employees', upload.single('image'), employeeService.createEmployee);
app.put('/api/employees/:id', upload.single('image'), employeeService.updateEmployee);
app.delete('/api/employees/:id', employeeService.deleteEmployee);

// Face recognition routes
app.post('/api/face/register', upload.single('image'), faceRecognitionService.registerEmployee);
app.post('/api/face/verify', upload.single('image'), faceRecognitionService.verifyEmployee);
app.get('/api/face/status', faceRecognitionService.getStatus);

// Attendance routes
app.get('/api/attendance', attendanceService.getAttendance);
app.post('/api/attendance/checkin', attendanceService.checkIn);
app.post('/api/attendance/checkout', attendanceService.checkOut);
app.get('/api/attendance/report', attendanceService.generateReport);

// System monitoring routes
app.get('/api/system/status', systemMonitor.getSystemStatus);
app.get('/api/system/health', systemMonitor.healthCheck);

// Admin routes
const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
    
    // Face recognition events
    socket.on('face-recognition-request', async (data) => {
        try {
            const result = await faceRecognitionService.processImage(data.image);
            socket.emit('face-recognition-result', result);
        } catch (error) {
            socket.emit('face-recognition-error', { error: error.message });
        }
    });
});

// Error handling middleware
app.use(errorHandler.notFound);
app.use(errorHandler.errorHandler);

// Start server
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Access the application at: http://localhost:${PORT}`);
});

module.exports = app;