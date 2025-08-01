import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Badge, Alert } from 'react-bootstrap';
import { 
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, Legend, ResponsiveContainer, LineChart, Line, Area, AreaChart 
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { toast } from 'react-toastify';
import LoadingSpinner from '../components/LoadingSpinner';

const AnalyticsPage = () => {
  const { user } = useAuth();
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  const COLORS = ['#28a745', '#dc3545', '#ffc107', '#17a2b8', '#6f42c1', '#fd7e14', '#20c997', '#e83e8c'];

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/transactions/analytics/summary', {
        params: dateRange
      });
      setAnalyticsData(response.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (e) => {
    const { name, value } = e.target;
    setDateRange(prev => ({ ...prev, [name]: value }));
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: user?.currency || 'USD'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const prepareExpenseChartData = () => {
    if (!analyticsData?.expensesByCategory) return [];
    return analyticsData.expensesByCategory.map((item, index) => ({
      name: item._id,
      value: item.total,
      count: item.count,
      color: COLORS[index % COLORS.length]
    }));
  };

  const prepareIncomeChartData = () => {
    if (!analyticsData?.incomeByCategory) return [];
    return analyticsData.incomeByCategory.map((item, index) => ({
      name: item._id,
      value: item.total,
      count: item.count,
      color: COLORS[index % COLORS.length]
    }));
  };

  const prepareMonthlyTrendData = () => {
    if (!analyticsData?.monthlyTrends) return [];
    
    const groupedData = {};
    analyticsData.monthlyTrends.forEach(item => {
      const key = `${item._id.year}-${String(item._id.month).padStart(2, '0')}`;
      if (!groupedData[key]) {
        groupedData[key] = {
          month: new Date(item._id.year, item._id.month - 1).toLocaleDateString('en-US', { 
            month: 'short', 
            year: 'numeric' 
          }),
          income: 0,
          expense: 0
        };
      }
      groupedData[key][item._id.type] = item.total;
    });

    return Object.values(groupedData).sort((a, b) => a.month.localeCompare(b.month));
  };

  const calculateInsights = () => {
    if (!analyticsData) return {};

    const { summary, expensesByCategory, incomeByCategory } = analyticsData;
    const insights = {};

    // Top spending category
    if (expensesByCategory.length > 0) {
      insights.topExpenseCategory = expensesByCategory[0];
    }

    // Top income source
    if (incomeByCategory.length > 0) {
      insights.topIncomeSource = incomeByCategory[0];
    }

    // Savings rate analysis
    const savingsRate = parseFloat(summary.savingsRate);
    if (savingsRate >= 20) {
      insights.savingsStatus = { type: 'excellent', message: 'Excellent savings rate!' };
    } else if (savingsRate >= 10) {
      insights.savingsStatus = { type: 'good', message: 'Good savings rate' };
    } else if (savingsRate >= 0) {
      insights.savingsStatus = { type: 'fair', message: 'Consider increasing savings' };
    } else {
      insights.savingsStatus = { type: 'poor', message: 'Spending more than earning' };
    }

    // Budget analysis
    if (user?.monthlyBudget > 0) {
      const budgetUsage = (summary.totalExpenses / user.monthlyBudget) * 100;
      if (budgetUsage > 100) {
        insights.budgetStatus = { type: 'over', message: `Over budget by ${formatCurrency(summary.totalExpenses - user.monthlyBudget)}` };
      } else if (budgetUsage > 90) {
        insights.budgetStatus = { type: 'warning', message: 'Close to budget limit' };
      } else {
        insights.budgetStatus = { type: 'good', message: `${formatCurrency(user.monthlyBudget - summary.totalExpenses)} remaining` };
      }
    }

    return insights;
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded shadow-sm">
          <p className="mb-1 fw-bold">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} className="mb-1" style={{ color: entry.color }}>
              {entry.name}: {formatCurrency(entry.value)}
              {entry.payload.count && ` (${entry.payload.count} transactions)`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const insights = calculateInsights();

  if (loading) {
    return <LoadingSpinner message="Loading analytics..." />;
  }

  if (!analyticsData) {
    return (
      <Container className="py-5">
        <Alert variant="info">
          <Alert.Heading>No Data Available</Alert.Heading>
          <p>Add some transactions to see your financial analytics.</p>
        </Alert>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      {/* Header */}
      <Row className="mb-4">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h2 className="mb-1">Financial Analytics</h2>
              <p className="text-muted mb-0">Insights into your spending and earning patterns</p>
            </div>
            <div className="d-flex gap-2">
              <Form.Control
                type="date"
                name="startDate"
                value={dateRange.startDate}
                onChange={handleDateChange}
                className="me-2"
              />
              <Form.Control
                type="date"
                name="endDate"
                value={dateRange.endDate}
                onChange={handleDateChange}
              />
            </div>
          </div>
        </Col>
      </Row>

      {/* Summary Cards */}
      <Row className="mb-4">
        <Col md={3} className="mb-3">
          <Card className="h-100 border-0 shadow-sm bg-gradient-success text-white">
            <Card.Body className="text-center">
              <i className="bi bi-arrow-up-circle display-4 mb-2"></i>
              <h3 className="mb-1">{formatCurrency(analyticsData.summary.totalIncome)}</h3>
              <p className="mb-0 opacity-75">Total Income</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} className="mb-3">
          <Card className="h-100 border-0 shadow-sm bg-gradient-danger text-white">
            <Card.Body className="text-center">
              <i className="bi bi-arrow-down-circle display-4 mb-2"></i>
              <h3 className="mb-1">{formatCurrency(analyticsData.summary.totalExpenses)}</h3>
              <p className="mb-0 opacity-75">Total Expenses</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} className="mb-3">
          <Card className={`h-100 border-0 shadow-sm ${analyticsData.summary.netIncome >= 0 ? 'bg-gradient-primary' : 'bg-gradient-warning'} text-white`}>
            <Card.Body className="text-center">
              <i className="bi bi-wallet2 display-4 mb-2"></i>
              <h3 className="mb-1">{formatCurrency(analyticsData.summary.netIncome)}</h3>
              <p className="mb-0 opacity-75">Net Income</p>
            </Card.Body>
          </Card>
        </Col>
        <Col md={3} className="mb-3">
          <Card className="h-100 border-0 shadow-sm bg-gradient-info text-white">
            <Card.Body className="text-center">
              <i className="bi bi-percent display-4 mb-2"></i>
              <h3 className="mb-1">{analyticsData.summary.savingsRate}%</h3>
              <p className="mb-0 opacity-75">Savings Rate</p>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Insights */}
      {Object.keys(insights).length > 0 && (
        <Row className="mb-4">
          <Col>
            <Card className="border-0 shadow-sm">
              <Card.Header className="bg-white border-0">
                <h5 className="mb-0">💡 Financial Insights</h5>
              </Card.Header>
              <Card.Body>
                <Row>
                  {insights.topExpenseCategory && (
                    <Col md={6} className="mb-3">
                      <div className="d-flex align-items-center">
                        <i className="bi bi-trophy-fill text-warning me-2"></i>
                        <div>
                          <strong>Top Expense Category:</strong>
                          <div className="text-muted">
                            {insights.topExpenseCategory._id} - {formatCurrency(insights.topExpenseCategory.total)}
                          </div>
                        </div>
                      </div>
                    </Col>
                  )}
                  {insights.topIncomeSource && (
                    <Col md={6} className="mb-3">
                      <div className="d-flex align-items-center">
                        <i className="bi bi-star-fill text-success me-2"></i>
                        <div>
                          <strong>Top Income Source:</strong>
                          <div className="text-muted">
                            {insights.topIncomeSource._id} - {formatCurrency(insights.topIncomeSource.total)}
                          </div>
                        </div>
                      </div>
                    </Col>
                  )}
                  {insights.savingsStatus && (
                    <Col md={6} className="mb-3">
                      <div className="d-flex align-items-center">
                        <i className={`bi bi-piggy-bank-fill me-2 ${
                          insights.savingsStatus.type === 'excellent' ? 'text-success' :
                          insights.savingsStatus.type === 'good' ? 'text-primary' :
                          insights.savingsStatus.type === 'fair' ? 'text-warning' : 'text-danger'
                        }`}></i>
                        <div>
                          <strong>Savings Analysis:</strong>
                          <div className="text-muted">{insights.savingsStatus.message}</div>
                        </div>
                      </div>
                    </Col>
                  )}
                  {insights.budgetStatus && (
                    <Col md={6} className="mb-3">
                      <div className="d-flex align-items-center">
                        <i className={`bi bi-speedometer me-2 ${
                          insights.budgetStatus.type === 'good' ? 'text-success' :
                          insights.budgetStatus.type === 'warning' ? 'text-warning' : 'text-danger'
                        }`}></i>
                        <div>
                          <strong>Budget Status:</strong>
                          <div className="text-muted">{insights.budgetStatus.message}</div>
                        </div>
                      </div>
                    </Col>
                  )}
                </Row>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Charts Row 1 */}
      <Row className="mb-4">
        {/* Expense Breakdown */}
        <Col lg={6} className="mb-4">
          <Card className="h-100 border-0 shadow-sm">
            <Card.Header className="bg-white border-0">
              <h5 className="mb-0">Expenses by Category</h5>
            </Card.Header>
            <Card.Body>
              {prepareExpenseChartData().length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={prepareExpenseChartData()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {prepareExpenseChartData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-5 text-muted">
                  <i className="bi bi-pie-chart display-4"></i>
                  <p className="mt-2">No expense data available</p>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* Income Breakdown */}
        <Col lg={6} className="mb-4">
          <Card className="h-100 border-0 shadow-sm">
            <Card.Header className="bg-white border-0">
              <h5 className="mb-0">Income by Source</h5>
            </Card.Header>
            <Card.Body>
              {prepareIncomeChartData().length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={prepareIncomeChartData()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {prepareIncomeChartData().map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-5 text-muted">
                  <i className="bi bi-pie-chart display-4"></i>
                  <p className="mt-2">No income data available</p>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Monthly Trends */}
      <Row className="mb-4">
        <Col>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white border-0">
              <h5 className="mb-0">Monthly Trends</h5>
            </Card.Header>
            <Card.Body>
              {prepareMonthlyTrendData().length > 0 ? (
                <ResponsiveContainer width="100%" height={400}>
                  <AreaChart data={prepareMonthlyTrendData()}>
                    <defs>
                      <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#28a745" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#28a745" stopOpacity={0.1}/>
                      </linearGradient>
                      <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#dc3545" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#dc3545" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(value) => formatCurrency(value)} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="income"
                      stackId="1"
                      stroke="#28a745"
                      fillOpacity={1}
                      fill="url(#colorIncome)"
                      name="Income"
                    />
                    <Area
                      type="monotone"
                      dataKey="expense"
                      stackId="2"
                      stroke="#dc3545"
                      fillOpacity={1}
                      fill="url(#colorExpense)"
                      name="Expenses"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-5 text-muted">
                  <i className="bi bi-graph-up display-4"></i>
                  <p className="mt-2">No trend data available</p>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Recent Transactions */}
      {analyticsData.recentTransactions && analyticsData.recentTransactions.length > 0 && (
        <Row>
          <Col>
            <Card className="border-0 shadow-sm">
              <Card.Header className="bg-white border-0">
                <h5 className="mb-0">Recent Transactions</h5>
              </Card.Header>
              <Card.Body>
                <div className="row">
                  {analyticsData.recentTransactions.map((transaction, index) => (
                    <div key={transaction._id} className="col-md-6 mb-3">
                      <div className="d-flex align-items-center p-3 bg-light rounded">
                        <i className={`bi ${transaction.type === 'income' ? 'bi-arrow-up-circle text-success' : 'bi-arrow-down-circle text-danger'} me-3`} style={{fontSize: '1.5rem'}}></i>
                        <div className="flex-grow-1">
                          <div className="fw-medium">{transaction.description}</div>
                          <small className="text-muted">
                            {transaction.category} • {formatDate(transaction.date)}
                          </small>
                        </div>
                        <div className={`fw-bold ${transaction.type === 'income' ? 'text-success' : 'text-danger'}`}>
                          {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}
    </Container>
  );
};

export default AnalyticsPage;