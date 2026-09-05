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

    // Fetch assignments, announcements, and pages for each course
    for (const course of courses) {
      try {
        // 1. Fetch regular assignments
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

        // 2. Fetch announcements (discussion topics marked as announcements)
        const announcementsResponse = await fetch(
          `${CONFIG.canvasUrl}/api/v1/courses/${course.id}/discussion_topics?only_announcements=true&per_page=100`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );

        if (announcementsResponse.ok) {
          const announcements = await announcementsResponse.json();

          // Extract due dates or important dates from announcement text
          for (const announcement of announcements) {
            // Parse announcement message for dates (basic pattern matching)
            const dates = extractDatesFromText(announcement.message || '');

            for (const date of dates) {
              allAssignments.push({
                type: 'announcement',
                course: course.name,
                courseId: course.id,
                title: `📢 ${announcement.title}`,
                dueAt: date.toISOString(),
                url: announcement.html_url,
                submitted: false
              });
            }

            // Also add announcement itself as a "to-read" item if recent (last 7 days)
            const postedDate = new Date(announcement.posted_at || announcement.created_at);
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

            if (postedDate > sevenDaysAgo) {
              allAssignments.push({
                type: 'announcement',
                course: course.name,
                courseId: course.id,
                title: `📢 ${announcement.title}`,
                dueAt: postedDate.toISOString(),
                url: announcement.html_url,
                submitted: false
              });
            }
          }
        }

        // 3. Fetch course pages (where syllabi often live)
        const pagesResponse = await fetch(
          `${CONFIG.canvasUrl}/api/v1/courses/${course.id}/pages?per_page=100`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );

        if (pagesResponse.ok) {
          const pages = await pagesResponse.json();

          for (const page of pages) {
            // Check if page title or URL suggests it's a syllabus or important info
            const isSyllabus = /syllabus|schedule|calendar|due dates|assignments/i.test(page.title || page.url);

            if (isSyllabus) {
              // Fetch full page content to extract dates
              const pageDetailResponse = await fetch(
                `${CONFIG.canvasUrl}/api/v1/courses/${course.id}/pages/${page.url}`,
                {
                  headers: { 'Authorization': `Bearer ${token}` }
                }
              );

              if (pageDetailResponse.ok) {
                const pageDetail = await pageDetailResponse.json();
                const dates = extractDatesFromText(pageDetail.body || '');

                for (const date of dates) {
                  allAssignments.push({
                    type: 'page',
                    course: course.name,
                    courseId: course.id,
                    title: `📄 ${page.title}`,
                    dueAt: date.toISOString(),
                    url: pageDetail.html_url,
                    submitted: false
                  });
                }
              }
            }
          }
        }

        // 4. Fetch course home page (front page)
        const courseDetailResponse = await fetch(
          `${CONFIG.canvasUrl}/api/v1/courses/${course.id}?include[]=syllabus_body`,
          {
            headers: { 'Authorization': `Bearer ${token}` }
          }
        );

        if (courseDetailResponse.ok) {
          const courseDetail = await courseDetailResponse.json();

          // Extract dates from syllabus
          if (courseDetail.syllabus_body) {
            const dates = extractDatesFromText(courseDetail.syllabus_body);

            for (const date of dates) {
              allAssignments.push({
                type: 'syllabus',
                course: course.name,
                courseId: course.id,
                title: `📋 Syllabus: ${course.name}`,
                dueAt: date.toISOString(),
                url: `${CONFIG.canvasUrl}/courses/${course.id}`,
                submitted: false
              });
            }
          }
        }

      } catch (error) {
        console.error(`Error fetching data for course ${course.id}:`, error);
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

// Extract dates from HTML/text content
function extractDatesFromText(html) {
  if (!html) return [];

  // Strip HTML tags to get plain text
  const text = html.replace(/<[^>]*>/g, ' ');
  const dates = [];
  const now = new Date();
  const currentYear = now.getFullYear();

  // Pattern 1: "Due: MM/DD" or "Due MM/DD/YYYY"
  const dueDatePattern = /due[:\s]+(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/gi;
  let match;

  while ((match = dueDatePattern.exec(text)) !== null) {
    const month = parseInt(match[1]) - 1; // JS months are 0-indexed
    const day = parseInt(match[2]);
    const year = match[3] ? (match[3].length === 2 ? 2000 + parseInt(match[3]) : parseInt(match[3])) : currentYear;

    const date = new Date(year, month, day, 23, 59, 59); // Default to end of day
    if (!isNaN(date.getTime()) && date > now) {
      dates.push(date);
    }
  }

  // Pattern 2: "September 15" or "Sept 15, 2026"
  const monthNamePattern = /(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:,?\s+(\d{4}))?/gi;

  while ((match = monthNamePattern.exec(text)) !== null) {
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthName = match[1].toLowerCase().substring(0, 3);
    const month = monthNames.indexOf(monthName);
    const day = parseInt(match[2]);
    const year = match[3] ? parseInt(match[3]) : currentYear;

    if (month !== -1) {
      const date = new Date(year, month, day, 23, 59, 59);
      if (!isNaN(date.getTime()) && date > now) {
        dates.push(date);
      }
    }
  }

  // Pattern 3: ISO dates "2026-09-15"
  const isoPattern = /(\d{4})-(\d{2})-(\d{2})/g;

  while ((match = isoPattern.exec(text)) !== null) {
    const date = new Date(match[0]);
    if (!isNaN(date.getTime()) && date > now) {
      dates.push(date);
    }
  }

  // Remove duplicates (dates within 1 day of each other)
  const uniqueDates = [];
  for (const date of dates) {
    const isDuplicate = uniqueDates.some(existing =>
      Math.abs(existing - date) < 24 * 60 * 60 * 1000
    );
    if (!isDuplicate) {
      uniqueDates.push(date);
    }
  }

  return uniqueDates;
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
