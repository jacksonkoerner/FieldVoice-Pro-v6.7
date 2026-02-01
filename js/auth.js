// FieldVoice Pro - Authentication Page Logic
// Handles login/signup with Supabase Auth

// ============ STATE ============
let isSignUpMode = false;

// ============ AUTH MODE TOGGLE ============

/**
 * Toggle between sign in and sign up modes
 */
function toggleAuthMode() {
    isSignUpMode = !isSignUpMode;

    const titleEl = document.getElementById('auth-title');
    const buttonEl = document.getElementById('auth-button');
    const toggleTextEl = document.getElementById('toggle-text');
    const toggleButtonEl = document.getElementById('toggle-button');

    if (isSignUpMode) {
        titleEl.innerHTML = '<i class="fas fa-user-plus"></i> Sign Up';
        buttonEl.innerHTML = '<i class="fas fa-user-plus"></i> Sign Up';
        toggleTextEl.textContent = 'Already have an account?';
        toggleButtonEl.textContent = 'Sign In';
    } else {
        titleEl.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
        buttonEl.innerHTML = '<i class="fas fa-sign-in-alt"></i> Sign In';
        toggleTextEl.textContent = "Don't have an account?";
        toggleButtonEl.textContent = 'Sign Up';
    }

    hideError();
    hideSuccess();
}

// ============ AUTH SUBMISSION ============

/**
 * Handle authentication form submission
 */
async function handleAuth() {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    // Validation
    if (!email || !password) {
        showError('Please enter email and password');
        return;
    }

    if (password.length < 6) {
        showError('Password must be at least 6 characters');
        return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showError('Please enter a valid email address');
        return;
    }

    const button = document.getElementById('auth-button');
    button.disabled = true;
    button.innerHTML = isSignUpMode
        ? '<i class="fas fa-spinner fa-spin"></i> Signing up...'
        : '<i class="fas fa-spinner fa-spin"></i> Signing in...';

    hideError();
    hideSuccess();

    try {
        let result;

        if (isSignUpMode) {
            result = await window.supabaseClient.auth.signUp({
                email: email,
                password: password
            });
        } else {
            result = await window.supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });
        }

        if (result.error) {
            throw result.error;
        }

        console.log('[AUTH] Success:', result.data.user?.email);

        // For signup, check if email confirmation is required
        if (isSignUpMode && result.data.user && !result.data.session) {
            showSuccess('Account created! Please check your email to confirm your account.');
            button.disabled = false;
            button.innerHTML = '<i class="fas fa-user-plus"></i> Sign Up';
            return;
        }

        // Check if user has a profile set up
        const hasProfile = await checkUserProfile();

        if (hasProfile) {
            window.location.href = 'index.html';
        } else {
            // New user, send to settings to complete profile
            window.location.href = 'settings.html?welcome=true';
        }

    } catch (error) {
        console.error('[AUTH] Error:', error);

        // Provide user-friendly error messages
        let errorMessage = error.message || 'Authentication failed';

        if (error.message?.includes('Invalid login credentials')) {
            errorMessage = 'Invalid email or password. Please try again.';
        } else if (error.message?.includes('Email not confirmed')) {
            errorMessage = 'Please check your email and confirm your account first.';
        } else if (error.message?.includes('User already registered')) {
            errorMessage = 'An account with this email already exists. Try signing in instead.';
        } else if (error.message?.includes('Password should be')) {
            errorMessage = 'Password must be at least 6 characters long.';
        }

        showError(errorMessage);
        button.disabled = false;
        button.innerHTML = isSignUpMode
            ? '<i class="fas fa-user-plus"></i> Sign Up'
            : '<i class="fas fa-sign-in-alt"></i> Sign In';
    }
}

// ============ PROFILE CHECK ============

/**
 * Check if user has completed their profile
 * @returns {Promise<boolean>}
 */
async function checkUserProfile() {
    try {
        const settings = await window.dataLayer?.loadUserSettings?.();
        return settings && settings.fullName && settings.fullName.trim() !== '';
    } catch (e) {
        console.warn('[AUTH] Could not check profile:', e);
        return false;
    }
}

// ============ SESSION CHECK ============

/**
 * Check if user is already logged in on page load
 */
async function checkExistingSession() {
    try {
        // Wait for Supabase client to be ready
        let attempts = 0;
        while (!window.supabaseClient && attempts < 20) {
            await new Promise(r => setTimeout(r, 100));
            attempts++;
        }

        if (!window.supabaseClient) {
            console.warn('[AUTH] Supabase client not available');
            return;
        }

        const { data: { session } } = await window.supabaseClient.auth.getSession();
        if (session) {
            console.log('[AUTH] Existing session found, redirecting...');
            window.location.href = 'index.html';
        }
    } catch (e) {
        console.warn('[AUTH] Session check failed:', e);
    }
}

// ============ UI HELPERS ============

function showError(message) {
    const el = document.getElementById('auth-error');
    const textEl = document.getElementById('auth-error-text');
    textEl.textContent = message;
    el.classList.remove('hidden');
}

function hideError() {
    document.getElementById('auth-error').classList.add('hidden');
}

function showSuccess(message) {
    const el = document.getElementById('auth-success');
    const textEl = document.getElementById('auth-success-text');
    textEl.textContent = message;
    el.classList.remove('hidden');
}

function hideSuccess() {
    document.getElementById('auth-success').classList.add('hidden');
}

// ============ KEYBOARD HANDLING ============

function handleKeyPress(event) {
    if (event.key === 'Enter') {
        handleAuth();
    }
}

// ============ INIT ============

document.addEventListener('DOMContentLoaded', () => {
    // Add enter key listener
    document.getElementById('email').addEventListener('keypress', handleKeyPress);
    document.getElementById('password').addEventListener('keypress', handleKeyPress);

    // Check for existing session
    checkExistingSession();
});

// ============ EXPOSE TO WINDOW FOR ONCLICK HANDLERS ============
window.handleAuth = handleAuth;
window.toggleAuthMode = toggleAuthMode;
