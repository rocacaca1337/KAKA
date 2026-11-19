const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..');
const version=require('../package.json').devDependencies.electron;
const dir=path.join(root,'node_modules','electron');
const dist=path.join(dir,'dist');
const required=['electron.exe','icudtl.dat','resources.pak','chrome_100_percent.pak','chrome_200_percent.pak','v8_context_snapshot.bin','ffmpeg.dll','libEGL.dll','libGLESv2.dll','locales/en-US.pak','resources/default_app.asar'];
function healthy(folder){return required.every(f=>{try{return fs.statSync(path.join(folder,f)).size>0}catch{return false}})}
function run(command,args,opts={}){const r=spawnSync(command,args,{cwd:root,stdio:'inherit',...opts});if(r.error||r.status!==0)throw Error(`${command}: ${r.error?.message??r.status}`)}
function versionOK(){try{return JSON.parse(fs.readFileSync(path.join(dir,'package.json'),'utf8')).version===version}catch{return false}}
function runtimeOK(folder){
  if(!healthy(folder)){
    console.error('[KAKA] Missing runtime files: '+required.filter(f=>{try{return !fs.statSync(path.join(folder,f)).size}catch{return true}}).join(', '));
    return false;
  }
  // Test a real Electron app without relying on Windows GUI stdout.
  const probe=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'kaka-probe-'));
  const result=path.join(probe,'result.json');
  try{
    fs.mkdirSync(path.join(probe,'userdata'));
    fs.writeFileSync(path.join(probe,'package.json'),JSON.stringify({name:'kaka-runtime-probe',version:'1.0.0',main:'main.cjs'}));
    fs.writeFileSync(path.join(probe,'main.cjs'),`const {app}=require('electron');const fs=require('node:fs');const path=require('node:path');app.setPath('userData',path.join(__dirname,'userdata'));app.disableHardwareAcceleration();app.whenReady().then(()=>{fs.writeFileSync(path.join(__dirname,'result.json'),JSON.stringify({version:process.versions.electron}));app.exit(0)}).catch(()=>app.exit(1));`);
    const env={...process.env};
    delete env.ELECTRON_RUN_AS_NODE;delete env.ELECTRON_NO_ATTACH_CONSOLE;delete env.NODE_OPTIONS;
    const r=spawnSync(path.join(folder,'electron.exe'),[probe],{cwd:folder,encoding:'utf8',timeout:60000,windowsHide:true,env});
    let reported;try{reported=JSON.parse(fs.readFileSync(result,'utf8')).version}catch{}
    const ok=!r.error&&r.status===0&&reported===version;
    if ((r.status >>> 0) === 0x80000003) console.error('[KAKA] Electron stopped before the probe could start (Windows 0x80000003).');
    if(!ok)console.error('[KAKA] Runtime probe: '+JSON.stringify({status:r.status,signal:r.signal,error:r.error?.message,version:reported,stderr:r.stderr?.slice(-3000),stdout:r.stdout?.slice(-1000)}));
    return ok;
  }finally{try{fs.rmSync(probe,{recursive:true,force:true})}catch{}}
}
function ps(script,env){run('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{timeout:600000,env:{...process.env,...env}})}
function digest(file){const fd=fs.openSync(file,'r');const h=createHash('sha256'),b=Buffer.alloc(1024*1024);try{let n;while((n=fs.readSync(fd,b,0,b.length,null))>0)h.update(b.subarray(0,n));return h.digest('hex')}finally{fs.closeSync(fd)}}

function installRuntime(stage) {
  const previous = path.join(dir, 'dist.kaka-old-' + Date.now());
  const hasPrevious = fs.existsSync(dist);
  if (hasPrevious) fs.renameSync(dist, previous);
  let installed = false;
  try {
    fs.renameSync(stage, dist);
    installed = true;
    if (!runtimeOK(dist)) throw Error('Installed runtime failed its launch check');
    fs.writeFileSync(path.join(dir, 'path.txt'), 'electron.exe');
  } catch (error) {
    if (installed) fs.renameSync(dist, stage);
    if (hasPrevious) fs.renameSync(previous, dist);
    throw error;
  }
  if (hasPrevious) {
    try { fs.rmSync(previous, {recursive: true, force: true}); }
    catch (error) { console.warn('[KAKA] Previous runtime retained: '+error.message); }
  }
}

function main(){if(process.platform!=='win32')throw Error('Windows x64 only');if(process.arch!=='x64')throw Error('Windows x64 Node.js required');if(!versionOK()||!fs.existsSync(path.join(root,'node_modules','.bin','electron.cmd'))){console.log('[KAKA] Preparing npm dependencies...');run('cmd.exe',['/d','/c','npm.cmd install --include=dev --ignore-scripts'],{env:{...process.env,ELECTRON_SKIP_BINARY_DOWNLOAD:'1'}});if(!versionOK())throw Error('Electron package version mismatch');}
if(runtimeOK(dist)){fs.writeFileSync(path.join(dir,'path.txt'),'electron.exe');console.log('[KAKA] Electron OK');return;}
console.log('[KAKA] Repairing Electron from official GitHub release...');const tmp=fs.mkdtempSync(path.join(dir,'.kaka-electron-'));const name=`electron-v${version}-win32-x64.zip`,base=`https://github.com/electron/electron/releases/download/v${version}/`,zip=path.join(tmp,name),sums=path.join(tmp,'SHASUMS256.txt'),stage=path.join(tmp,'dist');
try{ps("$ErrorActionPreference='Stop'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Write-Host 'Downloading checksums...'; Invoke-WebRequest -UseBasicParsing -Uri $env:KAKA_SUM_URL -OutFile $env:KAKA_SUM; Write-Host 'Downloading Electron...'; Invoke-WebRequest -UseBasicParsing -Uri $env:KAKA_ZIP_URL -OutFile $env:KAKA_ZIP",{KAKA_SUM_URL:base+'SHASUMS256.txt',KAKA_SUM:sums,KAKA_ZIP_URL:base+name,KAKA_ZIP:zip});const line=fs.readFileSync(sums,'utf8').split(/\r?\n/).map(x=>x.trim().split(/\s+/)).find(x=>x[1]?.replace(/^\*/,'')===name);if(!line||digest(zip)!==line[0].toLowerCase())throw Error('SHA256 verification failed');console.log('[KAKA] SHA256 OK. Extracting...');ps("$ErrorActionPreference='Stop'; Expand-Archive -LiteralPath $env:KAKA_ZIP -DestinationPath $env:KAKA_STAGE -Force",{KAKA_ZIP:zip,KAKA_STAGE:stage});if(!runtimeOK(stage))throw Error('Downloaded Electron failed runtime check');installRuntime(stage);console.log('[KAKA] Electron repaired.');}finally{fs.rmSync(tmp,{recursive:true,force:true})}}
try{main()}catch(e){console.error('[KAKA] Electron 복구 실패. 아래 상세 오류를 확인하세요.');console.error(e.message);process.exitCode=1;}
