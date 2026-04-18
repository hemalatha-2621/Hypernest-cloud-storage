const SUPABASE_URL = "https://niyuchsndxijwdvgmghb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_12iHo_t0Ltm9rCSJkqXu_g_KNYO7yYj";
const STORAGE_BUCKET = "user-files";

let supabase = null;

function getSupabase() {
    if (supabase) return supabase;
    if (window.supabase && window.supabase.createClient) {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return supabase;
    }
    console.error('Supabase library not loaded yet!');
    return null;
}

let currentUser = null;
let currentFiles = [];
let searchTimeout = null;

// Global flag for backend availability
let isBackendAvailable = false;

async function checkBackend() {
    try {
        // Use a simple GET ping that would return JSON on success
        const response = await fetch('api/list-proxy?ping=1');
        const contentType = response.headers.get("content-type");
        isBackendAvailable = response.ok && contentType && contentType.includes("application/json");
        console.log('Backend presence check:', isBackendAvailable ? 'CONNECTED' : 'NOT FOUND (Static Mode)');
    } catch (e) {
        isBackendAvailable = false;
        console.log('Backend not detected, running in static mode.');
    }
}


// --- Utility Functions ---

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateString) {
    if (!dateString) return 'Recent';
    return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function showAuthMessage(message, isError = true) {
    const msg = document.getElementById('auth-msg');
    if (!msg) return;
    msg.textContent = message;
    msg.style.color = isError ? 'var(--error)' : 'var(--success)';
    setTimeout(() => msg.textContent = '', 5000);
}

function showUploadMessage(message, isError = true) {
    const msg = document.getElementById('upload-msg') || document.querySelector('.upload-area h3');
    if (!msg) return;
    const originalText = msg.textContent;
    msg.textContent = message;
    if (isError) msg.style.color = 'var(--error)';
    setTimeout(() => {
        msg.textContent = originalText;
        msg.style.color = '';
    }, 5000);
}

// --- Auth Functions ---

async function handleAuth(isLogin = true) {
    const client = getSupabase();
    if (!client) return;
    const email = document.getElementById('email')?.value.trim();
    const password = document.getElementById('password').value;
    
    if (!email || !password) {
        showAuthMessage('Please enter both email and password');
        return;
    }

    try {
        if (isLogin) {
            const { data, error } = await client.auth.signInWithPassword({ email, password });
            if (error) throw error;
            if (data.user) {
                showAuthMessage('Login successful!', false);
                setTimeout(() => window.location.href = 'files.html', 1000);
            }
        } else {
            const { data, error } = await client.auth.signUp({ 
                email, 
                password,
                options: { emailRedirectTo: window.location.origin }
            });
            if (error) throw error;
            if (data.user?.identities?.length === 0) {
                showAuthMessage('This email is already registered. Please log in.');
            } else {
                showAuthMessage('Account created! Check your email for verification.', false);
            }
        }
    } catch (error) {
        console.error('Auth error:', error);
        showAuthMessage(error.message);
    }
}

async function checkAuth() {
    const client = getSupabase();
    if (!client) return false;
    try {
        const { data: { user }, error } = await client.auth.getUser();
        if (error || !user) {
            if (window.location.pathname.includes('files.html')) {
                window.location.href = 'index.html';
            }
            return false;
        }
        currentUser = user;
        return true;
    } catch (error) {
        console.error('Auth check error:', error);
        if (window.location.pathname.includes('files.html')) {
            window.location.href = 'index.html';
        }
        return false;
    }
}

async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
}

// --- File Management Functions ---

function getFileIcon(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    const icons = {
        pdf: 'file-pdf',
        doc: 'file-word', docx: 'file-word',
        xls: 'file-excel', xlsx: 'file-excel',
        ppt: 'file-powerpoint', pptx: 'file-powerpoint',
        jpg: 'file-image', jpeg: 'file-image', png: 'file-image', gif: 'file-image', svg: 'file-image',
        mp3: 'file-audio', wav: 'file-audio',
        mp4: 'file-video', mov: 'file-video', webm: 'file-video',
        zip: 'file-archive', rar: 'file-archive', '7z': 'file-archive',
        txt: 'file-alt', html: 'file-code', js: 'file-code', css: 'file-code',
        default: 'file'
    };
    return icons[ext] || icons.default;
}

function createFileCard(file) {
    const fileIcon = getFileIcon(file.name);
    const size = file.metadata ? file.metadata.size : 0;
    const date = file.created_at || new Date().toISOString();
    
    return `
        <div class="file-card reveal" data-file-path="${file.name}">
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                <i class="fas fa-${fileIcon} fa-2x" style="color: var(--accent);"></i>
                <div style="overflow: hidden; flex: 1;">
                    <div style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${file.name}">${file.name}</div>
                    <div style="color: var(--muted); font-size: 0.875rem;">${formatFileSize(size)}</div>
                </div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; color: var(--muted); font-size: 0.875rem;">
                <span>${formatDate(date)}</span>
                <div style="display: flex; gap: 4px;">
                    <button class="preview-btn" title="Preview" style="padding: 6px 10px; background: rgba(255,255,255,0.05); color: var(--text); border: 1px solid var(--border);"><i class="fas fa-eye"></i></button>
                    <button class="download-btn" title="Download" style="padding: 6px 10px; background: rgba(255,255,255,0.05); color: var(--text); border: 1px solid var(--border);"><i class="fas fa-download"></i></button>
                    <button class="delete-btn" title="Delete" style="padding: 6px 10px; background: rgba(255,255,255,0.05); color: var(--error); border: 1px solid var(--border);"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        </div>
    `;
}

async function loadFiles(searchQuery = '', sortBy = 'name-asc') {
    if (!await checkAuth()) return;

    const filesList = document.getElementById('files-list');
    if (!filesList) return;

    try {
        // Try proxy list first if available
        let result;
        if (isBackendAvailable) {
            try {
                const response = await fetch(`api/list-proxy?userId=${currentUser.id}`);
                const contentType = response.headers.get("content-type");
                if (response.ok && contentType && contentType.includes("application/json")) {
                    result = await response.json();
                } else {
                    isBackendAvailable = false;
                }
            } catch (e) {
                console.warn('Proxy call failed, trying direct:', e);
                isBackendAvailable = false;
            }
        }

        if (!result || !result.success) {
            console.log('Using direct Supabase list...');
            const client = getSupabase();
            if (!client) throw new Error('Supabase client not ready');
            const { data, error } = await client.storage
                .from(STORAGE_BUCKET)
                .list(currentUser.id, {
                    limit: 100,
                    offset: 0,
                    sortBy: { column: 'name', order: 'asc' }
                });
            if (error) throw error;
            result = { success: true, data };
        }

        currentFiles = result.data || [];
        
        // Filter by search query
        let filteredFiles = currentFiles.filter(file => 
            file.name.toLowerCase().includes(searchQuery.toLowerCase())
        );

        // Sort files
        const [sortField, sortOrder] = sortBy.split('-');
        filteredFiles.sort((a, b) => {
            let comparison;
            switch (sortField) {
                case 'name':
                    comparison = a.name.localeCompare(b.name);
                    break;
                case 'date':
                    comparison = new Date(a.created_at || 0) - new Date(b.created_at || 0);
                    break;
                case 'size':
                    comparison = (a.metadata?.size || 0) - (b.metadata?.size || 0);
                    break;
                default:
                    comparison = 0;
            }
            return sortOrder === 'desc' ? -comparison : comparison;
        });

        if (filteredFiles.length === 0) {
            filesList.innerHTML = `
                <div class="reveal" style="grid-column: 1/-1; text-align: center; padding: 48px; color: var(--muted);">
                    <i class="fas fa-folder-open fa-4x" style="margin-bottom: 16px; opacity: 0.5;"></i>
                    <p>${searchQuery ? 'No files match your search' : 'Your storage is empty'}</p>
                </div>`;
            return;
        }

        filesList.innerHTML = filteredFiles.map(createFileCard).join('');

        // Attach event listeners
        filesList.querySelectorAll('.preview-btn').forEach(btn => 
            btn.addEventListener('click', () => handlePreview(btn.closest('.file-card').dataset.filePath))
        );
        filesList.querySelectorAll('.download-btn').forEach(btn => 
            btn.addEventListener('click', () => handleDownload(btn.closest('.file-card').dataset.filePath))
        );
        filesList.querySelectorAll('.delete-btn').forEach(btn => 
            btn.addEventListener('click', () => handleDelete(btn.closest('.file-card').dataset.filePath))
        );
    } catch (error) {
        console.error('Load files error:', error);
        filesList.innerHTML = `<div style="grid-column: 1/-1; color: var(--error); text-align: center;">Error loading files: ${error.message}</div>`;
    }
}

async function handlePreview(fileName) {
    const modal = document.getElementById('preview-modal');
    const content = document.getElementById('preview-content');
    const filenameLabel = document.getElementById('preview-filename');
    const downloadBtn = document.getElementById('preview-download');
    const deleteBtn = document.getElementById('preview-delete');

    filenameLabel.textContent = fileName;
    content.innerHTML = '<div style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin fa-2x"></i><p>Loading preview...</p></div>';
    modal.classList.add('active');

    try {
        let url;
        if (isBackendAvailable) {
            try {
                const response = await fetch('api/sign-proxy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        filePath: `${currentUser.id}/${fileName}`,
                        expiresIn: 300
                    })
                });
                const result = await response.json();
                if (result.success) url = result.signedUrl;
            } catch (e) {
                console.warn('Proxy sign failed, trying direct:', e);
            }
        }

        if (!url) {
            console.log('Using direct Supabase sign...');
            const client = getSupabase();
            if (!client) throw new Error('Supabase client not ready');
            const { data, error } = await client.storage
                .from(STORAGE_BUCKET)
                .createSignedUrl(`${currentUser.id}/${fileName}`, 300);
            if (error) throw error;
            url = data.signedUrl;
        }
        const ext = fileName.split('.').pop().toLowerCase();

        if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) {
            content.innerHTML = `<img src="${url}" style="max-width: 100%; max-height: 50vh; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">`;
        } else if (['mp4', 'mov', 'webm'].includes(ext)) {
            content.innerHTML = `<video controls style="max-width: 100%; border-radius: 8px;"><source src="${url}"></video>`;
        } else if (['mp3', 'wav', 'ogg'].includes(ext)) {
            content.innerHTML = `<div style="padding: 24px; text-align: center;"><i class="fas fa-music fa-3x" style="color: var(--accent); margin-bottom: 16px;"></i><audio controls style="width: 100%;"><source src="${url}"></audio></div>`;
        } else if (ext === 'pdf') {
            content.innerHTML = `<iframe src="${url}" style="width: 100%; height: 50vh; border: none; border-radius: 8px;"></iframe>`;
        } else {
            content.innerHTML = `
                <div style="padding: 40px; text-align: center; background: rgba(255,255,255,0.03); border-radius: 8px;">
                    <i class="fas fa-${getFileIcon(fileName)} fa-4x" style="color: var(--accent); opacity: 0.8; margin-bottom: 16px;"></i>
                    <p>Preview not supported for this file type.</p>
                </div>`;
        }

        downloadBtn.onclick = () => window.open(url, '_blank');
        deleteBtn.onclick = () => {
            modal.classList.remove('active');
            handleDelete(fileName);
        };
    } catch (error) {
        console.error('Preview error:', error);
        content.innerHTML = `<div style="color: var(--error);">Failed to load preview: ${error.message}</div>`;
    }
}

async function handleDownload(fileName) {
    try {
        let url;
        if (isBackendAvailable) {
            try {
                const response = await fetch('api/sign-proxy', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        filePath: `${currentUser.id}/${fileName}`,
                        expiresIn: 60
                    })
                });
                const result = await response.json();
                if (result.success) url = result.signedUrl;
            } catch (e) {
                console.warn('Proxy download failed, trying direct:', e);
            }
        }

        if (!url) {
            console.log('Using direct Supabase download...');
            const client = getSupabase();
            if (!client) throw new Error('Supabase client not ready');
            const { data, error } = await client.storage
                .from(STORAGE_BUCKET)
                .download(`${currentUser.id}/${fileName}`);
            if (error) throw error;
            url = URL.createObjectURL(data);
        }

        // Open the URL for download
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Download error:', error);
        alert('Download failed: ' + error.message);
    }
}

async function handleDelete(fileName) {
    const modal = document.getElementById('delete-modal');
    const filenameLabel = document.getElementById('delete-filename');
    const confirmBtn = document.getElementById('confirm-delete');
    const cancelBtn = document.getElementById('cancel-delete');

    filenameLabel.textContent = fileName;
    modal.classList.add('active');

    confirmBtn.onclick = async () => {
        confirmBtn.disabled = true;
        confirmBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
        try {
            let deleted = false;
            if (isBackendAvailable) {
                try {
                    const response = await fetch('api/delete-proxy', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ filePath: `${currentUser.id}/${fileName}` })
                    });
                    const result = await response.json();
                    if (result.success) deleted = true;
                } catch (e) {
                    console.warn('Proxy delete failed, trying direct:', e);
                }
            }

            if (!deleted) {
                console.log('Using direct Supabase delete...');
                const client = getSupabase();
                if (!client) throw new Error('Supabase client not ready');
                const { error } = await client.storage
                    .from(STORAGE_BUCKET)
                    .remove([`${currentUser.id}/${fileName}`]);
                if (error) throw error;
            }

            modal.classList.remove('active');
            loadFiles(document.getElementById('search-input')?.value || '');
        } catch (error) {
            console.error('Delete error:', error);
            alert('Delete failed: ' + error.message);
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Delete';
        }
    };

    cancelBtn.onclick = () => modal.classList.remove('active');
}

// --- Upload Functions ---

function createProgressElement(file) {
    return `
        <div class="file-progress" data-file-progress="${file.name}" style="margin-bottom: 16px; padding: 12px; background: rgba(255,255,255,0.03); border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 8px; overflow: hidden;">
                    <i class="fas fa-${getFileIcon(file.name)}"></i>
                    <span style="font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${file.name}</span>
                </div>
                <span class="progress-percentage">0%</span>
            </div>
            <div class="progress-bar">
                <div class="progress-fill" style="width: 0%"></div>
            </div>
        </div>
    `;
}

async function handleUpload(files) {
    if (!await checkAuth()) return;
    if (!files || files.length === 0) return;

    const progressSection = document.getElementById('upload-progress-section');
    const progressList = document.getElementById('upload-progress-list');
    
    if (progressSection && progressList) {
        progressSection.style.display = 'block';
        files = Array.from(files);
        progressList.innerHTML += files.map(createProgressElement).join('');
    }

    const uploadPromises = Array.from(files).map(async file => {
        try {
            let uploaded = false;
            if (isBackendAvailable) {
                try {
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('userId', currentUser.id);

                    const response = await fetch('api/upload-proxy', {
                        method: 'POST',
                        body: formData
                    });
                    const result = await response.json();
                    if (result.success) uploaded = true;
                } catch (e) {
                    console.warn('Proxy upload failed, trying direct:', e);
                }
            }

            if (!uploaded) {
                console.log('Using direct Supabase upload...');
                const client = getSupabase();
                if (!client) throw new Error('Supabase client not ready');
                const { error } = await client.storage
                    .from(STORAGE_BUCKET)
                    .upload(`${currentUser.id}/${file.name}`, file, {
                        cacheControl: '3600',
                        upsert: true
                    });
                if (error) throw error;
            }
            
            // Success: update progress to 100% and then remove after delay
            const progEl = document.querySelector(`[data-file-progress="${file.name}"]`);
            if (progEl) {
                progEl.querySelector('.progress-percentage').textContent = '100%';
                progEl.querySelector('.progress-fill').style.width = '100%';
                progEl.querySelector('.progress-fill').style.background = 'var(--success)';
                setTimeout(() => {
                    progEl.style.opacity = '0';
                    progEl.style.transform = 'translateX(20px)';
                    progEl.style.transition = 'all 0.5s ease';
                    setTimeout(() => {
                        progEl.remove();
                        if (progressList && progressList.children.length === 0) {
                            progressSection.style.display = 'none';
                        }
                    }, 500);
                }, 1000);
            }
        } catch (error) {
            console.error(`Upload error (${file.name}):`, error);
            const progEl = document.querySelector(`[data-file-progress="${file.name}"]`);
            if (progEl) {
                progEl.querySelector('.progress-percentage').textContent = 'Error';
                progEl.querySelector('.progress-fill').style.background = 'var(--error)';
                progEl.style.color = 'var(--error)';
            }
        }
    });

    await Promise.all(uploadPromises);
    loadFiles(document.getElementById('search-input')?.value || '');
}

// --- Initialization ---

document.addEventListener('DOMContentLoaded', async () => {
    // Auth Page Elements
    const authForm = document.getElementById('auth-section');
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    
    if (authForm && loginBtn && signupBtn) {
        loginBtn.addEventListener('click', () => handleAuth(true));
        signupBtn.addEventListener('click', () => handleAuth(false));
        
        const passwordInput = document.getElementById('password');
        if (passwordInput) {
            passwordInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleAuth(true);
            });
        }
        return;
    }

    // Files Page Elements
    if (!await checkAuth()) return;

    // Search
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                loadFiles(e.target.value, document.getElementById('sort-select')?.value || 'name-asc');
            }, 300);
        });
    }

    // Sort
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            loadFiles(document.getElementById('search-input')?.value || '', e.target.value);
        });
    }

    // Upload functionality
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const browseBtn = document.getElementById('browse-btn');
    
    if (uploadArea && fileInput && browseBtn) {
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });
        uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            handleUpload(e.dataTransfer.files);
        });
        browseBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => handleUpload(fileInput.files));
    }

    // Modals
    const closePreviewBtn = document.getElementById('close-preview');
    const previewModal = document.getElementById('preview-modal');
    if (closePreviewBtn && previewModal) {
        closePreviewBtn.addEventListener('click', () => previewModal.classList.remove('active'));
        previewModal.addEventListener('click', (e) => {
            if (e.target === previewModal) previewModal.classList.remove('active');
        });
    }

    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    // Initial check for backend and load files
    await checkBackend();
    loadFiles();
});
