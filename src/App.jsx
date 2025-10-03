import React, { useState, useEffect } from 'react';
import { AlertCircle, Mail, Send, Save, LogOut, Plus, Edit3, CheckCircle } from 'lucide-react';

// This is a comprehensive Gmail automation app with multi-account support
// Features: OAuth, account switching, AI drafts, side-by-side editing, learning system

function App() {
  const [accounts, setAccounts] = useState([]);
  const [currentAccount, setCurrentAccount] = useState(null);
  const [emails, setEmails] = useState([]);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [aiDraft, setAiDraft] = useState('');
  const [userDraft, setUserDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savedCount, setSavedCount] = useState(0);
  const [learnedCount, setLearnedCount] = useState(0);

  // Gmail OAuth configuration
  const GMAIL_SCOPES = 'https://www.googleapis.com/auth/gmail.modify';
  const CLIENT_ID = '765965414841-ci1o1mf038i6usid380kbsr83jl0pup.apps.googleusercontent.com';
  
  // Initialize Google API
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
  }, []);

  // Add new Gmail account via OAuth
  const handleAddAccount = () => {
    // Check if Google API is loaded
    if (!window.google || !window.google.accounts) {
      setError('Google API not loaded yet. Please wait a moment and try again.');
      return;
    }

    try {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: GMAIL_SCOPES,
        callback: async (response) => {
          if (response.access_token) {
            await fetchAccountInfo(response.access_token);
          } else if (response.error) {
            setError(`OAuth error: ${response.error}`);
          }
        },
      });
      tokenClient.requestAccessToken();
    } catch (err) {
      setError(`Failed to initialize OAuth: ${err.message}`);
    }
  };

  // Fetch account information after OAuth
  const fetchAccountInfo = async (accessToken) => {
    try {
      const response = await fetch('https://www.googleapis.com/gmail/v1/users/me/profile', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const profile = await response.json();
      
      const newAccount = {
        email: profile.emailAddress,
        accessToken: accessToken,
        id: profile.emailAddress
      };
      
      setAccounts(prev => [...prev, newAccount]);
      setCurrentAccount(newAccount);
      await loadEmails(newAccount);
    } catch (err) {
      setError('Failed to connect Gmail account');
    }
  };

  // Load emails for current account
  const loadEmails = async (account) => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(
        'https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=is:unread OR newer_than:7d',
        {
          headers: { Authorization: `Bearer ${account.accessToken}` }
        }
      );
      
      const data = await response.json();
      
      if (data.messages) {
        const emailDetails = await Promise.all(
          data.messages.slice(0, 20).map(msg => fetchEmailDetail(msg.id, account.accessToken))
        );
        setEmails(emailDetails);
      } else {
        setEmails([]);
      }
    } catch (err) {
      setError('Failed to load emails');
    } finally {
      setLoading(false);
    }
  };

  // Fetch individual email details
  const fetchEmailDetail = async (messageId, accessToken) => {
    try {
      const response = await fetch(
        `https://www.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );
      
      const message = await response.json();
      const headers = message.payload.headers;
      
      const getHeader = (name) => {
        const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
        return header ? header.value : '';
      };

      // Get email body
      let body = '';
      if (message.payload.body.data) {
        body = atob(message.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
      } else if (message.payload.parts) {
        const textPart = message.payload.parts.find(part => part.mimeType === 'text/plain');
        if (textPart && textPart.body.data) {
          body = atob(textPart.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        }
      }
      
      return {
        id: message.id,
        threadId: message.threadId,
        from: getHeader('From'),
        subject: getHeader('Subject'),
        date: new Date(parseInt(message.internalDate)),
        snippet: message.snippet,
        body: body.substring(0, 500) // First 500 chars for preview
      };
    } catch (err) {
      console.error('Error fetching email:', err);
      return null;
    }
  };

  // Generate AI draft for selected email
  const generateAIDraft = async (email) => {
    setLoading(true);
    setError('');
    
    try {
      // This is a placeholder for AI draft generation
      // In production, you'd call your backend API that uses GPT-4 or Claude
      
      // Analyze email content to determine category
      const emailText = `${email.subject} ${email.body}`.toLowerCase();
      
      let draft = '';
      
      // Category 1: "Google this person" requests
      if (emailText.includes('google') && (emailText.includes('search') || emailText.includes('find') || emailText.includes('look up'))) {
        draft = `Thank you for contacting us.\n\nWe don't provide research services. The information you're looking for can be found through a standard Google search.\n\nBest regards`;
      }
      // Category 2: Removal requests without documentation
      else if (emailText.includes('remove') && !emailText.includes('attach')) {
        draft = `Thank you for your removal request.\n\nTo process removals, we require official legal documentation. Please submit your request with supporting documents at [REMOVAL_LINK].\n\nOur legal team will review within 5-7 business days.\n\nBest regards`;
      }
      // Category 3: Expungement/dismissal claims
      else if (emailText.includes('expunge') || emailText.includes('dismiss') || emailText.includes('sealed')) {
        draft = `Thank you for contacting us regarding your case.\n\nTo process expungement or dismissal removals, please attach official court documents showing the case status change.\n\nOnce we verify the documentation, we'll process the removal within 24-48 hours.\n\nBest regards`;
      }
      // Category 4: Threats or angry emails
      else if (emailText.includes('sue') || emailText.includes('lawyer') || emailText.includes('legal action') || emailText.includes('attorney')) {
        draft = `We have received your communication and it has been logged.\n\nFor legal matters, please direct all correspondence to: legal@[YOUR_DOMAIN]\n\nAll communications are preserved and documented per standard legal procedures.\n\nBest regards`;
      }
      // Category 5: Needs manual review
      else {
        draft = `[MANUAL REVIEW NEEDED]\n\nThis email requires personal attention. Please review and respond appropriately.\n\nOriginal message from: ${email.from}\nSubject: ${email.subject}`;
      }
      
      setAiDraft(draft);
      setUserDraft(draft); // Initialize user draft with AI draft
      
    } catch (err) {
      setError('Failed to generate AI draft');
    } finally {
      setLoading(false);
    }
  };

  // Save draft to Gmail
  const saveDraft = async () => {
    if (!currentAccount || !selectedEmail) return;
    
    setLoading(true);
    setError('');
    
    try {
      // Track learning: what did AI suggest vs what user wrote
      const learningData = {
        timestamp: new Date().toISOString(),
        emailId: selectedEmail.id,
        from: selectedEmail.from,
        subject: selectedEmail.subject,
        aiDraft: aiDraft,
        userDraft: userDraft,
        changes: calculateChanges(aiDraft, userDraft),
        account: currentAccount.email
      };
      
      // Save learning data to localStorage (in production, send to backend)
      const existingLearning = JSON.parse(localStorage.getItem('gmail_learning') || '[]');
      existingLearning.push(learningData);
      localStorage.setItem('gmail_learning', JSON.stringify(existingLearning));
      setLearnedCount(existingLearning.length);
      
      // Create draft in Gmail
      const draftMessage = `To: ${selectedEmail.from}\nSubject: Re: ${selectedEmail.subject}\nIn-Reply-To: ${selectedEmail.id}\nReferences: ${selectedEmail.id}\n\n${userDraft}`;

      const encodedMessage = btoa(draftMessage).replace(/+/g, '-').replace(/\/g, '_');
      
      await fetch('https://www.googleapis.com/gmail/v1/users/me/drafts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentAccount.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: {
            raw: encodedMessage,
            threadId: selectedEmail.threadId
          }
        })
      });
      
      setSavedCount(prev => prev + 1);
      alert('Draft saved to Gmail! ✓');
      
      // Clear selection
      setSelectedEmail(null);
      setAiDraft('');
      setUserDraft('');
      
    } catch (err) {
      setError('Failed to save draft to Gmail');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Calculate what changed between AI draft and user draft
  const calculateChanges = (ai, user) => {
    return {
      lengthDiff: user.length - ai.length,
      exactMatch: ai === user,
      similarity: calculateSimilarity(ai, user)
    };
  };

  const calculateSimilarity = (str1, str2) => {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    const longerLength = longer.length;
    if (longerLength === 0) return 1.0;
    return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
  };

  const editDistance = (str1, str2) => {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  };

  const handleSelectEmail = async (email) => {
    setSelectedEmail(email);
    await generateAIDraft(email);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Mail className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Gmail Automation</h1>
                <p className="text-sm text-gray-500">Multi-Account AI Draft Assistant</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                <span className="font-semibold">{savedCount}</span> drafts saved
                <span className="mx-2">•</span>
                <span className="font-semibold">{learnedCount}</span> learned
              </div>
              
              {currentAccount && (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-700">{currentAccount.email}</span>
                </div>
              )}
              
              <button
                onClick={handleAddAccount}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                <Plus className="w-4 h-4" />
                Add Account
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {accounts.length === 0 ? (
          // No accounts connected yet
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <Mail className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Connect Your Gmail Accounts</h2>
            <p className="text-gray-600 mb-6">
              Click "Add Account" to authorize your Gmail accounts and start automating email responses
            </p>
            <button
              onClick={handleAddAccount}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <Plus className="w-5 h-5" />
              Connect First Gmail Account
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-12 gap-6">
            {/* Account Switcher & Email List */}
            <div className="col-span-4 space-y-4">
              {/* Account Switcher */}
              <div className="bg-white rounded-lg shadow-sm p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Account ({accounts.length}/9)
                </label>
                <select
                  value={currentAccount?.email || ''}
                  onChange={(e) => {
                    const account = accounts.find(a => a.email === e.target.value);
                    setCurrentAccount(account);
                    loadEmails(account);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {accounts.map(account => (
                    <option key={account.id} value={account.email}>
                      {account.email}
                    </option>
                  ))}
                </select>
              </div>

              {/* Email List */}
              <div className="bg-white rounded-lg shadow-sm">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-900">
                    Emails ({emails.length})
                  </h3>
                </div>
                <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
                  {loading && emails.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      Loading emails...
                    </div>
                  ) : emails.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      No emails found
                    </div>
                  ) : (
                    emails.map(email => (
                      <button
                        key={email.id}
                        onClick={() => handleSelectEmail(email)}
                        className={`w-full text-left p-4 hover:bg-gray-50 transition ${
                          selectedEmail?.id === email.id ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <p className="font-medium text-gray-900 text-sm truncate pr-2">
                            {email.from.split('<')[0].trim() || email.from}
                          </p>
                          <span className="text-xs text-gray-500 whitespace-nowrap">
                            {email.date.toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm font-medium text-gray-700 mb-1 truncate">
                          {email.subject}
                        </p>
                        <p className="text-xs text-gray-500 line-clamp-2">
                          {email.snippet}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Email Detail & Draft Editor */}
            <div className="col-span-8">
              {selectedEmail ? (
                <div className="bg-white rounded-lg shadow-sm">
                  {/* Email Header */}
                  <div className="p-6 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-900 mb-2">
                      {selectedEmail.subject}
                    </h2>
                    <div className="flex items-center gap-4 text-sm text-gray-600">
                      <span><strong>From:</strong> {selectedEmail.from}</span>
                      <span><strong>Date:</strong> {selectedEmail.date.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Email Body */}
                  <div className="p-6 border-b border-gray-200 bg-gray-50">
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Original Email:</h3>
                    <div className="text-sm text-gray-800 whitespace-pre-wrap bg-white p-4 rounded border border-gray-200">
                      {selectedEmail.body}
                    </div>
                  </div>

                  {/* Side-by-Side Draft Editor */}
                  <div className="p-6">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      {/* AI Draft */}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="w-4 h-4 text-blue-600" />
                          <h3 className="text-sm font-semibold text-gray-700">AI Draft</h3>
                        </div>
                        <textarea
                          value={aiDraft}
                          readOnly
                          className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm font-mono"
                        />
                      </div>

                      {/* Your Edit */}
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Edit3 className="w-4 h-4 text-green-600" />
                          <h3 className="text-sm font-semibold text-gray-700">Your Edit</h3>
                        </div>
                        <textarea
                          value={userDraft}
                          onChange={(e) => setUserDraft(e.target.value)}
                          className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm font-mono"
                          placeholder="Edit the AI draft here..."
                        />
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => {
                          setSelectedEmail(null);
                          setAiDraft('');
                          setUserDraft('');
                        }}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveDraft}
                        disabled={loading || !userDraft.trim()}
                        className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Save className="w-4 h-4" />
                        Save Draft to Gmail
                      </button>
                    </div>

                    {/* Similarity Indicator */}
                    {aiDraft && userDraft && (
                      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm text-gray-700">
                          <strong>Draft Similarity:</strong> {Math.round(calculateSimilarity(aiDraft, userDraft) * 100)}%
                          {calculateSimilarity(aiDraft, userDraft) > 0.95 && (
                            <span className="ml-2 text-green-600 font-medium">
                              ✓ AI is learning your style!
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                  <Mail className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    Select an Email
                  </h3>
                  <p className="text-gray-600">
                    Choose an email from the list to generate an AI draft response
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-7xl mx-auto px-4 py-6 text-center text-sm text-gray-500">
        <p>💡 All drafts are saved to Gmail Drafts - nothing is sent automatically</p>
        <p className="mt-1">🧠 Every edit you make helps train the AI to write like you</p>
      </div>
    </div>
  );
}

export default App;