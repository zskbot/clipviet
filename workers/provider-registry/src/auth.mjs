const enc = new TextEncoder();
const ITERATIONS = 310000;
const SESSION_SECONDS = 60 * 60 * 12;
const EMAIL_RE = /^[a-z0-9._%+-]+@gmail\.com$/i;
const json = (data, status=200, headers={}) => new Response(JSON.stringify(data), {
  status, headers: { "content-type":"application/json; charset=utf-8", "cache-control":"no-store", "x-content-type-options":"nosniff", ...headers }
});
const hex = bytes => [...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,"0")).join("");
const random = (n=32) => crypto.getRandomValues(new Uint8Array(n));
async function digest(value) { return hex(await crypto.subtle.digest("SHA-256", typeof value==="string" ? enc.encode(value) : value)); }
function b64(bytes) { let s=""; for(const b of bytes)s+=String.fromCharCode(b); return btoa(s); }
function fromB64(value) { return Uint8Array.from(atob(value),c=>c.charCodeAt(0)); }
function equal(a,b) { const x=enc.encode(a||""),y=enc.encode(b||""); if(!x.length||x.length!==y.length)return false;let d=0;for(let i=0;i<x.length;i++)d|=x[i]^y[i];return d===0; }
function cookie(request,name) { const raw=request.headers.get("cookie")||""; for(const item of raw.split(";")){const i=item.indexOf("=");if(i>0&&item.slice(0,i).trim()===name)return item.slice(i+1).trim();}return ""; }
function cookieHeader(value,maxAge) { return "cv_session="+value+"; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age="+maxAge; }
function clearCookie() { return "cv_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0"; }
async function passwordHash(password,salt,iterations=ITERATIONS) {
  const key=await crypto.subtle.importKey("raw",enc.encode(password),"PBKDF2",false,["deriveBits"]);
  return b64(await crypto.subtle.deriveBits({name:"PBKDF2",hash:"SHA-256",salt,iterations},key,256));
}
function normalizeEmail(value) { return typeof value==="string" ? value.trim().toLowerCase() : ""; }
async function readBody(request) {
  const length=Number(request.headers.get("content-length")||0); if(length>4096)return null;
  const raw=await request.text(); if(raw.length>4096)return null;
  try{return JSON.parse(raw||"{}")}catch{return null}
}
function sameOrigin(request) { const origin=request.headers.get("origin"); return !origin || origin===new URL(request.url).origin; }
async function newSession(db,userId) {
  const token=b64(random(32)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_");
  const now=new Date(), expires=new Date(now.getTime()+SESSION_SECONDS*1000).toISOString();
  await db.prepare("INSERT INTO auth_sessions(token_hash,user_id,expires_at,created_at,last_seen_at) VALUES(?,?,?,?,?)")
    .bind(await digest(token),userId,expires,now.toISOString(),now.toISOString()).run();
  return token;
}
async function rateLimit(db,email,ip) {
  const bucket=await digest(email+"|"+ip), now=Date.now();
  const row=await db.prepare("SELECT failures,window_started_at,locked_until FROM auth_rate_limits WHERE bucket_hash=?").bind(bucket).first();
  if(row?.locked_until && Date.parse(row.locked_until)>now)return {blocked:true,bucket};
  if(!row || now-Date.parse(row.window_started_at)>15*60*1000) {
    await db.prepare("INSERT INTO auth_rate_limits(bucket_hash,failures,window_started_at,locked_until) VALUES(?,0,?,NULL) ON CONFLICT(bucket_hash) DO UPDATE SET failures=0,window_started_at=excluded.window_started_at,locked_until=NULL")
      .bind(bucket,new Date(now).toISOString()).run();
  }
  return {blocked:false,bucket};
}
async function failedLogin(db,bucket) {
  const now=new Date(), row=await db.prepare("SELECT failures,window_started_at FROM auth_rate_limits WHERE bucket_hash=?").bind(bucket).first();
  const fresh=!row || now.getTime()-Date.parse(row.window_started_at)>15*60*1000;
  const failures=(fresh?0:Number(row.failures||0))+1;
  const locked=failures>=5?new Date(now.getTime()+15*60*1000).toISOString():null;
  await db.prepare("INSERT INTO auth_rate_limits(bucket_hash,failures,window_started_at,locked_until) VALUES(?,?,?,?) ON CONFLICT(bucket_hash) DO UPDATE SET failures=excluded.failures,window_started_at=excluded.window_started_at,locked_until=excluded.locked_until")
    .bind(bucket,failures,fresh?now.toISOString():row.window_started_at,locked).run();
}
export async function sessionRole(request,env) {
  if(!env.PROVIDER_DB)return "";
  const token=cookie(request,"cv_session"); if(!token || token.length>128)return "";
  try {
    const row=await env.PROVIDER_DB.prepare("SELECT u.role,u.active,s.expires_at FROM auth_sessions s JOIN auth_users u ON u.id=s.user_id WHERE s.token_hash=?")
      .bind(await digest(token)).first();
    if(!row || row.active!==1 || Date.parse(row.expires_at)<=Date.now())return "";
    return row.role;
  } catch { return ""; }
}
export async function handleAuth(request,env) {
  const url=new URL(request.url), path=url.pathname, db=env.PROVIDER_DB;
  if(!db)return json({error:"Preview D1 is unavailable."},503);
  if(request.method==="GET"&&path==="/login")return authPage();
  if(request.method==="GET"&&path==="/auth/status") {
    const row=await db.prepare("SELECT COUNT(*) AS count FROM auth_users").first();
    return json({setupRequired:Number(row?.count||0)===0});
  }
  if(request.method==="GET"&&path==="/auth/me") {
    const role=await sessionRole(request,env); return role?json({authenticated:true,role}):json({authenticated:false},401);
  }
  if(!sameOrigin(request))return json({error:"Origin mismatch."},403);
  if(request.method==="POST"&&path==="/auth/bootstrap") {
    const body=await readBody(request);
    if(!body)return json({error:"Invalid request."},400);
    const email=normalizeEmail(body.email), password=typeof body.password==="string"?body.password:"";
    if(!EMAIL_RE.test(email)||password.length<12||password.length>128)return json({error:"Use a Gmail address and a password between 12 and 128 characters."},400);
    if(typeof env.AUTH_BOOTSTRAP_TOKEN!=="string"||!env.AUTH_BOOTSTRAP_TOKEN||!equal(body.bootstrapToken,env.AUTH_BOOTSTRAP_TOKEN))return json({error:"Bootstrap token is invalid or not configured."},403);
    const count=await db.prepare("SELECT COUNT(*) AS count FROM auth_users").first();
    if(Number(count?.count||0)!==0)return json({error:"Initial administrator has already been created."},409);
    const salt=random(16), hash=await passwordHash(password,salt), id=crypto.randomUUID(), now=new Date().toISOString();
    try {
      await db.prepare("INSERT INTO auth_users(id,email,password_hash,password_salt,password_iterations,role,active,created_at,last_login_at) VALUES(?,?,?,?,?,'admin',1,?,?)")
        .bind(id,email,hash,b64(salt),ITERATIONS,now,now).run();
      const token=await newSession(db,id);
      return json({ok:true,role:"admin"},200,{"set-cookie":cookieHeader(token,SESSION_SECONDS)});
    } catch { return json({error:"Account initialization failed; reload and try again."},409); }
  }
  if(request.method==="POST"&&path==="/auth/login") {
    const body=await readBody(request); if(!body)return json({error:"Invalid request."},400);
    const email=normalizeEmail(body.email), password=typeof body.password==="string"?body.password:"";
    if(!EMAIL_RE.test(email)||!password||password.length>128)return json({error:"Invalid email or password."},400);
    const ip=request.headers.get("CF-Connecting-IP")||"unknown", limit=await rateLimit(db,email,ip);
    if(limit.blocked)return json({error:"Too many attempts. Try again in 15 minutes."},429);
    const user=await db.prepare("SELECT id,password_hash,password_salt,password_iterations,role,active FROM auth_users WHERE email=?").bind(email).first();
    const salt=user?.password_salt?fromB64(user.password_salt):random(16);
    const calculated=await passwordHash(password,salt,Number(user?.password_iterations||ITERATIONS));
    if(!user||user.active!==1||!equal(calculated,user.password_hash)) {
      await failedLogin(db,limit.bucket); return json({error:"Invalid email or password."},401);
    }
    await db.prepare("DELETE FROM auth_rate_limits WHERE bucket_hash=?").bind(limit.bucket).run();
    const now=new Date().toISOString();
    await db.prepare("UPDATE auth_users SET last_login_at=? WHERE id=?").bind(now,user.id).run();
    await db.prepare("DELETE FROM auth_sessions WHERE expires_at<=?").bind(now).run();
    const token=await newSession(db,user.id);
    return json({ok:true,role:user.role},200,{"set-cookie":cookieHeader(token,SESSION_SECONDS)});
  }
  if(request.method==="POST"&&path==="/auth/logout") {
    const token=cookie(request,"cv_session");
    if(token)await db.prepare("DELETE FROM auth_sessions WHERE token_hash=?").bind(await digest(token)).run();
    return json({ok:true},200,{"set-cookie":clearCookie()});
  }
  return json({error:"Not found."},404);
}
function authPage() {
  const html=`<!doctype html><html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#050505"><title>ClipViet · Sign in</title>
<style>*{box-sizing:border-box}body{margin:0;background:#050505;color:#f5f5f5;font:14px ui-monospace,Menlo,monospace;min-height:100vh;display:grid;place-items:center;padding:20px}.panel{width:min(100%,420px);border:1px solid #292929;padding:24px}.tag{color:#f05252;font-size:11px;letter-spacing:.18em}h1{font-size:24px;margin:12px 0}p{color:#999;line-height:1.6}label{display:block;margin:16px 0 7px;color:#aaa;font-size:11px}input{width:100%;height:48px;border:1px solid #444;background:#0b0b0b;color:#fff;padding:0 12px;border-radius:0;font:14px inherit}button{width:100%;height:48px;border:1px solid #f05252;background:#111;color:#fff;font:700 12px inherit;margin-top:18px;border-radius:0}button:disabled{opacity:.5}.error{color:#ff9b9b;white-space:pre-wrap}.hidden{display:none}.note{font-size:11px;color:#777}</style></head><body><main class="panel"><div class="tag">CLIPVIET / PREVIEW</div><h1>Account sign in</h1><p>Đăng nhập bằng địa chỉ Gmail và mật khẩu riêng của ClipViet. Không nhập mật khẩu Google.</p><form id="login"><label>GMAIL</label><input name="email" type="email" autocomplete="username" placeholder="name@gmail.com" required><label>PASSWORD</label><input name="password" type="password" autocomplete="current-password" required><button id="submit">SIGN IN</button></form><form id="setup" class="hidden"><p>Khởi tạo quản trị viên đầu tiên. Cần bootstrap token được cấu hình riêng trong Cloudflare Worker Secrets.</p><label>GMAIL</label><input name="email" type="email" autocomplete="username" required><label>NEW PASSWORD (12+ CHARACTERS)</label><input name="password" type="password" minlength="12" autocomplete="new-password" required><label>ONE-TIME BOOTSTRAP TOKEN</label><input name="bootstrapToken" type="password" autocomplete="off" required><button id="setupSubmit">CREATE ADMIN ACCOUNT</button></form><p id="error" class="error hidden" role="alert"></p><p class="note">12-hour secure session · HttpOnly cookie · Preview database only</p></main>
<script>const $=id=>document.getElementById(id);async function send(path,data){const r=await fetch(path,{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"content-type":"application/json"},body:JSON.stringify(data)});const j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||"Request failed");location.replace("/admin")}async function init(){try{const s=await fetch("/auth/status",{cache:"no-store"}).then(r=>r.json());if(s.setupRequired){$("login").classList.add("hidden");$("setup").classList.remove("hidden")}}catch(e){$("error").textContent="Unable to load authentication status.";$("error").classList.remove("hidden")}}$("login").onsubmit=async e=>{e.preventDefault();$("submit").disabled=true;try{const f=new FormData(e.target);await send("/auth/login",{email:f.get("email"),password:f.get("password")})}catch(x){$("error").textContent=x.message;$("error").classList.remove("hidden")}finally{$("submit").disabled=false}};$("setup").onsubmit=async e=>{e.preventDefault();$("setupSubmit").disabled=true;try{const f=new FormData(e.target);await send("/auth/bootstrap",{email:f.get("email"),password:f.get("password"),bootstrapToken:f.get("bootstrapToken")})}catch(x){$("error").textContent=x.message;$("error").classList.remove("hidden")}finally{$("setupSubmit").disabled=false}};init();</script></body></html>`;
  return new Response(html,{status:200,headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","content-security-policy":"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'","x-content-type-options":"nosniff","referrer-policy":"no-referrer","x-frame-options":"DENY"}});
}
