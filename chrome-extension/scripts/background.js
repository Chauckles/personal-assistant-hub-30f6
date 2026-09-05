// Background Service Worker - PA Assistant
// Handles periodic checks, notifications, and data syncing

const CONFIG = {
  canvasUrl: 'https://canvas.andover.edu',
  blackbaudUrl: 'https://andover.myschoolapp.com',
  checkIntervalMinutes: 180 // Check every 3 hours
};

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  console.log('PA Assistant installed!');

  // Set up periodic alarms
  chrome.alarms.create('checkAssignments', {
    periodInMinutes: CONFIG.checkIntervalMinutes
  });

  // Check immediately on install
  await checkForUpdates();
});

// Listen for alarm triggers
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkAssignments') {
    checkForUpdates();
  }
});

// Main update checker
async function checkForUpdates() {
  console.log('Checking for updates...', new Date().toISOString());

  try {
    // Get stored credentials
    const { canvasToken, blackbaudEmail, blackbaudPassword } = await chrome.storage.local.get([
      'canvasToken',
      'blackbaudEmail',
      'blackbaudPassword'
    ]);

    if (!canvasToken) {
      console.log('No Canvas token configured');
      return;
    }

    // Check Canvas for new assignments
    await checkCanvas(canvasToken);

    // Check Blackbaud for schedule (if credentials available)
    if (blackbaudEmail && blackbaudPassword) {
      await checkBlackbaud(blackbaudEmail, blackbaudPassword);
    }

  } catch (error) {
    console.error('Error checking for updates:', error);
  }
}

// Check Canvas for assignments
async function checkCanvas(token) {
  console.log('Checking Canvas...');

  try {
    // Get all active courses
    const coursesResponse = await fetch(
      `${CONFIG.canvasUrl}/api/v1/courses?enrollment_state=active&per_page=100`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );

    if (!coursesResponse.ok) {
      throw new Error(`Canvas API error: ${coursesResponse.status}`);
    }

    const courses = await coursesResponse.json();
    const allAssignments = [];

    // Fetch assignments for each course
    for (const course of courses) {
      try {
        const assignmentsResponse = await fetch(
          `${CONFIG.canvasUrl}/api/v1/courses/${course.id}/assignments?per_page=100`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );

        if (assignmentsResponse.ok) {
          const assignments = await assignmentsResponse.json();

          // Filter for assignments with due dates
          const upcomingAssignments = assignments
            .filter(a => a.due_at)
            .map(a => ({
              type: 'assignment',
              course: course.name,
              courseId: course.id,
              title: a.name,
              dueAt: a.due_at,
              url: a.html_url,
              submitted: a.has_submitted_submissions || false
            }));

          allAssignments.push(...upcomingAssignments);
        }
      } catch (error) {
        console.error(`Error fetching assignments for course ${course.id}:`, error);
      }
    }

    // Get previously stored assignments
    const { previousAssignments = [] } = await chrome.storage.local.get('previousAssignments');

    // Find new assignments
    const previousIds = new Set(previousAssignments.map(a => `${a.courseId}:${a.title}:${a.dueAt}`));
    const newAssignments = allAssignments.filter(a =>
      !previousIds.has(`${a.courseId}:${a.title}:${a.dueAt}`)
    );

    // Send notifications for new assignments
    for (const assignment of newAssignments) {
      await sendNotification(
        '📚 New Assignment',
        `${assignment.course}: ${assignment.title}`,
        assignment.url
      );
    }

    // Check for assignments due soon (next 24 hours)
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const dueSoon = allAssignments.filter(a => {
      const dueDate = new Date(a.dueAt);
      return dueDate >= now && dueDate <= tomorrow && !a.submitted;
    });

    for (const assignment of dueSoon) {
      const dueDate = new Date(assignment.dueAt);
      const hoursUntil = Math.round((dueDate - now) / (1000 * 60 * 60));

      await sendNotification(
        '⚠️ Assignment Due Soon',
        `${assignment.title} - Due in ${hoursUntil} hours`,
        assignment.url
      );
    }

    // Update stored assignments and badge
    await chrome.storage.local.set({
      assignments: allAssignments,
      previousAssignments: allAssignments,
      lastCheck: new Date().toISOString()
    });

    // Update badge with count of assignments due in next 7 days
    const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const upcomingCount = allAssignments.filter(a => {
      const dueDate = new Date(a.dueAt);
      return dueDate >= now && dueDate <= sevenDays;
    }).length;

    chrome.action.setBadgeText({ text: upcomingCount > 0 ? String(upcomingCount) : '' });
    chrome.action.setBadgeBackgroundColor({ color: '#FF6B6B' });

    console.log(`Canvas check complete. Found ${allAssignments.length} assignments, ${newAssignments.length} new`);

  } catch (error) {
    console.error('Error checking Canvas:', error);
  }
}

// Check Blackbaud for schedule updates
async function checkBlackbaud(email, password) {
  console.log('Checking Blackbaud schedule...');
  // TODO: Implement Blackbaud schedule scraping
  // This will require logging in and scraping the schedule page
  // Will be implemented in the next phase
}

// Send browser notification
async function sendNotification(title, message, url) {
  const notificationId = await chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: title,
    message: message,
    priority: 2
  });

  // Store the URL to open when clicked
  if (url) {
    const { notificationUrls = {} } = await chrome.storage.local.get('notificationUrls');
    notificationUrls[notificationId] = url;
    await chrome.storage.local.set({ notificationUrls });
  }

  console.log(`Notification sent: ${title} - ${message}`);
}

// Handle notification clicks
chrome.notifications.onClicked.addListener(async (notificationId) => {
  const { notificationUrls = {} } = await chrome.storage.local.get('notificationUrls');
  const url = notificationUrls[notificationId];

  if (url) {
    chrome.tabs.create({ url });
  }
});

// Listen for messages from popup/sidebar
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkNow') {
    checkForUpdates().then(() => {
      sendResponse({ success: true });
    });
    return true; // Keep channel open for async response
  }

  if (request.action === 'getAssignments') {
    chrome.storage.local.get(['assignments', 'lastCheck']).then(sendResponse);
    return true;
  }

  if (request.action === 'openSettings') {
    chrome.runtime.openOptionsPage();
    return false;
  }
});
