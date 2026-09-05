// Setup page script

// Load current settings
document.addEventListener('DOMContentLoaded', async () => {
  const { canvasToken } = await chrome.storage.local.get(['canvasToken']);

  // Populate Canvas token (masked)
  if (canvasToken) {
    document.getElementById('canvas-token').value = canvasToken;
  }
});

// Save button
document.getElementById('save-btn').addEventListener('click', async () => {
  const canvasToken = document.getElementById('canvas-token').value.trim();

  if (!canvasToken) {
    showMessage('error', 'Please enter your Canvas API token');
    return;
  }

  try {
    // Save to storage
    await chrome.storage.local.set({ canvasToken });

    // Trigger immediate check
    await chrome.runtime.sendMessage({ action: 'checkNow' });

    showMessage('success', 'Settings saved! PA Hub is now active.');

    // Close window after 2 seconds
    setTimeout(() => {
      window.close();
    }, 2000);
  } catch (error) {
    console.error('Save error:', error);
    showMessage('error', 'Failed to save settings. Please try again.');
  }
});

// Show message helper
function showMessage(type, text) {
  const successEl = document.getElementById('success-message');
  const errorEl = document.getElementById('error-message');

  successEl.style.display = 'none';
  errorEl.style.display = 'none';

  if (type === 'success') {
    successEl.textContent = text;
    successEl.style.display = 'block';
  } else {
    errorEl.textContent = text;
    errorEl.style.display = 'block';
  }
}
