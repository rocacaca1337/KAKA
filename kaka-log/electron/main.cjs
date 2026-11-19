const { app, BrowserWindow, Menu, ipcMain, shell, screen } = require('electron');
const path = require('path');
const fs = require('fs');
// Maintain the legacy database filename and IPC identifiers for compatibility.
const appData=app.getPath('appData');
const targetPath=path.join(appData,'KAKA');
const migrationMarker=path.join(appData,'KAKA-migration-v1.json');
const candidates=['GARAGE LOG','garage-log','ROCACACA'].map(n=>path.join(appData,n));
const hasData=dir=>['garage-log.sqlite','Local Storage','backups'].some(n=>fs.existsSync(path.join(dir,n)));
const existingLock=app.requestSingleInstanceLock();
if(!existingLock){app.exit(0);process.exit(0);}
try {
  if(!fs.existsSync(targetPath)&&!fs.existsSync(migrationMarker)){
    const sources=candidates.filter(hasData);
    // Do not merge unrelated databases. If several exist, stop and let the user choose safely.
    if(sources.length>1) throw Error('기존 데이터 폴더가 여러 개 있습니다. 백업 후 사용할 폴더 하나만 남겨 주세요: '+sources.join(', '));
    if(sources.length===1)fs.renameSync(sources[0],targetPath);
  }
  fs.mkdirSync(targetPath,{recursive:true});
  if(!fs.existsSync(migrationMarker))fs.writeFileSync(migrationMarker,JSON.stringify({version:1}),{flag:'wx'});
  app.setPath('userData',targetPath);
} catch(e){require('electron').dialog.showErrorBox('KAKA 데이터 이전 실패',e.message+'\n기존 폴더를 삭제하지 마세요.');app.exit(1);process.exit(1);}
app.on('second-instance',()=>{const w=BrowserWindow.getAllWindows()[0];if(w){if(w.isMinimized())w.restore();w.focus();}});
const backupDir = () => path.join(app.getPath('userData'), 'backups');
ipcMain.handle('garage:backup', (_event, data) => { if(typeof data !== 'string') throw Error('invalid data'); JSON.parse(data); const dir=backupDir(); fs.mkdirSync(dir,{recursive:true}); const d=new Date(); const date=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'); const file=path.join(dir,date+'.json'); fs.writeFileSync(file+'.tmp',data,'utf8'); fs.renameSync(file+'.tmp',file); const files=fs.readdirSync(dir).filter(x=>/^\d{4}-\d{2}-\d{2}\.json$/.test(x)).sort().reverse(); for(const old of files.slice(30)) fs.unlinkSync(path.join(dir,old)); });
ipcMain.handle('garage:open-backups', async()=>{fs.mkdirSync(backupDir(),{recursive:true});const error=await shell.openPath(backupDir());if(error)throw Error(error);});

ipcMain.handle('garage:theme',(event,key)=>{const win=BrowserWindow.fromWebContents(event.sender);if(!win)return;const light=key==='white';win.setBackgroundColor(light?'#f1f3f5':'#171719');if(process.platform==='win32')win.setTitleBarOverlay({color:light?'#e9ecef':'#202023',symbolColor:light?'#202124':'#ececf0',height:30});});
function createWindow() {
  const windowFile=path.join(app.getPath('userData'),'window-state.json');
  let saved={};try{saved=JSON.parse(fs.readFileSync(windowFile,'utf8'))}catch{}
  const displays=screen.getAllDisplays();
  const valid=saved.bounds&&['x','y','width','height'].every(k=>Number.isFinite(saved.bounds[k]))&&saved.bounds.width>=760&&saved.bounds.height>=620;
  let bounds={width:1280,height:900};
  if(valid){const r=saved.bounds;const display=displays.find(d=>{const a=d.workArea;return Math.min(r.x+r.width,a.x+a.width)-Math.max(r.x,a.x)>=100&&Math.min(r.y+r.height,a.y+a.height)-Math.max(r.y,a.y)>=100});if(display){const a=display.workArea;const width=Math.max(760,Math.min(r.width,a.width)),height=Math.max(620,Math.min(r.height,a.height));bounds={width,height,x:Math.max(a.x,Math.min(r.x,a.x+a.width-width)),y:Math.max(a.y,Math.min(r.y,a.y+a.height-height))}}}

  const win = new BrowserWindow({
    ...bounds,
    minWidth: 760,
    minHeight: 620,
    backgroundColor: '#171719',
    ...(process.platform==='win32'?{titleBarStyle:'hidden',titleBarOverlay:{color:'#202023',symbolColor:'#ececf0',height:30}}:{}),
    title: 'KAKA',
    icon: path.join(__dirname, '..', 'src', 'assets', 'icon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      // 렌더러에는 Node.js 권한을 노출하지 않습니다.
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: false,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });

  function saveWindow(){try{const data={bounds:win.getNormalBounds(),maximized:win.isMaximized()};fs.writeFileSync(windowFile,JSON.stringify(data),'utf8')}catch{}}
  win.on('close',saveWindow);if(saved.maximized===true)win.maximize();
  win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// SQLite local snapshot storage; migration preserves original JSON separately.
let db;
function database(){if(!db){const {DatabaseSync}=require('node:sqlite');const connection=new DatabaseSync(path.join(app.getPath('userData'),'garage-log.sqlite'));try{connection.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS garage (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL)');db=connection;}catch(error){connection.close();throw error;}}return db;}
function saveData(data){JSON.parse(data);database().prepare('INSERT INTO garage VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(data)}
for(const [channel,fn] of Object.entries({'garage:load':()=>database().prepare('SELECT data FROM garage WHERE id=1').get()?.data??null,'garage:save':saveData,'garage:migrate':(original,data)=>{if(original){const dir=backupDir();fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'before-sqlite-'+Date.now()+'.json'),original)}saveData(data)}}))ipcMain.on(channel,(event,...args)=>{try{event.returnValue={ok:true,value:fn(...args)}}catch(e){event.returnValue={ok:false,error:e.message}}});
const {dialog}=require('electron');
const xml=s=>String(s??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
function crc32(b){let c=0xffffffff;for(const x of b){c^=x;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0)}return (c^0xffffffff)>>>0;}
function zip(files){const local=[],central=[];let offset=0;for(const [name,text] of Object.entries(files)){const n=Buffer.from(name),b=Buffer.from(text),crc=crc32(b),h=Buffer.alloc(30),d=Buffer.alloc(46);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt32LE(crc,14);h.writeUInt32LE(b.length,18);h.writeUInt32LE(b.length,22);h.writeUInt16LE(n.length,26);d.writeUInt32LE(0x02014b50);d.writeUInt16LE(20,4);d.writeUInt16LE(20,6);d.writeUInt32LE(crc,16);d.writeUInt32LE(b.length,20);d.writeUInt32LE(b.length,24);d.writeUInt16LE(n.length,28);d.writeUInt32LE(offset,42);local.push(h,n,b);central.push(d,n);offset+=h.length+n.length+b.length;}const cd=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(Object.keys(files).length,8);end.writeUInt16LE(Object.keys(files).length,10);end.writeUInt32LE(cd.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...local,cd,end]);}
function xlsx(rows,language){const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main',rel='http://schemas.openxmlformats.org/officeDocument/2006/relationships',pkg='http://schemas.openxmlformats.org/package/2006/relationships';return zip({'[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>','_rels/.rels':`<Relationships xmlns="${pkg}"><Relationship Id="rId1" Type="${rel}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,'xl/workbook.xml':`<workbook xmlns="${ns}" xmlns:r="${rel}"><sheets><sheet name="${language==='en'?'Service history':'정비 이력'}" sheetId="1" r:id="rId1"/></sheets></workbook>`,'xl/_rels/workbook.xml.rels':`<Relationships xmlns="${pkg}"><Relationship Id="rId1" Type="${rel}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,'xl/worksheets/sheet1.xml':`<worksheet xmlns="${ns}"><sheetData>${rows.map((row,i)=>`<row r="${i+1}">${row.map((v,j)=>typeof v==='number'&&Number.isFinite(v)?`<c r="${String.fromCharCode(65+j)}${i+1}"><v>${v}</v></c>`:`<c r="${String.fromCharCode(65+j)}${i+1}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`});}
ipcMain.handle('garage:export',async(_,format,rows,language)=>{if(!['csv','xlsx'].includes(format)||!Array.isArray(rows))throw Error(language==='en'?'Invalid export format':'잘못된 형식');const result=await dialog.showSaveDialog({defaultPath:'KAKA.'+format,filters:[{name:format.toUpperCase(),extensions:[format]}]});if(result.canceled)return;const csv=rows.map(row=>row.map(v=>{let s=String(v??'');if(typeof v==='string'&&/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"'}).join(',')).join('\r\n');fs.writeFileSync(result.filePath,format==='xlsx'?xlsx(rows,language):'\ufeff'+csv);});
function validRepo(repo,language){if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo))throw Error(language==='en'?'Enter the repository as owner/repo.':'소유자/저장소 형식으로 입력하세요.');return repo;}
ipcMain.handle('garage:check-update',async(_,repo,language)=>{const res=await fetch('https://api.github.com/repos/'+validRepo(repo,language)+'/releases/latest',{headers:{'User-Agent':'KAKA'},signal:AbortSignal.timeout(10000)});if(!res.ok)throw Error((language==='en'?'GitHub response ':'GitHub 응답 ')+res.status);const r=await res.json();const parse=s=>{const m=/^v?(\d+)\.(\d+)(?:\.(\d+))?$/.exec(s);return m?[Number(m[1]),Number(m[2]),Number(m[3]||0)]:null;};const a=parse(r.tag_name),b=parse(app.getVersion());if(!a||!b)throw Error(language==='en'?'Unrecognized version format':'버전 형식 확인 필요');const i=a.findIndex((n,j)=>n!==b[j]);const newer=i>=0&&a[i]>b[i];return {newer,message:language==='en'?(newer?'Version '+r.tag_name+' is available.':'You are up to date.'):(newer?'새 버전 '+r.tag_name+' 사용 가능':'최신 버전입니다.')}});
ipcMain.handle('garage:open-release',(_,repo)=>shell.openExternal('https://github.com/'+validRepo(repo)+'/releases'));

ipcMain.handle('garage:backup-before-delete',(_,data)=>{if(typeof data!=='string')throw Error('invalid data');JSON.parse(data);const dir=backupDir();fs.mkdirSync(dir,{recursive:true});const target=path.join(dir,'before-delete-'+Date.now()+'.json');fs.writeFileSync(target,data,{encoding:'utf8',flag:'wx'});return true;});

// Only expose the application's own directory, never an arbitrary renderer-supplied path.
function dataSize(dir){let total=0;for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);try{if(e.isDirectory())total+=dataSize(f);else if(e.isFile())total+=fs.statSync(f).size;}catch{}}return total;}
ipcMain.handle('garage:data-info',()=>{const dir=app.getPath('userData');const daily=fs.existsSync(backupDir())?fs.readdirSync(backupDir()).filter(n=>/^\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort().reverse():[];return {path:dir,bytes:dataSize(dir),lastBackup:daily[0]?.slice(0,10)||null};});
ipcMain.handle('garage:open-data',async()=>{const err=await shell.openPath(app.getPath('userData'));if(err)throw Error(err);});
