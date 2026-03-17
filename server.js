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
app.use((err, req, res, next) => {
  console.error('  ❌ Upload Error:', err.message);
  res.json({ success: false, error: err.message });
});

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
    <button id="resetBtn" class="btn btn-main" style="font-size:14px;padding:12px;">อัปโหลด OK</button>
  </div>
</div>

<div style="text-align:center;padding:0 24px 36px;font-size:11px;color:#94a3b8;">
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
