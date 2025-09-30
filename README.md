# Gmail Automation App

Multi-account Gmail automation with AI-powered draft responses. Manage up to 9 Gmail accounts with intelligent email categorization and learning system.

## Features

✅ **Multi-Account Support** - Connect and manage 9 different Gmail accounts  
✅ **OAuth 2.0 Authentication** - Secure Gmail authorization  
✅ **AI Draft Generation** - Automatic response drafts based on email content  
✅ **Side-by-Side Editor** - See AI suggestions and edit before saving  
✅ **Learning System** - Tracks your edits to improve AI over time  
✅ **Gmail Drafts Only** - Nothing sent automatically (safe mode)  
✅ **Mobile Responsive** - Works on phone and desktop  

## Setup Instructions

### 1. Get Google OAuth Credentials

Before deploying, you need to set up Google OAuth:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable **Gmail API**:
   - Go to "APIs & Services" → "Library"
   - Search for "Gmail API"
   - Click "Enable"

4. Create OAuth 2.0 Credentials:
   - Go to "APIs & Services" → "Credentials"
   - Click "+ CREATE CREDENTIALS" → "OAuth client ID"
   - Select "Web application"
   - Add Authorized JavaScript origins:
     ```
     http://localhost:3000
     https://your-app-name.vercel.app
     ```
   - Add Authorized redirect URIs:
     ```
     http://localhost:3000
     https://your-app-name.vercel.app
     ```
   - Click "Create"
   - Copy your **Client ID** (you'll need this)

5. Configure OAuth Consent Screen:
   - Go to "OAuth consent screen"
   - Select "External" user type
   - Fill in app name, user support email
   - Add scopes: `https://www.googleapis.com/auth/gmail.modify`
   - Save

### 2. Update the App

Open `src/App.jsx` and replace this line:

```javascript
const CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID';
```

With your actual Client ID:

```javascript
const CLIENT_ID = '123456789-abc123.apps.googleusercontent.com';
```

### 3. Test Locally (Optional)

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open http://localhost:3000 in your browser.

### 4. Deploy to Vercel

**Option A: Using Vercel CLI (Recommended)**

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Follow prompts:
# - Link to existing project? No
# - Project name: gmail-automation
# - Directory: ./
# - Override settings? No

# Get your live URL!
```

**Option B: Using Vercel Dashboard**

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New..." → "Project"
3. Import from Git (or upload this folder)
4. Click "Deploy"

### 5. Update Google OAuth Redirect

After deploying, go back to Google Cloud Console:

1. Go to your OAuth credentials
2. Add your Vercel URL to Authorized JavaScript origins:
   ```
   https://your-actual-app.vercel.app
   ```
3. Save

## How to Use

### First Time Setup

1. Click **"Add Account"**
2. Google will ask for permission - click "Allow"
3. Repeat for all 9 Gmail accounts

### Daily Workflow

1. **Select Account** - Choose which Gmail account to view
2. **Browse Emails** - Click any email to view details
3. **Review AI Draft** - AI generates a response based on email content
4. **Edit Draft** - Modify the response on the right side
5. **Save to Gmail** - Saves as draft in Gmail (won't send)
6. **Review in Gmail** - Open Gmail app to review and send

### Email Categories

The AI automatically categorizes emails:

| Category | Trigger Words | Response |
|----------|---------------|----------|
| Google Requests | "google", "search for" | Decline research services |
| Removal (No Docs) | "remove" without attachments | Request legal documentation |
| Expungement | "expunged", "dismissed", "sealed" | Request court documents |
| Legal Threats | "sue", "lawyer", "attorney" | Log and refer to legal |
| Manual Review | Everything else | Flag for personal attention |

### Learning System

The app tracks every edit you make:

- Saves AI draft vs your final version
- Calculates similarity percentage
- Shows when AI is learning your style (>95% match)
- Data stored locally (or can be sent to backend)

## Tech Stack

- **React** - Frontend framework
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Gmail API** - Email access
- **OAuth 2.0** - Authentication
- **Vercel** - Hosting

## File Structure

```
gmail-automation-app/
├── src/
│   ├── App.jsx          # Main application component
│   ├── main.jsx         # React entry point
│   └── index.css        # Global styles
├── index.html           # HTML template
├── package.json         # Dependencies
├── vite.config.js       # Vite configuration
├── tailwind.config.js   # Tailwind configuration
└── README.md           # This file
```

## Future Enhancements

- [ ] Add GPT-4 or Claude API for smarter drafts
- [ ] Backend database for learning data
- [ ] Auto-send mode (when confidence is high)
- [ ] Email templates management
- [ ] Analytics dashboard
- [ ] Multi-language support

## Troubleshooting

**"Access blocked: Authorization Error"**
- Make sure you've added your domain to Google OAuth settings
- Check that Gmail API is enabled

**"Failed to load emails"**
- Refresh the page
- Try disconnecting and reconnecting account

**Emails not showing up**
- Check if you have emails in last 7 days
- Try adjusting the date filter in code

**Can't save draft**
- Make sure you edited the draft
- Check internet connection
- Re-authorize the Gmail account

## Support

Need help? Contact: your-email@example.com

## License

Private use only - Not for distribution

---

**⚠️ Important**: This app only creates drafts - it never sends emails automatically. Always review drafts in Gmail before sending!
