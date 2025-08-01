const express = require('express');
const { body, validationResult, query } = require('express-validator');
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/transactions
// @desc    Create a new transaction
// @access  Private
router.post('/', auth, [
  body('type', 'Type is required').isIn(['income', 'expense']),
  body('amount', 'Amount must be a positive number').isFloat({ min: 0.01 }),
  body('category', 'Category is required').trim().isLength({ min: 1 }),
  body('description', 'Description is required').trim().isLength({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const transactionData = {
      ...req.body,
      user: req.user._id
    };

    const transaction = new Transaction(transactionData);
    await transaction.save();

    // Populate user data for response
    await transaction.populate('user', 'name email');

    res.status(201).json({
      message: 'Transaction created successfully',
      transaction
    });
  } catch (error) {
    console.error('Create transaction error:', error);
    res.status(500).json({ message: 'Server error creating transaction' });
  }
});

// @route   GET /api/transactions
// @desc    Get all transactions for user with filtering
// @access  Private
router.get('/', auth, [
  query('page', 'Page must be a positive integer').optional().isInt({ min: 1 }),
  query('limit', 'Limit must be between 1 and 100').optional().isInt({ min: 1, max: 100 }),
  query('type', 'Type must be income or expense').optional().isIn(['income', 'expense']),
  query('category', 'Category must be a string').optional().isString(),
  query('startDate', 'Start date must be a valid date').optional().isISO8601(),
  query('endDate', 'End date must be a valid date').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      page = 1,
      limit = 10,
      type,
      category,
      startDate,
      endDate,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = { user: req.user._id };
    
    if (type) filter.type = type;
    if (category) filter.category = { $regex: category, $options: 'i' };
    
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query with pagination
    const transactions = await Transaction.find(filter)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('user', 'name email');

    const total = await Transaction.countDocuments(filter);

    res.json({
      transactions,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ message: 'Server error fetching transactions' });
  }
});

// @route   GET /api/transactions/:id
// @desc    Get single transaction
// @access  Private
router.get('/:id', auth, async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      user: req.user._id
    }).populate('user', 'name email');

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    res.json({ transaction });
  } catch (error) {
    console.error('Get transaction error:', error);
    if (error.name === 'CastError') {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    res.status(500).json({ message: 'Server error fetching transaction' });
  }
});

// @route   PUT /api/transactions/:id
// @desc    Update transaction
// @access  Private
router.put('/:id', auth, [
  body('type', 'Type must be income or expense').optional().isIn(['income', 'expense']),
  body('amount', 'Amount must be a positive number').optional().isFloat({ min: 0.01 }),
  body('category', 'Category is required').optional().trim().isLength({ min: 1 }),
  body('description', 'Description is required').optional().trim().isLength({ min: 1 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const transaction = await Transaction.findOne({
      _id: req.params.id,
      user: req.user._id
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    // Update fields
    Object.keys(req.body).forEach(key => {
      if (req.body[key] !== undefined) {
        transaction[key] = req.body[key];
      }
    });

    await transaction.save();
    await transaction.populate('user', 'name email');

    res.json({
      message: 'Transaction updated successfully',
      transaction
    });
  } catch (error) {
    console.error('Update transaction error:', error);
    if (error.name === 'CastError') {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    res.status(500).json({ message: 'Server error updating transaction' });
  }
});

// @route   DELETE /api/transactions/:id
// @desc    Delete transaction
// @access  Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const transaction = await Transaction.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('Delete transaction error:', error);
    if (error.name === 'CastError') {
      return res.status(404).json({ message: 'Transaction not found' });
    }
    res.status(500).json({ message: 'Server error deleting transaction' });
  }
});

// @route   GET /api/transactions/analytics/summary
// @desc    Get transaction summary and analytics
// @access  Private
router.get('/analytics/summary', auth, [
  query('startDate', 'Start date must be a valid date').optional().isISO8601(),
  query('endDate', 'End date must be a valid date').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { startDate, endDate } = req.query;
    
    // Build date filter
    const dateFilter = { user: req.user._id };
    if (startDate || endDate) {
      dateFilter.date = {};
      if (startDate) dateFilter.date.$gte = new Date(startDate);
      if (endDate) dateFilter.date.$lte = new Date(endDate);
    }

    // Get total income and expenses
    const [incomeTotal, expenseTotal] = await Promise.all([
      Transaction.aggregate([
        { $match: { ...dateFilter, type: 'income' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]),
      Transaction.aggregate([
        { $match: { ...dateFilter, type: 'expense' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ])
    ]);

    // Get expenses by category
    const expensesByCategory = await Transaction.aggregate([
      { $match: { ...dateFilter, type: 'expense' } },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } }
    ]);

    // Get income by category
    const incomeByCategory = await Transaction.aggregate([
      { $match: { ...dateFilter, type: 'income' } },
      { $group: { _id: '$category', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      { $sort: { total: -1 } }
    ]);

    // Get monthly trends
    const monthlyTrends = await Transaction.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' },
            type: '$type'
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    // Recent transactions
    const recentTransactions = await Transaction.find(dateFilter)
      .sort({ date: -1 })
      .limit(5)
      .populate('user', 'name email');

    const totalIncome = incomeTotal[0]?.total || 0;
    const totalExpenses = expenseTotal[0]?.total || 0;
    const netIncome = totalIncome - totalExpenses;

    res.json({
      summary: {
        totalIncome,
        totalExpenses,
        netIncome,
        savingsRate: totalIncome > 0 ? ((netIncome / totalIncome) * 100).toFixed(2) : 0
      },
      expensesByCategory,
      incomeByCategory,
      monthlyTrends,
      recentTransactions
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ message: 'Server error fetching analytics' });
  }
});

// @route   GET /api/transactions/categories
// @desc    Get available categories
// @access  Private
router.get('/categories', auth, async (req, res) => {
  try {
    const expenseCategories = Transaction.getExpenseCategories();
    const incomeCategories = Transaction.getIncomeCategories();

    res.json({
      expense: expenseCategories,
      income: incomeCategories
    });
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ message: 'Server error fetching categories' });
  }
});

module.exports = router;