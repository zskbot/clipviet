const API=window.CLIPVIET_API_BASE||"https://api.clipviet.live";
const $=id=>document.getElementById(id);
let page=1,pageCount=0,activeProvider="",categoryId="",keyword="",items=[];
const gate=$("age-gate");
try{if(sessionStorage.getItem("clipviet-age-confirmed")==="yes")gate.hidden=true;}catch{}
$("confirm").addEventListener("click",()=>{try{sessionStorage.setItem("clipviet-age-confirmed","yes");}catch{}gate.hidden=true;});
$("leave").addEventListener("click",()=>location.replace("https://www.google.com/"));
$("year").textContent=new Date().getFullYear();
function status(message){$("source-status").textContent=message;}
function makeOption(label,value){const option=document.createElement("option");option.textContent=label;option.value=String(value);return option;}
async function loadCategories(){
 const source=$("source").value;
 const url=new URL(API+"/api/catalog/categories");
 if(source)url.searchParams.set("sourceId",source);
 const response=await fetch(url,{headers:{Accept:"application/json"},cache:"no-store",redirect:"error"});
 const result=await response.json();if(!response.ok)throw new Error(result.error||"Category API error");
 activeProvider=result.sourceId;
 const select=$("category");select.replaceChildren(makeOption("Tất cả danh mục",""));
 for(const category of result.data){select.append(makeOption(category.name,category.id));}
 const sourceSelect=$("source");if(!sourceSelect.value)sourceSelect.dataset.active=activeProvider;
 status("Nguồn đang phục vụ: "+activeProvider+(result.failover?" · tự động chuyển nguồn dự phòng":"")+" · "+result.count+" danh mục lá");
}
function render(){
 const root=$("cards");root.replaceChildren();
 for(const item of items){
  const a=document.createElement("a");a.className="card";
  a.href="../watch/source.html?sourceId="+encodeURIComponent(item.sourceId)+"&vodId="+encodeURIComponent(item.id);
  const img=document.createElement("img");img.loading="lazy";img.decoding="async";img.alt=item.title;img.src=item.poster||"../poster-fallback.svg";img.addEventListener("error",()=>{img.src="../poster-fallback.svg";},{once:true});
  const body=document.createElement("div");body.className="card-body";
  const title=document.createElement("h2");title.textContent=item.title||"Untitled";
  const meta=document.createElement("p");meta.textContent=[item.year,item.area,item.categoryName].filter(Boolean).join(" · ");
  body.append(title,meta);a.append(img,body);root.append(a);
 }
 $("empty").hidden=items.length>0;$("count").textContent=(items.length?items.length+" VIDEO · ":"")+ "TỔNG "+Number($("count").dataset.total||0).toLocaleString("vi-VN");
 $("page-label").textContent="Trang "+page+" / "+Math.max(pageCount,1);
 $("prev").disabled=page<=1;$("next").disabled=pageCount===0||page>=pageCount;
}
async function loadVideos(){
 status("Đang tải trang "+page+"…");
 const url=new URL(API+"/api/catalog/videos");if($("source").value)url.searchParams.set("sourceId",$("source").value);
 url.searchParams.set("page",String(page));if(categoryId)url.searchParams.set("categoryId",categoryId);if(keyword)url.searchParams.set("keyword",keyword);
 try{
  const response=await fetch(url,{headers:{Accept:"application/json"},cache:"no-store",redirect:"error"});
  const result=await response.json();if(!response.ok)throw new Error(result.error||"Provider request failed");
  activeProvider=result.provider.id;items=result.items||[];page=result.page||page;pageCount=result.pageCount||0;
  $("count").dataset.total=String(result.total||0);$("source").dataset.active=activeProvider;
  status("Đang dùng "+result.provider.name+" · "+result.limit+" mục/trang · "+(result.failover?"đã tự động chuyển nguồn dự phòng":"API hoạt động"));
  render();
 }catch(error){items=[];pageCount=0;render();status("Không tải được nguồn: "+error.message);}
}
$("filters").addEventListener("submit",async e=>{e.preventDefault();page=1;categoryId=$("category").value;keyword=$("keyword").value.trim();await loadVideos();});
$("source").addEventListener("change",async()=>{page=1;categoryId="";$("category").value="";try{await loadCategories();await loadVideos();}catch(e){status("Không tải được danh mục: "+e.message);}});
$("category").addEventListener("change",()=>{categoryId=$("category").value;page=1;loadVideos();});
$("prev").addEventListener("click",()=>{if(page>1){page--;loadVideos();}});
$("next").addEventListener("click",()=>{if(page<pageCount){page++;loadVideos();}});
(async()=>{try{await loadCategories();await loadVideos();}catch(e){status("API chưa sẵn sàng: "+e.message);}})();