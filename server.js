const express = require('express');
const multer = require('multer');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const port = 3000;

// Initialize Supabase Admin Client
const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Setup Multer for memory storage
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Proxy Upload Endpoint
app.post('/api/upload-proxy', upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        const userId = req.body.userId;
        const bucketName = 'user-files';

        if (!file || !userId) {
            return res.status(400).json({ error: 'Missing file or userId' });
        }

        console.log(`Proxy uploading: ${file.originalname} for user: ${userId}`);

        const filePath = `${userId}/${file.originalname}`;
        
        const { data, error } = await supabaseAdmin.storage
            .from(bucketName)
            .upload(filePath, file.buffer, {
                contentType: file.mimetype,
                upsert: true
            });

        if (error) {
            console.error('Supabase upload error:', error);
            return res.status(500).json({ error: error.message });
        }

        res.json({ success: true, data });
    } catch (err) {
        console.error('Proxy upload exception:', err);
        res.status(500).json({ error: err.message });
    }
});

// Proxy List Endpoint (to avoid RLS issues for listing as well)
app.get('/api/list-proxy', async (req, res) => {
    try {
        const userId = req.query.userId;
        const bucketName = 'user-files';

        if (!userId) {
            return res.status(400).json({ error: 'Missing userId' });
        }

        console.log(`Proxy listing files for user: ${userId}`);

        const { data, error } = await supabaseAdmin.storage
            .from(bucketName)
            .list(userId, {
                limit: 100,
                offset: 0,
                sortBy: { column: 'name', order: 'asc' }
            });

        if (error) {
            console.error('Supabase list error:', error);
            return res.status(500).json({ error: error.message });
        }

        res.json({ success: true, data });
    } catch (err) {
        console.error('Proxy list exception:', err);
        res.status(500).json({ error: err.message });
    }
});

// Proxy Signed URL Endpoint
app.post('/api/sign-proxy', async (req, res) => {
    try {
        const { filePath, expiresIn } = req.body;
        const bucketName = 'user-files';

        if (!filePath) {
            return res.status(400).json({ error: 'Missing filePath' });
        }

        console.log(`Proxy creating signed URL for: ${filePath}`);

        const { data, error } = await supabaseAdmin.storage
            .from(bucketName)
            .createSignedUrl(filePath, expiresIn || 300);

        if (error) {
            console.error('Supabase sign error:', error);
            return res.status(500).json({ error: error.message });
        }

        res.json({ success: true, signedUrl: data.signedUrl });
    } catch (err) {
        console.error('Proxy sign exception:', err);
        res.status(500).json({ error: err.message });
    }
});

// Proxy Delete Endpoint
app.post('/api/delete-proxy', async (req, res) => {
    try {
        const { filePath } = req.body;
        const bucketName = 'user-files';

        if (!filePath) {
            return res.status(400).json({ error: 'Missing filePath' });
        }

        console.log(`Proxy deleting: ${filePath}`);

        const { data, error } = await supabaseAdmin.storage
            .from(bucketName)
            .remove([filePath]);

        if (error) {
            console.error('Supabase delete error:', error);
            return res.status(500).json({ error: error.message });
        }

        res.json({ success: true, data });
    } catch (err) {
        console.error('Proxy delete exception:', err);
        res.status(500).json({ error: err.message });
    }
});

app.listen(port, () => {
    console.log(`🚀 Premium Server running at http://localhost:${port}/`);
    console.log('📁 Backend Proxy Active (Bypassing RLS for Uploads/List)');
});
