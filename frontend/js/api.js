const API={
async call(action,payload={}){
try{
if(!CONFIG.API_URL||CONFIG.API_URL.startsWith("PASTE_"))return this.demo(action,payload);
const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
let r;try{r=await fetch(CONFIG.API_URL,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify({action,payload}),signal:controller.signal,cache:"no-store"})}finally{clearTimeout(timer)}
const text=await r.text();if(!text.trim())return{success:false,message:"Server mengembalikan respons kosong. Periksa deployment Web App Apps Script."};
let data;try{data=JSON.parse(text)}catch(e){return{success:false,message:"Respons Apps Script bukan JSON. Pastikan deployment terbaru dan URL config.js benar."}}
if(!r.ok)return{success:false,message:data.message||"HTTP "+r.status};return data;
}catch(e){return{success:false,message:e.name==="AbortError"?"Permintaan terlalu lama. Periksa koneksi dan deployment Apps Script.":"Tidak dapat terhubung ke Apps Script. "+(e.message||e)}}},
demo(a,p){if(a==="login"){const u={admin:["Administrator","Admin","admin123"],guru:["Guru Demo","Guru","guru123"],siswa:["Siswa Demo","Siswa","siswa123"]}[String(p.username||"").toLowerCase()];return u&&u[2]===p.password?{success:true,user:{username:p.username,nama:u[0],role:u[1]},token:"demo",permissions:["*"]}:{success:false,message:"Akun demo: admin/admin123, guru/guru123, siswa/siswa123"}}if(a==="dashboard")return{success:true,stats:{students:0,teachers:0,classes:0,subjects:0,courses:0,materials:0,assignments:0,submissions:0,grades:0,attendance:0}};return{success:true,data:[]}}};