/**
 * CBT MODULE for SIAKAD — Google Apps Script
 * Install as CBT.gs in the same Apps Script project as Code.gs.
 * All requests use POST JSON: {action:"cbt...", payload:{...}}.
 */
const CBT_TABLES = {
  CBTExams: ["ID","Title","Subject","Class","StartAt","EndAt","DurationMin","QuestionCount","ShuffleQuestions","ShuffleOptions","ShowResult","Status","CreatedBy"],
  CBTQuestions: ["ID","ExamID","Type","Question","OptionsJSON","AnswerKey","Points","Explanation","CreatedBy"],
  CBTParticipants: ["ID","Username","Name","Class","PinHash","Status"],
  CBTResponses: ["ID","ExamID","ParticipantID","QuestionID","Answer","UpdatedAt"],
  CBTResults: ["ID","ExamID","ParticipantID","StartedAt","SubmittedAt","Score","MaxScore","CorrectCount","EssayPending","Status"],
  CBTEvents: ["Timestamp","ExamID","ParticipantID","Event","Details"]
};
function cbtSetupDatabase() {
  const book = ss();
  Object.keys(CBT_TABLES).forEach(n => {
    const sh = book.getSheetByName(n) || book.insertSheet(n);
    if (!sh.getLastRow()) sh.appendRow(CBT_TABLES[n]);
    sh.setFrozenRows(1);
  });
  return {success:true,message:"Database CBT siap",tables:Object.keys(CBT_TABLES)};
}
function cbtRows_(name) {
  if (!CBT_TABLES[name]) throw Error("Tabel CBT tidak valid");
  const sh = ss().getSheetByName(name);
  if (!sh) throw Error("Database CBT belum disiapkan. Jalankan cbtSetupDatabase().");
  if (sh.getLastRow() < 2) return [];
  const v = sh.getDataRange().getValues(), h = v.shift().map(x=>String(x).trim());
  return v.map((r,i)=>({__row:i+2,...Object.fromEntries(h.map((k,j)=>[k,r[j] instanceof Date?r[j].toISOString():r[j]]))}))
    .filter(o=>Object.keys(o).some(k=>k!=="__row" && String(o[k]??"").trim()!==""));
}
function cbtId_(){return "CBT"+Utilities.getUuid().replace(/-/g,"").slice(0,12).toUpperCase();}
function cbtHash_(pin){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(pin),Utilities.Charset.UTF_8).map(b=>(b<0?b+256:b).toString(16).padStart(2,"0")).join("");}
function cbtAppend_(table,obj){const h=CBT_TABLES[table], sh=ss().getSheetByName(table);sh.appendRow(h.map(k=>obj[k]===undefined?"":obj[k]));}
function cbtLog_(exam,participant,event,details){try{cbtAppend_("CBTEvents",{Timestamp:new Date(),ExamID:exam||"",ParticipantID:participant||"",Event:event,Details:String(details||"").slice(0,500)});}catch(e){}}
function cbtNow_(){return Date.now();}
function cbtAuth_(p){
  if(p.token){
    const raw=CacheService.getScriptCache().get("CBT_"+p.token);
    if(raw){try{return JSON.parse(raw);}catch(e){}}
  }
  const s=authenticate(p);
  if(s && ["Admin","Guru"].includes(s.role)) return {kind:"staff",username:s.username,name:s.nama,role:s.role};
  return null;
}
function cbtPublicQuestion_(q,exam){
  let options=[];try{options=JSON.parse(q.OptionsJSON||"[]");}catch(e){}
  if(exam.ShuffleOptions==="TRUE"||exam.ShuffleOptions===true) options=options.sort(()=>Math.random()-.5);
  return {id:q.ID,type:q.Type,question:q.Question,options,points:Number(q.Points)||1};
}
function cbtHandleAction(action,p){
  p=p||{};
  if(action==="cbtHealth")return {success:true,module:"CBT",version:"1.0"};
  if(action==="cbtSetup"){
    const s=authenticate(p);if(!s||s.role!=="Admin")return {success:false,message:"Hanya Admin yang dapat menyiapkan database CBT."};
    return cbtSetupDatabase();
  }
  if(action==="cbtParticipantLogin"){
    const username=String(p.username||"").trim().toLowerCase(), pin=String(p.pin||"");
    if(!username||!pin)return {success:false,message:"Username dan PIN wajib diisi."};
    const u=cbtRows_("CBTParticipants").find(x=>String(x.Username).toLowerCase()===username && x.PinHash===cbtHash_(pin) && String(x.Status).toLowerCase()==="aktif");
    if(!u)return {success:false,message:"Akun/PIN salah atau akun tidak aktif."};
    const token=Utilities.getUuid();
    const session={kind:"participant",participantId:u.ID,username:u.Username,name:u.Name,className:u.Class};
    CacheService.getScriptCache().put("CBT_"+token,JSON.stringify(session),21600);
    return {success:true,token,user:{username:u.Username,name:u.Name,class:u.Class}};
  }
  const auth=cbtAuth_(p);
  if(!auth)return {success:false,message:"Sesi tidak valid. Silakan login kembali."};
  const staff=auth.kind==="staff";
  const participant=auth.kind==="participant";
  if(action==="cbtDashboard"){
    if(!staff)return {success:true,role:"Siswa",exams:cbtRows_("CBTExams").filter(e=>String(e.Status).toLowerCase()==="aktif").map(e=>({id:e.ID,title:e.Title,subject:e.Subject,className:e.Class,startAt:e.StartAt,endAt:e.EndAt,durationMin:e.DurationMin}))};
    return {success:true,stats:{exams:cbtRows_("CBTExams").length,questions:cbtRows_("CBTQuestions").length,participants:cbtRows_("CBTParticipants").length,results:cbtRows_("CBTResults").length,essaysPending:cbtRows_("CBTResults").filter(r=>Number(r.EssayPending)>0).length}};
  }
  if(action==="cbtCreateExam"){
    if(!staff)return {success:false,message:"Akses ditolak."};
    const d=p.data||{};if(!String(d.Title||"").trim())return {success:false,message:"Judul ujian wajib diisi."};
    const id=cbtId_();cbtAppend_("CBTExams",{ID:id,Title:String(d.Title).trim(),Subject:d.Subject||"",Class:d.Class||"",StartAt:d.StartAt||"",EndAt:d.EndAt||"",DurationMin:Math.max(1,Number(d.DurationMin)||60),QuestionCount:Math.max(0,Number(d.QuestionCount)||0),ShuffleQuestions:d.ShuffleQuestions===false?"FALSE":"TRUE",ShuffleOptions:d.ShuffleOptions===false?"FALSE":"TRUE",ShowResult:d.ShowResult===false?"FALSE":"TRUE",Status:d.Status||"Draft",CreatedBy:auth.username});
    return {success:true,id,message:"Ujian dibuat."};
  }
  if(action==="cbtListExams"){
    if(!staff)return {success:false,message:"Akses ditolak."};
    return {success:true,data:cbtRows_("CBTExams")};
  }
  if(action==="cbtSaveQuestion"){
    if(!staff)return {success:false,message:"Akses ditolak."};
    const d=p.data||{}, exam=cbtRows_("CBTExams").find(x=>x.ID===d.ExamID);
    if(!exam)return {success:false,message:"Ujian tidak ditemukan."};
    if(!String(d.Question||"").trim())return {success:false,message:"Teks soal wajib diisi."};
    const type=["MCQ","MULTI","TRUEFALSE","ESSAY"].includes(d.Type)?d.Type:"MCQ";
    const id=cbtId_();cbtAppend_("CBTQuestions",{ID:id,ExamID:d.ExamID,Type:type,Question:String(d.Question),OptionsJSON:JSON.stringify(Array.isArray(d.Options)?d.Options:[]),AnswerKey:type==="ESSAY"?"":JSON.stringify(d.AnswerKey??""),Points:Math.max(0,Number(d.Points)||1),Explanation:d.Explanation||"",CreatedBy:auth.username});
    return {success:true,id,message:"Soal tersimpan."};
  }
  if(action==="cbtListQuestions"){
    if(!staff)return {success:false,message:"Akses ditolak."};
    return {success:true,data:cbtRows_("CBTQuestions").filter(q=>!p.examId||q.ExamID===p.examId).map(q=>({...q,Options:(()=>{try{return JSON.parse(q.OptionsJSON||"[]")}catch(e){return[]}})()}))};
  }
  if(action==="cbtCreateParticipant"){
    if(!staff)return {success:false,message:"Akses ditolak."};
    const d=p.data||{},username=String(d.Username||"").trim(),pin=String(d.PIN||"");
    if(!username||pin.length<4||!String(d.Name||"").trim())return {success:false,message:"Nama, username, dan PIN minimal 4 digit wajib diisi."};
    if(cbtRows_("CBTParticipants").some(u=>String(u.Username).toLowerCase()===username.toLowerCase()))return {success:false,message:"Username peserta sudah digunakan."};
    const id=cbtId_();cbtAppend_("CBTParticipants",{ID:id,Username:username,Name:String(d.Name),Class:d.Class||"",PinHash:cbtHash_(pin),Status:d.Status||"Aktif"});
    return {success:true,id,message:"Peserta dibuat. PIN tidak ditampilkan kembali."};
  }
  if(action==="cbtListParticipants"){
    if(!staff)return {success:false,message:"Akses ditolak."};
    return {success:true,data:cbtRows_("CBTParticipants").map(({PinHash,...u})=>u)};
  }
  if(action==="cbtStartExam"){
    if(!participant)return {success:false,message:"Login sebagai peserta diperlukan."};
    const e=cbtRows_("CBTExams").find(x=>x.ID===p.examId && String(x.Status).toLowerCase()==="aktif");
    if(!e)return {success:false,message:"Ujian tidak ditemukan atau belum aktif."};
    const now=cbtNow_(),start=Date.parse(e.StartAt),end=Date.parse(e.EndAt);
    if(Number.isFinite(start)&&now<start)return {success:false,message:"Ujian belum dimulai."};
    if(Number.isFinite(end)&&now>end)return {success:false,message:"Waktu ujian sudah berakhir."};
    let result=cbtRows_("CBTResults").find(r=>r.ExamID===e.ID&&r.ParticipantID===auth.participantId);
    if(result&&result.Status==="Submitted")return {success:false,message:"Ujian ini sudah dikumpulkan."};
    if(!result){const id=cbtId_();cbtAppend_("CBTResults",{ID:id,ExamID:e.ID,ParticipantID:auth.participantId,StartedAt:new Date().toISOString(),SubmittedAt:"",Score:"",MaxScore:"",CorrectCount:"",EssayPending:"",Status:"InProgress"});result={ID:id,StartedAt:new Date().toISOString()};}
    const all=cbtRows_("CBTQuestions").filter(q=>q.ExamID===e.ID);
    let qs=all.slice();if(e.ShuffleQuestions!=="FALSE")qs.sort(()=>Math.random()-.5);
    if(Number(e.QuestionCount)>0)qs=qs.slice(0,Number(e.QuestionCount));
    const existing=cbtRows_("CBTResponses").filter(r=>r.ExamID===e.ID&&r.ParticipantID===auth.participantId);
    cbtLog_(e.ID,auth.participantId,"START","Ujian dimulai");
    return {success:true,exam:{id:e.ID,title:e.Title,subject:e.Subject,durationMin:Number(e.DurationMin)||60,startedAt:result.StartedAt},questions:qs.map(q=>cbtPublicQuestion_(q,e)),responses:existing.map(r=>({questionId:r.QuestionID,answer:r.Answer}))};
  }
  if(action==="cbtSaveAnswer"){
    if(!participant)return {success:false,message:"Login peserta diperlukan."};
    const e=cbtRows_("CBTExams").find(x=>x.ID===p.examId),q=cbtRows_("CBTQuestions").find(x=>x.ID===p.questionId&&x.ExamID===p.examId);
    if(!e||!q)return {success:false,message:"Ujian/soal tidak valid."};
    const result=cbtRows_("CBTResults").find(r=>r.ExamID===e.ID&&r.ParticipantID===auth.participantId&&r.Status==="InProgress");
    if(!result)return {success:false,message:"Ujian tidak aktif atau sudah dikumpulkan."};
    const started=Date.parse(result.StartedAt),limit=(Number(e.DurationMin)||60)*60000;
    if(cbtNow_()>started+limit)return {success:false,message:"Waktu ujian habis. Silakan kumpulkan jawaban."};
    const sh=ss().getSheetByName("CBTResponses"),old=cbtRows_("CBTResponses").find(r=>r.ExamID===e.ID&&r.ParticipantID===auth.participantId&&r.QuestionID===q.ID);
    const ans=typeof p.answer==="string"?p.answer:JSON.stringify(p.answer??"");
    if(old){const row=old.__row;sh.getRange(row,5).setValue(ans);sh.getRange(row,6).setValue(new Date().toISOString());}
    else cbtAppend_("CBTResponses",{ID:cbtId_(),ExamID:e.ID,ParticipantID:auth.participantId,QuestionID:q.ID,Answer:ans,UpdatedAt:new Date().toISOString()});
    return {success:true,message:"Jawaban tersimpan."};
  }
  if(action==="cbtSubmitExam"){
    if(!participant)return {success:false,message:"Login peserta diperlukan."};
    const e=cbtRows_("CBTExams").find(x=>x.ID===p.examId),result=cbtRows_("CBTResults").find(r=>r.ExamID===p.examId&&r.ParticipantID===auth.participantId&&r.Status==="InProgress");
    if(!e||!result)return {success:false,message:"Ujian tidak aktif atau sudah dikumpulkan."};
    const qs=cbtRows_("CBTQuestions").filter(q=>q.ExamID===e.ID),rs=cbtRows_("CBTResponses").filter(r=>r.ExamID===e.ID&&r.ParticipantID===auth.participantId);
    let score=0,max=0,correct=0,essay=0;
    qs.forEach(q=>{const pts=Math.max(0,Number(q.Points)||1);max+=pts;if(q.Type==="ESSAY"){essay++;return;}const r=rs.find(x=>x.QuestionID===q.ID);let expected,actual;try{expected=JSON.parse(q.AnswerKey||'""');}catch(e){expected=q.AnswerKey;}try{actual=JSON.parse(r?r.Answer:'""');}catch(e){actual=r?r.Answer:"";}if(JSON.stringify(actual)===JSON.stringify(expected)){score+=pts;correct++;}});
    const sh=ss().getSheetByName("CBTResults");const row=result.__row;
    sh.getRange(row,5,1,6).setValues([[new Date().toISOString(),score,max,correct,essay,"Submitted"]]);
    cbtLog_(e.ID,auth.participantId,"SUBMIT","Nilai otomatis dihitung; esai menunggu pemeriksaan.");
    return {success:true,message:"Ujian berhasil dikumpulkan.",score,maxScore:max,correctCount:correct,essayPending:essay,showResult:String(e.ShowResult)!=="FALSE"};
  }
  if(action==="cbtMonitor"){
    if(!staff)return {success:false,message:"Akses ditolak."};
    const exams=cbtRows_("CBTExams"),users=cbtRows_("CBTParticipants"),results=cbtRows_("CBTResults");
    return {success:true,data:results.map(r=>({examTitle:(exams.find(e=>e.ID===r.ExamID)||{}).Title||"",participant:(users.find(u=>u.ID===r.ParticipantID)||{}).Name||"",className:(users.find(u=>u.ID===r.ParticipantID)||{}).Class||"",startedAt:r.StartedAt,submittedAt:r.SubmittedAt,status:r.Status,score:r.Score,essayPending:r.EssayPending}))};
  }
  if(action==="cbtGradeEssay"){
    if(!staff)return {success:false,message:"Akses ditolak."};
    const r=cbtRows_("CBTResults").find(x=>x.ID===p.resultId);if(!r)return {success:false,message:"Hasil tidak ditemukan."};
    const qs=cbtRows_("CBTQuestions").filter(q=>q.ExamID===r.ExamID&&q.Type==="ESSAY"),rs=cbtRows_("CBTResponses").filter(x=>x.ExamID===r.ExamID&&x.ParticipantID===r.ParticipantID);
    let earned=0;qs.forEach(q=>{const g=(p.grades||{})[q.ID];if(g!==undefined)earned+=Math.max(0,Math.min(Number(q.Points)||1,Number(g)||0));});
    const sh=ss().getSheetByName("CBTResults"),row=r.__row;sh.getRange(row,6).setValue((Number(r.Score)||0)+earned);sh.getRange(row,9).setValue(0);
    cbtLog_(r.ExamID,r.ParticipantID,"ESSAY_GRADED","Esai dinilai oleh "+auth.username);
    return {success:true,message:"Nilai esai diperbarui."};
  }
  if(action==="cbtListResults"){
    if(!staff)return {success:false,message:"Akses ditolak."};
    const exams=cbtRows_("CBTExams"),users=cbtRows_("CBTParticipants");
    return {success:true,data:cbtRows_("CBTResults").map(r=>({...r,ExamTitle:(exams.find(e=>e.ID===r.ExamID)||{}).Title||"",ParticipantName:(users.find(u=>u.ID===r.ParticipantID)||{}).Name||"",Class:(users.find(u=>u.ID===r.ParticipantID)||{}).Class||""}))};
  }
  if(action==="cbtLogEvent"){
    if(!participant)return {success:false,message:"Login peserta diperlukan."};
    const allowed=["TAB_HIDDEN","FULLSCREEN_EXIT","COPY_ATTEMPT","PASTE_ATTEMPT","WINDOW_BLUR"];
    if(!allowed.includes(p.event))return {success:false,message:"Jenis event tidak valid."};
    cbtLog_(p.examId,auth.participantId,p.event,p.details||"");return {success:true};
  }
  return {success:false,message:"Action CBT tidak dikenal: "+action};
}
