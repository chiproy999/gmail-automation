# Quick Start Guide - Gmail Automation App

## 🚀 Get Up and Running in 10 Minutes

### Step 1: Get Google Credentials (5 minutes)

1. Go to https://console.cloud.google.com
2. Click "Select a project" → "New Project"
3. Name it "Gmail Automation" → Create
4. Click hamburger menu → "APIs & Services" → "Library"
5. Search "Gmail API" → Click it → Enable
6. Click "Credentials" in left sidebar
7. "+ CREATE CREDENTIALS" → "OAuth client ID"
8. Click "CONFIGURE CONSENT SCREEN"
   - Select "External" → Create
   - App name: "Gmail Automation"
   - User support email: your email
   - Developer contact: your email
   - Click "Save and Continue" (skip scopes)
   - Add yourself as test user
   - Click "Save and Continue"
9. Go back to "Credentials" → "+ CREATE CREDENTIALS" → "OAuth client ID"
10. Application type: "Web application"
11. Name: "Gmail Automation Web"
12. Authorized JavaScript origins: 
    - Click "+ ADD URI"
    - Add: `http://localhost:3000`
13. Click "CREATE"
14. **COPY YOUR CLIENT ID** (looks like: 123456789-abc123.apps.googleusercontent.com)

### Step 2: Update the Code (1 minute)

1. Unzip the downloaded folder
2. Open `src/App.jsx` in any text editor
3. Find line 16: `const CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID';`
4. Replace with your Client ID from Step 1
5. Save the file

### Step 3: Deploy to Vercel (2 minutes)

**Option A: Drag & Drop (Easiest)**
1. Go to https://vercel.com
2. Sign up/login (use GitHub or email)
3. Drag the entire folder onto the Vercel dashboard
4. Wait 60 seconds for deployment
5. **COPY YOUR VERCEL URL** (looks like: gmail-automation-abc123.vercel.app)

**Option B: Command Line**
```bash
npm install -g vercel
cd gmail-automation-app
vercel
# Follow the prompts
```

### Step 4: Update Google OAuth (2 minutes)

1. Go back to Google Cloud Console
2. Click "Credentials"
3. Click your OAuth client ID
4. Under "Authorized JavaScript origins":
   - Click "+ ADD URI"
   - Paste your Vercel URL: `https://your-app.vercel.app`
5. Under "Authorized redirect URIs":
   - Click "+ ADD URI"  
   - Paste: `https://your-app.vercel.app`
6. Click "SAVE"

### Step 5: Start Using! (Now!)

1. Visit your Vercel URL
2. Click "Add Account"
3. Sign in with your first Gmail account
4. Click "Allow" when Google asks for permissions
5. Done! Repeat for other accounts.

---

## 🎯 Your First Email Automation

1. Select an account from dropdown
2. Click any email in the list
3. See AI-generated draft on the left
4. Edit it on the right if needed
5. Click "Save Draft to Gmail"
6. Open Gmail → Drafts → Send when ready!

---

## ⚡ Pro Tips

- **Learning Phase**: For first 100 emails, edit the AI drafts heavily so it learns your style
- **Check Similarity**: When it shows >95% similarity, you know it's learned
- **Mobile Access**: Save the Vercel URL to your phone's home screen
- **Multiple Devices**: Works everywhere - just open the URL

---

## 🆘 Common Issues

**"Access blocked: Authorization Error"**
→ Make sure you added your Vercel URL to Google OAuth settings in Step 4

**"Failed to connect account"**
→ Check that Gmail API is enabled in Google Cloud Console

**"No emails showing"**
→ Try clicking "Add Account" again to refresh

**Changes not showing on Vercel**
→ Upload the modified folder again, or use `vercel --prod` to deploy

---

## 📞 Need Help?

The README.md file has detailed troubleshooting and feature explanations.

Good luck! 🚀
