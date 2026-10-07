const SPREADSHEET_ID="1gEZu_8HjIJLMJ9PE3tV1a7GZfhk5N5qbhyxn9DxU-EA";
const SESSION_TTL=21600;
const SHEETS={
  Users:["ID","Username","Password","Nama","Role","Email","Status","CreatedAt"],
  Students:["ID","NISN","Nama","Kelas","JK","Email","Status"],
  Teachers:["ID","NIP","Nama","Mapel","Email","Status"],
  Classes:["ID","Kode","Nama Kelas","Wali Kelas","Tahun Ajaran"],
  Subjects:["ID","Kode","Nama","Guru","KKM"],
  Courses:["ID","Kode","Nama Kursus","Guru","Deskripsi","Status"],
  Materials:["ID","Kursus","Judul","Deskripsi","URL","Tanggal","Status"],
  Assignments:["ID","Kursus","Judul","Deskripsi","URL","Batas Waktu","Status"],
  Submissions:["ID","AssignmentID","SiswaID","JawabanURL","TanggalKumpul","Status"],
  Grades:["ID","Siswa","Mapel","Tugas","UTS","UAS","Nilai Akhir","Semester","Tahun Ajaran"],
  Attendance:["ID","Tanggal","Siswa","Kelas","Mapel","Status","Keterangan"],
  Announcements:["ID","Judul","Isi","Tanggal","Status"],
  Settings:["Key","Value"],
  ActivityLog:["Timestamp","Username","Action","Entity","RecordID"]
};
const ROLES={
  Admin:["*"],
  Guru:["Students","Classes","Subjects","Courses","Materials","Assignments","Submissions","Grades","Attendance","Announcements"],
  Siswa:["Courses","Materials","Assignments","Submissions","Grades","Attendance","Announcements"]
};

function setupDatabase(){
  const ss=SpreadsheetApp.openById(SPREADSHEET_ID);
  Object.entries(SHEETS).forEach(([n,h])=>{
    let s=ss.getSheetByName(n)||ss.insertSheet(n);
    if(s.getLastRow()===0)s.appendRow(h);
    s.setFrozenRows(1);
  });
  const u=ss.getSheetByName("Users");
  if(u.getLastRow()<2){
    u.getRange(2,1,3,8).setValues([
      ["U001","admin","admin123","Administrator","Admin","","Aktif",new Date()],
      ["U002","guru","guru123","Guru Demo","Guru","","Aktif",new Date()],
      ["U003","siswa","siswa123","Siswa Demo","Siswa","","Aktif",new Date()]
    ]);
  }
  return{success:true,message:"Database siap"};
}

function doGet(){
  return out({success:true,message:"SIAKAD & LMS API aktif",version:"3.0"});
}

function doPost(e){
  try{
    const b=JSON.parse((e&&e.postData&&e.postData.contents)||"{}");
    const p=b.payload||{}, a=b.action;
    if(a==="login")return out(login(p));
    const session=authenticate(p);
    if(!session)return out({success:false,message:"Sesi tidak valid atau sudah kedaluwarsa. Silakan login kembali."});
    if(a==="dashboard")return out(dashboard(session));
    if(a==="list")return out(list(p,session));
    if(["create","update","delete"].includes(a))return out(mutate(a,p,session));
    if(a==="logout"){CacheService.getScriptCache().remove("SIAKAD_"+session.token);return out({success:true,message:"Logout berhasil"});}
    return out({success:false,message:"Action tidak dikenal: "+a});
  }catch(err){
    return out({success:false,message:err.message||String(err)});
  }
}

function out(x){
  return ContentService.createTextOutput(JSON.stringify(x)).setMimeType(ContentService.MimeType.JSON);
}

function sheet(n){
  if(!SHEETS[n])throw Error("Entity tidak valid: "+n);
  const s=SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(n);
  if(!s)throw Error("Sheet belum ada: "+n+" . Jalankan setupDatabase() terlebih dahulu.");
  return s;
}

function rows(n){
  const s=sheet(n);
  if(s.getLastRow()<2)return[];
  const v=s.getDataRange().getValues(),h=v.shift();
  return v.map((r,i)=>({
    __row:i+2,
    ...Object.fromEntries(h.map((k,j)=>[k,r[j] instanceof Date?r[j].toISOString():r[j]]))
  })).filter(o=>Object.keys(o).some(k=>k!=="__row"&&o[k]!==""));
}

function login(p){
  if(!p.username||!p.password)return{success:false,message:"Username dan password wajib diisi"};
  const u=rows("Users").find(x=>
    String(x.Username).toLowerCase()===String(p.username).trim().toLowerCase() &&
    String(x.Password)===String(p.password) &&
    String(x.Status)==="Aktif"
  );
  if(!u)return{success:false,message:"Username/password salah atau akun tidak aktif"};
  const token=Utilities.getUuid();
  const session={token,username:u.Username,nama:u.Nama,role:u.Role,email:u.Email||""};
  CacheService.getScriptCache().put("SIAKAD_"+token,JSON.stringify(session),SESSION_TTL);
  return{success:true,user:{username:u.Username,nama:u.Nama,role:u.Role,email:u.Email||""},token,permissions:ROLES[u.Role]||[]};
}

function authenticate(p){
  if(!p||!p.token)return null;
  const raw=CacheService.getScriptCache().get("SIAKAD_"+p.token);
  if(!raw)return null;
  try{return JSON.parse(raw)}catch(e){return null}
}

function allowed(role,entity,action){
  if(role==="Admin")return true;
  if(["read","create","update"].includes(action))return(ROLES[role]||[]).includes(entity);
  return false;
}

function dashboard(session){
  return{
    success:true,
    user:{username:session.username,nama:session.nama,role:session.role},
    stats:{
      students:rows("Students").length,
      teachers:rows("Teachers").length,
      classes:rows("Classes").length,
      subjects:rows("Subjects").length,
      courses:rows("Courses").length,
      materials:rows("Materials").length,
      assignments:rows("Assignments").length,
      submissions:rows("Submissions").length,
      grades:rows("Grades").length,
      attendance:rows("Attendance").length
    },
    announcements:rows("Announcements").slice(-5).reverse()
  };
}

function list(p,session){
  const entity=p.entity;
  if(!allowed(session.role,entity,"read"))throw Error("Akses ditolak");
  let data=rows(entity);
  if(p.search){
    const q=String(p.search).toLowerCase();
    data=data.filter(x=>Object.keys(x).some(k=>k!=="__row"&&String(x[k]).toLowerCase().includes(q)));
  }
  return{success:true,data:data.map(({__row,...x})=>x)};
}

function mutate(action,p,session){
  const entity=p.entity, d=p.data||{}, id=p.id||d.ID;
  if(!allowed(session.role,entity,action))throw Error("Akses ditolak");
  const s=sheet(entity), h=SHEETS[entity];

  if(action==="create"){
    const newId=id||entity.substring(0,3).toUpperCase()+Date.now().toString().slice(-8);
    s.appendRow(h.map(k=>k==="ID"?newId:(d[k]??"")));
    logActivity(session,action,entity,newId);
    return{success:true,message:"Data berhasil ditambahkan",id:newId};
  }

  const found=rows(entity).find(x=>String(x.ID)===String(id));
  if(!found)throw Error("Data dengan ID tersebut tidak ditemukan");

  if(action==="update"){
    h.forEach((k,i)=>{
      if(k!=="ID"&&Object.prototype.hasOwnProperty.call(d,k)){
        s.getRange(found.__row,i+1).setValue(d[k]);
      }
    });
    logActivity(session,action,entity,id);
    return{success:true,message:"Data berhasil diperbarui"};
  }

  if(action==="delete"){
    s.deleteRow(found.__row);
    logActivity(session,action,entity,id);
    return{success:true,message:"Data berhasil dihapus"};
  }

  throw Error("Operasi tidak valid");
}

function logActivity(session,action,entity,recordId){
  try{
    const s=sheet("ActivityLog");
    s.appendRow([new Date(),session.username,action,entity,recordId||""]);
  }catch(e){}
}
