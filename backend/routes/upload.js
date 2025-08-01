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
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not supported. Please use JPG, PNG, PDF, or CSV files.`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

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
    let tax = 0;
    let subtotal = 0;

    // Enhanced patterns to extract amounts from various formats
    const totalPatterns = [
      /total[:\s]*\$?([0-9]+\.?[0-9]*)/i,
      /amount[:\s]*\$?([0-9]+\.?[0-9]*)/i,
      /\$([0-9]+\.?[0-9]*)\s*total/i,
      /([0-9]+\.[0-9]{2})/g,
      /([0-9]+\.?[0-9]*)/g,
      /grand\s*total[:\s]*\$?([0-9]+\.?[0-9]*)/i,
      /final\s*total[:\s]*\$?([0-9]+\.?[0-9]*)/i
    ];

    // First, try to extract amount from the entire text
    const fullText = text.replace(/\n/g, ' ');
    const amountMatches = fullText.match(/([0-9]+\.?[0-9]*)/g);
    if (amountMatches) {
      // Find the largest reasonable amount (likely the total)
      const amounts = amountMatches.map(match => parseFloat(match)).filter(amount => amount > 0 && amount < 10000);
      if (amounts.length > 0) {
        total = Math.max(...amounts);
      }
    }
    for (const line of lines) {
      for (const pattern of totalPatterns) {
        const match = line.match(pattern);
        if (match) {
          const amount = parseFloat(match[1]);
          if (amount > 0 && amount > total) {
            total = amount;
          }
        }
      }
    }

    // If still no total found, try to parse from the raw text more aggressively
    if (total === 0) {
      const textNumbers = text.match(/\d+\.?\d*/g);
      if (textNumbers) {
        const validAmounts = textNumbers.map(n => parseFloat(n)).filter(n => n > 0 && n < 10000);
        if (validAmounts.length > 0) {
          total = Math.max(...validAmounts);
        }
      }
    }
    // Extract merchant name (usually at the top)
    if (lines.length > 0) {
      // Try to find a meaningful merchant name from the first few lines
      for (let i = 0; i < Math.min(3, lines.length); i++) {
        const line = lines[i];
        if (line.length > 2 && !line.match(/^\d/) && !line.includes('receipt') && !line.includes('total')) {
          merchantName = line.substring(0, 50);
          break;
        }
      }
      if (!merchantName && lines.length > 0) {
        merchantName = lines[0].substring(0, 50);
      }
    }

    // Enhanced date patterns
    const datePatterns = [
      /(\d{1,2}\/\d{1,2}\/\d{4})/,
      /(\d{1,2}-\d{1,2}-\d{4})/,
      /(\d{4}-\d{1,2}-\d{1,2})/,
      /(\d{1,2}\/\d{1,2}\/\d{2})/,
      /(\d{1,2}-\d{1,2}-\d{2})/,
      /(\d{4}-\d{1,2}-\d{1,2})/
    ];

    // Check the entire text for date patterns
    const fullTextForDate = text.replace(/\n/g, ' ');
    for (const pattern of datePatterns) {
      const match = fullTextForDate.match(pattern);
      if (match) {
        const parsedDate = new Date(match[1]);
        if (!isNaN(parsedDate.getTime())) {
          date = parsedDate;
          break;
        }
      }
    }

    // If no date found in full text, check line by line
    if (isNaN(date.getTime())) {
      for (const line of lines) {
        for (const pattern of datePatterns) {
          const match = line.match(pattern);
          if (match) {
            const parsedDate = new Date(match[1]);
            if (!isNaN(parsedDate.getTime())) {
              date = parsedDate;
              break;
            }
          }
        }
        if (!isNaN(date.getTime())) break;
      }
    }

    // If still no valid date, use current date
    if (isNaN(date.getTime())) {
      date = new Date();
    }

    // Extract individual items with better parsing
    for (const line of lines) {
      // More flexible item matching
      const itemPatterns = [
        /(.+?)\s+([0-9]+\.?[0-9]*)/,
        /(.+?)\s+\$([0-9]+\.?[0-9]*)/,
        /(.+?)\s+([0-9]+\.[0-9]{2})/
      ];
      
      for (const pattern of datePatterns) {
        const match = line.match(pattern);
        if (match) {
          const parsedDate = new Date(match[1]);
          if (!isNaN(parsedDate.getTime())) {
            date = parsedDate;
            break;
          }
        }
      }
      
      for (const pattern of itemPatterns) {
        const itemMatch = line.match(pattern);
        if (itemMatch && parseFloat(itemMatch[2]) > 0) {
          const itemName = itemMatch[1].trim();
          const itemAmount = parseFloat(itemMatch[2]);
          if (itemName.length > 1 && itemAmount > 0 && itemAmount < 1000) {
            items.push({
              name: itemName,
              amount: itemAmount
            });
          }
          break;
        }
      }
    }

    // Determine category based on merchant name
    const category = determineCategory(merchantName);

    return {
      total,
      merchantName,
      date: isNaN(date.getTime()) ? new Date() : date,
      items,
      category,
      rawText: text
    };
  } catch (error) {
    console.error('OCR extraction error:', error);
    throw new Error('Failed to extract data from receipt');
  }
};

// Helper function to determine category based on merchant name
const determineCategory = (merchantName) => {
  const name = merchantName.toLowerCase();
  
  if (name.includes('grocery') || name.includes('food') || name.includes('supermarket') || name.includes('market')) {
    return 'Food & Dining';
  } else if (name.includes('gas') || name.includes('fuel') || name.includes('shell') || name.includes('exxon')) {
    return 'Transportation';
  } else if (name.includes('amazon') || name.includes('walmart') || name.includes('target') || name.includes('costco')) {
    return 'Shopping';
  } else if (name.includes('restaurant') || name.includes('cafe') || name.includes('pizza') || name.includes('burger')) {
    return 'Food & Dining';
  } else if (name.includes('uber') || name.includes('lyft') || name.includes('taxi')) {
    return 'Transportation';
  } else if (name.includes('netflix') || name.includes('spotify') || name.includes('hulu') || name.includes('amazon prime')) {
    return 'Entertainment';
  } else if (name.includes('gym') || name.includes('fitness') || name.includes('planet fitness')) {
    return 'Health & Fitness';
  } else {
    return 'Other';
  }
};

// Helper function to parse CSV files
const parseCSVFile = async (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        // Normalize the data
        const normalizedData = {};
        
        // Handle different column name variations
        const dateField = data.date || data.Date || data.DATE || data.transaction_date;
        const descriptionField = data.description || data.Description || data.DESCRIPTION || data.memo || data.note;
        const amountField = data.amount || data.Amount || data.AMOUNT || data.transaction_amount;
        const categoryField = data.category || data.Category || data.CATEGORY || data.transaction_category;
        
        if (dateField && descriptionField && amountField) {
          // Parse amount (handle different formats)
          let amount = parseFloat(amountField.replace(/[$,]/g, ''));
          
          // Determine if it's income or expense
          const isIncome = amount > 0 || 
                          descriptionField.toLowerCase().includes('deposit') ||
                          descriptionField.toLowerCase().includes('salary') ||
                          descriptionField.toLowerCase().includes('payment received');
          
          normalizedData.date = new Date(dateField);
          normalizedData.description = descriptionField;
          normalizedData.amount = Math.abs(amount);
          normalizedData.type = isIncome ? 'income' : 'expense';
          normalizedData.category = categoryField || (isIncome ? 'Salary' : 'Other');
          normalizedData.paymentMethod = 'bank_transfer';
          
          // Only add if date is valid
          if (!isNaN(normalizedData.date.getTime())) {
            results.push(normalizedData);
          }
        }
      })
      .on('end', () => {
        resolve(results);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
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
                           description.toLowerCase().includes('payment received');

            transactions.push({
              date,
              description,
              amount,
              type: isIncome ? 'income' : 'expense',
              category: isIncome ? 'Other' : 'Other', // Default category
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
      if (req.file.mimetype === 'text/csv' || req.file.originalname.toLowerCase().endsWith('.csv')) {
        // Process CSV file
        const transactions = await parseCSVFile(filePath);
        
        result = {
          type: 'csv',
          transactions,
          message: `Successfully parsed ${transactions.length} transactions from CSV`
        };
      } else if (req.file.mimetype === 'application/pdf') {
        // Process PDF file
        const transactions = await parsePDFTransactions(filePath);
        
        result = {
          type: 'pdf',
          transactions,
          message: `Successfully parsed ${transactions.length} transactions from PDF`
        };
      } else if (req.file.mimetype.startsWith('image/')) {
        // Process image using OCR
        const extractedData = await extractReceiptData(filePath);
        
        result = {
          type: 'receipt',
          extractedData,
          suggestedTransaction: {
            type: 'expense',
            amount: extractedData.total,
            description: `Receipt from ${extractedData.merchantName}`,
            date: extractedData.date,
            category: extractedData.category,
            paymentMethod: 'credit_card'
          },
          message: 'Receipt processed successfully'
        };
      } else {
        throw new Error('Unsupported file type');
      }

      // Clean up uploaded file
      fs.unlinkSync(filePath);

      res.json(result);
    } catch (processingError) {
      // Clean up file on processing error
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      throw processingError;
    }
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ 
      message: 'Error processing file',
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
  
  if (error.message.includes('File type') || error.message.includes('not supported')) {
    return res.status(400).json({ message: error.message });
  }

  next(error);
});

// @route   GET /api/upload/csv-template
// @desc    Download CSV template
// @access  Private
router.get('/csv-template', auth, (req, res) => {
  try {
    const csvTemplate = `date,description,amount,category
2024-01-15,"Grocery Store",-45.67,"Food & Dining"
2024-01-14,"Salary",3000.00,"Salary"
2024-01-13,"Gas Station",-35.20,"Transportation"
2024-01-12,"Coffee Shop",-4.50,"Food & Dining"`;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="transaction-template.csv"');
    res.send(csvTemplate);
  } catch (error) {
    console.error('CSV template error:', error);
    res.status(500).json({ message: 'Error generating CSV template' });
  }
});

module.exports = router;