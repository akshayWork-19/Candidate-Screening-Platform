import React, { useState, useEffect } from 'react';
import './App.css';

const API_BASE = 'http://localhost:4000/api';

function App() {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [jobTitle, setJobTitle] = useState('');
  const [jobText, setJobText] = useState('');
  const [uploadMessage, setUploadMessage] = useState('');

  const fetchCandidates = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/candidates`);
      const data = await res.json();
      setCandidates(data);
    } catch (err) {
      console.error('Failed to fetch candidates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  const handleJobSubmit = async (e) => {
    e.preventDefault();
    setUploadMessage('Updating Job Description...');
    try {
      const res = await fetch(`${API_BASE}/upload/job-description`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: jobTitle, text: jobText })
      });
      if (res.ok) {
        setUploadMessage('Job description updated successfully.');
        setJobTitle('');
        setJobText('');
      } else {
        setUploadMessage('Failed to update job description.');
      }
    } catch (err) {
      setUploadMessage('Error updating job description.');
    }
    setTimeout(() => setUploadMessage(''), 3000);
  };

  const handleFileUpload = async (e, endpoint) => {
    e.preventDefault();
    const file = e.target.file.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    
    setUploadMessage(`Uploading to ${endpoint}...`);
    try {
      const res = await fetch(`${API_BASE}/upload/${endpoint}`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setUploadMessage(data.message || 'Upload successful.');
        fetchCandidates(); // Refresh list
      } else {
        setUploadMessage(`Error: ${data.error}`);
      }
    } catch (err) {
      setUploadMessage('Upload failed.');
    }
    e.target.reset();
    setTimeout(() => setUploadMessage(''), 4000);
  };

  const getStatusClass = (status) => {
    if (!status) return '';
    if (status.includes('UPLOADED')) return 'status-uploaded';
    if (status.includes('RECEIVED')) return 'status-received';
    return 'status-processed';
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>Candidate ATS Dashboard</h1>
        <button className="btn" onClick={fetchCandidates} style={{ width: 'auto' }}>
          Refresh
        </button>
      </header>

      {uploadMessage && (
        <div className="card" style={{ padding: '1rem', marginBottom: '1rem', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
          <div className="message" style={{ margin: 0, textAlign: 'center' }}>{uploadMessage}</div>
        </div>
      )}

      <div className="grid-layout">
        <div className="sidebar">
          <div className="card">
            <h2>1. Job Description</h2>
            <form onSubmit={handleJobSubmit}>
              <div className="form-group">
                <label>Job Title</label>
                <input 
                  type="text" 
                  value={jobTitle} 
                  onChange={(e) => setJobTitle(e.target.value)} 
                  placeholder="e.g. Senior Frontend Engineer"
                  required 
                />
              </div>
              <div className="form-group">
                <label>Job Requirements</label>
                <textarea 
                  value={jobText} 
                  onChange={(e) => setJobText(e.target.value)} 
                  placeholder="Paste the detailed job description here..."
                  required 
                />
              </div>
              <button type="submit" className="btn">Save JD</button>
            </form>
          </div>

          <div className="card">
            <h2>2. Upload Candidates (CSV)</h2>
            <form onSubmit={(e) => handleFileUpload(e, 'candidates')}>
              <div className="form-group">
                <input type="file" name="file" accept=".csv" required />
              </div>
              <button type="submit" className="btn">Upload</button>
            </form>
          </div>

          <div className="card">
            <h2>3. Upload Test Results (CSV)</h2>
            <form onSubmit={(e) => handleFileUpload(e, 'test-results')}>
              <div className="form-group">
                <input type="file" name="file" accept=".csv" required />
              </div>
              <button type="submit" className="btn">Upload</button>
            </form>
          </div>
        </div>

        <div className="main-content">
          <div className="card">
            <h2>Candidates</h2>
            {loading ? (
              <div className="empty-state">Loading candidates...</div>
            ) : candidates.length === 0 ? (
              <div className="empty-state">No candidates found. Upload a CSV to get started.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Final Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map(c => (
                      <tr key={c._id}>
                        <td>{c.name}</td>
                        <td>{c.email}</td>
                        <td>
                          <span className={`status-badge ${getStatusClass(c.status)}`}>
                            {c.status || 'UNKNOWN'}
                          </span>
                        </td>
                        <td>
                          {c.finalScore !== undefined && c.finalScore !== null ? (
                            <strong>{c.finalScore.toFixed(2)}</strong>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>Pending</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
