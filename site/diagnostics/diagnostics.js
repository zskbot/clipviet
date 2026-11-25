const API = window.CLIPVIET_API_BASE || "https://clipviet-catalog-api-preview.huynhthuongg2505-f9b.workers.dev";
const $ = (id) => document.getElementById(id);
const results = $("results");
const video = $("test-video");
const summary = $("summary");
const run = $("run");
const checks = [];
$("age-confirm").addEventListener("change", updateGate);
$("rights-confirm").addEventListener("change", updateGate);
function updateGate(){run.disabled=!$("age-confirm").checked||!$("rights-confirm").checked;}
function add(label,state,detail){
 checks.push({label,state,detail});
 const li=document.createElement("li"),tag=document.createElement("span"),text=document.createElement("span");
 tag.className="state "+state;tag.textContent=state.toUpperCase();
 text.textContent=label+" — "+detail;li.append(tag,text);results.append(li);
}
function corsState(response){
 const value=response.headers.get("access-control-allow-origin");
 return value==="*"||value===location.origin;
}
async function requestJson(path,label){
 const response=await fetch(API+path,{headers:{Accept:"application/json"},cache:"no-store",credentials:"omit",redirect:"error"});
 if(!response.ok)throw new Error(label+" HTTP "+response.status);
 const type=(response.headers.get("content-type")||"").toLowerCase();
 if(!type.includes("application/json"))throw new Error(label+" MIME "+(type||"missing"));
 if(!corsState(response))throw new Error(label+" CORS allow-origin không khớp");
 return response.json();
}
async function rangeProbe(url,label){
 const response=await fetch(url,{method:"GET",headers:{Range:"bytes=0-0",Accept:"*/*"},mode:"cors",credentials:"omit",redirect:"error",cache:"no-store"});
 const type=(response.headers.get("content-type")||"").split(";")[0].trim().toLowerCase();
 const cors=corsState(response);
 const status=response.status;
 if(response.body)await response.body.cancel().catch(()=>{});
 const pass=status===206&&cors;
 return {pass,status,type,cors,acceptRanges:response.headers.get("accept-ranges")||"not exposed"};
}
async function firstHlsSegment(manifestUrl){
 let url=manifestUrl;
 for(let depth=0;depth<2;depth++){
  const response=await fetch(url,{headers:{Accept:"application/vnd.apple.mpegurl,application/x-mpegURL,*/*"},mode:"cors",credentials:"omit",redirect:"error",cache:"no-store"});
  if(!response.ok)throw new Error("HLS manifest HTTP "+response.status);
  const type=(response.headers.get("content-type")||"").toLowerCase();
  const cors=corsState(response);
  if(!type.includes("mpegurl")&&!type.includes("vnd.apple"))throw new Error("HLS manifest MIME "+(type||"missing"));
  if(!cors)throw new Error("HLS manifest CORS không cho phép origin này");
  const text=await response.text();
  if(text.length>512000)throw new Error("HLS manifest vượt 512 KB");
  const uri=text.split(/\r?\n/).map(x=>x.trim()).find(x=>x&&!x.startsWith("#"));
  if(!uri)throw new Error("HLS playlist không có URI media");
  url=new URL(uri,url).href;
  if(/\.m3u8(?:$|[?#])/i.test(url))continue;
  return {url,manifestType:type};
 }
 throw new Error("Không tìm thấy segment trong HLS playlist");
}
async function testMedia(url){
 const isHls=/\.m3u8(?:$|[?#])/i.test(url);
 if(isHls){
  const segment=await firstHlsSegment(url);
  const probe=await rangeProbe(segment.url,"HLS segment");
  add("HLS manifest","pass",segment.manifestType);
  add("HLS segment Range",probe.pass?"pass":"fail","HTTP "+probe.status+" · "+probe.type+" · CORS "+(probe.cors?"OK":"FAIL")+" · Accept-Ranges "+probe.acceptRanges);
 }else{
  const probe=await rangeProbe(url,"MP4 media");
  const mimeOk=probe.type.startsWith("video/")||probe.type==="application/octet-stream";
  add("MP4 MIME",mimeOk?"pass":"fail",probe.type||"missing");
  add("MP4 byte-range + CORS",probe.pass?"pass":"fail","HTTP "+probe.status+" · CORS "+(probe.cors?"OK":"FAIL")+" · Accept-Ranges "+probe.acceptRanges);
 }
 video.src=url;video.preload="auto";video.load();
 add("Safari native HLS",video.canPlayType("application/vnd.apple.mpegurl")?"pass":"warn",video.canPlayType("application/vnd.apple.mpegurl")||"Không báo hỗ trợ HLS native");
 await new Promise((resolve,reject)=>{
  let done=false;const finish=(fn,value)=>{if(done)return;done=true;clearTimeout(timer);video.removeEventListener("loadeddata",ok);video.removeEventListener("error",bad);fn(value);};
  const ok=()=>finish(resolve,true),bad=()=>finish(reject,new Error("HTMLVideoElement media error "+(video.error?.code||"unknown")));
  const timer=setTimeout(()=>finish(reject,new Error("Không nhận được loadeddata trong 20 giây")),20000);
  video.addEventListener("loadeddata",ok,{once:true});video.addEventListener("error",bad,{once:true});
  if(video.readyState>=2)finish(resolve,true);
 });
 add("Video frame",video.readyState>=2&&video.videoWidth>0?"pass":"fail","readyState="+video.readyState+" · "+video.videoWidth+"×"+video.videoHeight);
}
async function runChecks(){
 run.disabled=true;run.textContent="ĐANG KIỂM TRA…";results.replaceChildren();checks.length=0;video.removeAttribute("src");video.load();
 try{
  const health=await requestJson("/health","Health");
  add("Worker health",health.ok?"pass":"fail",health.service+" · "+health.environment);
  const providers=await requestJson("/api/providers","Providers");
  const configured=(providers.data||[]).filter(x=>x.configured);
  add("Provider registry",configured.length?"pass":"fail",configured.length+"/"+(providers.data||[]).length+" provider đã cấu hình");
  const categories=await requestJson("/api/catalog/categories","Categories");
  add("Categories API",Array.isArray(categories.data)?"pass":"fail",(categories.data||[]).length+" danh mục · "+categories.sourceId);
  const list=await requestJson("/api/catalog/videos?page=1","Videos");
  if(!Array.isArray(list.items)||!list.items.length)throw new Error("Catalog API không trả video");
  add("Videos API","pass",list.items.length+" video · "+list.provider?.name);
  let detail=null;
  for(const item of list.items.slice(0,10)){
   const response=await requestJson("/api/providers/"+encodeURIComponent(item.sourceId)+"/videos/"+encodeURIComponent(item.id),"Video detail");
   if(response.data?.lines?.some(line=>line.episodes?.some(ep=>ep.url))){detail=response.data;break;}
  }
  if(!detail)throw new Error("10 video đầu không có playback URL hợp lệ");
  add("Video detail","pass",detail.title||detail.id);
  const episode=detail.lines.flatMap(line=>line.episodes||[]).find(ep=>ep.url);
  if(!episode)throw new Error("Thiếu episode URL");
  await testMedia(episode.url);
  summary.textContent="Hoàn tất. Kiểm tra này chạy trên "+navigator.userAgent+" · Origin "+location.origin;
 }catch(error){
  add("Luồng kiểm tra","fail",error.message||String(error));
  summary.textContent="Có bước chưa đạt. Gửi ảnh chụp kết quả này để tiếp tục xử lý.";
 }finally{
  run.disabled=false;run.textContent="CHẠY LẠI KIỂM TRA";
 }
}
run.addEventListener("click",runChecks);
$("clipform").addEventListener("load",()=>{$("form-status").textContent="Iframe phát sinh sự kiện load. Hãy kiểm tra form có hiển thị đầy đủ và thử gửi một đề xuất thử nghiệm."});
