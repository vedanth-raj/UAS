const fs = require('fs');
const path = require('path');

class EmployeeService {
    constructor() {
        this.employees = new Map();
        this.loadEmployees();
    }

    loadEmployees() {
        try {
            const dataPath = path.join(__dirname, '..', 'data', 'employees', 'employees.json');
            if (fs.existsSync(dataPath)) {
                const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
                data.forEach(employee => {
                    this.employees.set(employee.id, employee);
                });
            }
        } catch (error) {
            console.error('Error loading employees:', error);
        }
    }

    saveEmployees() {
        try {
            const dataPath = path.join(__dirname, '..', 'data', 'employees');
            if (!fs.existsSync(dataPath)) {
                fs.mkdirSync(dataPath, { recursive: true });
            }
            
            const filePath = path.join(dataPath, 'employees.json');
            const employeeArray = Array.from(this.employees.values());
            fs.writeFileSync(filePath, JSON.stringify(employeeArray, null, 2));
        } catch (error) {
            console.error('Error saving employees:', error);
        }
    }

    getAllEmployees(req, res) {
        try {
            const employees = Array.from(this.employees.values()).map(emp => ({
                id: emp.id,
                name: emp.name,
                email: emp.email,
                department: emp.department,
                registeredAt: emp.registeredAt
            }));
            
            res.json({
                success: true,
                employees: employees
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve employees'
            });
        }
    }

    createEmployee(req, res) {
        try {
            const { id, name, email, department } = req.body;
            
            if (!id || !name) {
                return res.status(400).json({
                    success: false,
                    error: 'Employee ID and name are required'
                });
            }

            if (this.employees.has(id)) {
                return res.status(409).json({
                    success: false,
                    error: 'Employee with this ID already exists'
                });
            }

            const employee = {
                id,
                name,
                email: email || '',
                department: department || '',
                registeredAt: new Date().toISOString(),
                imagePath: req.file ? req.file.path : null
            };

            this.employees.set(id, employee);
            this.saveEmployees();

            res.status(201).json({
                success: true,
                message: 'Employee created successfully',
                employee: {
                    id: employee.id,
                    name: employee.name,
                    email: employee.email,
                    department: employee.department,
                    registeredAt: employee.registeredAt
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to create employee'
            });
        }
    }

    updateEmployee(req, res) {
        try {
            const { id } = req.params;
            const { name, email, department } = req.body;

            if (!this.employees.has(id)) {
                return res.status(404).json({
                    success: false,
                    error: 'Employee not found'
                });
            }

            const employee = this.employees.get(id);
            
            if (name) employee.name = name;
            if (email !== undefined) employee.email = email;
            if (department !== undefined) employee.department = department;
            if (req.file) employee.imagePath = req.file.path;
            
            employee.updatedAt = new Date().toISOString();

            this.employees.set(id, employee);
            this.saveEmployees();

            res.json({
                success: true,
                message: 'Employee updated successfully',
                employee: {
                    id: employee.id,
                    name: employee.name,
                    email: employee.email,
                    department: employee.department,
                    updatedAt: employee.updatedAt
                }
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to update employee'
            });
        }
    }

    deleteEmployee(req, res) {
        try {
            const { id } = req.params;

            if (!this.employees.has(id)) {
                return res.status(404).json({
                    success: false,
                    error: 'Employee not found'
                });
            }

            this.employees.delete(id);
            this.saveEmployees();

            res.json({
                success: true,
                message: 'Employee deleted successfully'
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                error: 'Failed to delete employee'
            });
        }
    }
}

module.exports = new EmployeeService();