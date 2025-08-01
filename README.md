# Personal Finance Assistant

A modern, full-stack personal finance management application with OCR receipt processing, transaction tracking, and comprehensive analytics.

## 🚀 Features

- **OCR Receipt Processing**: Upload receipts (JPG, PNG, PDF) and automatically extract transaction details
- **CSV/PDF Import**: Bulk import transactions from bank statements and financial apps
- **Transaction Management**: Track income, expenses, and categorize transactions
- **Analytics Dashboard**: Visual insights into spending patterns and financial health
- **Budget Tracking**: Set monthly budgets and monitor spending
- **Modern UI**: Beautiful, responsive design with gradient backgrounds and smooth animations

## 📋 Table of Contents

- [Features](#-features)
- [Technology Stack](#-technology-stack)
- [Installation](#-installation)
- [Usage](#-usage)
- [API Documentation](#-api-documentation)
- [Workflow Diagrams](#-workflow-diagrams)
- [Contributing](#-contributing)
- [License](#-license)

## 🛠 Technology Stack

### Frontend
- **React.js** - User interface framework
- **Bootstrap 5** - CSS framework for responsive design
- **Axios** - HTTP client for API communication
- **React Router** - Client-side routing

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web application framework
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB object modeling
- **JWT** - Authentication and authorization
- **Multer** - File upload handling
- **Tesseract.js** - OCR (Optical Character Recognition)
- **PDF-parse** - PDF text extraction
- **CSV-parser** - CSV file processing

## 📦 Installation

### Prerequisites
- Node.js (v14 or higher)
- MongoDB
- npm or yarn

### Backend Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd personal-finance-assistant
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file in the backend directory:
   ```env
   MONGODB_URI=mongodb://localhost:27017/finance-tracker
   JWT_SECRET=your-secret-key
   PORT=5000
   NODE_ENV=development
   ```

4. **Start the backend server**
   ```bash
   npm run dev
   ```

### Frontend Setup

1. **Install frontend dependencies**
   ```bash
   cd frontend
   npm install
   ```

2. **Start the frontend development server**
   ```bash
   npm start
   ```

The application will be available at `http://localhost:3000`

## 🎯 Usage

### OCR Receipt Processing

1. Navigate to the Upload page
2. Drag and drop or click to upload receipt images (JPG, PNG) or PDF files
3. The system will automatically extract transaction details using OCR
4. Review the extracted information and suggested transaction
5. Click "Create Transaction" to save the transaction

### CSV/PDF Import

1. Upload CSV files with transaction data
2. The system supports various CSV formats with automatic column detection
3. Review the imported transactions in the preview modal
4. Click "Import Transactions" to bulk import

### Transaction Management

1. Add transactions manually through the Transactions page
2. Categorize transactions for better organization
3. View transaction history and analytics
4. Set up monthly budgets and track spending

## 📚 API Documentation

### Authentication Endpoints

```http
POST /api/auth/register
POST /api/auth/login
GET /api/auth/profile
```

### Transaction Endpoints

```http
GET /api/transactions
POST /api/transactions
PUT /api/transactions/:id
DELETE /api/transactions/:id
GET /api/transactions/analytics/summary
```

### Upload Endpoints

```http
POST /api/upload
POST /api/upload/bulk-import
```

## 🔄 Workflow Diagrams

### Application Overview

```mermaid
graph TB
    A[User] --> B[Frontend React App]
    B --> C[Backend Express API]
    C --> D[MongoDB Database]
    
    B --> E[Authentication]
    B --> F[Transaction Management]
    B --> G[Upload & OCR]
    B --> H[Analytics Dashboard]
    
    E --> I[JWT Token]
    F --> J[CRUD Operations]
    G --> K[File Processing]
    H --> L[Data Visualization]
    
    K --> M[OCR Processing]
    K --> N[CSV Parsing]
    K --> O[PDF Extraction]
    
    M --> P[Transaction Creation]
    N --> P
    O --> P
```

### OCR Upload Workflow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend
    participant O as OCR Engine
    participant DB as Database
    
    U->>F: Upload Receipt Image/PDF
    F->>B: POST /api/upload (multipart/form-data)
    B->>B: Validate File Type & Size
    B->>O: Process with Tesseract.js
    O->>B: Return Extracted Text
    B->>B: Parse Receipt Data
    B->>B: Determine Category
    B->>B: Create Suggested Transaction
    B->>F: Return OCR Results
    F->>U: Display Extracted Data
    U->>F: Review & Confirm
    F->>B: POST /api/transactions
    B->>DB: Save Transaction
    B->>F: Success Response
    F->>U: Transaction Created
```

### CSV Import Workflow

```mermaid
flowchart TD
    A[Upload CSV File] --> B[Validate File Format]
    B --> C[Parse CSV Data]
    C --> D[Detect Column Headers]
    D --> E[Normalize Data]
    E --> F[Determine Transaction Types]
    F --> G[Show Preview Modal]
    G --> H{User Confirms?}
    H -->|Yes| I[Bulk Import Transactions]
    H -->|No| J[Cancel Import]
    I --> K[Save to Database]
    K --> L[Success Notification]
    J --> M[Return to Upload Page]
```

### Dashboard Analytics Workflow

```mermaid
graph LR
    A[User Access Dashboard] --> B[Fetch Current Month Data]
    B --> C[Calculate Summary Statistics]
    C --> D[Generate Charts & Graphs]
    D --> E[Display Financial Overview]
    
    C --> F[Total Income]
    C --> G[Total Expenses]
    C --> H[Net Income]
    C --> I[Savings Rate]
    
    E --> J[Recent Transactions]
    E --> K[Budget Progress]
    E --> L[Quick Actions]
```

### File Processing Pipeline

```mermaid
graph TD
    A[File Upload] --> B{File Type?}
    B -->|Image| C[OCR Processing]
    B -->|PDF| D[PDF Text Extraction]
    B -->|CSV| E[CSV Parsing]
    
    C --> F[Text Recognition]
    D --> G[Text Extraction]
    E --> H[Data Normalization]
    
    F --> I[Receipt Data Parsing]
    G --> I
    H --> J[Transaction Data]
    
    I --> K[Category Detection]
    I --> L[Amount Extraction]
    I --> M[Date Parsing]
    
    K --> N[Suggested Transaction]
    L --> N
    M --> N
    
    J --> O[Transaction Preview]
    N --> P[OCR Results Display]
    
    O --> Q[Bulk Import]
    P --> R[Single Transaction Creation]
```

## 🎨 UI/UX Features

### Modern Design Elements
- **Gradient Backgrounds**: Beautiful color gradients throughout the application
- **Smooth Animations**: Hover effects and transitions for better user experience
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **Card-based Layout**: Clean, organized information display
- **Progress Indicators**: Visual feedback for uploads and processing

### Upload Page Features
- **Drag & Drop Interface**: Intuitive file upload experience
- **File Type Validation**: Automatic detection and validation of supported formats
- **Progress Tracking**: Real-time upload and processing progress
- **Preview Modals**: Review data before importing
- **Error Handling**: Clear error messages and recovery options

### Dashboard Enhancements
- **Financial Overview Cards**: Visual representation of key metrics
- **Interactive Charts**: Dynamic data visualization
- **Quick Actions**: Easy access to common tasks
- **Budget Tracking**: Visual budget progress with color-coded indicators

## 🔧 Configuration

### Environment Variables

#### Backend (.env)
```env
MONGODB_URI=mongodb://localhost:27017/finance-tracker
JWT_SECRET=your-secret-key-here
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
```

#### Frontend (.env)
```env
REACT_APP_API_URL=http://localhost:5000/api
REACT_APP_ENVIRONMENT=development
```

### File Upload Configuration

The application supports the following file types:
- **Images**: JPG, JPEG, PNG, GIF (for OCR processing)
- **Documents**: PDF (for OCR and transaction extraction)
- **Data**: CSV (for bulk transaction import)

Maximum file size: 10MB per file

## 🚀 Deployment

### Production Build

1. **Backend**
   ```bash
   cd backend
   npm run build
   npm start
   ```

2. **Frontend**
   ```bash
   cd frontend
   npm run build
   ```

### Docker Deployment

```dockerfile
# Backend Dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Tesseract.js](https://github.com/naptha/tesseract.js) for OCR functionality
- [Bootstrap](https://getbootstrap.com/) for the UI framework
- [React](https://reactjs.org/) for the frontend framework
- [Express.js](https://expressjs.com/) for the backend framework

## 📞 Support

For support and questions, please open an issue in the GitHub repository or contact the development team.

---

**Made with ❤️ for better financial management**