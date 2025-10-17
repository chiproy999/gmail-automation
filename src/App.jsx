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
  const [learningStats, setLearningStats] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState('all'); // all, important, hold, archive

  // API and OAuth configuration
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const GMAIL_SCOPES = 'https://www.googleapis.com/auth/gmail.modify';
  const CLIENT_ID = '875679301619-le0h6efnis34rkukl0n3gnfros6gcme7.apps.googleusercontent.com';
  
  // Initialize Google API
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      console.log('✓ Google Identity Services loaded successfully');
      console.log('Current URL:', window.location.href);
    };
    script.onerror = () => {
      setError('Failed to load Google Identity Services library');
    };
    document.body.appendChild(script);

    // Restore saved accounts from localStorage
    const savedAccounts = localStorage.getItem('gmail_accounts');
    if (savedAccounts) {
      try {
        const parsedAccounts = JSON.parse(savedAccounts);
        setAccounts(parsedAccounts);
        if (parsedAccounts.length > 0) {
          setCurrentAccount(parsedAccounts[0]);
        }
      } catch (err) {
        console.error('Failed to restore accounts:', err);
      }
    }
  }, []);

  // Load learning stats when account changes
  useEffect(() => {
    const loadStats = async () => {
      if (!currentAccount) return;

      try {
        const response = await fetch(`${API_URL}/api/learning-stats/${currentAccount.email}`);
        if (response.ok) {
          const stats = await response.json();
          setLearningStats(stats);
          setLearnedCount(stats.total_edits);
        }
      } catch (err) {
        console.error('Failed to load stats:', err);
      }
    };

    loadStats();
  }, [currentAccount]);

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
          console.log('OAuth Response:', response);

          if (response.access_token) {
            await fetchAccountInfo(response.access_token);
          } else if (response.error) {
            // Show detailed error
            let errorMsg = `OAuth error: ${response.error}`;

            if (response.error === 'access_denied') {
              errorMsg = 'Access denied. You need to click "Allow" to grant permissions.';
            } else if (response.error === 'invalid_client') {
              errorMsg = 'Invalid OAuth client. Check your Google Cloud Console settings.';
            } else if (response.error_description) {
              errorMsg += ` - ${response.error_description}`;
            }

            setError(errorMsg);
            console.error('OAuth Error Details:', response);
          }
        },
      });

      // Request the token (with prompt to select account)
      tokenClient.requestAccessToken({ prompt: 'select_account' });
    } catch (err) {
      setError(`Failed to initialize OAuth: ${err.message}`);
      console.error('OAuth Init Error:', err);
    }
  };

  // Fetch account information after OAuth
  const fetchAccountInfo = async (accessToken) => {
    try {
      const response = await fetch('https://www.googleapis.com/gmail/v1/users/me/profile', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Gmail API error (${response.status}): ${errorData.error?.message || 'Unknown error'}`);
      }

      const profile = await response.json();

      const newAccount = {
        email: profile.emailAddress,
        accessToken: accessToken,
        id: profile.emailAddress,
        tokenExpiry: Date.now() + 3600000 // Token expires in 1 hour
      };

      const updatedAccounts = [...accounts, newAccount];
      setAccounts(updatedAccounts);
      setCurrentAccount(newAccount);

      // Save to localStorage for session persistence
      localStorage.setItem('gmail_accounts', JSON.stringify(updatedAccounts));

      await loadEmails(newAccount);
      setError(''); // Clear any previous errors
      alert(`✓ Successfully connected ${profile.emailAddress}`);
    } catch (err) {
      setError(`Failed to connect Gmail: ${err.message}`);
      console.error('OAuth Error:', err);
    }
  };

  // Load emails for current account
  const loadEmails = async (account) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        'https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=in:inbox (is:unread OR newer_than:7d) -from:me',
        {
          headers: { Authorization: `Bearer ${account.accessToken}` }
        }
      );

      const data = await response.json();

      if (data.messages) {
        const emailDetails = await Promise.all(
          data.messages.slice(0, 20).map(msg => fetchEmailDetail(msg.id, account.accessToken))
        );

        // Auto-categorize emails
        const categorizedEmails = await Promise.all(
          emailDetails.map(async (email) => {
            if (!email) return email;

            try {
              // Call backend to categorize
              const catResponse = await fetch(`${API_URL}/api/categorize-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  email: {
                    from: email.from,
                    subject: email.subject,
                    body: email.body || email.snippet
                  },
                  accountEmail: account.email
                })
              });

              if (catResponse.ok) {
                const catData = await catResponse.json();
                return {
                  ...email,
                  category: catData.category,
                  importance: catData.importance,
                  autoAction: catData.autoAction // 'archive', 'important', 'hold', 'respond'
                };
              }
            } catch (err) {
              console.error('Categorization error:', err);
            }

            return { ...email, category: 'unknown', importance: 'medium', autoAction: 'hold' };
          })
        );

        setEmails(categorizedEmails.filter(e => e));
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

      // Get attachments
      const attachments = [];
      const getAllParts = (parts) => {
        if (!parts) return;
        for (const part of parts) {
          if (part.filename && part.body && part.body.attachmentId) {
            attachments.push({
              filename: part.filename,
              mimeType: part.mimeType,
              attachmentId: part.body.attachmentId,
              size: part.body.size
            });
          }
          if (part.parts) {
            getAllParts(part.parts);
          }
        }
      };
      getAllParts(message.payload.parts);

      return {
        id: message.id,
        threadId: message.threadId,
        from: getHeader('From'),
        subject: getHeader('Subject'),
        date: new Date(parseInt(message.internalDate)),
        snippet: message.snippet,
        body: body.substring(0, 500), // First 500 chars for preview
        attachments: attachments
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
      // Call backend AI API with attachments
      const response = await fetch(`${API_URL}/api/generate-draft`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: {
            id: email.id,
            from: email.from,
            subject: email.subject,
            body: email.body,
            snippet: email.snippet
          },
          accountEmail: currentAccount.email,
          attachments: email.attachments || [],
          accessToken: currentAccount.accessToken
        })
      });

      if (!response.ok) {
        throw new Error('Backend API error');
      }

      const data = await response.json();

      setAiDraft(data.aiDraft);
      setUserDraft(data.aiDraft); // Initialize user draft with AI draft

      // Store category and importance
      if (selectedEmail) {
        selectedEmail.category = data.category;
        selectedEmail.importance = data.importance;
      }

    } catch (err) {
      setError('Failed to generate AI draft. Make sure backend is running on port 3001.');
      console.error('AI Draft Error:', err);
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
      // Send learning data to backend
      const learningResponse = await fetch(`${API_URL}/api/save-learning`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          accountEmail: currentAccount.email,
          emailId: selectedEmail.id,
          fromEmail: selectedEmail.from,
          subject: selectedEmail.subject,
          emailBody: selectedEmail.body,
          aiDraft: aiDraft,
          userDraft: userDraft,
          category: selectedEmail.category || 'unknown',
          importance: selectedEmail.importance || 'medium'
        })
      });

      if (learningResponse.ok) {
        const learningResult = await learningResponse.json();
        setLearnedCount(prev => prev + 1);
        console.log(learningResult.message);
      }

      // Create draft in Gmail with proper MIME format
      const draftMessage = `From: ${currentAccount.email}
To: ${selectedEmail.from}
Subject: Re: ${selectedEmail.subject}
Content-Type: text/plain; charset=UTF-8

${userDraft}`;

      const encodedMessage = btoa(unescape(encodeURIComponent(draftMessage)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const draftResponse = await fetch('https://www.googleapis.com/gmail/v1/users/me/drafts', {
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

      if (!draftResponse.ok) {
        const errorData = await draftResponse.json();
        throw new Error(`Failed to save draft: ${errorData.error?.message || 'Unknown error'}`);
      }

      const draftResult = await draftResponse.json();
      console.log('✓ Draft saved successfully:', draftResult.id);

      setSavedCount(prev => prev + 1);
      alert('Draft saved to Gmail! ✓\n\nCheck your Gmail Drafts folder.');

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

  // Send email immediately
  const sendEmail = async () => {
    if (!currentAccount || !selectedEmail) return;

    if (!confirm(`Send this email to ${selectedEmail.from}?`)) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Send learning data to backend first
      const learningResponse = await fetch(`${API_URL}/api/save-learning`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          timestamp: new Date().toISOString(),
          accountEmail: currentAccount.email,
          emailId: selectedEmail.id,
          fromEmail: selectedEmail.from,
          subject: selectedEmail.subject,
          emailBody: selectedEmail.body,
          aiDraft: aiDraft,
          userDraft: userDraft,
          category: selectedEmail.category || 'unknown',
          importance: selectedEmail.importance || 'medium'
        })
      });

      if (learningResponse.ok) {
        const learningResult = await learningResponse.json();
        setLearnedCount(prev => prev + 1);
        console.log(learningResult.message);
      }

      // Send email directly
      const emailMessage = `From: ${currentAccount.email}
To: ${selectedEmail.from}
Subject: Re: ${selectedEmail.subject}
Content-Type: text/plain; charset=UTF-8

${userDraft}`;

      const encodedMessage = btoa(unescape(encodeURIComponent(emailMessage)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const sendResponse = await fetch('https://www.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentAccount.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          raw: encodedMessage,
          threadId: selectedEmail.threadId
        })
      });

      if (!sendResponse.ok) {
        const errorData = await sendResponse.json();
        throw new Error(`Failed to send: ${errorData.error?.message || 'Unknown error'}`);
      }

      const sendResult = await sendResponse.json();
      console.log('✓ Email sent successfully:', sendResult.id);

      alert('✓ Email sent successfully!');

      // Archive the original email
      await handleArchiveEmail(selectedEmail);

      // Clear selection
      setSelectedEmail(null);
      setAiDraft('');
      setUserDraft('');

    } catch (err) {
      setError(`Failed to send email: ${err.message}`);
      console.error('Send error:', err);
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

  // Archive email (remove from inbox only, don't delete)
  const handleArchiveEmail = async (email) => {
    try {
      const response = await fetch(
        `https://www.googleapis.com/gmail/v1/users/me/messages/${email.id}/modify`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${currentAccount.accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            removeLabelIds: ['INBOX']
          })
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Gmail API error: ${errorData.error?.message || 'Unknown error'}`);
      }

      console.log('✓ Archived email:', email.subject);

      // Remove from local list
      setEmails(prev => prev.filter(e => e.id !== email.id));
    } catch (err) {
      setError(`Failed to archive email: ${err.message}`);
      console.error('Archive error:', err);
    }
  };

  // Archive all filtered emails
  const handleArchiveAll = async () => {
    const filtered = getFilteredEmails();

    if (filtered.length === 0) {
      return;
    }

    if (!confirm(`Archive all ${filtered.length} emails in this view?\n\nThis will remove them from inbox (still searchable in All Mail)`)) {
      return;
    }

    setLoading(true);
    let archived = 0;
    let failed = 0;

    for (const email of filtered) {
      try {
        const response = await fetch(
          `https://www.googleapis.com/gmail/v1/users/me/messages/${email.id}/modify`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${currentAccount.accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              removeLabelIds: ['INBOX']
            })
          }
        );

        if (response.ok) {
          archived++;
          console.log('✓ Archived:', email.subject);
        } else {
          failed++;
          const errorData = await response.json();
          console.error('Failed to archive:', email.subject, errorData);
        }
      } catch (err) {
        failed++;
        console.error('Failed to archive:', email.id, err);
      }
    }

    // Remove archived emails from local list
    setEmails(prev => prev.filter(e => !filtered.find(f => f.id === e.id)));
    setLoading(false);

    if (failed > 0) {
      alert(`✓ Archived ${archived} emails\n❌ Failed: ${failed} emails`);
    } else {
      alert(`✓ Successfully archived ${archived} emails`);
    }
  };

  // Get filtered emails based on category
  const getFilteredEmails = () => {
    if (categoryFilter === 'all') return emails;
    if (categoryFilter === 'important') return emails.filter(e => e.importance === 'high');
    if (categoryFilter === 'respond') return emails.filter(e => e.autoAction === 'respond');
    if (categoryFilter === 'archive') return emails.filter(e => e.autoAction === 'archive');
    return emails;
  };

  // Get badge color based on importance
  const getBadgeColor = (importance, autoAction) => {
    if (autoAction === 'archive') return 'bg-gray-100 text-gray-600';
    if (importance === 'high') return 'bg-red-100 text-red-700';
    if (importance === 'low') return 'bg-gray-100 text-gray-600';
    return 'bg-yellow-100 text-yellow-700';
  };

  // Get badge label
  const getBadgeLabel = (importance, autoAction, category) => {
    if (autoAction === 'archive') return '📦 Archive';
    if (importance === 'high') return '🔴 Important';
    if (category === 'removal_request') return '🗑️ Removal';
    if (category === 'newsletter') return '📰 Newsletter';
    return '⏸️ Hold';
  };

  // Import historical emails for training
  const handleImportEmails = async () => {
    if (!currentAccount) {
      setError('Please connect an account first');
      return;
    }

    if (!confirm('Import last 6 months of sent emails for training?\n\nThis will:\n- Fetch your sent emails\n- Pair them with originals\n- Train the AI on your writing style\n\nCost: ~$0.50 for GPT analysis')) {
      return;
    }

    setImporting(true);
    setImportProgress('Fetching sent emails from last 6 months...');
    setError('');

    try {
      // Calculate date 6 months ago
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const afterDate = Math.floor(sixMonthsAgo.getTime() / 1000);

      // Fetch sent emails
      const sentResponse = await fetch(
        `https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=in:sent after:${afterDate}`,
        {
          headers: { Authorization: `Bearer ${currentAccount.accessToken}` }
        }
      );

      const sentData = await sentResponse.json();

      if (!sentData.messages || sentData.messages.length === 0) {
        setError('No sent emails found in last 6 months');
        setImporting(false);
        return;
      }

      setImportProgress(`Found ${sentData.messages.length} sent emails. Fetching details...`);

      // Fetch details for sent emails and match with originals
      const emailPairs = [];
      let processed = 0;

      for (const msg of sentData.messages.slice(0, 50)) { // Limit to 50 to avoid timeout
        try {
          processed++;
          if (processed % 10 === 0) {
            setImportProgress(`Processing ${processed}/${Math.min(50, sentData.messages.length)} emails...`);
          }

          const sentEmail = await fetchEmailDetail(msg.id, currentAccount.accessToken);

          if (!sentEmail || !sentEmail.body) continue;

          // Try to find the original email this was replying to
          // Look for In-Reply-To header
          const threadResponse = await fetch(
            `https://www.googleapis.com/gmail/v1/users/me/threads/${sentEmail.threadId}?format=full`,
            {
              headers: { Authorization: `Bearer ${currentAccount.accessToken}` }
            }
          );

          const threadData = await threadResponse.json();

          if (threadData.messages && threadData.messages.length >= 2) {
            // First message is usually the original, last is the sent reply
            const originalMsg = threadData.messages[0];
            const originalHeaders = originalMsg.payload.headers;

            const getHeader = (name) => {
              const header = originalHeaders.find(h => h.name.toLowerCase() === name.toLowerCase());
              return header ? header.value : '';
            };

            let originalBody = '';
            if (originalMsg.payload.body.data) {
              originalBody = atob(originalMsg.payload.body.data.replace(/-/g, '+').replace(/_/g, '/'));
            } else if (originalMsg.payload.parts) {
              const textPart = originalMsg.payload.parts.find(part => part.mimeType === 'text/plain');
              if (textPart && textPart.body.data) {
                originalBody = atob(textPart.body.data.replace(/-/g, '+').replace(/_/g, '/'));
              }
            }

            emailPairs.push({
              originalEmail: {
                id: originalMsg.id,
                from: getHeader('From'),
                subject: getHeader('Subject'),
                body: originalBody.substring(0, 1000),
                snippet: originalMsg.snippet
              },
              yourResponse: {
                body: sentEmail.body,
                date: sentEmail.date.toISOString()
              }
            });
          }
        } catch (err) {
          console.error('Error processing email:', err);
        }
      }

      if (emailPairs.length === 0) {
        setError('Could not find any email pairs to import');
        setImporting(false);
        return;
      }

      setImportProgress(`Importing ${emailPairs.length} email pairs to database...`);

      // Send to backend for import
      const importResponse = await fetch(`${API_URL}/api/import-emails`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          emailPairs,
          accountEmail: currentAccount.email
        })
      });

      const importResult = await importResponse.json();

      if (importResult.success) {
        setImportProgress(null);
        alert(`🎉 Success!\n\n${importResult.imported} emails imported\nAI Accuracy: ${importResult.avgSimilarity}%\n\n${importResult.message}`);

        // Reload stats
        const statsResponse = await fetch(`${API_URL}/api/learning-stats/${currentAccount.email}`);
        if (statsResponse.ok) {
          const stats = await statsResponse.json();
          setLearningStats(stats);
          setLearnedCount(stats.total_edits);
        }
      } else {
        setError('Import failed: ' + importResult.error);
      }

    } catch (err) {
      setError('Failed to import emails: ' + err.message);
      console.error('Import error:', err);
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
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
              {learningStats && (
                <div className="text-sm">
                  <div className="flex items-center gap-2 px-3 py-2 bg-purple-50 rounded-lg">
                    <div>
                      <div className="font-semibold text-purple-900">
                        AI Accuracy: {learningStats.avg_similarity_percent}%
                      </div>
                      <div className="text-xs text-purple-700">
                        {learningStats.total_edits} emails trained
                        {learningStats.readyForAutoSend && ' • ✓ Ready for auto-send!'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="text-sm text-gray-600">
                <span className="font-semibold">{savedCount}</span> drafts saved
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

              {currentAccount && (
                <button
                  onClick={handleImportEmails}
                  disabled={importing}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {importing ? '⏳' : '📥'} {importing ? 'Importing...' : 'Import Training Data'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Import Progress */}
      {importProgress && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 flex items-center gap-2">
            <div className="animate-spin">⏳</div>
            <p className="text-purple-800">{importProgress}</p>
          </div>
        </div>
      )}

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
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-gray-900">
                      Emails ({getFilteredEmails().length})
                    </h3>

                    {/* Bulk Archive Button */}
                    {getFilteredEmails().length > 0 && (
                      <button
                        onClick={handleArchiveAll}
                        disabled={loading}
                        className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        📦 Archive All ({getFilteredEmails().length})
                      </button>
                    )}
                  </div>

                  {/* Filter Tabs */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setCategoryFilter('all')}
                      className={`px-3 py-1 text-sm rounded-full ${
                        categoryFilter === 'all'
                          ? 'bg-blue-100 text-blue-700 font-medium'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setCategoryFilter('important')}
                      className={`px-3 py-1 text-sm rounded-full ${
                        categoryFilter === 'important'
                          ? 'bg-red-100 text-red-700 font-medium'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      🔴 Important
                    </button>
                    <button
                      onClick={() => setCategoryFilter('respond')}
                      className={`px-3 py-1 text-sm rounded-full ${
                        categoryFilter === 'respond'
                          ? 'bg-green-100 text-green-700 font-medium'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      ✉️ Respond
                    </button>
                    <button
                      onClick={() => setCategoryFilter('archive')}
                      className={`px-3 py-1 text-sm rounded-full ${
                        categoryFilter === 'archive'
                          ? 'bg-gray-100 text-gray-700 font-medium'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      📦 Archive
                    </button>
                  </div>
                </div>
                <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
                  {loading && emails.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      Loading emails...
                    </div>
                  ) : getFilteredEmails().length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      No emails in this category
                    </div>
                  ) : (
                    getFilteredEmails().map(email => (
                      <div
                        key={email.id}
                        className={`relative group ${
                          selectedEmail?.id === email.id ? 'bg-blue-50' : ''
                        }`}
                      >
                        <button
                          onClick={() => handleSelectEmail(email)}
                          className="w-full text-left p-4 hover:bg-gray-50 transition"
                        >
                          <div className="flex justify-between items-start mb-1">
                            <div className="flex items-center gap-2 flex-1">
                              <p className="font-medium text-gray-900 text-sm truncate">
                                {email.from.split('<')[0].trim() || email.from}
                              </p>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${getBadgeColor(email.importance, email.autoAction)}`}>
                                {getBadgeLabel(email.importance, email.autoAction, email.category)}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500 whitespace-nowrap ml-2">
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

                        {/* Quick Actions - Always visible */}
                        <div className="absolute right-2 top-2 flex gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleArchiveEmail(email);
                            }}
                            className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition"
                            title="Archive this email"
                          >
                            📦
                          </button>
                        </div>
                      </div>
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
                        className="flex items-center gap-2 px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Save className="w-4 h-4" />
                        Save Draft
                      </button>
                      <button
                        onClick={sendEmail}
                        disabled={loading || !userDraft.trim()}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send className="w-4 h-4" />
                        Send Now
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