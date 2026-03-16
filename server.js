// ═══════════════════════════════════════════════════════
//  Drive Uploader — Local Server (Express + Multer)
// ═══════════════════════════════════════════════════════
//
//  วิธีใช้:
//  1. npm install
//  2. node server.js
//  3. เปิด http://localhost:3000
//
//  เปิดให้คนอื่นเข้า:
//  → ngrok http 3000
//
// ═══════════════════════════════════════════════════════

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');

const app = express();
const PORT = 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ── Multer: กำหนดที่เก็บไฟล์ ──
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const folderName = req.body.folderName || 'Uploads';
    const safe = folderName.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'Uploads';
    const folderPath = path.join(UPLOAD_DIR, safe);
    if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
    cb(null, folderPath);
  },
  filename: function (req, file, cb) {
    // แก้ชื่อไฟล์ภาษาไทย/Unicode
    const original = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const safe = original.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
    const ext = path.extname(safe);
    const base = path.basename(safe, ext);

    // ถ้าซ้ำ → เพิ่มเลข
    const dir = req.body.folderName || 'Uploads';
    const dirSafe = dir.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'Uploads';
    const folderPath = path.join(UPLOAD_DIR, dirSafe);
    let finalName = safe;
    let filePath = path.join(folderPath, finalName);
    let n = 1;
    while (fs.existsSync(filePath)) {
      finalName = base + '_' + n + ext;
      filePath = path.join(folderPath, finalName);
      n++;
    }
    cb(null, finalName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: Infinity } // ไม่จำกัดขนาด
});

// ── Routes ──

// หน้าเว็บ
app.get('/', (req, res) => {
  res.send(HTML_PAGE);
});

// อัปโหลดไฟล์
app.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.json({ success: false, error: 'ไม่พบไฟล์' });
    }
    const folder = req.body.folderName || 'Uploads';
    const fileName = req.file.filename;
    const fileSize = req.file.size;

    console.log(`  ✅ ${fileName} (${fmtSize(fileSize)}) → ${folder}/`);

    res.json({
      success: true,
      fileName: fileName,
      fileSize: fileSize,
      folder: folder
    });
  } catch (err) {
    console.error('  ❌ Error:', err.message);
    res.json({ success: false, error: err.message });
  }
});

// Error handler สำหรับ multer
app.use('/upload', (err, req, res, next) => {
  console.error('  ❌ Upload Error:', err.message);
  res.json({ success: false, error: err.message });
});

// ── File Browser API ──

// ดึงรายการโฟลเดอร์และไฟล์ทั้งหมด
app.get('/api/files', (req, res) => {
  try {
    const folder = req.query.folder || '';

    // ถ้าไม่ระบุโฟลเดอร์ → แสดงรายการโฟลเดอร์ทั้งหมด
    if (!folder) {
      if (!fs.existsSync(UPLOAD_DIR)) {
        console.log('  📁 uploads/ ยังไม่มี');
        return res.json({ folders: [], files: [] });
      }
      let items;
      try { items = fs.readdirSync(UPLOAD_DIR, { withFileTypes: true }); }
      catch(e) { console.error('  ❌ อ่านโฟลเดอร์ไม่ได้:', e.message); return res.json({ folders: [], files: [] }); }

      const folders = [];
      for (const item of items) {
        if (!item.isDirectory()) continue;
        try {
          const folderPath = path.join(UPLOAD_DIR, item.name);
          const dirFiles = fs.readdirSync(folderPath);
          let fileCount = 0, totalSize = 0;
          for (const f of dirFiles) {
            try {
              const st = fs.statSync(path.join(folderPath, f));
              if (st.isFile()) { fileCount++; totalSize += st.size; }
            } catch(e) { /* ข้ามไฟล์ที่อ่านไม่ได้ */ }
          }
          folders.push({ name: item.name, fileCount, totalSize });
        } catch(e) { /* ข้ามโฟลเดอร์ที่อ่านไม่ได้ */ }
      }

      console.log('  📁 โฟลเดอร์ทั้งหมด:', folders.length);
      return res.json({ folders, files: [], uploadPath: path.resolve(UPLOAD_DIR) });
    }

    // แสดงไฟล์ในโฟลเดอร์ (ไม่ sanitize ซ้ำ เพราะชื่อจริงบน disk อาจต่างจาก sanitize)
    // ลองหาโฟลเดอร์จากชื่อตรงๆ ก่อน ถ้าไม่เจอค่อย sanitize
    let targetDir = path.join(UPLOAD_DIR, folder);
    if (!fs.existsSync(targetDir)) {
      targetDir = path.join(UPLOAD_DIR, sanitize(folder));
    }
    if (!fs.existsSync(targetDir)) {
      console.log('  ❌ ไม่พบโฟลเดอร์:', folder);
      return res.json({ folders: [], files: [] });
    }

    let items;
    try { items = fs.readdirSync(targetDir, { withFileTypes: true }); }
    catch(e) { return res.json({ folders: [], files: [] }); }

    const files = [];
    for (const item of items) {
      if (!item.isFile()) continue;
      try {
        const st = fs.statSync(path.join(targetDir, item.name));
        files.push({
          name: item.name,
          size: st.size,
          modified: st.mtime,
          type: getFileType(item.name)
        });
      } catch(e) { /* ข้ามไฟล์ที่อ่านไม่ได้ */ }
    }
    files.sort((a, b) => new Date(b.modified) - new Date(a.modified));

    console.log('  📂', folder, '→', files.length, 'ไฟล์');
    return res.json({ folders: [], files, folderName: folder, uploadPath: path.resolve(targetDir) });
  } catch (err) {
    console.error('  ❌ /api/files error:', err.message);
    return res.json({ folders: [], files: [], error: err.message });
  }
});

// ดาวน์โหลดไฟล์
app.get('/download/:folder/:file', (req, res) => {
  // ลองชื่อตรงก่อน ถ้าไม่เจอค่อย sanitize
  let filePath = path.join(UPLOAD_DIR, req.params.folder, req.params.file);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(UPLOAD_DIR, sanitize(req.params.folder), sanitize(req.params.file));
  }
  if (!fs.existsSync(filePath)) return res.status(404).send('File not found');
  res.download(filePath);
});

// ดูไฟล์ในเบราว์เซอร์ (รูปภาพ/วิดีโอ)
app.get('/preview/:folder/:file', (req, res) => {
  let filePath = path.join(UPLOAD_DIR, req.params.folder, req.params.file);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(UPLOAD_DIR, sanitize(req.params.folder), sanitize(req.params.file));
  }
  if (!fs.existsSync(filePath)) return res.status(404).send('File not found');
  res.sendFile(filePath);
});

// ลบไฟล์
app.delete('/api/files/:folder/:file', (req, res) => {
  try {
    let filePath = path.join(UPLOAD_DIR, req.params.folder, req.params.file);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(UPLOAD_DIR, sanitize(req.params.folder), sanitize(req.params.file));
    }
    if (!fs.existsSync(filePath)) return res.json({ success: false, error: 'ไม่พบไฟล์' });
    fs.unlinkSync(filePath);
    console.log('  🗑️ ลบ:', req.params.folder + '/' + req.params.file);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// ลบโฟลเดอร์ทั้งโฟลเดอร์
app.delete('/api/folder/:folder', (req, res) => {
  try {
    let folderPath = path.join(UPLOAD_DIR, req.params.folder);
    if (!fs.existsSync(folderPath)) {
      folderPath = path.join(UPLOAD_DIR, sanitize(req.params.folder));
    }
    if (!fs.existsSync(folderPath)) return res.json({ success: false, error: 'ไม่พบโฟลเดอร์' });
    fs.rmSync(folderPath, { recursive: true, force: true });
    console.log('  🗑️ ลบโฟลเดอร์:', req.params.folder);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// หน้า File Browser
app.get('/files', (req, res) => {
  res.send(FILES_PAGE);
});

function getFileType(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (['.jpg','.jpeg','.png','.gif','.webp','.svg','.bmp'].includes(ext)) return 'image';
  if (['.mp4','.avi','.mov','.mkv','.webm','.wmv'].includes(ext)) return 'video';
  if (['.mp3','.wav','.ogg','.flac','.aac'].includes(ext)) return 'audio';
  if (['.pdf'].includes(ext)) return 'pdf';
  if (['.doc','.docx','.xls','.xlsx','.ppt','.pptx','.txt','.csv'].includes(ext)) return 'document';
  if (['.zip','.rar','.7z','.tar','.gz'].includes(ext)) return 'archive';
  return 'other';
}

function fmtSize(b) {
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
  return (b / 1073741824).toFixed(1) + ' GB';
}

app.listen(PORT, () => {
  const nets = os.networkInterfaces();
  let localIP = 'localhost';
  for (const ifaces of Object.values(nets)) {
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) { localIP = iface.address; break; }
    }
  }
  console.log('');
  console.log('  ╔══════════════════════════════════════════╗');
  console.log('  ║        ☁️  Drive Uploader Server          ║');
  console.log('  ╠══════════════════════════════════════════╣');
  console.log(`  ║  Local:   http://localhost:${PORT}           ║`);
  console.log(`  ║  Network: http://${localIP}:${PORT}    ║`);
  console.log('  ║                                          ║');
  console.log('  ║  ไฟล์บันทึกที่: ./uploads/               ║');
  console.log('  ║  ngrok: ngrok http 3000                  ║');
  console.log('  ╚══════════════════════════════════════════╝');
  console.log('');
});

// ══════════════════════════════════════════════════════
//  HTML
// ══════════════════════════════════════════════════════
const HTML_PAGE = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Drive Uploader</title>
  <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    ::selection{background:#2563eb;color:#fff}
    html,body{min-height:100vh;background:linear-gradient(160deg,#eff6ff 0%,#dbeafe 40%,#e0f2fe 100%);font-family:'Prompt',sans-serif;color:#1e293b}
    input::placeholder{color:#94a3b8}
    @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
    @keyframes pop{0%{transform:scale(.9);opacity:0}100%{transform:scale(1);opacity:1}}
    .card{animation:fadeUp .5s ease-out both}
    .drop-zone{border:2px dashed #93c5fd;border-radius:18px;padding:40px 20px;text-align:center;cursor:pointer;transition:all .25s}
    .drop-zone:hover{border-color:#3b82f6;background:rgba(59,130,246,0.04)}
    .drop-zone.active{border-color:#2563eb!important;background:rgba(59,130,246,0.08)!important}
    .btn{border:none;cursor:pointer;font-family:'Prompt',sans-serif;font-weight:600;transition:all .2s;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;gap:8px}
    .btn-main{background:linear-gradient(135deg,#2563eb 0%,#3b82f6 50%,#2563eb 100%);background-size:200% 100%;color:#fff;padding:14px;width:100%;font-size:15px}
    .btn-main:hover:not(:disabled){background-position:100% 0;box-shadow:0 8px 32px rgba(37,99,235,.3);transform:translateY(-1px)}
    .btn-main:disabled{opacity:.45;cursor:not-allowed;transform:none;box-shadow:none}
    .btn-ghost{background:transparent;border:1.5px solid #bfdbfe;color:#64748b;padding:8px 18px;font-size:13px}
    .btn-ghost:hover{border-color:#3b82f6;color:#2563eb}
    .progress-track{height:6px;background:#dbeafe;border-radius:6px;overflow:hidden}
    .progress-fill{height:100%;border-radius:6px;background:linear-gradient(90deg,#2563eb,#3b82f6,#2563eb);background-size:200% 100%;animation:shimmer 1.5s linear infinite;transition:width .3s ease}
    .tag{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:500;white-space:nowrap}
    .tag-ok{background:#dcfce7;color:#16a34a}
    .tag-fail{background:#fee2e2;color:#dc2626}
    .tag-up{background:#dbeafe;color:#2563eb}
    .folder-input{width:100%;padding:13px 16px;font-size:15px;background:#fff;border:1.5px solid #bfdbfe;border-radius:12px;color:#1e293b;outline:none;transition:border-color .2s,box-shadow .2s;font-family:'Prompt',sans-serif}
    .folder-input:focus{border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.15)}
    .file-list{max-height:280px;overflow-y:auto}
    .file-list::-webkit-scrollbar{width:4px}
    .file-list::-webkit-scrollbar-track{background:transparent}
    .file-list::-webkit-scrollbar-thumb{background:#bfdbfe;border-radius:10px}
    .file-row{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;margin-bottom:5px;background:rgba(255,255,255,0.7);animation:fadeUp .3s ease-out both}
    .file-thumb{width:40px;height:40px;border-radius:8px;object-fit:cover;border:1px solid #bfdbfe;flex-shrink:0}
    .file-icon{width:40px;height:40px;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:20px;background:#eff6ff;border:1px solid #bfdbfe;flex-shrink:0}
    .file-name{font-size:13px;font-weight:500;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .file-size{font-size:11px;color:#64748b}
    .remove-btn{background:none;border:none;color:#94a3b8;cursor:pointer;font-size:18px;padding:2px 6px;border-radius:6px;transition:color .2s;flex-shrink:0}
    .remove-btn:hover{color:#dc2626}
    .spinner{width:12px;height:12px;border:2px solid #3b82f6;border-top-color:transparent;border-radius:50%;animation:spin .7s linear infinite;display:inline-block}
    .spinner-lg{width:16px;height:16px;border:2px solid rgba(255,255,255,.4);border-top-color:#fff;border-radius:50%;animation:spin .8s linear infinite;display:inline-block}
    .error-box{padding:10px 14px;border-radius:12px;margin-bottom:18px;background:#fee2e2;border:1px solid #fca5a5;color:#dc2626;font-size:13px;line-height:1.6}
    .result-box{padding:22px;border-radius:16px;background:#f0fdf4;border:1px solid #bbf7d0;animation:pop .35s ease-out}
    .hidden{display:none!important}
  </style>
</head>
<body>

<div style="padding:36px 24px 0;max-width:600px;margin:0 auto;">
  <div style="display:flex;align-items:center;gap:14px;">
    <div style="width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#2563eb,#3b82f6);display:flex;align-items:center;justify-content:center;font-size:24px;box-shadow:0 6px 24px rgba(37,99,235,.25);">☁️</div>
    <div>
      <h1 style="font-size:24px;font-weight:700;letter-spacing:-.03em;background:linear-gradient(135deg,#1e40af 20%,#2563eb);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Drive Uploader</h1>
      <p style="font-size:13px;color:#64748b;font-weight:300;">อัปโหลดไฟล์ลงเครื่อง · ไม่จำกัดขนาด · ไม่ต้องล็อกอิน</p>
    </div>
  </div>
</div>

<div class="card" style="max-width:600px;margin:24px auto 32px;padding:28px;background:rgba(255,255,255,0.85);backdrop-filter:blur(24px);border-radius:22px;border:1px solid #bfdbfe;box-shadow:0 8px 40px rgba(37,99,235,.08);">

  <div style="margin-bottom:22px;">
    <label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:500;color:#475569;margin-bottom:8px;">
      <span style="font-size:16px;">📁</span> ชื่อโฟลเดอร์ปลายทาง
    </label>
    <input id="folderName" type="text" class="folder-input" placeholder="เช่น เอกสารโปรเจกต์ 2026">
    <p style="font-size:11px;color:#94a3b8;margin:6px 0 0 4px;">ไฟล์จะถูกบันทึกที่ ./uploads/ชื่อโฟลเดอร์/</p>
  </div>

  <div id="dropZone" class="drop-zone" style="margin-bottom:22px;">
    <input id="fileInput" type="file" multiple style="display:none">
    <div style="font-size:44px;margin-bottom:8px;opacity:.7;">📂</div>
    <p style="font-weight:500;font-size:15px;color:#2563eb;">ลากไฟล์มาวางที่นี่</p>
    <p style="font-size:13px;color:#94a3b8;margin-top:6px;">หรือคลิกเพื่อเลือก · ทุกประเภท ไม่จำกัดขนาด</p>
  </div>

  <div id="fileListHeader" class="hidden">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding:0 2px;">
      <span id="fileCount" style="font-size:13px;color:#475569;font-weight:500;"></span>
      <button id="clearAllBtn" class="btn btn-ghost" style="padding:4px 12px;font-size:12px;">ล้างทั้งหมด</button>
    </div>
  </div>
  <div id="fileList" class="file-list" style="margin-bottom:22px;"></div>

  <div id="progressSection" class="hidden" style="margin-bottom:20px;">
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
      <span id="progressText" style="font-size:13px;color:#2563eb;"></span>
      <span id="progressPercent" style="font-size:20px;font-weight:700;color:#2563eb;"></span>
    </div>
    <div class="progress-track">
      <div id="progressBar" class="progress-fill" style="width:0%;"></div>
    </div>
    <div id="progressDetail" style="font-size:11px;color:#64748b;margin-top:6px;"></div>
  </div>

  <div id="errorBox" class="error-box hidden"></div>
  <button id="uploadBtn" class="btn btn-main" disabled>อัปโหลด</button>

  <div id="resultBox" class="result-box hidden">
    <div style="text-align:center;margin-bottom:16px;">
      <div id="resultEmoji" style="font-size:44px;margin-bottom:8px;"></div>
      <div id="resultTitle" style="font-size:18px;font-weight:600;"></div>
      <div id="resultSummary" style="font-size:13px;color:#64748b;margin-top:4px;"></div>
    </div>
    <div id="resultList" style="max-height:200px;overflow-y:auto;margin-bottom:16px;"></div>
    <button id="resetBtn" class="btn btn-main" style="font-size:14px;padding:12px;">อัปโหลดชุดใหม่</button>
  </div>
</div>

<div style="text-align:center;padding:0 24px 12px;">
  <a href="/files" style="display:inline-flex;align-items:center;gap:6px;padding:10px 22px;border-radius:12px;font-size:13px;font-weight:500;border:1.5px solid #bfdbfe;background:#fff;color:#2563eb;text-decoration:none;transition:all .2s;">📁 ดูไฟล์ที่อัปโหลดแล้ว</a>
</div>
<div style="text-align:center;padding:8px 24px 36px;font-size:11px;color:#94a3b8;">
  ไฟล์จะถูกบันทึกบนเครื่องเซิร์ฟเวอร์โดยตรง
</div>

<script>
var fileQueue=[], uploading=false;
var $=function(id){return document.getElementById(id);};
var folderInput=$('folderName'), dropZone=$('dropZone'), fileInput=$('fileInput');
var fileListEl=$('fileList'), fileListHdr=$('fileListHeader'), fileCountEl=$('fileCount');
var clearAllBtn=$('clearAllBtn'), uploadBtn=$('uploadBtn');
var progSection=$('progressSection'), progText=$('progressText'), progPct=$('progressPercent');
var progBar=$('progressBar'), progDetail=$('progressDetail');
var errorBox=$('errorBox'), resultBox=$('resultBox');
var resultEmoji=$('resultEmoji'), resultTitle=$('resultTitle');
var resultSummary=$('resultSummary'), resultListEl=$('resultList'), resetBtn=$('resetBtn');

dropZone.addEventListener('click',function(){if(!uploading)fileInput.click();});
dropZone.addEventListener('dragover',function(e){e.preventDefault();dropZone.classList.add('active');});
dropZone.addEventListener('dragleave',function(){dropZone.classList.remove('active');});
dropZone.addEventListener('drop',function(e){e.preventDefault();dropZone.classList.remove('active');if(e.dataTransfer.files.length)addFiles(e.dataTransfer.files);});
fileInput.addEventListener('change',function(){addFiles(fileInput.files);fileInput.value='';});
folderInput.addEventListener('input',function(){hideError();updateUI();});
clearAllBtn.addEventListener('click',function(){fileQueue=[];updateUI();});
uploadBtn.addEventListener('click',function(){handleUpload();});
resetBtn.addEventListener('click',function(){resetAll();});

function addFiles(fl){
  for(var i=0;i<fl.length;i++){
    var f=fl[i], t=f.type.startsWith('image/')?'image':f.type.startsWith('video/')?'video':'document';
    fileQueue.push({file:f,id:rnd(),type:t,status:'pending',error:''});
  }
  updateUI();
}
function removeFile(id){fileQueue=fileQueue.filter(function(f){return f.id!==id;});updateUI();}
function rnd(){return Math.random().toString(36).slice(2);}
function fmtSize(b){
  if(b<1024)return b+' B';
  if(b<1048576)return(b/1024).toFixed(1)+' KB';
  if(b<1073741824)return(b/1048576).toFixed(1)+' MB';
  return(b/1073741824).toFixed(1)+' GB';
}
function typeIcon(t){return t==='image'?'🖼️':t==='video'?'🎬':'📄';}

function updateUI(){
  var v=folderInput.value.trim();
  if(fileQueue.length===0){
    fileListHdr.classList.add('hidden');fileListEl.innerHTML='';
    uploadBtn.textContent='อัปโหลด';
  } else {
    fileListHdr.classList.remove('hidden');
    var ts=fileQueue.reduce(function(s,f){return s+f.file.size;},0);
    fileCountEl.textContent=fileQueue.length+' ไฟล์ · '+fmtSize(ts);
    uploadBtn.textContent='อัปโหลด '+fileQueue.length+' ไฟล์ ('+fmtSize(ts)+')';
    renderList();
  }
  uploadBtn.disabled=uploading||fileQueue.length===0||!v;
}

function renderList(){
  fileListEl.innerHTML='';
  fileQueue.forEach(function(f,i){
    var row=document.createElement('div');row.className='file-row';row.style.animationDelay=(i*.04)+'s';
    var th;
    if(f.type==='image'&&f.status==='pending'){th=document.createElement('img');th.className='file-thumb';th.src=URL.createObjectURL(f.file);}
    else{th=document.createElement('div');th.className='file-icon';th.textContent=typeIcon(f.type);}
    var info=document.createElement('div');info.style.cssText='flex:1;min-width:0;';
    var nm=document.createElement('div');nm.className='file-name';nm.textContent=f.file.name;
    var sz=document.createElement('div');sz.className='file-size';sz.textContent=fmtSize(f.file.size);
    info.appendChild(nm);info.appendChild(sz);
    var st;
    if(f.status==='uploading'){st=document.createElement('span');st.className='tag tag-up';st.innerHTML='<span class="spinner"></span> กำลังส่ง';}
    else if(f.status==='done'){st=document.createElement('span');st.className='tag tag-ok';st.textContent='✓ สำเร็จ';}
    else if(f.status==='error'){st=document.createElement('span');st.className='tag tag-fail';st.textContent='✕ ผิดพลาด';}
    else{st=document.createElement('button');st.className='remove-btn';st.textContent='×';
      (function(id){st.addEventListener('click',function(e){e.stopPropagation();removeFile(id);});})(f.id);}
    row.appendChild(th);row.appendChild(info);row.appendChild(st);
    fileListEl.appendChild(row);
  });
}

// ── Upload ด้วย XHR (ดู progress จริง) ──
function uploadFile(file, folder){
  return new Promise(function(resolve,reject){
    var xhr=new XMLHttpRequest();
    var fd=new FormData();
    fd.append('folderName',folder);
    fd.append('file',file);

    xhr.upload.addEventListener('progress',function(e){
      if(e.lengthComputable){
        var p=Math.round((e.loaded/e.total)*100);
        progDetail.textContent='☁️ '+fmtSize(e.loaded)+' / '+fmtSize(e.total)+' ('+p+'%)';
        // อัปเดต progress bar ของไฟล์นี้
        xhr._filePct=p;
      }
    });
    xhr.addEventListener('load',function(){
      if(xhr.status>=200&&xhr.status<300){
        try{var r=JSON.parse(xhr.responseText);if(r.success)resolve(r);else reject(new Error(r.error||'เซิร์ฟเวอร์ตอบกลับผิดพลาด'));}
        catch(e){reject(new Error('ผลลัพธ์ไม่ถูกต้อง'));}
      } else {reject(new Error('HTTP '+xhr.status));}
    });
    xhr.addEventListener('error',function(){reject(new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'));});
    xhr.addEventListener('timeout',function(){reject(new Error('หมดเวลา'));});
    xhr.timeout=0; // ไม่ timeout
    xhr.open('POST','/upload');
    xhr.send(fd);
  });
}

async function handleUpload(){
  var folder=folderInput.value.trim();
  if(!folder)return showError('กรุณาระบุชื่อโฟลเดอร์');
  if(fileQueue.length===0)return showError('กรุณาเลือกไฟล์');

  hideError();uploading=true;
  progSection.classList.remove('hidden');
  dropZone.style.opacity='0.4';dropZone.style.pointerEvents='none';
  uploadBtn.disabled=true;
  uploadBtn.innerHTML='<span class="spinner-lg"></span> กำลังอัปโหลด...';
  clearAllBtn.style.display='none';

  var total=fileQueue.length,ok=0,results=[];
  var grandSize=fileQueue.reduce(function(s,f){return s+f.file.size;},0)||1;
  var doneSize=0;

  for(var i=0;i<fileQueue.length;i++){
    var f=fileQueue[i];
    f.status='uploading';f.error='';
    renderList();

    progText.textContent='ไฟล์ '+(i+1)+'/'+total+' — '+f.file.name;
    progDetail.textContent='☁️ กำลังเริ่มส่ง...';

    // อัปเดต progress bar ตามน้ำหนักไฟล์จริง
    var basePct=(doneSize/grandSize)*100;
    var fileWeight=(f.file.size/grandSize)*100;

    // Poll XHR progress ทุก 200ms
    var intv=setInterval(function(){
      // ดูจาก progDetail ที่ XHR อัปเดต
      var m=progDetail.textContent.match(/\\((\\d+)%\\)/);
      if(m){
        var fp=parseInt(m[1]);
        var tp=basePct+fileWeight*(fp/100);
        progBar.style.width=Math.round(tp)+'%';
        progPct.textContent=Math.round(tp)+'%';
      }
    },200);

    try{
      var res=await uploadFile(f.file,folder);
      f.status='done';ok++;
      results.push({name:res.fileName||f.file.name,success:true,size:res.fileSize});
    }catch(err){
      f.status='error';f.error=err.message||'ไม่ทราบสาเหตุ';
      results.push({name:f.file.name,success:false,error:f.error});
    }

    clearInterval(intv);
    doneSize+=f.file.size;
    var endPct=(doneSize/grandSize)*100;
    progBar.style.width=Math.round(endPct)+'%';
    progPct.textContent=Math.round(endPct)+'%';
    progDetail.textContent='✅ เสร็จแล้ว';
    renderList();
  }

  progBar.style.width='100%';progPct.textContent='100%';
  uploading=false;

  setTimeout(function(){
    progSection.classList.add('hidden');dropZone.classList.add('hidden');
    fileListHdr.classList.add('hidden');fileListEl.innerHTML='';
    uploadBtn.classList.add('hidden');resultBox.classList.remove('hidden');

    if(ok===total){resultEmoji.textContent='🎉';resultTitle.textContent='อัปโหลดสำเร็จทั้งหมด!';resultTitle.style.color='#16a34a';}
    else if(ok>0){resultEmoji.textContent='⚠️';resultTitle.textContent='อัปโหลดสำเร็จบางส่วน';resultTitle.style.color='#d97706';}
    else{resultEmoji.textContent='❌';resultTitle.textContent='อัปโหลดล้มเหลว';resultTitle.style.color='#dc2626';}
    resultSummary.textContent='สำเร็จ '+ok+'/'+total+' ไฟล์ → โฟลเดอร์ "'+folder+'"';

    resultListEl.innerHTML=results.map(function(r){
      var c=r.success?'#16a34a':'#dc2626',nc=r.success?'#1e293b':'#94a3b8';
      var extra=r.success?'<span style="color:#64748b;font-size:11px;margin-left:auto;">'+fmtSize(r.size)+'</span>'
        :'<span style="color:#dc2626;font-size:11px;margin-left:auto;" title="'+(r.error||'')+'">'+r.error+'</span>';
      return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:13px;">'
        +'<span style="color:'+c+'">'+(r.success?'✓':'✕')+'</span>'
        +'<span style="color:'+nc+';flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+r.name+'</span>'
        +extra+'</div>';
    }).join('');
  },600);
}

function showError(m){errorBox.textContent='⚠️ '+m;errorBox.classList.remove('hidden');}
function hideError(){errorBox.classList.add('hidden');}
function resetAll(){
  fileQueue=[];uploading=false;folderInput.value='';
  resultBox.classList.add('hidden');dropZone.classList.remove('hidden');
  dropZone.style.opacity='1';dropZone.style.pointerEvents='auto';
  uploadBtn.classList.remove('hidden');progSection.classList.add('hidden');
  clearAllBtn.style.display='';hideError();updateUI();
}
</script>
</body>
</html>`;

// ══════════════════════════════════════════════════════
//  File Browser Page
// ══════════════════════════════════════════════════════
const FILES_PAGE = `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>File Browser — Drive Uploader</title>
  <link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    ::selection{background:#2563eb;color:#fff}
    html,body{min-height:100vh;background:linear-gradient(160deg,#eff6ff 0%,#dbeafe 40%,#e0f2fe 100%);font-family:'Prompt',sans-serif;color:#1e293b}
    @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
    @keyframes spin{to{transform:rotate(360deg)}}
    .card{animation:fadeUp .4s ease-out both;max-width:700px;margin:24px auto 32px;padding:28px;background:rgba(255,255,255,0.85);backdrop-filter:blur(24px);border-radius:22px;border:1px solid #bfdbfe;box-shadow:0 8px 40px rgba(37,99,235,.08)}
    a{text-decoration:none;color:#2563eb}
    a:hover{text-decoration:underline}
    .nav{display:flex;align-items:center;gap:10px;margin-bottom:20px;flex-wrap:wrap}
    .nav-btn{display:inline-flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;font-size:13px;font-weight:500;border:1.5px solid #bfdbfe;background:#fff;color:#2563eb;cursor:pointer;transition:all .2s;font-family:'Prompt',sans-serif}
    .nav-btn:hover{background:#eff6ff;border-color:#3b82f6}
    .nav-btn.active{background:#2563eb;color:#fff;border-color:#2563eb}
    .folder-card{display:flex;align-items:center;gap:14px;padding:14px 16px;border-radius:14px;background:#fff;border:1.5px solid #e2e8f0;margin-bottom:8px;cursor:pointer;transition:all .2s;animation:fadeUp .3s ease-out both}
    .folder-card:hover{border-color:#3b82f6;background:#eff6ff;transform:translateY(-1px);box-shadow:0 4px 12px rgba(37,99,235,.08)}
    .file-card{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:12px;background:#fff;border:1px solid #e2e8f0;margin-bottom:6px;animation:fadeUp .3s ease-out both;transition:all .15s}
    .file-card:hover{border-color:#bfdbfe;background:#f8fafc}
    .icon-box{width:42px;height:42px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0}
    .icon-folder{background:#dbeafe}
    .icon-image{background:#fef3c7}
    .icon-video{background:#fce7f3}
    .icon-audio{background:#f3e8ff}
    .icon-pdf{background:#fee2e2}
    .icon-document{background:#dbeafe}
    .icon-archive{background:#e2e8f0}
    .icon-other{background:#f1f5f9}
    .meta{font-size:11px;color:#94a3b8}
    .actions{display:flex;gap:6px;margin-left:auto;flex-shrink:0}
    .act-btn{padding:6px 12px;border-radius:8px;font-size:12px;font-weight:500;border:1px solid #e2e8f0;background:#fff;cursor:pointer;transition:all .15s;font-family:'Prompt',sans-serif;color:#475569}
    .act-btn:hover{background:#f1f5f9}
    .act-btn.dl{color:#2563eb;border-color:#bfdbfe}
    .act-btn.dl:hover{background:#eff6ff}
    .act-btn.del{color:#dc2626;border-color:#fca5a5}
    .act-btn.del:hover{background:#fef2f2}
    .empty{text-align:center;padding:40px 20px;color:#94a3b8;font-size:14px}
    .stats{display:flex;gap:16px;margin-bottom:18px;flex-wrap:wrap}
    .stat-box{padding:12px 18px;border-radius:12px;background:#eff6ff;border:1px solid #bfdbfe;flex:1;min-width:100px}
    .stat-num{font-size:22px;font-weight:700;color:#2563eb}
    .stat-label{font-size:11px;color:#64748b;margin-top:2px}
    .spinner-page{display:flex;align-items:center;justify-content:center;padding:60px;color:#94a3b8;gap:10px}
    .spin{width:20px;height:20px;border:3px solid #bfdbfe;border-top-color:#2563eb;border-radius:50%;animation:spin .7s linear infinite}
    .hidden{display:none!important}
    .confirm-overlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;z-index:999}
    .confirm-box{background:#fff;border-radius:16px;padding:24px;max-width:360px;width:90%;box-shadow:0 16px 48px rgba(0,0,0,.15);text-align:center}
    .confirm-box p{font-size:14px;color:#475569;margin:12px 0 20px}
    .confirm-box .btns{display:flex;gap:10px;justify-content:center}
    .confirm-box .btns button{padding:8px 20px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:'Prompt',sans-serif;border:none}
    .cbtn-cancel{background:#f1f5f9;color:#475569}
    .cbtn-cancel:hover{background:#e2e8f0}
    .cbtn-danger{background:#dc2626;color:#fff}
    .cbtn-danger:hover{background:#b91c1c}
  </style>
</head>
<body>

<div style="padding:36px 24px 0;max-width:700px;margin:0 auto;">
  <div style="display:flex;align-items:center;gap:14px;">
    <div style="width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#2563eb,#3b82f6);display:flex;align-items:center;justify-content:center;font-size:24px;box-shadow:0 6px 24px rgba(37,99,235,.25);">📁</div>
    <div>
      <h1 style="font-size:24px;font-weight:700;letter-spacing:-.03em;background:linear-gradient(135deg,#1e40af 20%,#2563eb);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">File Browser</h1>
      <p style="font-size:13px;color:#64748b;font-weight:300;">ดูและจัดการไฟล์ที่อัปโหลด</p>
    </div>
  </div>
</div>

<div class="card">
  <div class="nav">
    <a href="/"><button class="nav-btn">☁️ อัปโหลด</button></a>
    <button class="nav-btn active">📁 ไฟล์ทั้งหมด</button>
    <div style="flex:1"></div>
    <button id="refreshBtn" class="nav-btn" style="font-size:16px;padding:8px 12px;">🔄</button>
  </div>
  <div id="breadcrumb" style="font-size:14px;color:#64748b;margin-bottom:8px;display:flex;align-items:center;gap:6px;flex-wrap:wrap"></div>
  <div id="pathDisplay" style="font-size:12px;color:#94a3b8;margin-bottom:16px;background:#f1f5f9;padding:8px 14px;border-radius:10px;font-family:'Courier New',monospace;word-break:break-all;display:none;border:1px solid #e2e8f0;">
    <span style="color:#64748b;font-weight:500;">📂 Path:</span> <span id="pathText"></span>
  </div>
  <div id="statsSection" class="stats"></div>
  <div id="loading" class="spinner-page"><div class="spin"></div> กำลังโหลด...</div>
  <div id="content"></div>
</div>

<div id="confirmOverlay" class="confirm-overlay hidden">
  <div class="confirm-box">
    <div style="font-size:32px;">🗑️</div>
    <p id="confirmText"></p>
    <div class="btns">
      <button class="cbtn-cancel" id="confirmCancel">ยกเลิก</button>
      <button class="cbtn-danger" id="confirmOk">ลบ</button>
    </div>
  </div>
</div>

<div style="text-align:center;padding:16px 24px 36px;font-size:11px;color:#94a3b8;">Drive Uploader · File Browser</div>

<script>
var currentFolder='';
var confirmCb=null;

var contentEl=document.getElementById('content');
var loadingEl=document.getElementById('loading');
var breadcrumbEl=document.getElementById('breadcrumb');
var statsEl=document.getElementById('statsSection');
var pathDisplayEl=document.getElementById('pathDisplay');
var pathTextEl=document.getElementById('pathText');
var confirmOverlay=document.getElementById('confirmOverlay');

document.getElementById('refreshBtn').addEventListener('click',function(){loadContent();});
document.getElementById('confirmCancel').addEventListener('click',function(){confirmOverlay.classList.add('hidden');});
document.getElementById('confirmOk').addEventListener('click',function(){confirmOverlay.classList.add('hidden');if(confirmCb)confirmCb();});

function showConfirm(t,cb){document.getElementById('confirmText').textContent=t;confirmCb=cb;confirmOverlay.classList.remove('hidden');}
function fmtSize(b){if(b<1024)return b+' B';if(b<1048576)return(b/1024).toFixed(1)+' KB';if(b<1073741824)return(b/1048576).toFixed(1)+' MB';return(b/1073741824).toFixed(1)+' GB';}
function fmtDate(d){var t=new Date(d);return t.toLocaleDateString('th-TH')+' '+t.toLocaleTimeString('th-TH',{hour:'2-digit',minute:'2-digit'});}
function typeIcon(t){return{image:'🖼️',video:'🎬',audio:'🎵',pdf:'📕',document:'📄',archive:'📦'}[t]||'📎';}

async function loadContent(){
  loadingEl.classList.remove('hidden');contentEl.innerHTML='';statsEl.innerHTML='';
  var url='/api/files'+(currentFolder?'?folder='+encodeURIComponent(currentFolder):'');
  try{
    var res=await fetch(url);var data=await res.json();
    loadingEl.classList.add('hidden');

    if(!currentFolder){
      breadcrumbEl.innerHTML='<span style="color:#2563eb;font-weight:500;">📁 โฟลเดอร์ทั้งหมด</span>';
      if(data.uploadPath){pathTextEl.textContent=data.uploadPath;pathDisplayEl.style.display='block';}else{pathDisplayEl.style.display='none';}
      if(data.folders.length===0){contentEl.innerHTML='<div class="empty">📭 ยังไม่มีไฟล์ที่อัปโหลด<br><br><a href="/" style="font-size:13px;">← กลับไปอัปโหลด</a></div>';return;}
      var tf=data.folders.reduce(function(s,f){return s+f.fileCount;},0);
      var ts=data.folders.reduce(function(s,f){return s+f.totalSize;},0);
      statsEl.innerHTML='<div class="stat-box"><div class="stat-num">'+data.folders.length+'</div><div class="stat-label">โฟลเดอร์</div></div><div class="stat-box"><div class="stat-num">'+tf+'</div><div class="stat-label">ไฟล์ทั้งหมด</div></div><div class="stat-box"><div class="stat-num">'+fmtSize(ts)+'</div><div class="stat-label">ขนาดรวม</div></div>';
      var h='';data.folders.forEach(function(f,i){
        h+='<div class="folder-card" style="animation-delay:'+(i*.04)+'s" onclick="openFolder(this.dataset.name)" data-name="'+f.name.replace(/"/g,'&quot;')+'">';
        h+='<div class="icon-box icon-folder">📁</div><div style="flex:1;min-width:0;"><div style="font-weight:600;font-size:14px;">'+f.name+'</div><div class="meta">'+f.fileCount+' ไฟล์ · '+fmtSize(f.totalSize)+'</div></div>';
        h+='<div class="actions"><button class="act-btn del" onclick="event.stopPropagation();deleteFolder(\''+f.name.replace(/'/g,"\\'")+'\')">🗑️ ลบ</button></div></div>';
      });contentEl.innerHTML=h;
    } else {
      breadcrumbEl.innerHTML='<span style="color:#2563eb;cursor:pointer;font-weight:500;" onclick="goRoot()">📁 ทั้งหมด</span> <span style="color:#cbd5e1">›</span> <span style="font-weight:500;">'+currentFolder+'</span>';
      if(data.uploadPath){pathTextEl.textContent=data.uploadPath;pathDisplayEl.style.display='block';}else{pathDisplayEl.style.display='none';}
      if(data.files.length===0){contentEl.innerHTML='<div class="empty">📭 โฟลเดอร์ว่าง</div>';return;}
      var ts=data.files.reduce(function(s,f){return s+f.size;},0);
      statsEl.innerHTML='<div class="stat-box"><div class="stat-num">'+data.files.length+'</div><div class="stat-label">ไฟล์</div></div><div class="stat-box"><div class="stat-num">'+fmtSize(ts)+'</div><div class="stat-label">ขนาดรวม</div></div>';
      var h='';data.files.forEach(function(f,i){
        var previewUrl='/preview/'+encodeURIComponent(currentFolder)+'/'+encodeURIComponent(f.name);
        var downloadUrl='/download/'+encodeURIComponent(currentFolder)+'/'+encodeURIComponent(f.name);
        var canPreview=(f.type==='image'||f.type==='video'||f.type==='pdf');

        h+='<div class="file-card" style="animation-delay:'+(i*.03)+'s">';

        // thumbnail สำหรับรูป
        if(f.type==='image'){
          h+='<img src="'+previewUrl+'" style="width:42px;height:42px;border-radius:8px;object-fit:cover;border:1px solid #bfdbfe;flex-shrink:0;cursor:pointer;" onclick="showPreview(\''+previewUrl.replace(/'/g,"\\'")+'\',\'image\',\''+f.name.replace(/'/g,"\\'")+'\')">';
        } else {
          h+='<div class="icon-box icon-'+f.type+'">'+typeIcon(f.type)+'</div>';
        }

        h+='<div style="flex:1;min-width:0;"><div style="font-weight:500;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+f.name+'</div><div class="meta">'+fmtSize(f.size)+' · '+fmtDate(f.modified)+'</div></div>';
        h+='<div class="actions">';
        if(canPreview) h+='<button class="act-btn" onclick="showPreview(\''+previewUrl.replace(/'/g,"\\'")+'\',\''+f.type+'\',\''+f.name.replace(/'/g,"\\'")+'\')">👁️ ดู</button>';
        h+='<a href="'+downloadUrl+'" class="act-btn dl">⬇ โหลด</a>';
        h+='<button class="act-btn del" onclick="deleteFile(\''+f.name.replace(/'/g,"\\'")+'\')">🗑️</button></div></div>';
      });contentEl.innerHTML=h;
    }
  }catch(e){loadingEl.classList.add('hidden');contentEl.innerHTML='<div class="empty" style="color:#dc2626;">❌ โหลดข้อมูลไม่ได้: '+e.message+'</div>';}
}

function goRoot(){currentFolder='';loadContent();}
function openFolder(n){currentFolder=n;loadContent();}
async function deleteFile(n){showConfirm('ลบไฟล์ "'+n+'" ?',async function(){await fetch('/api/files/'+encodeURIComponent(currentFolder)+'/'+encodeURIComponent(n),{method:'DELETE'});loadContent();});}
async function deleteFolder(n){showConfirm('ลบโฟลเดอร์ "'+n+'" และไฟล์ทั้งหมด?',async function(){await fetch('/api/folder/'+encodeURIComponent(n),{method:'DELETE'});loadContent();});}

// ── Preview Modal ──
function showPreview(url, type, name){
  var overlay=document.createElement('div');
  overlay.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.85);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:1000;padding:20px;';

  // Header
  var header=document.createElement('div');
  header.style.cssText='display:flex;align-items:center;justify-content:space-between;width:100%;max-width:90vw;margin-bottom:10px;';
  var title=document.createElement('span');
  title.style.cssText='color:#fff;font-size:14px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;';
  title.textContent=name;
  var closeBtn=document.createElement('button');
  closeBtn.style.cssText='background:none;border:none;color:#fff;font-size:28px;cursor:pointer;padding:0 8px;flex-shrink:0;';
  closeBtn.textContent='✕';
  closeBtn.addEventListener('click',function(){document.body.removeChild(overlay);});
  header.appendChild(title);
  header.appendChild(closeBtn);
  overlay.appendChild(header);

  // Content
  var content;
  if(type==='image'){
    content=document.createElement('img');
    content.src=url;
    content.style.cssText='max-width:90vw;max-height:80vh;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.3);object-fit:contain;';
  } else if(type==='video'){
    content=document.createElement('video');
    content.src=url;
    content.controls=true;
    content.autoplay=true;
    content.style.cssText='max-width:90vw;max-height:80vh;border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.3);';
  } else if(type==='pdf'){
    content=document.createElement('iframe');
    content.src=url;
    content.style.cssText='width:90vw;height:80vh;border:none;border-radius:12px;';
  }
  if(content) overlay.appendChild(content);

  // คลิกพื้นหลังเพื่อปิด
  overlay.addEventListener('click',function(e){if(e.target===overlay) document.body.removeChild(overlay);});

  document.body.appendChild(overlay);
}

loadContent();
</script>
</body>
</html>`;
