import React, { useState, useCallback } from 'react';
import { 
  Container, Row, Col, Card, Button, Form, Alert, 
  Modal, Table, Badge, ProgressBar, Tab, Tabs 
} from 'react-bootstrap';
import { useDropzone } from 'react-dropzone';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';
import { toast } from 'react-toastify';

const UploadPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('receipt');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [extractedData, setExtractedData] = useState(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [transactionPreview, setTransactionPreview] = useState(null);
  const [bulkTransactions, setBulkTransactions] = useState([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedTransactions, setSelectedTransactions] = useState([]);

  // Receipt Upload
  const onReceiptDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload an image (JPEG, PNG, GIF) or PDF file');
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    await uploadReceipt(file);
  }, []);

  const uploadReceipt = async (file) => {
    setUploading(true);
    setUploadProgress(0);
    setExtractedData(null);

    try {
      const formData = new FormData();
      formData.append('receipt', file);

      const response = await axios.post('/upload/receipt', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        },
      });

      setExtractedData(response.data);
      setTransactionPreview(response.data.suggestedTransaction);
      toast.success('Receipt processed successfully!');
    } catch (error) {
      console.error('Receipt upload error:', error);
      toast.error(error.response?.data?.message || 'Failed to process receipt');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // PDF Upload
  const onPdfDrop = useCallback(async (acceptedFiles) => {
    const file = acceptedFiles[0];
    if (!file) return;

    // Validate file type
    if (file.type !== 'application/pdf') {
      toast.error('Please upload a PDF file');
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    await uploadPdf(file);
  }, []);

  const uploadPdf = async (file) => {
    setUploading(true);
    setUploadProgress(0);
    setBulkTransactions([]);

    try {
      const formData = new FormData();
      formData.append('transactionsPdf', file);

      const response = await axios.post('/upload/transactions-pdf', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        },
      });

      setBulkTransactions(response.data.transactions);
      setSelectedTransactions(response.data.transactions.map((_, index) => index));
      
      if (response.data.transactions.length > 0) {
        setShowBulkModal(true);
        toast.success(`Found ${response.data.transactions.length} potential transactions`);
      } else {
        toast.info('No transactions found in the PDF');
      }
    } catch (error) {
      console.error('PDF upload error:', error);
      toast.error(error.response?.data?.message || 'Failed to process PDF');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const { getRootProps: getReceiptRootProps, getInputProps: getReceiptInputProps, isDragActive: isReceiptDragActive } = useDropzone({
    onDrop: onReceiptDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif'],
      'application/pdf': ['.pdf']
    },
    multiple: false
  });

  const { getRootProps: getPdfRootProps, getInputProps: getPdfInputProps, isDragActive: isPdfDragActive } = useDropzone({
    onDrop: onPdfDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: false
  });

  const handleCreateTransaction = async () => {
    if (!transactionPreview) return;

    try {
      await axios.post('/transactions', transactionPreview);
      toast.success('Transaction created successfully!');
      setExtractedData(null);
      setTransactionPreview(null);
      setShowPreviewModal(false);
    } catch (error) {
      console.error('Create transaction error:', error);
      toast.error('Failed to create transaction');
    }
  };

  const handleBulkImport = async () => {
    const transactionsToImport = bulkTransactions.filter((_, index) => 
      selectedTransactions.includes(index)
    );

    if (transactionsToImport.length === 0) {
      toast.error('Please select at least one transaction to import');
      return;
    }

    try {
      const response = await axios.post('/upload/bulk-import', {
        transactions: transactionsToImport
      });

      toast.success(`Successfully imported ${response.data.imported} transactions`);
      
      if (response.data.errors > 0) {
        toast.warning(`${response.data.errors} transactions had errors`);
      }

      setShowBulkModal(false);
      setBulkTransactions([]);
      setSelectedTransactions([]);
    } catch (error) {
      console.error('Bulk import error:', error);
      toast.error('Failed to import transactions');
    }
  };

  const toggleTransactionSelection = (index) => {
    setSelectedTransactions(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const selectAllTransactions = () => {
    setSelectedTransactions(bulkTransactions.map((_, index) => index));
  };

  const deselectAllTransactions = () => {
    setSelectedTransactions([]);
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

  return (
    <Container className="py-4">
      {/* Header */}
      <Row className="mb-4">
        <Col>
          <div className="text-center">
            <h2 className="mb-2">Upload & Import</h2>
            <p className="text-muted">
              Extract transactions from receipts or import from bank statements
            </p>
          </div>
        </Col>
      </Row>

      {/* Upload Tabs */}
      <Row className="justify-content-center">
        <Col lg={10}>
          <Tabs
            activeKey={activeTab}
            onSelect={(k) => setActiveTab(k)}
            className="mb-4"
            fill
          >
            {/* Receipt OCR Tab */}
            <Tab eventKey="receipt" title={
              <span>
                <i className="bi bi-camera me-2"></i>
                Receipt Scanner
              </span>
            }>
              <Card className="border-0 shadow-sm">
                <Card.Body className="p-4">
                  <div className="text-center mb-4">
                    <h4>📷 Receipt Scanner</h4>
                    <p className="text-muted">
                      Upload receipt images or PDFs to automatically extract transaction data using OCR
                    </p>
                  </div>

                  {/* Upload Zone */}
                  <div
                    {...getReceiptRootProps()}
                    className={`upload-zone ${isReceiptDragActive ? 'active' : ''} mb-4`}
                  >
                    <input {...getReceiptInputProps()} />
                    <div className="text-center">
                      <i className="bi bi-cloud-upload display-1 text-muted mb-3"></i>
                      <h5>
                        {isReceiptDragActive 
                          ? 'Drop your receipt here...' 
                          : 'Drag & drop receipt or click to browse'
                        }
                      </h5>
                      <p className="text-muted mb-3">
                        Supports JPEG, PNG, GIF, and PDF files (max 10MB)
                      </p>
                      <Button variant="outline-primary">
                        <i className="bi bi-folder2-open me-2"></i>
                        Choose File
                      </Button>
                    </div>
                  </div>

                  {/* Upload Progress */}
                  {uploading && (
                    <div className="mb-4">
                      <div className="d-flex justify-content-between mb-2">
                        <span>Processing receipt...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <ProgressBar now={uploadProgress} variant="primary" />
                    </div>
                  )}

                  {/* Extracted Data Preview */}
                  {extractedData && (
                    <Alert variant="success" className="mb-4">
                      <Alert.Heading>✅ Receipt Processed Successfully!</Alert.Heading>
                      <Row>
                        <Col md={6}>
                          <strong>Merchant:</strong> {extractedData.data.merchantName || 'Unknown'}<br />
                          <strong>Date:</strong> {formatDate(extractedData.data.date)}<br />
                          <strong>Total:</strong> {formatCurrency(extractedData.data.total)}
                        </Col>
                        <Col md={6}>
                          <strong>Items Found:</strong> {extractedData.data.items?.length || 0}<br />
                          {extractedData.data.items?.length > 0 && (
                            <Button 
                              variant="link" 
                              size="sm" 
                              onClick={() => setShowPreviewModal(true)}
                            >
                              View Details
                            </Button>
                          )}
                        </Col>
                      </Row>
                      <hr />
                      <div className="d-flex gap-2">
                        <Button 
                          variant="success" 
                          onClick={handleCreateTransaction}
                        >
                          <i className="bi bi-check-circle me-2"></i>
                          Create Transaction
                        </Button>
                        <Button 
                          variant="outline-secondary" 
                          onClick={() => setExtractedData(null)}
                        >
                          Discard
                        </Button>
                      </div>
                    </Alert>
                  )}

                  {/* Instructions */}
                  <div className="row text-center">
                    <div className="col-md-4">
                      <i className="bi bi-1-circle-fill text-primary display-6 mb-2"></i>
                      <h6>Upload Receipt</h6>
                      <small className="text-muted">
                        Take a photo or scan your receipt
                      </small>
                    </div>
                    <div className="col-md-4">
                      <i className="bi bi-2-circle-fill text-primary display-6 mb-2"></i>
                      <h6>AI Processing</h6>
                      <small className="text-muted">
                        Our OCR extracts transaction details
                      </small>
                    </div>
                    <div className="col-md-4">
                      <i className="bi bi-3-circle-fill text-primary display-6 mb-2"></i>
                      <h6>Review & Save</h6>
                      <small className="text-muted">
                        Confirm details and add to your records
                      </small>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            </Tab>

            {/* PDF Import Tab */}
            <Tab eventKey="pdf" title={
              <span>
                <i className="bi bi-file-earmark-pdf me-2"></i>
                PDF Import
              </span>
            }>
              <Card className="border-0 shadow-sm">
                <Card.Body className="p-4">
                  <div className="text-center mb-4">
                    <h4>📊 Bank Statement Import</h4>
                    <p className="text-muted">
                      Upload PDF bank statements to automatically import multiple transactions
                    </p>
                  </div>

                  {/* Upload Zone */}
                  <div
                    {...getPdfRootProps()}
                    className={`upload-zone ${isPdfDragActive ? 'active' : ''} mb-4`}
                  >
                    <input {...getPdfInputProps()} />
                    <div className="text-center">
                      <i className="bi bi-file-earmark-pdf display-1 text-danger mb-3"></i>
                      <h5>
                        {isPdfDragActive 
                          ? 'Drop your PDF here...' 
                          : 'Drag & drop PDF or click to browse'
                        }
                      </h5>
                      <p className="text-muted mb-3">
                        Bank statements, credit card statements (max 10MB)
                      </p>
                      <Button variant="outline-danger">
                        <i className="bi bi-folder2-open me-2"></i>
                        Choose PDF File
                      </Button>
                    </div>
                  </div>

                  {/* Upload Progress */}
                  {uploading && (
                    <div className="mb-4">
                      <div className="d-flex justify-content-between mb-2">
                        <span>Processing PDF...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <ProgressBar now={uploadProgress} variant="danger" />
                    </div>
                  )}

                  {/* Instructions */}
                  <div className="row text-center">
                    <div className="col-md-3">
                      <i className="bi bi-1-circle-fill text-danger display-6 mb-2"></i>
                      <h6>Upload PDF</h6>
                      <small className="text-muted">
                        Bank or credit card statement
                      </small>
                    </div>
                    <div className="col-md-3">
                      <i className="bi bi-2-circle-fill text-danger display-6 mb-2"></i>
                      <h6>Parse Data</h6>
                      <small className="text-muted">
                        Extract transaction records
                      </small>
                    </div>
                    <div className="col-md-3">
                      <i className="bi bi-3-circle-fill text-danger display-6 mb-2"></i>
                      <h6>Review Items</h6>
                      <small className="text-muted">
                        Select transactions to import
                      </small>
                    </div>
                    <div className="col-md-3">
                      <i className="bi bi-4-circle-fill text-danger display-6 mb-2"></i>
                      <h6>Bulk Import</h6>
                      <small className="text-muted">
                        Add selected items to records
                      </small>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            </Tab>
          </Tabs>
        </Col>
      </Row>

      {/* Receipt Details Modal */}
      <Modal show={showPreviewModal} onHide={() => setShowPreviewModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Receipt Details</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {extractedData && (
            <div>
              <Row className="mb-3">
                <Col md={6}>
                  <strong>Merchant:</strong> {extractedData.data.merchantName || 'Unknown'}
                </Col>
                <Col md={6}>
                  <strong>Date:</strong> {formatDate(extractedData.data.date)}
                </Col>
              </Row>
              <Row className="mb-3">
                <Col md={6}>
                  <strong>Total Amount:</strong> {formatCurrency(extractedData.data.total)}
                </Col>
                <Col md={6}>
                  <strong>Items Found:</strong> {extractedData.data.items?.length || 0}
                </Col>
              </Row>
              
              {extractedData.data.items && extractedData.data.items.length > 0 && (
                <div>
                  <h6>Detected Items:</h6>
                  <Table striped size="sm">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th className="text-end">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {extractedData.data.items.map((item, index) => (
                        <tr key={index}>
                          <td>{item.name}</td>
                          <td className="text-end">{formatCurrency(item.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}

              {extractedData.data.rawText && (
                <div className="mt-3">
                  <h6>Raw OCR Text:</h6>
                  <pre className="bg-light p-3 rounded" style={{ fontSize: '0.8rem', maxHeight: '200px', overflow: 'auto' }}>
                    {extractedData.data.rawText}
                  </pre>
                </div>
              )}
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowPreviewModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Bulk Import Modal */}
      <Modal show={showBulkModal} onHide={() => setShowBulkModal(false)} size="xl">
        <Modal.Header closeButton>
          <Modal.Title>Import Transactions</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <strong>{bulkTransactions.length}</strong> transactions found
            </div>
            <div>
              <Button variant="outline-primary" size="sm" onClick={selectAllTransactions} className="me-2">
                Select All
              </Button>
              <Button variant="outline-secondary" size="sm" onClick={deselectAllTransactions}>
                Deselect All
              </Button>
            </div>
          </div>

          <div style={{ maxHeight: '400px', overflow: 'auto' }}>
            <Table hover>
              <thead className="sticky-top bg-white">
                <tr>
                  <th width="50">
                    <Form.Check
                      type="checkbox"
                      checked={selectedTransactions.length === bulkTransactions.length}
                      onChange={(e) => e.target.checked ? selectAllTransactions() : deselectAllTransactions()}
                    />
                  </th>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Type</th>
                  <th className="text-end">Amount</th>
                </tr>
              </thead>
              <tbody>
                {bulkTransactions.map((transaction, index) => (
                  <tr key={index} className={selectedTransactions.includes(index) ? 'table-active' : ''}>
                    <td>
                      <Form.Check
                        type="checkbox"
                        checked={selectedTransactions.includes(index)}
                        onChange={() => toggleTransactionSelection(index)}
                      />
                    </td>
                    <td>{formatDate(transaction.date)}</td>
                    <td>{transaction.description}</td>
                    <td>
                      <Badge bg={transaction.type === 'income' ? 'success' : 'danger'}>
                        {transaction.type}
                      </Badge>
                    </td>
                    <td className={`text-end text-${transaction.type === 'income' ? 'success' : 'danger'}`}>
                      {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <div className="me-auto">
            <strong>{selectedTransactions.length}</strong> of {bulkTransactions.length} selected
          </div>
          <Button variant="secondary" onClick={() => setShowBulkModal(false)}>
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handleBulkImport}
            disabled={selectedTransactions.length === 0}
          >
            Import Selected ({selectedTransactions.length})
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default UploadPage;