const SPREADSHEET_ID="1gEZu_8HjIJLMJ9PE3tV1a7GZfhk5N5qbhyxn9DxU-EA";
const SESSION_TTL=21600;
const SHEETS={
Users:["ID","Username","Password","Nama","Role","Email","Status","CreatedAt"],Students:["ID","NISN","Nama","Kelas","JK","Email","Status"],Teachers:["ID","NIP","Nama","Mapel","Email","Status"],Classes:["ID","Kode","Nama Kelas","Wali Kelas","Tahun Ajaran"],Subjects:["ID","Kode","Nama","Guru","KKM"],Courses:["ID","Kode","Nama Kursus","Guru","Deskripsi","Status"],Materials:["ID","Kursus","Judul","Deskripsi","URL","Tanggal","Status"],Assignments:["ID","Kursus","Judul","Deskripsi","URL","Batas Waktu","Status"],Submissions:["ID","AssignmentID","SiswaID","JawabanURL","TanggalKumpul","Status"],Grades:["ID","Siswa","Mapel","Tugas","UTS","UAS","Nilai Akhir","Semester","Tahun Ajaran"],Attendance:["ID","Tanggal","Siswa","Kelas","Mapel","Status","Keterangan"],Announcements:["ID","Judul","Isi","Tanggal","Status"],Settings:["Key","Value"],ActivityLog:["Timestamp","Username","Action","Entity","RecordID"],SchoolProfile:["Key","Value"],LandingBanners:["ID","Title","Subtitle","ImageURL","ButtonText","ButtonURL","Status"],News:["ID","Title","Excerpt","Content","ImageURL","Date","Status"],Agenda:["ID","Title","Description","Date","Time","Location","Status"],Gallery:["ID","Title","ImageURL","Caption","Date","Status"],PPDB:["ID","Title","Description","StartDate","EndDate","URL","Status"]};
const ROLES={Admin:["*"],Guru:["Students","Classes","Subjects","Courses","Materials","Assignments","Submissions","Grades","Attendance","Announcements"],Siswa:["Courses","Materials","Assignments","Submissions","Grades","Attendance","Announcements"]};

function ss(){try{return SpreadsheetApp.openById(SPREADSHEET_ID)}catch(e){throw Error("Spreadsheet tidak dapat dibuka. Periksa SPREADSHEET_ID dan izin akses Apps Script.")}}
function setupDatabase(){
  const book=ss();
  Object.entries(SHEETS).forEach(([n,h])=>{let s=book.getSheetByName(n)||book.insertSheet(n);if(s.getLastRow()===0)s.appendRow(h);s.setFrozenRows(1)});
  const u=book.getSheetByName("Users");
  if(u.getLastRow()<2)u.getRange(2,1,3,8).setValues([["U001","admin","admin123","Administrator","Admin","","Aktif",new Date()],["U002","guru","guru123","Guru Demo","Guru","","Aktif",new Date()],["U003","siswa","siswa123","Siswa Demo","Siswa","","Aktif",new Date()]]);
  return{success:true,message:"Database siap",spreadsheet:book.getName(),users:u.getLastRow()-1};
}
function doGet(e){
  try{
    if(e&&e.parameter&&e.parameter.action==="health")return out({success:true,api:"online",version:"3.1",spreadsheet:ss().getName()});
    return out({success:true,message:"SIAKAD & LMS API aktif",version:"3.1"});
  }catch(err){return out({success:false,message:err.message})}
}
function doPost(e){
  try{
    const b=JSON.parse((e&&e.postData&&e.postData.contents)||"{}"),p=b.payload||{},a=b.action;
    if(a==="login")return out(login(p));
    if(a==="setup")return out(setupDatabase());
    if(a==="landingPublic")return out(landingPublic());
    if(a==="health")return out(health());
    const session=authenticate(p);
    if(!session)return out({success:false,message:"Sesi tidak valid atau sudah kedaluwarsa. Silakan login kembali."});
    if(a==="landingSetup")return out(landingSetup());
    if(a==="landingList")return out(landingRead(p.entity));
    if(["landingCreate","landingUpdate","landingDelete"].includes(a))return out(landingMutate(a.replace("landing","").toLowerCase(),p,session));
    if(a==="dashboard")return out(dashboard(session));
    if(a==="list")return out(list(p,session));
    if(["create","update","delete"].includes(a))return out(mutate(a,p,session));
    if(a==="logout"){CacheService.getScriptCache().remove("SIAKAD_"+session.token);return out({success:true,message:"Logout berhasil"})}
    return out({success:false,message:"Action tidak dikenal: "+a});
  }catch(err){return out({success:false,message:err.message||String(err)})}
}
function out(x){return ContentService.createTextOutput(JSON.stringify(x)).setMimeType(ContentService.MimeType.JSON)}
function sheet(n){if(!SHEETS[n])throw Error("Entity tidak valid: "+n);const s=ss().getSheetByName(n);if(!s)throw Error("Sheet "+n+" belum ada. Jalankan setupDatabase().");return s}
function clean(v){return String(v??"").replace(/^\uFEFF/,"").trim()}
function rows(n){
  const s=sheet(n);if(s.getLastRow()<2)return[];
  const v=s.getDataRange().getValues(),h=v.shift().map(clean);
  return v.map((r,i)=>({__row:i+2,...Object.fromEntries(h.map((k,j)=>[k,r[j] instanceof Date?r[j].toISOString():r[j]]))}))
    .filter(o=>Object.keys(o).some(k=>k!=="__row"&&clean(o[k])!==""));
}
function login(p){
  const username=clean(p.username).toLowerCase(),password=String(p.password??"");
  if(!username||!password)return{success:false,message:"Username dan password wajib diisi"};
  const users=rows("Users");
  const u=users.find(x=>clean(x.Username).toLowerCase()===username&&String(x.Password)===password&&clean(x.Status).toLowerCase()==="aktif");
  if(!u)return{success:false,message:"Username/password salah atau akun tidak aktif."};
  const token=Utilities.getUuid(),session={token,username:clean(u.Username),nama:clean(u.Nama),role:clean(u.Role),email:clean(u.Email)};
  CacheService.getScriptCache().put("SIAKAD_"+token,JSON.stringify(session),SESSION_TTL);
  return{success:true,message:"Login berhasil",user:{username:session.username,nama:session.nama,role:session.role,email:session.email},token,permissions:ROLES[session.role]||[]};
}
function authenticate(p){if(!p||!p.token)return null;const raw=CacheService.getScriptCache().get("SIAKAD_"+p.token);if(!raw)return null;try{return JSON.parse(raw)}catch(e){return null}}
function allowed(role,entity,action){if(role==="Admin")return true;if(["read","create","update"].includes(action))return(ROLES[role]||[]).includes(entity);return false}
function health(){const u=rows("Users");return{success:true,api:"online",spreadsheet:ss().getName(),users:u.length,headers:SHEETS.Users}}
function dashboard(s){return{success:true,user:{username:s.username,nama:s.nama,role:s.role},stats:{students:rows("Students").length,teachers:rows("Teachers").length,classes:rows("Classes").length,subjects:rows("Subjects").length,courses:rows("Courses").length,materials:rows("Materials").length,assignments:rows("Assignments").length,submissions:rows("Submissions").length,grades:rows("Grades").length,attendance:rows("Attendance").length},announcements:rows("Announcements").slice(-5).reverse()}}
function list(p,s){const entity=p.entity;if(!allowed(s.role,entity,"read"))throw Error("Akses ditolak");let data=rows(entity);if(p.search){const q=clean(p.search).toLowerCase();data=data.filter(x=>Object.keys(x).some(k=>k!=="__row"&&clean(x[k]).toLowerCase().includes(q)))}return{success:true,data:data.map(({__row,...x})=>x)}}
function mutate(action,p,s){
  const entity=p.entity,d=p.data||{},id=p.id||d.ID;if(!allowed(s.role,entity,action))throw Error("Akses ditolak");
  const sh=sheet(entity),h=SHEETS[entity];
  if(action==="create"){const newId=id||entity.substring(0,3).toUpperCase()+Date.now().toString().slice(-8);sh.appendRow(h.map(k=>k==="ID"?newId:(d[k]??"")));logActivity(s,action,entity,newId);return{success:true,message:"Data berhasil ditambahkan",id:newId}}
  const found=rows(entity).find(x=>clean(x.ID)===clean(id));if(!found)throw Error("Data dengan ID tersebut tidak ditemukan");
  if(action==="update"){h.forEach((k,i)=>{if(k!=="ID"&&Object.prototype.hasOwnProperty.call(d,k))sh.getRange(found.__row,i+1).setValue(d[k])});logActivity(s,action,entity,id);return{success:true,message:"Data berhasil diperbarui"}}
  if(action==="delete"){sh.deleteRow(found.__row);logActivity(s,action,entity,id);return{success:true,message:"Data berhasil dihapus"}}
  throw Error("Operasi tidak valid");
}
function logActivity(s,a,e,id){try{sheet("ActivityLog").appendRow([new Date(),s.username,a,e,id||""])}catch(err){}}
const LANDING_SHEETS={SchoolProfile:["Key","Value"],LandingBanners:["ID","Title","Subtitle","ImageURL","ButtonText","ButtonURL","Status"],News:["ID","Title","Excerpt","Content","ImageURL","Date","Status"],Agenda:["ID","Title","Description","Date","Time","Location","Status"],Gallery:["ID","Title","ImageURL","Caption","Date","Status"],PPDB:["ID","Title","Description","StartDate","EndDate","URL","Status"]};
function landingSetup(){const b=ss();Object.entries(LANDING_SHEETS).forEach(([n,h])=>{let s=b.getSheetByName(n)||b.insertSheet(n);if(s.getLastRow()===0)s.appendRow(h);s.setFrozenRows(1)});const p=b.getSheetByName("SchoolProfile");if(p.getLastRow()<2)p.getRange(2,1,10,2).setValues([["school_name","Nama Sekolah / Madrasah"],["npsn",""],["logo_url",""],["address","Alamat sekolah"],["phone",""],["email",""],["website",""],["vision","Terwujudnya peserta didik yang berkarakter, berilmu, mandiri dan berprestasi."],["mission","Menyelenggarakan pendidikan bermutu, inovatif, berkarakter dan berorientasi masa depan."],["about","Selamat datang di website resmi sekolah."]]);return{success:true,message:"CMS Landing Page siap"}}
function landingRead(entity){if(!LANDING_SHEETS[entity])throw Error("CMS entity tidak valid");const s=ss().getSheetByName(entity);if(!s)return{success:true,data:[]};return{success:true,data:rows(entity).map(({__row,...x})=>x)}}
function landingMutate(action,p,s){if(s.role!=="Admin")throw Error("Hanya Admin yang dapat mengubah konten website");const e=p.entity;if(!LANDING_SHEETS[e])throw Error("CMS entity tidak valid");return mutate(action,{entity:e,data:p.data,id:p.id},s)}

function landingPublic(){const profile={};try{rows("SchoolProfile").forEach(x=>profile[x.Key]=x.Value)}catch(e){}const active=n=>{try{return rows(n).filter(x=>String(x.Status||"").toLowerCase()==="aktif")}catch(e){return[]}};return{success:true,data:{profile,banners:active("LandingBanners"),news:active("News"),agenda:active("Agenda"),gallery:active("Gallery"),ppdb:active("PPDB")}}}
