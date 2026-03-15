# Unified Attendance Interface

A modern web-based attendance system with face recognition capabilities.

## Features

- Face recognition-based attendance
- Employee management
- Real-time attendance tracking
- Admin dashboard
- System monitoring and health checks
- Secure API with rate limiting
- WebSocket support for real-time updates

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables (copy .env.example to .env)
4. Start the server:
   ```bash
   npm start
   ```

## Development

Run in development mode with auto-reload:
```bash
npm run dev
```

## Testing

Run tests:
```bash
npm test
```

## API Endpoints

### Employees
- `GET /api/employees` - Get all employees
- `POST /api/employees` - Create new employee
- `PUT /api/employees/:id` - Update employee
- `DELETE /api/employees/:id` - Delete employee

### Face Recognition
- `POST /api/face/register` - Register employee face
- `POST /api/face/verify` - Verify employee face
- `GET /api/face/status` - Get face recognition system status

### Attendance
- `GET /api/attendance` - Get attendance records
- `POST /api/attendance/checkin` - Check in employee
- `POST /api/attendance/checkout` - Check out employee
- `GET /api/attendance/report` - Generate attendance report

### System
- `GET /api/system/status` - Get system status
- `GET /api/system/health` - Health check

## License

MIT