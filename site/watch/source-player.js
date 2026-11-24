const API=window.CLIPVIET_API_BASE||"https://api.clipviet.live";
const params=new URLSearchParams(location.search),sourceId=params.get("sourceId"),vodId=params.get("vodId");
const $=id=>document.getElementById(id),video=$("video"),status=$("status");
let data=null,lineIndex=0,episodeIndex=0,hls=null,watchdog=null;
function say(text){status.textContent=text;}
function destroy(){if(watchdog){clearTimeout(watchdog);watchdog=null;}if(hls){hls.destroy();hls=null;}video.pause();video.removeAttribute("src");video.load();}
function currentEpisode(){return data?.lines?.[lineIndex]?.episodes?.[episodeIndex]||null;}
function setLineOptions(){const select=$("line");select.replaceChildren();data.lines.forEach((line,i)=>{const o=document.createElement("option");o.value=String(i);o.textContent=line.lineName;select.append(o);});select.value=String(lineIndex);$("switch").hidden=data.lines.length<2;}
function renderEpisodes(){const root=$("episodes");root.replaceChildren();const episodes=data.lines[lineIndex]?.episodes||[];episodes.forEach((ep,i)=>{const b=document.createElement("button");b.type="button";b.textContent=ep.name;b.setAttribute("aria-pressed",String(i===episodeIndex));b.addEventListener("click",()=>{episodeIndex=i;renderEpisodes();play();});root.append(b);});}
function fail(message){say(message);$("switch").hidden=data?.lines?.length<2;const ep=currentEpisode();if(ep){$("external").hidden=false;$("external").href=ep.url;}}
function play(){
 const ep=currentEpisode();if(!ep){fail("Không có URL phát hợp lệ trong đường phát này.");return;}
 destroy();$("external").hidden=false;$("external").href=ep.url;say("Đang nạp manifest trực tiếp từ CDN nguồn…");
 const isIOS=/iPhone|iPad|iPod/i.test(navigator.userAgent);
 const useHls=!isIOS&&window.Hls&&window.Hls.isSupported();
 let ready=false;
 const markReady=()=>{if(ready)return;ready=true;if(watchdog){clearTimeout(watchdog);watchdog=null;}say("Đường phát đã sẵn sàng. Nhấn Play để xem.");};
 watchdog=setTimeout(()=>{if(video.readyState<2||video.videoWidth===0)fail("Quá 12 giây chưa nhận được khung hình. Thử đổi đường phát.");},12000);
 video.addEventListener("loadeddata",markReady,{once:true});
 video.addEventListener("playing",markReady,{once:true});
 video.addEventListener("error",()=>fail("Trình duyệt không tải được video hoặc segment. Thử đổi đường phát."),{once:true});
 if(useHls){
  hls=new Hls({enableWorker:true,lowLatencyMode:false,manifestLoadingTimeOut:12000,fragLoadingTimeOut:12000});
  hls.loadSource(ep.url);hls.attachMedia(video);
  hls.on(Hls.Events.MANIFEST_PARSED,()=>say("Manifest HLS đã tải. Đang chờ dữ liệu video…"));
  hls.on(Hls.Events.ERROR,(_event,detail)=>{if(detail.fatal)fail("HLS báo lỗi fatal: "+detail.details+". Thử đổi đường phát.");});
 }else{
  video.src=ep.url;video.load();
  if(!isIOS&&!video.canPlayType("application/vnd.apple.mpegurl"))say("Trình duyệt này có thể không hỗ trợ HLS trực tiếp. Thử Safari hoặc mở link ngoài.");
 }
}
$("line").addEventListener("change",()=>{lineIndex=Number($("line").value)||0;episodeIndex=0;renderEpisodes();play();});
$("switch").addEventListener("click",()=>{if(data.lines.length<2)return;lineIndex=(lineIndex+1)%data.lines.length;episodeIndex=0;setLineOptions();renderEpisodes();play();});
(async()=>{
 if(!sourceId||!vodId){say("Thiếu sourceId hoặc vodId.");return;}
 try{
  const response=await fetch(API+"/api/providers/"+encodeURIComponent(sourceId)+"/videos/"+encodeURIComponent(vodId),{headers:{Accept:"application/json"},cache:"no-store",redirect:"error"});
  const payload=await response.json();if(!response.ok)throw new Error(payload.error||"Provider API error");
  data=payload.data;if(!data||!Array.isArray(data.lines)||!data.lines.length)throw new Error("Video không có đường phát hợp lệ.");
  $("title").textContent=data.title||"Video";
  $("meta").textContent=[data.sourceName,data.year,data.area,data.categoryName,data.duration].filter(Boolean).join(" · ");
  $("description").textContent=data.description||"";
  setLineOptions();renderEpisodes();play();
 }catch(error){$("title").textContent="Không tải được video";say(error.message);}
})();
window.addEventListener("pagehide",destroy);