const fs = require('fs');
const path = require('path');

class AttendanceService {
    constructor() {
        this.attendanceRecords = [];
        this.loadAttendanceData();
    }

    loadAttendanceData() {
        try {
            const dataPath = path.join(__dirname, '..', 'data', 'attendance.json');
            if (fs.existsSync(dataPath)) {
                const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
                this.attendanceRecords = data;
            }
        } catch (error) {
            console.error('Error loading attendance data:', error);
        }
    }

    saveAttendanceData() {
        try {
            const dataPath = path.join(__dirname, '..', 'data');
            if (!fs.existsSync(dataPath)) {
                fs.mkdirSync(dataPath, { recursive: true });
            }
            
            const filePath = path.join(dataPath, 'attendance.json');
            fs.writeFileSync(filePath, JSON.stringify(this.attendanceRecords, null, 2));
        } catch (error) {
            console.error('Error saving attendance data:', error);
        }
    }

    getAttendance(req, res) {
        try {
            const { employeeId, date, limit = 50 } = req.query;
            let records = [...this.attendanceRecords];

            if (employeeId) {
                records = records.filter(record => record.employeeId === employeeId);
            }

            if (date) {
                const targetDate = new Date(date).toDateString();
                records = records.filter(record => 
                    new Date(record.timestamp).toDateString() === targetDate
                );
            }

            // Sort by timestamp (most recent first)
            records.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            // Apply limit
            records = records.slice(0, parseInt(limit));

            res.json({
                success: true,
                records: records,
                total: records.length
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve attendance records'
            });
        }
    }

    checkIn(req, res) {
        try {
            const { employeeId, employeeName } = req.body;

            if (!employeeId) {
                return res.status(400).json({
                    success: false,
                    error: 'Employee ID is required'
                });
            }

            // Check if employee is already checked in today
            const today = new Date().toDateString();
            const existingCheckIn = this.attendanceRecords.find(record => 
                record.employeeId === employeeId && 
                record.type === 'checkin' &&
                new Date(record.timestamp).toDateString() === today &&
                !this.attendanceRecords.some(checkout => 
                    checkout.employeeId === employeeId &&
                    checkout.type === 'checkout' &&
                    new Date(checkout.timestamp) > new Date(record.timestamp)
                )
            );

            if (existingCheckIn) {
                return res.status(409).json({
                    success: false,
                    error: 'Employee is already checked in today'
                });
            }

            const record = {
                id: Date.now().toString(),
                employeeId: employeeId,
                employeeName: employeeName || 'Unknown',
                type: 'checkin',
                timestamp: new Date().toISOString(),
                location: req.body.location || 'Office'
            };

            this.attendanceRecords.push(record);
            this.saveAttendanceData();

            res.json({
                success: true,
                message: 'Check-in recorded successfully',
                record: record
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to record check-in'
            });
        }
    }

    checkOut(req, res) {
        try {
            const { employeeId, employeeName } = req.body;

            if (!employeeId) {
                return res.status(400).json({
                    success: false,
                    error: 'Employee ID is required'
                });
            }

            // Check if employee has checked in today
            const today = new Date().toDateString();
            const checkInRecord = this.attendanceRecords
                .filter(record => 
                    record.employeeId === employeeId && 
                    record.type === 'checkin' &&
                    new Date(record.timestamp).toDateString() === today
                )
                .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

            if (!checkInRecord) {
                return res.status(400).json({
                    success: false,
                    error: 'No check-in record found for today'
                });
            }

            // Check if already checked out
            const existingCheckOut = this.attendanceRecords.find(record => 
                record.employeeId === employeeId && 
                record.type === 'checkout' &&
                new Date(record.timestamp) > new Date(checkInRecord.timestamp)
            );

            if (existingCheckOut) {
                return res.status(409).json({
                    success: false,
                    error: 'Employee is already checked out'
                });
            }

            const record = {
                id: Date.now().toString(),
                employeeId: employeeId,
                employeeName: employeeName || 'Unknown',
                type: 'checkout',
                timestamp: new Date().toISOString(),
                location: req.body.location || 'Office',
                checkInId: checkInRecord.id
            };

            this.attendanceRecords.push(record);
            this.saveAttendanceData();

            res.json({
                success: true,
                message: 'Check-out recorded successfully',
                record: record
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to record check-out'
            });
        }
    }

    generateReport(req, res) {
        try {
            const { startDate, endDate, employeeId } = req.query;
            
            let records = [...this.attendanceRecords];

            // Filter by employee if specified
            if (employeeId) {
                records = records.filter(record => record.employeeId === employeeId);
            }

            // Filter by date range if specified
            if (startDate) {
                const start = new Date(startDate);
                records = records.filter(record => new Date(record.timestamp) >= start);
            }

            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999); // End of day
                records = records.filter(record => new Date(record.timestamp) <= end);
            }

            // Group by employee and date
            const report = {};
            
            records.forEach(record => {
                const date = new Date(record.timestamp).toDateString();
                const key = `${record.employeeId}-${date}`;
                
                if (!report[key]) {
                    report[key] = {
                        employeeId: record.employeeId,
                        employeeName: record.employeeName,
                        date: date,
                        checkIn: null,
                        checkOut: null,
                        hoursWorked: 0
                    };
                }

                if (record.type === 'checkin') {
                    report[key].checkIn = record.timestamp;
                } else if (record.type === 'checkout') {
                    report[key].checkOut = record.timestamp;
                }
            });

            // Calculate hours worked
            Object.values(report).forEach(entry => {
                if (entry.checkIn && entry.checkOut) {
                    const checkInTime = new Date(entry.checkIn);
                    const checkOutTime = new Date(entry.checkOut);
                    const diffMs = checkOutTime - checkInTime;
                    entry.hoursWorked = Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100;
                }
            });

            const reportArray = Object.values(report);

            res.json({
                success: true,
                report: reportArray,
                summary: {
                    totalRecords: reportArray.length,
                    totalHours: reportArray.reduce((sum, entry) => sum + entry.hoursWorked, 0),
                    dateRange: {
                        start: startDate || 'All time',
                        end: endDate || 'Present'
                    }
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to generate report'
            });
        }
    }
}

module.exports = new AttendanceService();