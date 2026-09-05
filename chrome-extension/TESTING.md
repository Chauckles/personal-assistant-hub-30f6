# PA Hub Extension - Testing Guide

## Quick Start (5 minutes)

### 1. Load Extension in Chrome
1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `chrome-extension` folder
5. You should see "PA Assistant - Canvas & Schedule Tracker" appear

### 2. Configure Canvas Token
1. Click the extension icon (purple "P") in Chrome toolbar
2. OR right-click the extension → Options
3. Enter your Canvas API token: `2319~eVNCCmQzLtzJ4YGGHDhH9V7ChPBn4N9PAVGTc78cmHh2VPZwJGyHzJK8FxJzPNCD`
4. Click **Save & Start**
5. The extension will check Canvas immediately

### 3. Test the Overlay
1. Visit any webpage (e.g., google.com)
2. Look for a floating purple "P" icon in the bottom-right corner
3. **Click the icon** or press **Alt+P** to open the overlay
4. You should see:
   - 📚 Assignments tab (active)
   - 📅 Schedule tab (placeholder)

### 4. Verify Canvas Integration

**Check Assignments:**
- Open the overlay (click icon or Alt+P)
- Go to Assignments tab
- You should see your Canvas assignments grouped as:
  - ⚠️ **Due Today** (due in next 24 hours)
  - 📅 **This Week** (due in next 7 days)
- Each assignment shows:
  - Title
  - Course name
  - Due date/time
  - "Open →" link to Canvas

**Check Notifications:**
- The extension checks Canvas every 3 hours
- New assignments trigger browser notifications
- Assignments due in next 24 hours also notify
- To test immediately, click the **🔄 Refresh** button in overlay

**Check Badge Count:**
- The floating "P" icon shows a red badge
- Badge number = assignments due in next 7 days
- Updates automatically after each Canvas check

### 5. Features to Test

#### Draggable Icon
- Click and drag the purple "P" icon anywhere on the page
- Position persists only during page session

#### Keyboard Shortcut
- Press **Alt+P** to toggle overlay (works on any page)

#### Tab Switching
- Click between Assignments and Schedule tabs
- Only Assignments is functional; Schedule shows placeholder

#### Settings
- Click ⚙️ **Settings** button in overlay
- Opens the setup page
- Can update Canvas token here

#### Refresh
- Click 🔄 **Refresh** button in overlay
- Forces immediate Canvas check
- Useful for testing without waiting 3 hours

## Expected Behavior

### On Install
1. Extension icon appears in Chrome toolbar
2. Floating "P" icon appears on all web pages
3. Canvas is checked immediately (if token configured)
4. Browser notification permission requested

### Every 3 Hours (Automatic)
1. Extension checks Canvas for new assignments
2. Sends notification for any NEW assignments
3. Sends notification for assignments due in next 24 hours
4. Updates badge count on floating icon
5. Updates overlay data if open

### When You Click Floating Icon
1. Overlay panel slides in from the side
2. Shows your Canvas assignments (grouped by urgency)
3. Can click "Open →" to view assignment on Canvas
4. Can refresh or open settings from footer buttons

## Common Issues

**No assignments showing:**
- Check that Canvas token is correct in Settings
- Check Chrome DevTools Console (F12) for errors
- Try clicking Refresh in overlay to force check

**Notifications not appearing:**
- Chrome may have blocked notifications
- Go to chrome://settings/content/notifications
- Allow notifications for the extension

**Floating icon not appearing:**
- Check that the extension is enabled
- Refresh the webpage
- Check browser console for errors

**"Extension context invalidated" error:**
- Happens after updating the extension code
- Close all tabs and reload extension at chrome://extensions/

## Debugging

### View Extension Logs
1. Go to `chrome://extensions/`
2. Find PA Assistant extension
3. Click **Inspect views: service worker**
4. Check Console tab for background script logs
5. Logs show:
   - Canvas API requests
   - Assignment counts
   - Notification sends
   - Errors

### View Content Script Logs
1. Open any webpage with the floating icon
2. Press F12 to open DevTools
3. Check Console tab
4. Overlay UI logs appear here

### Check Storage
1. In background service worker DevTools (see above)
2. Go to Application → Storage → Local Storage
3. Find the extension's origin
4. Should contain:
   - `canvasToken`
   - `assignments` (array)
   - `previousAssignments` (array)
   - `lastCheck` (timestamp)

## Next Steps

After confirming Canvas integration works:
1. **Blackbaud Schedule** - Add school schedule scraping
2. **Email Automation** - Separate Python script (not in extension)
3. **Notifications Polish** - Add sound, priority levels, custom timing

## File Structure

```
chrome-extension/
├── manifest.json          # Extension config
├── icons/                 # 16x16, 48x48, 128x128 icons
├── scripts/
│   ├── background.js      # Service worker (Canvas API, alarms)
│   ├── content.js         # Floating icon + overlay UI
│   └── setup.js           # Settings page logic
├── pages/
│   └── setup.html         # Settings/config page
└── styles/
    └── overlay.css        # Win+G style overlay theme
```

## Support

Issues? Check:
1. Browser console (F12)
2. Extension service worker console (chrome://extensions/)
3. Storage (see Debugging section above)
