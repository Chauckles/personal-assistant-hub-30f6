# PA Hub - Canvas Assignment Tracker

A Chrome extension that helps Phillips Academy students track Canvas assignments with a Win+G style overlay.

## ✨ Features

### 📚 Canvas Assignment Tracking
- Automatically checks Canvas every 3 hours for new assignments
- Shows upcoming assignments in a beautiful overlay panel
- Browser notifications for new assignments and deadlines
- Badge count showing assignments due in the next 7 days
- Groups assignments by urgency:
  - ⚠️ Due Today (next 24 hours)
  - 📅 This Week (next 7 days)

### 🎯 Win+G Style Overlay
- Floating icon in bottom-right corner (draggable!)
- Click to open overlay panel with all your assignments
- Keyboard shortcut: **Alt+P** to toggle
- Badge shows count of upcoming assignments
- Quick refresh button to check Canvas on demand

### 📅 Coming Soon
- Blackbaud schedule integration
- Email automation (separate Python script)

## 🚀 Installation

### Step 1: Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `chrome-extension` folder
5. You should see "PA Assistant - Canvas & Schedule Tracker" appear

### Step 2: Configure Canvas Token

1. Click the extension icon in Chrome toolbar (or right-click → Options)
2. Enter your **Canvas API token**:
   - Go to [canvas.andover.edu/profile/settings](https://canvas.andover.edu/profile/settings)
   - Scroll to "Approved Integrations"
   - Click "+ New Access Token"
   - Give it a purpose (e.g., "PA Hub Extension")
   - Copy the token
3. Paste the token into the extension setup page
4. Click **Save & Start**

The extension will immediately check Canvas and start showing your assignments.

## 📖 How to Use

### Overlay Panel

- **Click the floating icon** (bottom-right) or press **Alt+P**
- Tabs:
  - **📚 Assignments**: See what's due today and this week
  - **📅 Schedule**: Coming soon (Blackbaud integration)

### Drag the Icon

- Click and drag the purple "P" icon anywhere on the page
- Position resets when you reload the page

### Notifications

- You'll get browser notifications for:
  - New assignments posted to Canvas
  - Assignments due in the next 24 hours

### Refresh on Demand

- Click the 🔄 **Refresh** button in the overlay to check Canvas immediately
- Useful when you know a new assignment was just posted

## ⚙️ Configuration

Edit `scripts/background.js` to customize:

```javascript
const CONFIG = {
  checkIntervalMinutes: 180,        // How often to check Canvas (3 hours)
  emailCheckIntervalMinutes: 30,    // How often to check Outlook (30 min)
  newsEmailDaysBeforeDelete: 3,     // Days before deleting news emails
  newsEmailSenders: [...],          // News domains to auto-delete
  importantEmailKeywords: [...],    // Keywords for important emails
};
```

## 🔐 Privacy & Security

- Your Canvas token and Outlook access stay **local** in Chrome storage
- Extension only has access to Canvas, Blackbaud, and Microsoft Graph (Outlook) APIs
- No data is sent to external servers
- Email automation rules run locally in your browser

## 🐛 Troubleshooting

**Extension not working?**
- Check that you've entered your Canvas token in settings
- Make sure Microsoft OAuth client ID is configured in `scripts/background.js`

**No notifications?**
- Check Chrome notification permissions: `chrome://settings/content/notifications`
- Make sure the extension has notification permission

**Outlook not connecting?**
- Double-check your Microsoft client ID in `scripts/background.js` (line ~291)
- Make sure your app registration redirect URI matches your extension ID
- Make sure you added the Mail.ReadWrite and Mail.Send permissions
- Try revoking access and reconnecting: [account.microsoft.com/privacy/app-access](https://account.microsoft.com/privacy/app-access)

**Badge count wrong?**
- Click the floating icon and press "Refresh" to force a check
- Or wait for the next automatic check (every 3 hours)

## 📝 Notes

- Canvas is checked every 3 hours (configurable)
- Emails are checked every 30 minutes (configurable)
- The floating icon is draggable - move it anywhere you want!
- All your data stays in your browser - nothing is uploaded

## 🔜 Coming Soon

- Blackbaud schedule scraping
- Google Calendar integration
- Homework help AI assistant
- Custom notification rules
- Mobile companion app

---

Built for Phillips Academy students by a student who was tired of missing assignments hidden in Canvas announcements. 🎓
