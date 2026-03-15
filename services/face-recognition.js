const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class FaceRecognitionService {
    constructor() {
        this.isInitialized = false;
        this.pythonPath = 'python';
        this.scriptPath = path.join(__dirname, '..', 'python', 'face_recognition_engine.py');
        this.employees = new Map();
        this.loadEmployeeData();
    }

    async initialize() {
        try {
            console.log('Initializing Face Recognition Service...');
            
            // Check if Python face recognition is available
            const isAvailable = await this.checkPythonFaceRecognition();
            
            if (!isAvailable) {
                console.warn('Python face recognition not available. System will require manual setup.');
                this.isInitialized = false;
                return false;
            }
            
            this.isInitialized = true;
            console.log('Face Recognition Service initialized successfully');
            return true;
        } catch (error) {
            console.error('Failed to initialize Face Recognition Service:', error);
            this.isInitialized = false;
            return false;
        }
    }

    async checkPythonFaceRecognition() {
        return new Promise((resolve) => {
            const python = spawn(this.pythonPath, ['-c', 'import face_recognition; print("OK")']);
            
            python.stdout.on('data', (data) => {
                if (data.toString().trim() === 'OK') {
                    resolve(true);
                }
            });
            
            python.stderr.on('data', (data) => {
                console.error('Python face_recognition check error:', data.toString());
                resolve(false);
            });
            
            python.on('close', (code) => {
                if (code !== 0) {
                    resolve(false);
                }
            });
            
            // Timeout after 5 seconds
            setTimeout(() => {
                python.kill();
                resolve(false);
            }, 5000);
        });
    }

    loadEmployeeData() {
        try {
            const dataPath = path.join(__dirname, '..', 'data', 'employees', 'employees.json');
            if (fs.existsSync(dataPath)) {
                const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
                data.forEach(employee => {
                    this.employees.set(employee.id, employee);
                });
                console.log(`Loaded ${this.employees.size} employees`);
            }
        } catch (error) {
            console.error('Error loading employee data:', error);
        }
    }

    saveEmployeeData() {
        try {
            const dataPath = path.join(__dirname, '..', 'data', 'employees');
            if (!fs.existsSync(dataPath)) {
                fs.mkdirSync(dataPath, { recursive: true });
            }
            
            const filePath = path.join(dataPath, 'employees.json');
            const employeeArray = Array.from(this.employees.values());
            fs.writeFileSync(filePath, JSON.stringify(employeeArray, null, 2));
        } catch (error) {
            console.error('Error saving employee data:', error);
        }
    }

    async registerEmployee(req, res) {
        try {
            if (!this.isInitialized) {
                return res.status(503).json({
                    success: false,
                    error: 'Face recognition service not available. Please set up Python face recognition libraries.'
                });
            }

            const { employeeId, name } = req.body;
            const imageFile = req.file;

            if (!employeeId || !name || !imageFile) {
                return res.status(400).json({
                    success: false,
                    error: 'Employee ID, name, and image are required'
                });
            }

            // Process the image with Python face recognition
            const result = await this.processImageWithPython(imageFile.path, 'register', employeeId);
            
            if (result.success) {
                // Store employee data
                const employee = {
                    id: employeeId,
                    name: name,
                    registeredAt: new Date().toISOString(),
                    imagePath: imageFile.path,
                    faceEncoding: result.encoding
                };
                
                this.employees.set(employeeId, employee);
                this.saveEmployeeData();
                
                res.json({
                    success: true,
                    message: 'Employee registered successfully',
                    employee: {
                        id: employee.id,
                        name: employee.name,
                        registeredAt: employee.registeredAt
                    }
                });
            } else {
                res.status(400).json({
                    success: false,
                    error: result.error || 'Failed to register employee'
                });
            }
        } catch (error) {
            console.error('Error registering employee:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }

    async verifyEmployee(req, res) {
        try {
            if (!this.isInitialized) {
                return res.status(503).json({
                    success: false,
                    error: 'Face recognition service not available'
                });
            }

            const imageFile = req.file;
            if (!imageFile) {
                return res.status(400).json({
                    success: false,
                    error: 'Image is required'
                });
            }

            // Process the image with Python face recognition
            const result = await this.processImageWithPython(imageFile.path, 'verify');
            
            if (result.success && result.employeeId) {
                const employee = this.employees.get(result.employeeId);
                if (employee) {
                    res.json({
                        success: true,
                        employee: {
                            id: employee.id,
                            name: employee.name
                        },
                        confidence: result.confidence
                    });
                } else {
                    res.status(404).json({
                        success: false,
                        error: 'Employee not found'
                    });
                }
            } else {
                res.status(400).json({
                    success: false,
                    error: result.error || 'Face not recognized'
                });
            }
        } catch (error) {
            console.error('Error verifying employee:', error);
            res.status(500).json({
                success: false,
                error: 'Internal server error'
            });
        }
    }

    async processImageWithPython(imagePath, action, employeeId = null) {
        return new Promise((resolve) => {
            const args = [this.scriptPath, action, imagePath];
            if (employeeId) {
                args.push(employeeId);
            }
            
            const python = spawn(this.pythonPath, args);
            let output = '';
            let error = '';
            
            python.stdout.on('data', (data) => {
                output += data.toString();
            });
            
            python.stderr.on('data', (data) => {
                error += data.toString();
            });
            
            python.on('close', (code) => {
                if (code === 0 && output) {
                    try {
                        const result = JSON.parse(output.trim());
                        resolve(result);
                    } catch (parseError) {
                        resolve({
                            success: false,
                            error: 'Invalid response from face recognition engine'
                        });
                    }
                } else {
                    resolve({
                        success: false,
                        error: error || 'Face recognition process failed'
                    });
                }
            });
            
            // Timeout after 30 seconds
            setTimeout(() => {
                python.kill();
                resolve({
                    success: false,
                    error: 'Face recognition process timed out'
                });
            }, 30000);
        });
    }

    getStatus(req, res) {
        res.json({
            initialized: this.isInitialized,
            employeeCount: this.employees.size,
            pythonPath: this.pythonPath,
            scriptPath: this.scriptPath,
            timestamp: new Date().toISOString()
        });
    }

    async processImage(imageData) {
        // This method is for WebSocket processing
        if (!this.isInitialized) {
            throw new Error('Face recognition service not available');
        }
        
        // Implementation for processing base64 image data
        // This would need to be implemented based on your specific requirements
        throw new Error('WebSocket image processing not implemented');
    }
}

module.exports = new FaceRecognitionService();