import React, { useState, useRef } from 'react';
import { Container, Row, Col, Card, Button, Form, Alert, ProgressBar, Badge, Modal, Table, Tabs, Tab } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const UploadPage = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [ocrResults, setOcrResults] = useState([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  const [activeTab, setActiveTab] = useState('receipt');
  
  const fileInputRef = useRef(null);
  const dropRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = async (files) => {
    const validFiles = files.filter(file => {
      const validTypes = [
        'image/jpeg', 
        'image/png', 
        'image/jpg', 
        'image/gif',
        'text/csv', 
        'application/pdf',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];
      const maxSize = 10 * 1024 * 1024; // 10MB
      
      if (!validTypes.includes(file.type)) {
        setError(`File ${file.name} is not a supported format. Please use JPG, PNG, PDF, or CSV files.`);
        return false;
      }
      
      if (file.size > maxSize) {
        setError(`File ${file.name} is too large. Maximum size is 10MB.`);
        return false;
      }
      
      return true;
    });

    if (validFiles.length === 0) return;

    setError('');
    setLoading(true);
    setUploadProgress(0);

    try {
      for (const file of validFiles) {
        await uploadFile(file);
      }
      setSuccess(`Successfully uploaded ${validFiles.length} file(s)`);
    } catch (error) {
      console.error('Upload error:', error);
      setError('Failed to upload files');
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const uploadFile = async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    let endpoint = '/upload/receipt';
    
    // Determine endpoint based on file type
    if (file.type === 'text/csv' || 
        file.type === 'application/vnd.ms-excel' ||
        file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      endpoint = '/upload/csv';
      formData.append('csv', file);
    } else if (file.type === 'application/pdf') {
      endpoint = '/upload/transactions-pdf';
      formData.append('transactionsPdf', file);
    } else {
      formData.append('receipt', file);
    }

    try {
      const response = await axios.post(endpoint, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        },
      });

      const uploadedFile = {
        id: Date.now() + Math.random(),
        name: file.name,
        type: file.type,
        size: file.size,
        uploadedAt: new Date(),
        status: 'completed',
        result: response.data
      };

      setUploadedFiles(prev => [...prev, uploadedFile]);

      // Handle different response types
      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        // OCR result
        if (response.data.suggestedTransaction) {
          const ocrResult = {
            fileId: uploadedFile.id,
            fileName: file.name,
            extractedText: response.data.data?.rawText || 'No text extracted',
            suggestedTransaction: response.data.suggestedTransaction,
            confidence: 0.85
          };
          setOcrResults(prev => [...prev, ocrResult]);
        }
      } else if (file.type === 'text/csv' || 
                 file.type === 'application/vnd.ms-excel' ||
                 file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
        // CSV result
        if (response.data.transactions && response.data.transactions.length > 0) {
          setPreviewData(response.data.transactions);
          setShowPreviewModal(true);
        }
      }

    } catch (error) {
      const failedFile = {
        id: Date.now() + Math.random(),
        name: file.name,
        type: file.type,
        size: file.size,
        uploadedAt: new Date(),
        status: 'failed',
        error: error.response?.data?.message || 'Upload failed'
      };

      setUploadedFiles(prev => [...prev, failedFile]);
      throw error;
    }
  };

  const createTransactionFromOCR = async (ocrResult) => {
    try {
      await axios.post('/transactions', ocrResult.suggestedTransaction);
      setSuccess('Transaction created from receipt!');
      
      // Remove the OCR result from the list
      setOcrResults(prev => prev.filter(result => result.fileId !== ocrResult.fileId));
    } catch (error) {
      console.error('Create transaction error:', error);
      setError('Failed to create transaction from receipt');
    }
  };

  const bulkImportTransactions = async () => {
    try {
      setLoading(true);
      await axios.post('/upload/bulk-import', { transactions: previewData });
      setSuccess(`Successfully imported ${previewData.length} transactions!`);
      setShowPreviewModal(false);
      setPreviewData([]);
    } catch (error) {
      console.error('Bulk import error:', error);
      setError('Failed to import transactions');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: user?.currency || 'USD'
    }).format(amount);
  };

  const getFileIcon = (fileType) => {
    if (fileType.startsWith('image/')) return 'bi-image';
    if (fileType === 'text/csv') return 'bi-file-earmark-spreadsheet';
    if (fileType === 'application/pdf') return 'bi-file-earmark-pdf';
    return 'bi-file-earmark';
  };

  return (
    <Container className="py-4">
      {/* Header */}
      <Row className="mb-4">
        <Col>
          <h2 className="mb-1">Upload & Import</h2>
          <p className="text-muted mb-0">
            Upload receipts for OCR processing or import transactions from CSV files
          </p>
        </Col>
      </Row>

      {error && (
        <Alert variant="danger" dismissible onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert variant="success" dismissible onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      <Row>
        {/* Upload Section */}
        <Col lg={8} className="mb-4">
          <Card className="upload-card">
            <Card.Header className="bg-white border-0">
              <Tabs
                activeKey={activeTab}
                onSelect={(k) => setActiveTab(k)}
                className="border-0"
              >
                <Tab eventKey="receipt" title="Receipt OCR">
                  <div className="mt-3">
                    <div
                      ref={dropRef}
                      className={`upload-zone ${dragActive ? 'active' : ''}`}
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="text-center">
                        <i className="bi bi-camera display-1 text-primary mb-3"></i>
                        <h4>Drop receipt images here or click to browse</h4>
                        <p className="text-muted mb-3">
                          Supported formats: JPG, PNG, PDF
                        </p>
                        <p className="text-muted small">
                          Maximum file size: 10MB per file
                        </p>
                        <Button variant="primary" className="mt-2">
                          <i className="bi bi-folder2-open me-2"></i>
                          Choose Receipt Files
                        </Button>
                      </div>
                    </div>
                  </div>
                </Tab>
                <Tab eventKey="csv" title="CSV Import">
                  <div className="mt-3">
                    <div
                      ref={dropRef}
                      className={`upload-zone ${dragActive ? 'active' : ''}`}
                      onDragEnter={handleDrag}
                      onDragLeave={handleDrag}
                      onDragOver={handleDrag}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <div className="text-center">
                        <i className="bi bi-file-earmark-spreadsheet display-1 text-success mb-3"></i>
                        <h4>Drop CSV files here or click to browse</h4>
                        <p className="text-muted mb-3">
                          Import multiple transactions from bank statements
                        </p>
                        <p className="text-muted small">
                          Maximum file size: 10MB per file
                        </p>
                        <Button variant="success" className="mt-2">
                          <i className="bi bi-folder2-open me-2"></i>
                          Choose CSV Files
                        </Button>
                      </div>
                    </div>
                  </div>
                </Tab>
              </Tabs>
            </Card.Header>
            <Card.Body>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.pdf,.csv"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />

              {/* Upload Progress */}
              {loading && uploadProgress > 0 && (
                <div className="mt-3">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <ProgressBar now={uploadProgress} className="upload-progress" />
                </div>
              )}

              {/* Uploaded Files */}
              {uploadedFiles.length > 0 && (
                <div className="mt-4">
                  <h6 className="mb-3">Recent Uploads</h6>
                  <div className="uploaded-files-list">
                    {uploadedFiles.slice(-5).map((file) => (
                      <div key={file.id} className="uploaded-file-item">
                        <div className="d-flex align-items-center">
                          <div className="file-icon me-3">
                            <i className={`bi ${getFileIcon(file.type)} fs-4`}></i>
                          </div>
                          <div className="file-details flex-grow-1">
                            <div className="file-name fw-medium">{file.name}</div>
                            <small className="text-muted">
                              {formatFileSize(file.size)} • {file.uploadedAt.toLocaleString()}
                            </small>
                          </div>
                          <Badge bg={file.status === 'completed' ? 'success' : 'danger'} className="file-status">
                            {file.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>

          {/* OCR Results */}
          {ocrResults.length > 0 && (
            <Card className="mt-4 ocr-results-card">
              <Card.Header className="bg-white border-0">
                <h5 className="mb-0">
                  <i className="bi bi-eye text-primary me-2"></i>
                  OCR Results
                </h5>
              </Card.Header>
              <Card.Body>
                {ocrResults.map((result) => (
                  <Card key={result.fileId} className="mb-3 ocr-result-item">
                    <Card.Body>
                      <div className="d-flex justify-content-between align-items-start mb-3">
                        <div>
                          <h6 className="mb-1">{result.fileName}</h6>
                          <Badge bg="info">Confidence: {(result.confidence * 100).toFixed(0)}%</Badge>
                        </div>
                        <Button 
                          variant="success" 
                          size="sm"
                          onClick={() => createTransactionFromOCR(result)}
                          className="create-transaction-btn"
                        >
                          <i className="bi bi-check-circle me-1"></i>
                          Create Transaction
                        </Button>
                      </div>
                      
                      <Row>
                        <Col md={6}>
                          <h6>Extracted Text:</h6>
                          <div className="extracted-text-box">
                            <pre className="mb-0">{result.extractedText}</pre>
                          </div>
                        </Col>
                        <Col md={6}>
                          <h6>Suggested Transaction:</h6>
                          <div className="suggested-transaction-box">
                            <div className="transaction-detail">
                              <strong>Type:</strong> {result.suggestedTransaction.type}
                            </div>
                            <div className="transaction-detail">
                              <strong>Amount:</strong> {formatCurrency(result.suggestedTransaction.amount)}
                            </div>
                            <div className="transaction-detail">
                              <strong>Category:</strong> {result.suggestedTransaction.category}
                            </div>
                            <div className="transaction-detail">
                              <strong>Description:</strong> {result.suggestedTransaction.description}
                            </div>
                            <div className="transaction-detail">
                              <strong>Date:</strong> {result.suggestedTransaction.date}
                            </div>
                          </div>
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                ))}
              </Card.Body>
            </Card>
          )}
        </Col>

        {/* Help & Tips */}
        <Col lg={4}>
          <Card className="mb-4 help-card">
            <Card.Header className="bg-white border-0">
              <h5 className="mb-0">
                <i className="bi bi-question-circle text-info me-2"></i>
                Upload Tips
              </h5>
            </Card.Header>
            <Card.Body>
              <div className="tip-item mb-3">
                <h6><i className="bi bi-camera text-primary me-2"></i>Receipt OCR</h6>
                <p className="small text-muted mb-0">
                  Upload clear photos of receipts. The system will extract transaction details automatically.
                </p>
              </div>
              <div className="tip-item mb-3">
                <h6><i className="bi bi-file-spreadsheet text-success me-2"></i>CSV Import</h6>
                <p className="small text-muted mb-0">
                  Import multiple transactions from bank statements or financial apps in CSV format.
                </p>
              </div>
              <div className="tip-item mb-3">
                <h6><i className="bi bi-shield-check text-info me-2"></i>Security</h6>
                <p className="small text-muted mb-0">
                  All uploaded files are processed securely and deleted after processing.
                </p>
              </div>
            </Card.Body>
          </Card>

          <Card className="mb-4 csv-guide-card">
            <Card.Header className="bg-white border-0">
              <h5 className="mb-0">
                <i className="bi bi-file-earmark-text text-warning me-2"></i>
                CSV Format Guide
              </h5>
            </Card.Header>
            <Card.Body>
              <p className="small text-muted mb-3">
                Your CSV file should include these columns:
              </p>
              <div className="csv-format-example">
                <code className="small">
                  date,description,amount,category<br/>
                  2024-01-15,"Grocery Store",-45.67,"Food"<br/>
                  2024-01-14,"Salary",3000.00,"Income"
                </code>
              </div>
              <div className="csv-tips mt-3">
                <p className="small text-muted">
                  • Use negative amounts for expenses<br/>
                  • Use positive amounts for income<br/>
                  • Date format: YYYY-MM-DD
                </p>
              </div>
            </Card.Body>
          </Card>

          <Card className="quick-actions-card">
            <Card.Header className="bg-white border-0">
              <h5 className="mb-0">
                <i className="bi bi-lightning text-warning me-2"></i>
                Quick Actions
              </h5>
            </Card.Header>
            <Card.Body>
              <div className="d-grid gap-2">
                <Button variant="outline-primary" size="sm" className="quick-action-btn">
                  <i className="bi bi-download me-2"></i>
                  Download CSV Template
                </Button>
                <Button variant="outline-info" size="sm" className="quick-action-btn">
                  <i className="bi bi-question-circle me-2"></i>
                  Upload Help
                </Button>
                <Button variant="outline-secondary" size="sm" className="quick-action-btn">
                  <i className="bi bi-clock-history me-2"></i>
                  View Upload History
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* CSV Preview Modal */}
      <Modal show={showPreviewModal} onHide={() => setShowPreviewModal(false)} size="lg" className="preview-modal">
        <Modal.Header closeButton className="modal-header-custom">
          <Modal.Title>
            <i className="bi bi-eye text-primary me-2"></i>
            Import Preview
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted mb-3">
            Review the transactions below before importing. You can edit individual transactions after import.
          </p>
          <div className="preview-table-container">
            <Table striped hover size="sm" className="preview-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {previewData.map((transaction, index) => (
                  <tr key={index} className="preview-row">
                    <td>{transaction.date}</td>
                    <td>
                      <Badge bg={transaction.type === 'income' ? 'success' : 'danger'}>
                        {transaction.type}
                      </Badge>
                    </td>
                    <td>{transaction.description}</td>
                    <td>{transaction.category}</td>
                    <td className={transaction.type === 'income' ? 'text-success' : 'text-danger'}>
                      {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Modal.Body>
        <Modal.Footer className="modal-footer-custom">
          <Button variant="secondary" onClick={() => setShowPreviewModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={bulkImportTransactions} disabled={loading} className="import-btn">
            {loading ? 'Importing...' : `Import ${previewData.length} Transactions`}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default UploadPage;