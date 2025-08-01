import React, { useState, useEffect } from 'react';
import { 
  Container, Row, Col, Card, Form, Button, Alert, 
  Modal, Tab, Tabs, Table, Badge 
} from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { toast } from 'react-toastify';

const ProfilePage = () => {
  const { user, updateProfile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [statistics, setStatistics] = useState(null);
  
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    currency: user?.currency || 'USD',
    monthlyBudget: user?.monthlyBudget || ''
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    budgetAlerts: true,
    weeklyReports: false,
    darkMode: false,
    language: 'en'
  });

  const currencies = [
    { code: 'USD', name: 'US Dollar ($)', symbol: '$' },
    { code: 'EUR', name: 'Euro (€)', symbol: '€' },
    { code: 'GBP', name: 'British Pound (£)', symbol: '£' },
    { code: 'JPY', name: 'Japanese Yen (¥)', symbol: '¥' },
    { code: 'CAD', name: 'Canadian Dollar (C$)', symbol: 'C$' },
    { code: 'AUD', name: 'Australian Dollar (A$)', symbol: 'A$' },
    { code: 'INR', name: 'Indian Rupee (₹)', symbol: '₹' }
  ];

  useEffect(() => {
    fetchUserStatistics();
    loadPreferences();
  }, []);

  const fetchUserStatistics = async () => {
    try {
      const response = await axios.get('/transactions/analytics/summary');
      setStatistics(response.data);
    } catch (error) {
      console.error('Error fetching statistics:', error);
    }
  };

  const loadPreferences = () => {
    const savedPreferences = localStorage.getItem('userPreferences');
    if (savedPreferences) {
      setPreferences(JSON.parse(savedPreferences));
    }
  };

  const handleProfileChange = (e) => {
    const { name, value } = e.target;
    setProfileData(prev => ({ ...prev, [name]: value }));
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
  };

  const handlePreferenceChange = (e) => {
    const { name, checked, value } = e.target;
    const newValue = e.target.type === 'checkbox' ? checked : value;
    setPreferences(prev => ({ ...prev, [name]: newValue }));
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const result = await updateProfile({
        name: profileData.name,
        currency: profileData.currency,
        monthlyBudget: parseFloat(profileData.monthlyBudget) || 0
      });

      if (result.success) {
        toast.success('Profile updated successfully!');
      }
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      await axios.put('/auth/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });

      toast.success('Password updated successfully!');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const handlePreferencesSubmit = (e) => {
    e.preventDefault();
    localStorage.setItem('userPreferences', JSON.stringify(preferences));
    toast.success('Preferences saved successfully!');
  };

  const handleExportData = async () => {
    try {
      const response = await axios.get('/transactions/export', {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `transactions-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.success('Data exported successfully!');
    } catch (error) {
      toast.error('Failed to export data');
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await axios.delete('/auth/account');
      toast.success('Account deleted successfully');
      logout();
    } catch (error) {
      toast.error('Failed to delete account');
    }
    setShowDeleteModal(false);
  };

  const formatCurrency = (amount) => {
    const currency = currencies.find(c => c.code === user?.currency) || currencies[0];
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.code
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <Container className="py-4">
      {/* Header */}
      <Row className="mb-4">
        <Col>
          <div className="d-flex align-items-center">
            <div className="bg-primary rounded-circle d-flex align-items-center justify-content-center me-3" 
                 style={{ width: '60px', height: '60px' }}>
              <i className="bi bi-person-fill text-white" style={{ fontSize: '2rem' }}></i>
            </div>
            <div>
              <h2 className="mb-1">{user?.name}</h2>
              <p className="text-muted mb-0">{user?.email}</p>
              <small className="text-muted">
                Member since {formatDate(user?.createdAt)}
              </small>
            </div>
          </div>
        </Col>
      </Row>

      {/* Account Statistics */}
      {statistics && (
        <Row className="mb-4">
          <Col md={3} className="mb-3">
            <Card className="border-0 shadow-sm text-center">
              <Card.Body>
                <i className="bi bi-receipt text-primary display-6 mb-2"></i>
                <h4 className="mb-1">{statistics.summary?.totalTransactions || 0}</h4>
                <small className="text-muted">Total Transactions</small>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3} className="mb-3">
            <Card className="border-0 shadow-sm text-center">
              <Card.Body>
                <i className="bi bi-arrow-up-circle text-success display-6 mb-2"></i>
                <h4 className="mb-1">{formatCurrency(statistics.summary?.totalIncome || 0)}</h4>
                <small className="text-muted">Total Income</small>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3} className="mb-3">
            <Card className="border-0 shadow-sm text-center">
              <Card.Body>
                <i className="bi bi-arrow-down-circle text-danger display-6 mb-2"></i>
                <h4 className="mb-1">{formatCurrency(statistics.summary?.totalExpenses || 0)}</h4>
                <small className="text-muted">Total Expenses</small>
              </Card.Body>
            </Card>
          </Col>
          <Col md={3} className="mb-3">
            <Card className="border-0 shadow-sm text-center">
              <Card.Body>
                <i className="bi bi-percent text-info display-6 mb-2"></i>
                <h4 className="mb-1">{statistics.summary?.savingsRate || 0}%</h4>
                <small className="text-muted">Savings Rate</small>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* Settings Tabs */}
      <Row>
        <Col>
          <Tabs
            activeKey={activeTab}
            onSelect={(k) => setActiveTab(k)}
            className="mb-4"
          >
            {/* Profile Settings */}
            <Tab eventKey="profile" title={
              <span>
                <i className="bi bi-person me-2"></i>
                Profile
              </span>
            }>
              <Card className="border-0 shadow-sm">
                <Card.Header className="bg-white border-0">
                  <h5 className="mb-0">Profile Information</h5>
                </Card.Header>
                <Card.Body>
                  <Form onSubmit={handleProfileSubmit}>
                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Full Name</Form.Label>
                          <Form.Control
                            type="text"
                            name="name"
                            value={profileData.name}
                            onChange={handleProfileChange}
                            required
                          />
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Email Address</Form.Label>
                          <Form.Control
                            type="email"
                            value={profileData.email}
                            disabled
                            className="bg-light"
                          />
                          <Form.Text className="text-muted">
                            Contact support to change your email address
                          </Form.Text>
                        </Form.Group>
                      </Col>
                    </Row>

                    <Row>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Preferred Currency</Form.Label>
                          <Form.Select
                            name="currency"
                            value={profileData.currency}
                            onChange={handleProfileChange}
                          >
                            {currencies.map(currency => (
                              <option key={currency.code} value={currency.code}>
                                {currency.name}
                              </option>
                            ))}
                          </Form.Select>
                        </Form.Group>
                      </Col>
                      <Col md={6}>
                        <Form.Group className="mb-3">
                          <Form.Label>Monthly Budget</Form.Label>
                          <Form.Control
                            type="number"
                            name="monthlyBudget"
                            value={profileData.monthlyBudget}
                            onChange={handleProfileChange}
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                          />
                          <Form.Text className="text-muted">
                            Set your monthly spending limit
                          </Form.Text>
                        </Form.Group>
                      </Col>
                    </Row>

                    <Button 
                      type="submit" 
                      variant="primary" 
                      disabled={loading}
                    >
                      {loading ? 'Updating...' : 'Update Profile'}
                    </Button>
                  </Form>
                </Card.Body>
              </Card>
            </Tab>

            {/* Security Settings */}
            <Tab eventKey="security" title={
              <span>
                <i className="bi bi-shield-lock me-2"></i>
                Security
              </span>
            }>
              <Card className="border-0 shadow-sm">
                <Card.Header className="bg-white border-0">
                  <h5 className="mb-0">Change Password</h5>
                </Card.Header>
                <Card.Body>
                  <Form onSubmit={handlePasswordSubmit}>
                    <Form.Group className="mb-3">
                      <Form.Label>Current Password</Form.Label>
                      <Form.Control
                        type="password"
                        name="currentPassword"
                        value={passwordData.currentPassword}
                        onChange={handlePasswordChange}
                        required
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>New Password</Form.Label>
                      <Form.Control
                        type="password"
                        name="newPassword"
                        value={passwordData.newPassword}
                        onChange={handlePasswordChange}
                        minLength={6}
                        required
                      />
                      <Form.Text className="text-muted">
                        Must be at least 6 characters long
                      </Form.Text>
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Label>Confirm New Password</Form.Label>
                      <Form.Control
                        type="password"
                        name="confirmPassword"
                        value={passwordData.confirmPassword}
                        onChange={handlePasswordChange}
                        required
                      />
                    </Form.Group>

                    <Button 
                      type="submit" 
                      variant="primary" 
                      disabled={loading}
                    >
                      {loading ? 'Updating...' : 'Update Password'}
                    </Button>
                  </Form>

                  <hr className="my-4" />

                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <h6 className="mb-1">Two-Factor Authentication</h6>
                      <small className="text-muted">Add an extra layer of security</small>
                    </div>
                    <Badge bg="secondary">Coming Soon</Badge>
                  </div>
                </Card.Body>
              </Card>
            </Tab>

            {/* Preferences */}
            <Tab eventKey="preferences" title={
              <span>
                <i className="bi bi-gear me-2"></i>
                Preferences
              </span>
            }>
              <Card className="border-0 shadow-sm">
                <Card.Header className="bg-white border-0">
                  <h5 className="mb-0">App Preferences</h5>
                </Card.Header>
                <Card.Body>
                  <Form onSubmit={handlePreferencesSubmit}>
                    <h6 className="mb-3">Notifications</h6>
                    <Form.Group className="mb-3">
                      <Form.Check
                        type="checkbox"
                        name="emailNotifications"
                        label="Email notifications for important updates"
                        checked={preferences.emailNotifications}
                        onChange={handlePreferenceChange}
                      />
                    </Form.Group>

                    <Form.Group className="mb-3">
                      <Form.Check
                        type="checkbox"
                        name="budgetAlerts"
                        label="Budget alerts when approaching limits"
                        checked={preferences.budgetAlerts}
                        onChange={handlePreferenceChange}
                      />
                    </Form.Group>

                    <Form.Group className="mb-4">
                      <Form.Check
                        type="checkbox"
                        name="weeklyReports"
                        label="Weekly financial summary reports"
                        checked={preferences.weeklyReports}
                        onChange={handlePreferenceChange}
                      />
                    </Form.Group>

                    <h6 className="mb-3">Display</h6>
                    <Form.Group className="mb-3">
                      <Form.Check
                        type="checkbox"
                        name="darkMode"
                        label="Dark mode (Coming soon)"
                        checked={preferences.darkMode}
                        onChange={handlePreferenceChange}
                        disabled
                      />
                    </Form.Group>

                    <Form.Group className="mb-4">
                      <Form.Label>Language</Form.Label>
                      <Form.Select
                        name="language"
                        value={preferences.language}
                        onChange={handlePreferenceChange}
                        disabled
                      >
                        <option value="en">English</option>
                        <option value="es">Spanish (Coming soon)</option>
                        <option value="fr">French (Coming soon)</option>
                      </Form.Select>
                    </Form.Group>

                    <Button type="submit" variant="primary">
                      Save Preferences
                    </Button>
                  </Form>
                </Card.Body>
              </Card>
            </Tab>

            {/* Data & Privacy */}
            <Tab eventKey="data" title={
              <span>
                <i className="bi bi-download me-2"></i>
                Data & Privacy
              </span>
            }>
              <Card className="border-0 shadow-sm">
                <Card.Header className="bg-white border-0">
                  <h5 className="mb-0">Data Management</h5>
                </Card.Header>
                <Card.Body>
                  <div className="mb-4">
                    <h6 className="mb-2">Export Your Data</h6>
                    <p className="text-muted mb-3">
                      Download all your transaction data in CSV format
                    </p>
                    <Button 
                      variant="outline-primary" 
                      onClick={handleExportData}
                    >
                      <i className="bi bi-download me-2"></i>
                      Export Transactions
                    </Button>
                  </div>

                  <hr />

                  <div className="mb-4">
                    <h6 className="mb-2">Data Privacy</h6>
                    <p className="text-muted mb-3">
                      Your financial data is encrypted and stored securely. We never share your personal information with third parties.
                    </p>
                    <div className="d-flex gap-2">
                      <Badge bg="success">
                        <i className="bi bi-shield-check me-1"></i>
                        Encrypted
                      </Badge>
                      <Badge bg="primary">
                        <i className="bi bi-lock me-1"></i>
                        Secure
                      </Badge>
                      <Badge bg="info">
                        <i className="bi bi-eye-slash me-1"></i>
                        Private
                      </Badge>
                    </div>
                  </div>

                  <hr />

                  <div className="text-danger">
                    <h6 className="mb-2 text-danger">Delete Account</h6>
                    <p className="text-muted mb-3">
                      Permanently delete your account and all associated data. This action cannot be undone.
                    </p>
                    <Button 
                      variant="outline-danger"
                      onClick={() => setShowDeleteModal(true)}
                    >
                      <i className="bi bi-trash me-2"></i>
                      Delete Account
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            </Tab>
          </Tabs>
        </Col>
      </Row>

      {/* Delete Account Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title className="text-danger">Delete Account</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Alert variant="danger">
            <Alert.Heading>⚠️ Warning</Alert.Heading>
            <p>
              This action will permanently delete your account and all associated data, including:
            </p>
            <ul>
              <li>All transaction records</li>
              <li>Financial analytics and reports</li>
              <li>Account settings and preferences</li>
              <li>Uploaded receipts and documents</li>
            </ul>
            <p className="mb-0">
              <strong>This action cannot be undone.</strong>
            </p>
          </Alert>
          <p>Are you sure you want to delete your account?</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDeleteAccount}>
            Delete My Account
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default ProfilePage;