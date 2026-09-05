// Content Script - Floating Overlay Icon (Win+G style)
// Injects a draggable icon that opens the PA Hub overlay

let overlayOpen = false;
let overlayContainer = null;
let floatingIcon = null;

// Initialize the floating icon when page loads
function init() {
  if (floatingIcon) return; // Already initialized

  // Create floating icon
  floatingIcon = document.createElement('div');
  floatingIcon.id = 'pa-hub-floating-icon';
  floatingIcon.innerHTML = `
    <div class="pa-hub-icon-badge" id="pa-hub-badge"></div>
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <circle cx="16" cy="16" r="14" fill="#4F46E5" stroke="#fff" stroke-width="2"/>
      <text x="16" y="21" text-anchor="middle" fill="white" font-size="16" font-weight="bold">P</text>
    </svg>
  `;

  // Make it draggable
  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;

  floatingIcon.addEventListener('mousedown', dragStart);
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', dragEnd);

  function dragStart(e) {
    if (e.target.closest('.pa-hub-icon-badge')) return; // Don't drag when clicking badge

    initialX = e.clientX - floatingIcon.offsetLeft;
    initialY = e.clientY - floatingIcon.offsetTop;
    isDragging = true;
  }

  function drag(e) {
    if (!isDragging) return;

    e.preventDefault();
    currentX = e.clientX - initialX;
    currentY = e.clientY - initialY;

    floatingIcon.style.left = currentX + 'px';
    floatingIcon.style.top = currentY + 'px';
    floatingIcon.style.right = 'auto';
    floatingIcon.style.bottom = 'auto';
  }

  function dragEnd(e) {
    if (!isDragging) return;

    isDragging = false;

    // If we barely moved, treat it as a click
    const moved = Math.abs(e.clientX - (initialX + floatingIcon.offsetLeft)) > 5 ||
                  Math.abs(e.clientY - (initialY + floatingIcon.offsetTop)) > 5;

    if (!moved) {
      toggleOverlay();
    }
  }

  // Add to page
  document.body.appendChild(floatingIcon);

  // Update badge count
  updateBadgeCount();
}

// Toggle overlay panel
function toggleOverlay() {
  if (overlayOpen) {
    closeOverlay();
  } else {
    openOverlay();
  }
}

// Open overlay panel
async function openOverlay() {
  if (overlayContainer) {
    overlayContainer.style.display = 'flex';
    overlayOpen = true;
    return;
  }

  // Create overlay container
  overlayContainer = document.createElement('div');
  overlayContainer.id = 'pa-hub-overlay';
  overlayContainer.innerHTML = `
    <div class="pa-hub-panel">
      <div class="pa-hub-header">
        <h2>🎓 PA Hub</h2>
        <button id="pa-hub-close">✕</button>
      </div>

      <div class="pa-hub-tabs">
        <button class="pa-hub-tab active" data-tab="assignments">📚 Assignments</button>
        <button class="pa-hub-tab" data-tab="schedule">📅 Schedule</button>
      </div>

      <div class="pa-hub-content">
        <div id="tab-assignments" class="pa-hub-tab-content active">
          <div class="pa-hub-loading">Loading assignments...</div>
        </div>

        <div id="tab-schedule" class="pa-hub-tab-content">
          <div class="pa-hub-loading">Loading schedule...</div>
        </div>
      </div>

      <div class="pa-hub-footer">
        <button id="pa-hub-refresh">🔄 Refresh</button>
        <button id="pa-hub-settings">⚙️ Settings</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlayContainer);

  // Event listeners
  overlayContainer.querySelector('#pa-hub-close').addEventListener('click', closeOverlay);
  overlayContainer.addEventListener('click', (e) => {
    if (e.target === overlayContainer) closeOverlay();
  });

  // Tab switching
  overlayContainer.querySelectorAll('.pa-hub-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;

      // Update active tab
      overlayContainer.querySelectorAll('.pa-hub-tab').forEach(t => t.classList.remove('active'));
      overlayContainer.querySelectorAll('.pa-hub-tab-content').forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      overlayContainer.querySelector(`#tab-${tabName}`).classList.add('active');
    });
  });

  // Refresh button
  overlayContainer.querySelector('#pa-hub-refresh').addEventListener('click', () => {
    loadAllData();
  });

  // Settings button
  overlayContainer.querySelector('#pa-hub-settings').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'openSettings' });
  });

  overlayOpen = true;
  loadAllData();
}

// Close overlay
function closeOverlay() {
  if (overlayContainer) {
    overlayContainer.style.display = 'none';
  }
  overlayOpen = false;
}

// Load all data into overlay
async function loadAllData() {
  loadAssignments();
  loadSchedule();
}

// Load assignments from storage
async function loadAssignments() {
  const response = await chrome.runtime.sendMessage({ action: 'getAssignments' });
  const { assignments = [], lastCheck } = response || {};

  const container = overlayContainer.querySelector('#tab-assignments');

  if (assignments.length === 0) {
    container.innerHTML = `
      <div class="pa-hub-empty">
        <p>No upcoming assignments</p>
        <small>Last checked: ${lastCheck ? new Date(lastCheck).toLocaleString() : 'Never'}</small>
      </div>
    `;
    return;
  }

  // Group by urgency
  const now = new Date();
  const urgent = []; // Due in 24h
  const upcoming = []; // Due in 7 days
  const later = [];

  assignments.forEach(a => {
    const dueDate = new Date(a.dueAt);
    const hoursUntil = (dueDate - now) / (1000 * 60 * 60);

    if (hoursUntil < 0) return; // Past due, skip
    if (hoursUntil <= 24) urgent.push(a);
    else if (hoursUntil <= 168) upcoming.push(a);
    else later.push(a);
  });

  let html = '';

  if (urgent.length > 0) {
    html += '<div class="pa-hub-section urgent"><h3>⚠️ Due Today</h3>';
    urgent.forEach(a => {
      const dueDate = new Date(a.dueAt);
      html += `
        <div class="pa-hub-item">
          <div class="pa-hub-item-title">${a.title}</div>
          <div class="pa-hub-item-meta">${a.course} • ${dueDate.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'})}</div>
          <a href="${a.url}" target="_blank" class="pa-hub-item-link">Open →</a>
        </div>
      `;
    });
    html += '</div>';
  }

  if (upcoming.length > 0) {
    html += '<div class="pa-hub-section"><h3>📅 This Week</h3>';
    upcoming.forEach(a => {
      const dueDate = new Date(a.dueAt);
      html += `
        <div class="pa-hub-item">
          <div class="pa-hub-item-title">${a.title}</div>
          <div class="pa-hub-item-meta">${a.course} • ${dueDate.toLocaleDateString([], {weekday: 'short', month: 'short', day: 'numeric'})}</div>
          <a href="${a.url}" target="_blank" class="pa-hub-item-link">Open →</a>
        </div>
      `;
    });
    html += '</div>';
  }

  container.innerHTML = html || '<div class="pa-hub-empty">No upcoming assignments</div>';
}

// Load schedule (placeholder for now)
async function loadSchedule() {
  const container = overlayContainer.querySelector('#tab-schedule');
  container.innerHTML = `
    <div class="pa-hub-empty">
      <p>Schedule sync coming soon</p>
      <small>Blackbaud integration will be added next</small>
    </div>
  `;
}

// Update badge count on floating icon
async function updateBadgeCount() {
  const response = await chrome.runtime.sendMessage({ action: 'getAssignments' });
  const { assignments = [] } = response || {};

  const now = new Date();
  const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const upcomingCount = assignments.filter(a => {
    const dueDate = new Date(a.dueAt);
    return dueDate >= now && dueDate <= sevenDays;
  }).length;

  const badge = floatingIcon?.querySelector('#pa-hub-badge');
  if (badge) {
    if (upcomingCount > 0) {
      badge.textContent = upcomingCount;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }
}

// Listen for updates from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'updateBadge') {
    updateBadgeCount();
  }

  if (request.action === 'refreshOverlay') {
    if (overlayOpen) {
      loadAllData();
    }
  }
});

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Keyboard shortcut: Alt+P to toggle overlay
document.addEventListener('keydown', (e) => {
  if (e.altKey && e.key === 'p') {
    e.preventDefault();
    toggleOverlay();
  }
});
