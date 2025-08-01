import React, { useState, useEffect } from 'react';
import { 
  Container, Row, Col, Card, Button, Table, Form, Modal, 
  Badge, Alert, Pagination, InputGroup, Dropdown, ButtonGroup 
} from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { toast } from 'react-toastify';
import LoadingSpinner from '../components/LoadingSpinner';

const TransactionsPage = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState({ expense: [], income: [] });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [formData, setFormData] = useState({
    type: 'expense',
    amount: '',
    category: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    paymentMethod: 'cash',
    notes: ''
  });
  const [filters, setFilters] = useState({
    type: '',
    category: '',
    startDate: '',
    endDate: '',
    search: ''
  });
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    total: 0,
    limit: 10
  });
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    fetchCategories();
    fetchTransactions();
  }, [filters, pagination.currentPage, sortBy, sortOrder]);

  const fetchCategories = async () => {
    try {
      const response = await axios.get('/transactions/categories');
      setCategories(response.data);
    } catch (error) {
      console.error('Error fetching categories:', error);
      toast.error('Failed to load categories');
    }
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.currentPage,
        limit: pagination.limit,
        sortBy,
        sortOrder,
        ...filters
      };

      // Remove empty filters
      Object.keys(params).forEach(key => {
        if (params[key] === '') delete params[key];
      });

      const response = await axios.get('/transactions', { params });
      setTransactions(response.data.transactions);
      setPagination(prev => ({
        ...prev,
        totalPages: response.data.totalPages,
        total: response.data.total
      }));
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      // Reset category when type changes
      ...(name === 'type' ? { category: '' } : {})
    }));
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  };

  const resetForm = () => {
    setFormData({
      type: 'expense',
      amount: '',
      category: '',
      description: '',
      date: new Date().toISOString().split('T')[0],
      paymentMethod: 'cash',
      notes: ''
    });
    setEditingTransaction(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.amount || !formData.category || !formData.description) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      const transactionData = {
        ...formData,
        amount: parseFloat(formData.amount)
      };

      if (editingTransaction) {
        await axios.put(`/transactions/${editingTransaction._id}`, transactionData);
        toast.success('Transaction updated successfully');
      } else {
        await axios.post('/transactions', transactionData);
        toast.success('Transaction created successfully');
      }

      setShowModal(false);
      resetForm();
      fetchTransactions();
    } catch (error) {
      console.error('Error saving transaction:', error);
      toast.error(error.response?.data?.message || 'Failed to save transaction');
    }
  };

  const handleEdit = (transaction) => {
    setEditingTransaction(transaction);
    setFormData({
      type: transaction.type,
      amount: transaction.amount.toString(),
      category: transaction.category,
      description: transaction.description,
      date: transaction.date.split('T')[0],
      paymentMethod: transaction.paymentMethod,
      notes: transaction.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this transaction?')) {
      try {
        await axios.delete(`/transactions/${id}`);
        toast.success('Transaction deleted successfully');
        fetchTransactions();
      } catch (error) {
        console.error('Error deleting transaction:', error);
        toast.error('Failed to delete transaction');
      }
    }
  };

  const clearFilters = () => {
    setFilters({
      type: '',
      category: '',
      startDate: '',
      endDate: '',
      search: ''
    });
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

  const getTransactionTypeColor = (type) => {
    return type === 'income' ? 'success' : 'danger';
  };

  const getTransactionIcon = (type) => {
    return type === 'income' ? 'bi-arrow-up-circle' : 'bi-arrow-down-circle';
  };

  const getCurrentCategories = () => {
    return formData.type === 'income' ? categories.income : categories.expense;
  };

  if (loading && transactions.length === 0) {
    return <LoadingSpinner message="Loading transactions..." />;
  }

  return (
    <Container className="py-4">
      {/* Header */}
      <Row className="mb-4">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <div>
              <h2 className="mb-1">Transactions</h2>
              <p className="text-muted mb-0">Manage your income and expenses</p>
            </div>
            <Button 
              variant="primary" 
              size="lg"
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
            >
              <i className="bi bi-plus-circle me-2"></i>
              Add Transaction
            </Button>
          </div>
        </Col>
      </Row>

      {/* Filters */}
      <Card className="mb-4 border-0 shadow-sm">
        <Card.Body>
          <Row>
            <Col md={2}>
              <Form.Group>
                <Form.Label>Type</Form.Label>
                <Form.Select
                  name="type"
                  value={filters.type}
                  onChange={handleFilterChange}
                >
                  <option value="">All Types</option>
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={2}>
              <Form.Group>
                <Form.Label>Category</Form.Label>
                <Form.Select
                  name="category"
                  value={filters.category}
                  onChange={handleFilterChange}
                >
                  <option value="">All Categories</option>
                  {[...categories.income, ...categories.expense].map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={2}>
              <Form.Group>
                <Form.Label>Start Date</Form.Label>
                <Form.Control
                  type="date"
                  name="startDate"
                  value={filters.startDate}
                  onChange={handleFilterChange}
                />
              </Form.Group>
            </Col>
            <Col md={2}>
              <Form.Group>
                <Form.Label>End Date</Form.Label>
                <Form.Control
                  type="date"
                  name="endDate"
                  value={filters.endDate}
                  onChange={handleFilterChange}
                />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group>
                <Form.Label>Search</Form.Label>
                <InputGroup>
                  <Form.Control
                    type="text"
                    placeholder="Search description..."
                    name="search"
                    value={filters.search}
                    onChange={handleFilterChange}
                  />
                  <Button variant="outline-secondary" onClick={clearFilters}>
                    <i className="bi bi-x-circle"></i>
                  </Button>
                </InputGroup>
              </Form.Group>
            </Col>
            <Col md={1} className="d-flex align-items-end">
              <Dropdown as={ButtonGroup}>
                <Button variant="outline-primary" size="sm">
                  <i className="bi bi-sort-down me-1"></i>
                  Sort
                </Button>
                <Dropdown.Toggle split variant="outline-primary" size="sm" />
                <Dropdown.Menu>
                  <Dropdown.Item onClick={() => { setSortBy('date'); setSortOrder('desc'); }}>
                    Date (Newest)
                  </Dropdown.Item>
                  <Dropdown.Item onClick={() => { setSortBy('date'); setSortOrder('asc'); }}>
                    Date (Oldest)
                  </Dropdown.Item>
                  <Dropdown.Item onClick={() => { setSortBy('amount'); setSortOrder('desc'); }}>
                    Amount (High to Low)
                  </Dropdown.Item>
                  <Dropdown.Item onClick={() => { setSortBy('amount'); setSortOrder('asc'); }}>
                    Amount (Low to High)
                  </Dropdown.Item>
                </Dropdown.Menu>
              </Dropdown>
            </Col>
          </Row>
        </Card.Body>
      </Card>

      {/* Transactions Table */}
      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-white border-0">
          <div className="d-flex justify-content-between align-items-center">
            <h5 className="mb-0">
              Transactions ({pagination.total})
            </h5>
            <div className="d-flex align-items-center">
              <Form.Select
                size="sm"
                value={pagination.limit}
                onChange={(e) => setPagination(prev => ({ 
                  ...prev, 
                  limit: parseInt(e.target.value),
                  currentPage: 1 
                }))}
                style={{ width: 'auto' }}
              >
                <option value={10}>10 per page</option>
                <option value={25}>25 per page</option>
                <option value={50}>50 per page</option>
              </Form.Select>
            </div>
          </div>
        </Card.Header>
        <Card.Body className="p-0">
          {loading ? (
            <div className="text-center py-4">
              <LoadingSpinner size="sm" centered={false} />
            </div>
          ) : transactions.length > 0 ? (
            <>
              <Table responsive hover className="mb-0">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th>Payment Method</th>
                    <th className="text-end">Amount</th>
                    <th width="120">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction._id}>
                      <td className="text-muted">
                        {formatDate(transaction.date)}
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          <i className={`${getTransactionIcon(transaction.type)} text-${getTransactionTypeColor(transaction.type)} me-2`}></i>
                          <div>
                            <div className="fw-medium">{transaction.description}</div>
                            {transaction.notes && (
                              <small className="text-muted">{transaction.notes}</small>
                            )}
                          </div>
                        </div>
                      </td>
                      <td>
                        <Badge bg="secondary" className="text-white">
                          {transaction.category}
                        </Badge>
                      </td>
                      <td className="text-muted text-capitalize">
                        {transaction.paymentMethod.replace('_', ' ')}
                      </td>
                      <td className={`text-end fw-bold text-${getTransactionTypeColor(transaction.type)}`}>
                        {transaction.type === 'income' ? '+' : '-'}
                        {formatCurrency(transaction.amount)}
                      </td>
                      <td>
                        <ButtonGroup size="sm">
                          <Button
                            variant="outline-primary"
                            onClick={() => handleEdit(transaction)}
                          >
                            <i className="bi bi-pencil"></i>
                          </Button>
                          <Button
                            variant="outline-danger"
                            onClick={() => handleDelete(transaction._id)}
                          >
                            <i className="bi bi-trash"></i>
                          </Button>
                        </ButtonGroup>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="d-flex justify-content-center p-3">
                  <Pagination>
                    <Pagination.First 
                      disabled={pagination.currentPage === 1}
                      onClick={() => setPagination(prev => ({ ...prev, currentPage: 1 }))}
                    />
                    <Pagination.Prev 
                      disabled={pagination.currentPage === 1}
                      onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage - 1 }))}
                    />
                    
                    {[...Array(pagination.totalPages)].map((_, index) => {
                      const page = index + 1;
                      if (
                        page === 1 || 
                        page === pagination.totalPages || 
                        (page >= pagination.currentPage - 2 && page <= pagination.currentPage + 2)
                      ) {
                        return (
                          <Pagination.Item
                            key={page}
                            active={page === pagination.currentPage}
                            onClick={() => setPagination(prev => ({ ...prev, currentPage: page }))}
                          >
                            {page}
                          </Pagination.Item>
                        );
                      } else if (
                        page === pagination.currentPage - 3 || 
                        page === pagination.currentPage + 3
                      ) {
                        return <Pagination.Ellipsis key={page} />;
                      }
                      return null;
                    })}

                    <Pagination.Next 
                      disabled={pagination.currentPage === pagination.totalPages}
                      onClick={() => setPagination(prev => ({ ...prev, currentPage: prev.currentPage + 1 }))}
                    />
                    <Pagination.Last 
                      disabled={pagination.currentPage === pagination.totalPages}
                      onClick={() => setPagination(prev => ({ ...prev, currentPage: pagination.totalPages }))}
                    />
                  </Pagination>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-5">
              <i className="bi bi-inbox display-4 text-muted"></i>
              <h5 className="mt-3 text-muted">No transactions found</h5>
              <p className="text-muted">
                {Object.values(filters).some(f => f) 
                  ? 'Try adjusting your filters or add your first transaction'
                  : 'Start by adding your first transaction!'
                }
              </p>
              <Button 
                variant="primary"
                onClick={() => {
                  resetForm();
                  setShowModal(true);
                }}
              >
                <i className="bi bi-plus-circle me-1"></i>
                Add Transaction
              </Button>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Add/Edit Transaction Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            {editingTransaction ? 'Edit Transaction' : 'Add New Transaction'}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Type *</Form.Label>
                  <Form.Select
                    name="type"
                    value={formData.type}
                    onChange={handleFormChange}
                    required
                  >
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Amount *</Form.Label>
                  <InputGroup>
                    <InputGroup.Text>{user?.currency || 'USD'}</InputGroup.Text>
                    <Form.Control
                      type="number"
                      name="amount"
                      value={formData.amount}
                      onChange={handleFormChange}
                      placeholder="0.00"
                      step="0.01"
                      min="0.01"
                      required
                    />
                  </InputGroup>
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Category *</Form.Label>
                  <Form.Select
                    name="category"
                    value={formData.category}
                    onChange={handleFormChange}
                    required
                  >
                    <option value="">Select Category</option>
                    {getCurrentCategories().map(category => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Payment Method</Form.Label>
                  <Form.Select
                    name="paymentMethod"
                    value={formData.paymentMethod}
                    onChange={handleFormChange}
                  >
                    <option value="cash">Cash</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="debit_card">Debit Card</option>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="digital_wallet">Digital Wallet</option>
                    <option value="check">Check</option>
                    <option value="other">Other</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Description *</Form.Label>
              <Form.Control
                type="text"
                name="description"
                value={formData.description}
                onChange={handleFormChange}
                placeholder="Enter transaction description"
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Date *</Form.Label>
              <Form.Control
                type="date"
                name="date"
                value={formData.date}
                onChange={handleFormChange}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Notes (Optional)</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                name="notes"
                value={formData.notes}
                onChange={handleFormChange}
                placeholder="Additional notes..."
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              {editingTransaction ? 'Update Transaction' : 'Add Transaction'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
};

export default TransactionsPage;