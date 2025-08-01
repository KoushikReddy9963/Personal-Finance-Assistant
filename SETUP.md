# 🚀 Quick Setup Guide

## Prerequisites

Before running the application, make sure you have:

1. **Node.js** (v14 or higher) - [Download](https://nodejs.org/)
2. **MongoDB** - Either:
   - Local installation: [Download MongoDB Community](https://www.mongodb.com/try/download/community)
   - Or use MongoDB Atlas (cloud): [Create free account](https://www.mongodb.com/cloud/atlas)

## 🔧 Installation Steps

### 1. Install Dependencies

```bash
# Install all dependencies (root, backend, and frontend)
npm run install-all
```

Or install manually:
```bash
# Root dependencies
npm install

# Backend dependencies  
cd backend && npm install

# Frontend dependencies
cd ../frontend && npm install
```

### 2. Setup Environment Variables

Create `backend/.env` file with the following:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/finance-tracker
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
NODE_ENV=development
```

**Important:** 
- Change `JWT_SECRET` to a strong, unique secret in production
- Update `MONGODB_URI` if using MongoDB Atlas or different connection

### 3. Start MongoDB

**For local MongoDB:**
```bash
mongod
```

**For MongoDB Atlas:**
- Replace `MONGODB_URI` in `.env` with your Atlas connection string
- Example: `mongodb+srv://username:password@cluster.mongodb.net/finance-tracker`

### 4. Run the Application

**Option A: Start both frontend and backend simultaneously**
```bash
npm run dev
```

**Option B: Start individually**

Terminal 1 (Backend):
```bash
npm run server
# or
cd backend && npm run dev
```

Terminal 2 (Frontend):
```bash
npm run client  
# or
cd frontend && npm start
```

### 5. Access the Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000
- **API Health Check:** http://localhost:5000/api/health

## 🧪 Testing the Setup

### 1. Backend API Test

Visit http://localhost:5000/api/health - you should see:
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 2. Frontend Test

1. Go to http://localhost:3000
2. You should see the FinanceTracker homepage
3. Click "Sign Up Free" to test registration
4. Try logging in with created credentials

### 3. Database Connection Test

1. Register a new user
2. If successful, MongoDB connection is working
3. Check MongoDB to see the created user document

## 📱 Current Features Available

### ✅ Working Features
- Beautiful responsive homepage
- User registration and login
- JWT authentication
- Protected dashboard route
- Financial overview (when you have transactions)
- Responsive navigation

### 🚧 Coming Soon Features  
- Transaction CRUD operations
- Analytics and charts  
- Receipt OCR processing
- PDF transaction import
- Profile management

## 🐛 Troubleshooting

### Common Issues

**1. MongoDB Connection Error**
```
Error: MongoDB connection error
```
- Ensure MongoDB is running (`mongod`)
- Check `MONGODB_URI` in `.env` file
- For Atlas: verify connection string and network access

**2. Port Already in Use**
```
Error: listen EADDRINUSE :::3000
```
- Kill existing processes: `lsof -ti:3000 | xargs kill -9`
- Or use different ports by updating scripts

**3. JWT Authentication Issues**
```
Error: Token is not valid
```
- Clear browser localStorage
- Check `JWT_SECRET` is set in `.env`
- Re-login to get fresh token

**4. CORS Errors**
```
Access to XMLHttpRequest has been blocked by CORS policy
```
- Backend should automatically handle CORS for localhost:3000
- Check backend is running on port 5000
- Verify proxy setting in frontend/package.json

### Reset Development Environment

```bash
# Clear all node_modules
rm -rf node_modules backend/node_modules frontend/node_modules

# Clear package locks
rm -f package-lock.json backend/package-lock.json frontend/package-lock.json

# Reinstall everything
npm run install-all
```

## 🎯 Next Steps

1. **Create your first account** - Register through the UI
2. **Explore the dashboard** - Currently shows placeholder data
3. **Check the API** - Use tools like Postman to test endpoints
4. **Development** - Implement remaining features:
   - Transaction management
   - Data visualization  
   - File upload features

## 📚 Development Resources

- **API Documentation:** All endpoints are documented in README.md
- **Database Models:** Check `backend/models/` for schema definitions
- **Frontend Components:** Located in `frontend/src/components/`
- **Backend Routes:** Located in `backend/routes/`

Happy coding! 🎉