// Main app.js for Resume Portal

// Global variables
let currentUser = null;
let userProfile = null;
let userResume = null;

// DOM elements
const navLinks = document.getElementById('navLinks');
const pages = document.querySelectorAll('.page');
const toast = document.getElementById('toast');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Set up navigation
    setupNavigation();
    
    // Set up form submissions
    setupForms();
    
    // Set up file upload
    setupFileUpload();
    
    // Check if user is logged in
    checkAuthStatus();
    
    // Load current page based on hash
    loadPageFromHash();
});

// Navigation functions
function setupNavigation() {
    // Handle hash changes for navigation
    window.addEventListener('hashchange', loadPageFromHash);
    
    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            logout();
        });
    }
}

function loadPageFromHash() {
    // Get the current hash without the # symbol
    const hash = window.location.hash.substring(1) || 'home';
    
    // Hide all pages
    pages.forEach(page => {
        page.classList.remove('active');
    });
    
    // Show the selected page
    const selectedPage = document.getElementById(hash);
    if (selectedPage) {
        selectedPage.classList.add('active');
        
        // Check if page requires authentication
        if (selectedPage.classList.contains('auth-required') && !currentUser) {
            // Redirect to login if not authenticated
            window.location.hash = 'login';
            showToast('Please log in to access this page', 'warning');
            return;
        }
        
        // Check if page is admin-only
        if (selectedPage.classList.contains('admin-only') && (!currentUser || !isAdmin())) {
            // Redirect to dashboard if not admin
            window.location.hash = 'dashboard';
            showToast('Access denied: Admin privileges required', 'error');
            return;
        }
        
        // Load page-specific data
        loadPageData(hash);
    } else {
        // If page doesn't exist, go to home
        window.location.hash = 'home';
    }
}

function loadPageData(page) {
    switch (page) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'profile':
            loadProfileData();
            break;
        case 'resume':
            loadResumeData();
            break;
        case 'admin':
            loadAdminData();
            break;
    }
}

// Authentication functions
async function checkAuthStatus() {
    try {
        const response = await fetch('/api/user', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            setCurrentUser(data.user);
        } else {
            setCurrentUser(null);
        }
    } catch (error) {
        console.error('Auth check error:', error);
        setCurrentUser(null);
    }
}

function setCurrentUser(user) {
    currentUser = user;
    
    // Update UI based on authentication status
    const authRequired = document.querySelectorAll('.auth-required');
    const noAuth = document.querySelectorAll('.no-auth');
    const adminOnly = document.querySelectorAll('.admin-only');
    
    if (user) {
        // Show authenticated elements
        authRequired.forEach(el => el.classList.remove('hidden'));
        noAuth.forEach(el => el.classList.add('hidden'));
        
        // Show/hide admin elements
        if (isAdmin()) {
            adminOnly.forEach(el => el.classList.remove('hidden'));
        } else {
            adminOnly.forEach(el => el.classList.add('hidden'));
        }
        
        // Update user greeting
        const userGreeting = document.getElementById('userGreeting');
        if (userGreeting) {
            userGreeting.textContent = user.username;
        }
    } else {
        // Show non-authenticated elements
        authRequired.forEach(el => el.classList.add('hidden'));
        noAuth.forEach(el => el.classList.remove('hidden'));
        adminOnly.forEach(el => el.classList.add('hidden'));
    }
}

function isAdmin() {
    // In a real app, this would check a role property on the user
    // For now, we'll just check if the username is 'admin'
    return currentUser && currentUser.username === 'admin';
}

async function login(email, password) {
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password }),
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            setCurrentUser(data.user);
            window.location.hash = 'dashboard';
            showToast('Login successful!', 'success');
            return true;
        } else {
            showToast(data.message || 'Login failed', 'error');
            return false;
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('Login failed. Please try again.', 'error');
        return false;
    }
}

async function register(username, email, password) {
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, email, password }),
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('Registration successful! Please log in.', 'success');
            window.location.hash = 'login';
            return true;
        } else {
            showToast(data.message || 'Registration failed', 'error');
            return false;
        }
    } catch (error) {
        console.error('Registration error:', error);
        showToast('Registration failed. Please try again.', 'error');
        return false;
    }
}

async function logout() {
    try {
        const response = await fetch('/api/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (response.ok) {
            setCurrentUser(null);
            window.location.hash = 'home';
            showToast('Logged out successfully', 'success');
        } else {
            showToast('Logout failed', 'error');
        }
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Logout failed', 'error');
    }
}

// Form setup
function setupForms() {
    // Register form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            
            // Simple validation
            if (password !== confirmPassword) {
                showToast('Passwords do not match', 'error');
                return;
            }
            
            await register(username, email, password);
        });
    }
    
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            
            await login(email, password);
        });
    }
    
    // Profile form
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await updateProfile();
        });
    }
    
    // Resume upload form
    const resumeUploadForm = document.getElementById('resumeUploadForm');
    if (resumeUploadForm) {
        resumeUploadForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            await uploadResume();
        });
    }
}

// File upload setup
function setupFileUpload() {
    const resumeFile = document.getElementById('resumeFile');
    const fileName = document.getElementById('fileName');
    
    if (resumeFile && fileName) {
        resumeFile.addEventListener('change', function() {
            if (this.files && this.files.length > 0) {
                fileName.textContent = this.files[0].name;
            } else {
                fileName.textContent = '';
            }
        });
    }
    
    // Delete resume button
    const deleteResumeBtn = document.getElementById('deleteResumeBtn');
    if (deleteResumeBtn) {
        deleteResumeBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            if (confirm('Are you sure you want to delete your resume?')) {
                await deleteResume();
            }
        });
    }
}

// Data loading functions
async function loadDashboardData() {
    if (!currentUser) return;
  
    try {
      // Load profile
      await loadProfileData(false);
  
      // Load resume
      const response = await fetch('/api/resume', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });
  
      if (response.ok) {
        const data = await response.json();
        userResume = data.resume;
  
        document.getElementById('resumeStatus').textContent = 'Uploaded';
  
        // Update resume score
        const resumeScore = document.getElementById('resumeScore');
        const resumeFeedback = document.getElementById('resumeFeedback');
  
        if (resumeScore && resumeFeedback) {
          if (userResume.score !== null) {
            resumeScore.textContent = userResume.score + '%';
  
            // Color code based on score
            if (userResume.score >= 70) {
              resumeScore.style.color = 'green';
            } else if (userResume.score >= 40) {
              resumeScore.style.color = 'orange';
            } else {
              resumeScore.style.color = 'red';
            }
          } else {
            resumeScore.textContent = 'N/A';
            resumeScore.style.color = '';
          }
  
          resumeFeedback.textContent = userResume.feedback || 'No feedback available.';
        }
      } else {
        document.getElementById('resumeStatus').textContent = 'Not uploaded';
        document.getElementById('resumeScore').textContent = 'N/A';
        document.getElementById('resumeFeedback').textContent = 'No feedback yet';
      }
  
      // Profile progress
      updateProfileProgress();
    } catch (error) {
      console.error('Dashboard load error:', error);
      showToast('Failed to load dashboard data', 'error');
    }
  }
  

async function loadProfileData(showError = true) {
    if (!currentUser) return;
    
    try {
        const response = await fetch('/api/profile', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            userProfile = data.profile;
            
            // Fill profile form
            if (document.getElementById('firstName')) {
                document.getElementById('firstName').value = userProfile.first_name || '';
                document.getElementById('lastName').value = userProfile.last_name || '';
                document.getElementById('phone').value = userProfile.phone || '';
                document.getElementById('headline').value = userProfile.headline || '';
                document.getElementById('summary').value = userProfile.summary || '';
            }
            
            return userProfile;
        } else if (showError) {
            showToast('Failed to load profile', 'error');
        }
    } catch (error) {
        console.error('Profile load error:', error);
        if (showError) {
            showToast('Failed to load profile', 'error');
        }
    }
}

async function loadResumeData(showError = true) {
    if (!currentUser) return;
    
    try {
        const response = await fetch('/api/resume', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            userResume = data.resume;
            
            // Update resume display
            const resumeDisplay = document.getElementById('resumeDisplay');
            if (resumeDisplay) {
                resumeDisplay.classList.remove('hidden');
                
                // Update resume info
                const resumeFilename = document.getElementById('resumeFilename');
                const resumeDate = document.getElementById('resumeDate');
                const viewResumeBtn = document.getElementById('viewResumeBtn');
                
                if (resumeFilename) resumeFilename.textContent = userResume.original_name;
                if (resumeDate) resumeDate.textContent = new Date(userResume.upload_date).toLocaleDateString();
                if (viewResumeBtn) viewResumeBtn.href = `/uploads/${userResume.file_name}`;
            }
            
            return userResume;
        } else if (response.status !== 404 && showError) {
            showToast('Failed to load resume', 'error');
        } else if (response.status === 404) {
            // No resume found
            const resumeDisplay = document.getElementById('resumeDisplay');
            if (resumeDisplay) {
                resumeDisplay.classList.add('hidden');
            }
            userResume = null;
        }
    } catch (error) {
        console.error('Resume load error:', error);
        if (showError) {
            showToast('Failed to load resume', 'error');
        }
    }
}

async function loadAdminData() {
    if (!currentUser || !isAdmin()) return;
    
    try {
        const response = await fetch('/api/admin/resumes', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            renderAdminResumes(data.resumes);
        } else {
            showToast('Failed to load admin data', 'error');
        }
    } catch (error) {
        console.error('Admin data load error:', error);
        showToast('Failed to load admin data', 'error');
    }
}

// Rendering functions
function renderAdminResumes(resumes) {
    const tableBody = document.getElementById('resumesTableBody');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    if (resumes.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="5" class="text-center">No resumes found</td>';
        tableBody.appendChild(row);
        return;
    }
    
    resumes.forEach(resume => {
        const row = document.createElement('tr');
        
        const userName = resume.first_name && resume.last_name ? 
            `${resume.first_name} ${resume.last_name}` : 
            resume.username;
        
        row.innerHTML = `
            <td>${userName}</td>
            <td>${resume.email}</td>
            <td>${resume.original_name}</td>
            <td>${new Date(resume.upload_date).toLocaleDateString()}</td>
            <td>
                <a href="/uploads/${resume.file_name}" target="_blank" class="btn btn-sm">View</a>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

function updateProfileProgress() {
    if (!userProfile) return;
    
    const profileProgress = document.getElementById('profileProgress');
    const profilePercentage = document.getElementById('profilePercentage');
    
    if (!profileProgress || !profilePercentage) return;
    
    // Calculate completion percentage
    let fields = 0;
    let filled = 0;
    
    // Check each field
    if (userProfile.first_name) filled++;
    fields++;
    
    if (userProfile.last_name) filled++;
    fields++;
    
    if (userProfile.phone) filled++;
    fields++;
    
    if (userProfile.headline) filled++;
    fields++;
    
    if (userProfile.summary) filled++;
    fields++;
    
    const percentage = fields > 0 ? Math.round((filled / fields) * 100) : 0;
    
    // Update UI
    profileProgress.style.width = `${percentage}%`;
    profilePercentage.textContent = `${percentage}%`;
}

function updateResumeStatus() {
    const resumeStatus = document.getElementById('resumeStatus');
    if (!resumeStatus) return;
    
    if (userResume) {
        resumeStatus.textContent = 'Uploaded';
        resumeStatus.classList.add('status-success');
        resumeStatus.classList.remove('status-warning');
    } else {
        resumeStatus.textContent = 'Not uploaded';
        resumeStatus.classList.add('status-warning');
        resumeStatus.classList.remove('status-success');
    }
}

// API functions
async function updateProfile() {
    if (!currentUser) return;
    
    const firstName = document.getElementById('firstName').value;
    const lastName = document.getElementById('lastName').value;
    const phone = document.getElementById('phone').value;
    const headline = document.getElementById('headline').value;
    const summary = document.getElementById('summary').value;
    
    try {
        const response = await fetch('/api/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                firstName,
                lastName,
                phone,
                headline,
                summary
            }),
            credentials: 'include'
        });
        
        if (response.ok) {
            showToast('Profile updated successfully', 'success');
            
            // Reload profile data
            await loadProfileData();
            
            // Update profile progress
            updateProfileProgress();
            
            return true;
        } else {
            const data = await response.json();
            showToast(data.message || 'Failed to update profile', 'error');
            return false;
        }
    } catch (error) {
        console.error('Profile update error:', error);
        showToast('Failed to update profile', 'error');
        return false;
    }
}

async function uploadResume() {
    if (!currentUser) return;
    
    const fileInput = document.getElementById('resumeFile');
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        showToast('Please select a file', 'warning');
        return;
    }
    
    const formData = new FormData();
    formData.append('resume', fileInput.files[0]);
    
    try {
        const response = await fetch('/api/upload-resume', {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showToast('Resume uploaded successfully', 'success');
            
            // Reset file input
            fileInput.value = '';
            document.getElementById('fileName').textContent = '';
            
            // Reload resume data
            await loadResumeData();
            
            // Update resume status
            updateResumeStatus();
            
            return true;
        } else {
            showToast(data.message || 'Failed to upload resume', 'error');
            return false;
        }
    } catch (error) {
        console.error('Resume upload error:', error);
        showToast('Failed to upload resume', 'error');
        return false;
    }
}

async function deleteResume() {
    // Note: API endpoint for delete not provided in server.js
    // This is a placeholder for the delete functionality
    showToast('Delete functionality not implemented on the server', 'warning');
    return false;
    
    /* Implementation would look like:
    try {
        const response = await fetch('/api/resume', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (response.ok) {
            showToast('Resume deleted successfully', 'success');
            userResume = null;
            
            // Update UI
            const resumeDisplay = document.getElementById('resumeDisplay');
            if (resumeDisplay) {
                resumeDisplay.classList.add('hidden');
            }
            
            // Update resume status
            updateResumeStatus();
            
            return true;
        } else {
            const data = await response.json();
            showToast(data.message || 'Failed to delete resume', 'error');
            return false;
        }
    } catch (error) {
        console.error('Resume delete error:', error);
        showToast('Failed to delete resume', 'error');
        return false;
    }
    */
}

// Utility functions
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    const toastMessage = document.querySelector('.toast-message');
    const toastIcon = document.querySelector('.toast-icon');
    
    // Set message
    toastMessage.textContent = message;
    
    // Set icon and color based on type
    toast.className = 'toast';
    toast.classList.add(`toast-${type}`);
    
    // Set icon
    switch (type) {
        case 'success':
            toastIcon.className = 'fas fa-check-circle toast-icon';
            break;
        case 'error':
            toastIcon.className = 'fas fa-times-circle toast-icon';
            break;
        case 'warning':
            toastIcon.className = 'fas fa-exclamation-circle toast-icon';
            break;
        default:
            toastIcon.className = 'fas fa-info-circle toast-icon';
    }
    
    // Show toast
    toast.classList.remove('hidden');
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}