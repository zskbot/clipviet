const API=window.CLIPVIET_API_BASE||"https://api.clipviet.live/api/v1";
const ROOT=API.replace("/api/v1", "");
const $=s=>document.querySelector(s), status=$("#status-text"), rows=$("#rows");
async function request(path,options={}){const r=await fetch(API+path,{credentials:"include",redirect:"error",headers:{Accept:"application/json","Content-Type":"application/json",...(options.headers||{})},...options});const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||"HTTP "+r.status);return data;}
function say(message){status.textContent=message;}
async function load(){try{const result=await request("/admin/videos");rows.replaceChildren();for(const video of result.data){const item=document.createElement("article");item.className="item";const info=document.createElement("div"),strong=document.createElement("strong"),small=document.createElement("small");strong.textContent=video.title;small.textContent=[video.status,video.country,video.genre].filter(Boolean).join(" · ");info.append(strong,small);const del=document.createElement("button");del.textContent="XÓA";del.addEventListener("click",async()=>{if(!confirm("Xóa video này khỏi catalog?"))return;try{await request("/admin/videos/"+encodeURIComponent(video.id),{method:"DELETE"});await load();say("Đã xóa video.");}catch(e){say(e.message);}});item.append(info,del);rows.append(item);}if(!result.data.length)rows.textContent="Catalog đang trống.";say("Đã tải "+result.count+" video.");}catch(e){rows.textContent="Không tải được catalog.";say(e.message+" — Hãy xác thực Telegram và kiểm tra API.");}}
$("#form").addEventListener("submit",async e=>{e.preventDefault();const payload={title:$("#title").value.trim(),genre:$("#genre").value.trim(),country:$("#country").value.trim(),duration:$("#duration").value.trim(),media_url:$("#media").value.trim(),poster_url:$("#poster").value.trim(),description:$("#description").value.trim(),status:$("#status").value,rights_confirmed:$("#rights").checked};try{await request("/admin/videos",{method:"POST",body:JSON.stringify(payload)});e.target.reset();say("Đã lưu video.");await load();}catch(error){say(error.message);}});
$("#refresh").addEventListener("click",load);load();
async function checkProviders(){
 const output=$("#provider-rows"),label=$("#provider-status");
 output.replaceChildren();label.textContent="Đang kiểm tra 5 provider tuần tự…";
 try{
  const result=await fetch(ROOT+"/api/providers/health",{credentials:"include",headers:{Accept:"application/json"},cache:"no-store",redirect:"error"});
  const payload=await result.json().catch(()=>({}));
  if(!result.ok)throw new Error(payload.error||"HTTP "+result.status);
  for(const provider of payload.data||[]){
   const item=document.createElement("article");item.className="item";
   const info=document.createElement("div"),strong=document.createElement("strong"),small=document.createElement("small");
   strong.textContent=provider.name+" · "+provider.status.toUpperCase();
   small.textContent=provider.status==="offline"?"Không lấy được API response":[provider.latencyMs+" ms",provider.categoryCount+" danh mục lá",provider.sampleCount+" mẫu",provider.total+" mục",provider.playbackUrlsPresent?"Có URL phát":"Thiếu URL phát"].filter(Boolean).join(" · ");
   info.append(strong,small);item.append(info);output.append(item);
  }
  label.textContent="Đã kiểm tra lúc "+new Date(payload.checked_at).toLocaleString()+" · Đây là API probe, chưa phải playback test.";
 }catch(error){label.textContent=error.message+" — Đăng nhập Telegram Admin và xác nhận API origin.";}
}
$("#check-providers")?.addEventListener("click",checkProviders);
