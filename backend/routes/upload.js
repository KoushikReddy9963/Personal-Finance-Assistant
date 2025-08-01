const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Tesseract = require('tesseract.js');
const pdf = require('pdf-parse');
const csv = require('csv-parser');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Accept images, PDFs, and CSV files
  const allowedTypes = [
    'image/jpeg',
    'image/jpg', 
    'image/png',
    'image/gif',
    'application/pdf',
    'text/csv',
    'application/vnd.ms-excel'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only image files, PDFs, and CSV files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

// Helper function to parse CSV files
const parseCSVFile = async (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
};

// Helper function to extract receipt data using OCR
const extractReceiptData = async (imagePath) => {
  try {
    const { data: { text } } = await Tesseract.recognize(imagePath, 'eng', {
      logger: m => console.log(m)
    });

    // Parse the OCR text to extract relevant information
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    let total = 0;
    let merchantName = '';
    let date = new Date();
    let items = [];

    // Look for total amount (various patterns)
    const totalPatterns = [
      /total[:\s]*\$?([0-9]+\.?[0-9]*)/i,
      /amount[:\s]*\$?([0-9]+\.?[0-9]*)/i,
      /\$([0-9]+\.?[0-9]*)\s*total/i,
      /\$([0-9]+\.[0-9]{2})/g,
      /grand total[:\s]*\$?([0-9]+\.?[0-9]*)/i,
      /subtotal[:\s]*\$?([0-9]+\.?[0-9]*)/i
    ];

    for (const line of lines) {
      for (const pattern of totalPatterns) {
        const match = line.match(pattern);
        if (match) {
          const amount = parseFloat(match[1]);
          if (amount > total) {
            total = amount;
          }
        }
      }
    }

    // Extract merchant name (usually at the top)
    if (lines.length > 0) {
      merchantName = lines[0].substring(0, 50); // First line, limited length
    }

    // Look for date patterns
    const datePatterns = [
      /(\d{1,2}\/\d{1,2}\/\d{4})/,
      /(\d{1,2}-\d{1,2}-\d{4})/,
      /(\d{4}-\d{1,2}-\d{1,2})/,
      /(\d{1,2}\/\d{1,2}\/\d{2})/,
      /(\d{1,2}-\d{1,2}-\d{2})/
    ];

    for (const line of lines) {
      for (const pattern of datePatterns) {
        const match = line.match(pattern);
        if (match) {
          date = new Date(match[1]);
          if (!isNaN(date.getTime())) {
            break;
          }
        }
      }
    }

    // Extract individual items (basic implementation)
    for (const line of lines) {
      const itemMatch = line.match(/(.+?)\s+\$?([0-9]+\.?[0-9]*)/);
      if (itemMatch && parseFloat(itemMatch[2]) > 0) {
        items.push({
          name: itemMatch[1].trim(),
          amount: parseFloat(itemMatch[2])
        });
      }
    }

    return {
      total,
      merchantName,
      date: isNaN(date.getTime()) ? new Date() : date,
      items,
      rawText: text
    };
  } catch (error) {
    console.error('OCR extraction error:', error);
    throw new Error('Failed to extract data from receipt');
  }
};

// Helper function to parse PDF transaction history
const parsePDFTransactions = async (pdfPath) => {
  try {
    const dataBuffer = fs.readFileSync(pdfPath);
    const pdfData = await pdf(dataBuffer);
    
    const lines = pdfData.text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const transactions = [];

    // Basic parsing for tabular transaction data
    // This is a simplified version - real implementation would need to be more sophisticated
    for (const line of lines) {
      // Look for lines that might contain transaction data
      // Pattern: Date, Description, Amount (various formats)
      const transactionPatterns = [
        /(\d{1,2}\/\d{1,2}\/\d{4})\s+(.+?)\s+([+-]?\$?[0-9,]+\.?[0-9]*)/,
        /(\d{1,2}-\d{1,2}-\d{4})\s+(.+?)\s+([+-]?\$?[0-9,]+\.?[0-9]*)/,
        /(\d{4}-\d{1,2}-\d{1,2})\s+(.+?)\s+([+-]?\$?[0-9,]+\.?[0-9]*)/
      ];

      for (const pattern of transactionPatterns) {
        const match = line.match(pattern);
        if (match) {
          const date = new Date(match[1]);
          const description = match[2].trim();
          const amountStr = match[3].replace(/[$,]/g, '');
          const amount = Math.abs(parseFloat(amountStr));

          if (!isNaN(date.getTime()) && amount > 0 && description.length > 0) {
            // Determine if it's income or expense based on amount sign or keywords
            const isIncome = match[3].includes('+') || 
                           description.toLowerCase().includes('deposit') ||
                           description.toLowerCase().includes('payment received') ||
                           description.toLowerCase().includes('salary') ||
                           description.toLowerCase().includes('income');

            transactions.push({
              date,
              description,
              amount,
              type: isIncome ? 'income' : 'expense',
              category: isIncome ? 'Income' : 'Other', // Default category
              paymentMethod: 'bank_transfer'
            });
          }
          break;
        }
      }
    }

    return transactions;
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error('Failed to parse PDF transaction history');
  }
};

// @route   POST /api/upload
// @desc    Upload and process files (images, PDFs, CSV)
// @access  Private
router.post('/', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const filePath = req.file.path;
    let result = {};

    try {
      if (req.file.mimetype === 'text/csv' || req.file.mimetype === 'application/vnd.ms-excel') {
        // Parse CSV file
        const csvData = await parseCSVFile(filePath);
        
        // Convert CSV data to transaction format
        const transactions = csvData.map(row => {
          const amount = parseFloat(row.amount || row.Amount || row.AMOUNT || 0);
          const isIncome = amount > 0 || 
                          (row.type && row.type.toLowerCase() === 'income') ||
                          (row.Type && row.Type.toLowerCase() === 'income');
          
          return {
            date: row.date || row.Date || row.DATE || new Date().toISOString().split('T')[0],
            description: row.description || row.Description || row.DESCRIPTION || row.description || '',
            amount: Math.abs(amount),
            type: isIncome ? 'income' : 'expense',
            category: row.category || row.Category || row.CATEGORY || (isIncome ? 'Income' : 'Other'),
            paymentMethod: row.paymentMethod || row.payment_method || 'bank_transfer'
          };
        });

        result = {
          type: 'csv',
          transactions,
          message: `Successfully parsed ${transactions.length} transactions from CSV`
        };
      } else if (req.file.mimetype === 'application/pdf') {
        // Process PDF
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdf(dataBuffer);
        
        // Try to determine if it's a receipt or transaction history
        const text = pdfData.text.toLowerCase();
        const isReceipt = text.includes('receipt') || text.includes('total') || text.includes('amount');
        
        if (isReceipt) {
          // Process as receipt
          const extractedData = {
            total: 0,
            merchantName: 'PDF Receipt',
            date: new Date(),
            items: [],
            rawText: pdfData.text
          };

          // Try to find total amount in PDF text
          const totalMatch = pdfData.text.match(/total[:\s]*\$?([0-9]+\.?[0-9]*)/i);
          if (totalMatch) {
            extractedData.total = parseFloat(totalMatch[1]);
          }

          result = {
            type: 'receipt',
            data: extractedData,
            suggestedTransaction: {
              type: 'expense',
              amount: extractedData.total,
              description: `Receipt from ${extractedData.merchantName}`,
              date: extractedData.date,
              category: 'Other',
              paymentMethod: 'credit_card'
            },
            message: 'PDF receipt processed successfully'
          };
        } else {
          // Process as transaction history
          const transactions = await parsePDFTransactions(filePath);
          result = {
            type: 'transactions',
            transactions,
            message: `Found ${transactions.length} potential transactions in PDF`
          };
        }
      } else {
        // Process image using OCR
        const extractedData = await extractReceiptData(filePath);
        
        result = {
          type: 'receipt',
          data: extractedData,
          suggestedTransaction: {
            type: 'expense',
            amount: extractedData.total,
            description: `Receipt from ${extractedData.merchantName}`,
            date: extractedData.date,
            category: 'Other',
            paymentMethod: 'credit_card'
          },
          message: 'Receipt processed successfully'
        };
      }

      // Clean up uploaded file
      fs.unlinkSync(filePath);

      res.json(result);
    } catch (error) {
      // Clean up file on error
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      throw error;
    }
  } catch (error) {
    console.error('File processing error:', error);
    res.status(500).json({ 
      message: 'Error processing file',
      error: error.message 
    });
  }
});

// @route   POST /api/upload/receipt
// @desc    Upload and process receipt image/PDF (legacy endpoint)
// @access  Private
router.post('/receipt', auth, upload.single('receipt'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const filePath = req.file.path;
    let extractedData;

    if (req.file.mimetype === 'application/pdf') {
      // For PDF receipts, we'll try to extract text directly
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdf(dataBuffer);
      
      // Simple text extraction - in a real app, you'd want more sophisticated parsing
      extractedData = {
        total: 0,
        merchantName: 'PDF Receipt',
        date: new Date(),
        items: [],
        rawText: pdfData.text
      };

      // Try to find total amount in PDF text
      const totalMatch = pdfData.text.match(/total[:\s]*\$?([0-9]+\.?[0-9]*)/i);
      if (totalMatch) {
        extractedData.total = parseFloat(totalMatch[1]);
      }
    } else {
      // Process image using OCR
      extractedData = await extractReceiptData(filePath);
    }

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    res.json({
      message: 'Receipt processed successfully',
      data: extractedData,
      suggestedTransaction: {
        type: 'expense',
        amount: extractedData.total,
        description: `Receipt from ${extractedData.merchantName}`,
        date: extractedData.date,
        category: 'Other',
        paymentMethod: 'credit_card'
      }
    });
  } catch (error) {
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error('Receipt processing error:', error);
    res.status(500).json({ 
      message: 'Error processing receipt',
      error: error.message 
    });
  }
});

// @route   POST /api/upload/transactions-pdf
// @desc    Upload and import transaction history from PDF
// @access  Private
router.post('/transactions-pdf', auth, upload.single('transactionsPdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No PDF file uploaded' });
    }

    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ message: 'Only PDF files are allowed' });
    }

    const filePath = req.file.path;
    const transactions = await parsePDFTransactions(filePath);

    // Clean up uploaded file
    fs.unlinkSync(filePath);

    if (transactions.length === 0) {
      return res.json({
        message: 'No transactions found in PDF',
        transactions: []
      });
    }

    res.json({
      message: `Found ${transactions.length} potential transactions`,
      transactions,
      previewMode: true // Indicates these are suggestions, not saved yet
    });
  } catch (error) {
    // Clean up file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    console.error('PDF transaction import error:', error);
    res.status(500).json({ 
      message: 'Error processing PDF transaction history',
      error: error.message 
    });
  }
});

// @route   POST /api/upload/bulk-import
// @desc    Import multiple transactions from parsed data
// @access  Private
router.post('/bulk-import', auth, async (req, res) => {
  try {
    const { transactions } = req.body;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ message: 'No transactions provided' });
    }

    const savedTransactions = [];
    const errors = [];

    for (let i = 0; i < transactions.length; i++) {
      try {
        const transactionData = {
          ...transactions[i],
          user: req.user._id
        };

        const transaction = new Transaction(transactionData);
        await transaction.save();
        savedTransactions.push(transaction);
      } catch (error) {
        errors.push({
          index: i,
          transaction: transactions[i],
          error: error.message
        });
      }
    }

    res.json({
      message: `Successfully imported ${savedTransactions.length} transactions`,
      imported: savedTransactions.length,
      errors: errors.length,
      errorDetails: errors
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({ 
      message: 'Error during bulk import',
      error: error.message 
    });
  }
});

// Error handling middleware for multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large. Maximum size is 10MB.' });
    }
    return res.status(400).json({ message: error.message });
  }
  
  if (error.message === 'Only image files, PDFs, and CSV files are allowed') {
    return res.status(400).json({ message: error.message });
  }

  next(error);
});

module.exports = router;