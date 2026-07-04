'use strict';
/* ================= AUTH CONFIG =================
   Общий бэкенд приложения (Supabase). Заполняется при деплое. */
const AUTH_CONFIG = {
  url: '/sb',
  anonKey: 'sb_publishable_jkpMc9KlH_7RfPjAzwA1ZA_vgbLDfrx'
};
function authConfigured(){
  return AUTH_CONFIG.url.length > 1 && AUTH_CONFIG.anonKey.length > 20;
}
/* Пути к API в порядке приоритета: прокси на текущем домене → прокси Netlify → напрямую.
   Приложение само находит работающий у конкретного провайдера и запоминает его. */
const API_BASES = [
  '/sb',
  'https://grand-gelato-322c2c.netlify.app/sb',
  'https://btoorbyqzphpqejzgwmz.supabase.co'
];
let API_BASE = (function(){ try{ return localStorage.getItem('mytracker_apibase'); }catch(e){ return null; } })();
function apiBase(){ return API_BASE || AUTH_CONFIG.url; }
async function probeBase(base){
  try{
    const ctl = (typeof AbortController!=='undefined') ? new AbortController() : null;
    const t = ctl ? setTimeout(()=>ctl.abort(), 4000) : null;
    const r = await fetch(base + '/auth/v1/settings', {headers:{apikey:AUTH_CONFIG.anonKey}, signal: ctl?ctl.signal:undefined, cache:'no-store'});
    if(t) clearTimeout(t);
    return r.ok;
  }catch(e){ return false; }
}
let resolvingBase = null;
function resolveApiBase(force){
  if(resolvingBase) return resolvingBase;
  resolvingBase = (async()=>{
    try{
      if(API_BASE && !force && await probeBase(API_BASE)) return API_BASE;
      for(const b of API_BASES){
        if(b===API_BASE && !force) continue;
        if(await probeBase(b)){
          API_BASE = b;
          try{ localStorage.setItem('mytracker_apibase', b); }catch(e){}
          return b;
        }
      }
      return apiBase();
    } finally { resolvingBase = null; }
  })();
  return resolvingBase;
}

/* ================= STATE ================= */
const DEF_CATS = () => ({
  expense:['Жильё','Продукты','Кафе и рестораны','Транспорт','Здоровье','Развлечения','Одежда','Подписки','Образование','Долги','Другое'],
  income:['Зарплата','Премия','Фриланс','Проценты','Другое']
});
const DEF_CAT_ICONS = {'Жильё':'🏠','Продукты':'🛒','Кафе и рестораны':'🍽️','Транспорт':'🚕','Здоровье':'💊','Развлечения':'🎉','Одежда':'👕','Подписки':'📺','Образование':'📚','Долги':'💳','Другое':'📦','Зарплата':'💼','Премия':'🏆','Фриланс':'🧑‍💻','Проценты':'🏦'};
const DEFAULT_STATE = () => ({
  version: 2,
  updatedAt: 0,
  settings: { mode:'dark', scheme:'violet', userName:'', supabaseUrl:'', supabaseKey:'', syncId:'', autoSync:true,
    modules: { work:true, personal:true, budget:true, sport:true, review:true, health:false, learn:false, travel:false, people:false } },
  work: { yearGoals:[], quarterGoals:[], weekFocuses:[], dayTasks:[], team:[], teamTasks:[], recurring:[], projects:[] },
  personal: { yearGoals:[], projects:[], tasks:[], weekFocuses:[], people:[], ideas:[], businesses:[] },
  budget: { plan:[], planned:[], transactions:[], debts:[], savings:[], categories:DEF_CATS(), catIcons:Object.assign({},DEF_CAT_ICONS) },
  sport: { workouts:[], types:['Бег','Силовая','Плавание','Вело','Йога','Футбол','Теннис'], weeklyGoal:3, goals:[] },
  templates: [],
  health: { metrics:[], vitamins:[], vitaminLog:{}, checkups:[] },
  learn: { books:[], courses:[] },
  travel: { wishlist:[], trips:[] },
  people: { contacts:[] },
  mood: [],
  reviews: []
});
let S = load();
function migrate(s){
  const d = DEFAULT_STATE();
  s = Object.assign(d, s);
  { // миграция старого формата темы → режим + схема
    const incoming = s.settings || {};
    const validSchemes = ['violet','ocean','emerald','sunset','graphite','margarita'];
    const hadMode = ['dark','light'].includes(incoming.mode);
    const hadScheme = validSchemes.includes(incoming.scheme);
    const oldTheme = incoming.theme;
    s.settings = Object.assign(DEFAULT_STATE().settings, incoming);
    if(!hadMode || !hadScheme){
      const map = { dark:['dark','violet'], light:['light','violet'], ocean:['dark','ocean'],
        emerald:['dark','emerald'], sunset:['dark','sunset'], latte:['light','sunset'], graphite:['dark','graphite'] };
      const [mo, sc] = map[oldTheme] || ['dark','violet'];
      if(!hadMode) s.settings.mode = mo;
      if(!hadScheme) s.settings.scheme = sc;
    }
  }
  s.work = Object.assign(DEFAULT_STATE().work, s.work||{});
  s.personal = Object.assign(DEFAULT_STATE().personal, s.personal||{});
  s.budget = Object.assign(DEFAULT_STATE().budget, s.budget||{});
  if(!s.budget.categories || !s.budget.categories.expense) s.budget.categories = DEF_CATS();
  if(!s.budget.catIcons) s.budget.catIcons = {};
  Object.keys(DEF_CAT_ICONS).forEach(k=>{ if(!s.budget.catIcons[k]) s.budget.catIcons[k]=DEF_CAT_ICONS[k]; });
  s.budget.plan.forEach(x=>{ if(!x.category) x.category='Другое'; });
  s.budget.transactions.forEach(x=>{ if(!x.category) x.category='Другое'; });
  s.work.team.forEach(m=>{ if(!m.topics) m.topics=[]; });
  if(!Array.isArray(s.work.projects)) s.work.projects=[];
  if(!Array.isArray(s.personal.weekFocuses)) s.personal.weekFocuses=[];
  if(!Array.isArray(s.personal.people)) s.personal.people=[];
  if(!Array.isArray(s.personal.ideas)) s.personal.ideas=[];
  if(!Array.isArray(s.personal.businesses)) s.personal.businesses=[];
  s.personal.businesses.forEach(b=>{
    if(!Array.isArray(b.goals)) b.goals=[];
    if(!Array.isArray(b.tasks)) b.tasks=[];
    if(!Array.isArray(b.finance)) b.finance=[];
  });
  if(!s.sport || !Array.isArray(s.sport.workouts)) s.sport = DEFAULT_STATE().sport;
  if(!Array.isArray(s.sport.types) || !s.sport.types.length) s.sport.types = DEFAULT_STATE().sport.types;
  if(!s.sport.weeklyGoal) s.sport.weeklyGoal = 3;
  if(!Array.isArray(s.sport.goals)) s.sport.goals = [];
  if(!Array.isArray(s.templates)) s.templates = [];
  const DEF_MODS = { work:true, personal:true, budget:true, sport:true, review:true, health:false, learn:false, travel:false, people:false };
  if(!s.settings.modules) s.settings.modules = Object.assign({}, DEF_MODS);
  Object.keys(DEF_MODS).forEach(k=>{ if(typeof s.settings.modules[k] !== 'boolean') s.settings.modules[k] = DEF_MODS[k]; });
  if(!s.health || !Array.isArray(s.health.metrics)) s.health = DEFAULT_STATE().health;
  ['metrics','vitamins','checkups'].forEach(k=>{ if(!Array.isArray(s.health[k])) s.health[k]=[]; });
  if(!s.health.vitaminLog || typeof s.health.vitaminLog!=='object') s.health.vitaminLog = {};
  if(!s.learn || !Array.isArray(s.learn.books)) s.learn = DEFAULT_STATE().learn;
  if(!Array.isArray(s.learn.courses)) s.learn.courses = [];
  if(!s.travel || !Array.isArray(s.travel.trips)) s.travel = DEFAULT_STATE().travel;
  if(!Array.isArray(s.travel.wishlist)) s.travel.wishlist = [];
  if(!s.people || !Array.isArray(s.people.contacts)) s.people = DEFAULT_STATE().people;
  if(!Array.isArray(s.mood)) s.mood = [];
  // дедупликация повторяющихся задач (могла возникнуть при синхронизации)
  const seen = new Set();
  s.work.dayTasks = s.work.dayTasks.filter(t=>{
    if(!t.recId) return true;
    const k = t.recId+'|'+t.date;
    if(seen.has(k)) return false;
    seen.add(k); return true;
  });
  s.version = 2;
  return s;
}
function load(){
  try{
    const raw = localStorage.getItem('mytracker_v1');
    if(raw){ return migrate(JSON.parse(raw)); }
  }catch(e){}
  return DEFAULT_STATE();
}
function save(){
  S.updatedAt = Date.now();
  localStorage.setItem('mytracker_v1', JSON.stringify(S));
  schedulePush();
}
const uid = () => Math.random().toString(36).slice(2,9) + Date.now().toString(36).slice(-4);

/* ================= UTILS ================= */
const $ = sel => document.querySelector(sel);
const esc = s => String(s??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmtMoney = n => new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(n||0) + ' ₽';
const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const MONTHS_SHORT = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];
const DAYS = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
const todayStr = () => { const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
const curMonth = () => todayStr().slice(0,7);
const curYear = () => new Date().getFullYear();
const curQuarter = () => Math.floor(new Date().getMonth()/3)+1;
function weekStart(d){ // Monday of week, YYYY-MM-DD
  const dt = d ? new Date(d+'T12:00:00') : new Date();
  const day = (dt.getDay()+6)%7;
  dt.setDate(dt.getDate()-day);
  return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
}
function addDays(dateStr, n){
  const dt = new Date(dateStr+'T12:00:00'); dt.setDate(dt.getDate()+n);
  return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0');
}
function fmtDate(dateStr){
  if(!dateStr) return '';
  const d = new Date(dateStr+'T12:00:00');
  return d.getDate()+' '+MONTHS_SHORT[d.getMonth()] + (d.getFullYear()!==curYear() ? ' '+d.getFullYear() : '');
}
function fmtMonth(ym){ const [y,m]=ym.split('-'); return MONTHS[+m-1]+' '+y; }
function daysUntil(dateStr){
  const t = new Date(todayStr()+'T12:00:00'), d = new Date(dateStr+'T12:00:00');
  return Math.round((d-t)/86400000);
}
function deadlineChip(dl){
  if(!dl) return '';
  const n = daysUntil(dl);
  const cls = n<0 ? 'red' : n<=2 ? 'yellow' : '';
  const txt = n<0 ? 'просрочено · '+fmtDate(dl) : n===0 ? 'сегодня' : n===1 ? 'завтра' : fmtDate(dl);
  return `<span class="chip ${cls}">⏱ ${txt}</span>`;
}
function monthAdd(ym, n){
  let [y,m] = ym.split('-').map(Number);
  m += n;
  while(m>12){m-=12;y++;} while(m<1){m+=12;y--;}
  return y+'-'+String(m).padStart(2,'0');
}
const fmtMonthShort = ym => { const [y,m]=ym.split('-'); return MONTHS_SHORT[+m-1]+(+y!==curYear()?' '+y.slice(2):''); };
const AVATAR_COLORS = ['#6366f1','#a855f7','#ec4899','#f59e0b','#10b981','#3b82f6','#f43f5e','#14b8a6'];
const initials = name => name.trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase();
const plural = (n,a,b,c)=>{n=Math.abs(n)%100;const m=n%10;if(n>10&&n<20)return c;if(m>1&&m<5)return b;if(m===1)return a;return c;};

/* ================= TOAST / MODAL ================= */
let toastTimer;
function toast(msg){
  $('#toastRoot').innerHTML = `<div class="toast"></div>`;
  $('#toastRoot').firstElementChild.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=> $('#toastRoot').innerHTML='', 2200);
}
function openModal(title, bodyHtml, onSubmit, submitLabel='Сохранить'){
  $('#modalRoot').innerHTML = `
    <div class="modal-back" onclick="if(event.target===this)closeModal()">
      <form class="modal" id="modalForm">
        <h3>${title}</h3>
        ${bodyHtml}
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" onclick="closeModal()">Отмена</button>
          <button type="submit" class="btn btn-primary">${submitLabel}</button>
        </div>
      </form>
    </div>`;
  $('#modalForm').addEventListener('submit', e=>{
    e.preventDefault();
    const data = {};
    e.target.querySelectorAll('[name]').forEach(el=>{
      data[el.name] = el.type==='checkbox' ? el.checked : el.value;
    });
    if(onSubmit(data)!==false){ closeModal(); }
  });
  const f = $('#modalForm').querySelector('input,textarea,select');
  if(f && window.innerWidth>820) setTimeout(()=>f.focus(),50);
}
function closeModal(){ $('#modalRoot').innerHTML=''; }
function confirmDel(msg, fn){
  if(confirm(msg)){ fn(); save(); render(); }
}

/* ---- быстрый выбор месяца/даты (проваливание в год) ---- */
let _pickCb=null, _pickYear=curYear(), _pickDayMode=false;
function pickMonth(ym, cb, dayMode){
  _pickCb = cb; _pickDayMode = !!dayMode;
  _pickYear = +String(ym||curMonth()).slice(0,4);
  renderPickMonth();
}
function renderPickMonth(){
  $('#modalRoot').innerHTML = `<div class="modal-back" onclick="if(event.target===this)closeModal()">
    <div class="modal" style="max-width:340px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <button class="icon-btn" onclick="_pickYear--;renderPickMonth()">‹</button>
        <b style="font-size:16px">${_pickYear}</b>
        <button class="icon-btn" onclick="_pickYear++;renderPickMonth()">›</button>
      </div>
      <div class="grid" style="grid-template-columns:repeat(3,1fr);gap:8px">
        ${MONTHS_SHORT.map((mn,i)=>{
          const cur = _pickYear===curYear() && i===new Date().getMonth();
          return `<button class="btn ${cur?'btn-primary':'btn-ghost'} btn-sm" style="justify-content:center" onclick="pickMonthDone(${i+1})">${mn}</button>`;
        }).join('')}
      </div>
    </div></div>`;
}
function pickMonthDone(m){
  const ym = _pickYear+'-'+String(m).padStart(2,'0');
  if(_pickDayMode){ renderPickDay(ym); return; }
  const cb=_pickCb; closeModal(); cb(ym);
}
function renderPickDay(ym){
  const [y,m] = ym.split('-').map(Number);
  const days = new Date(y, m, 0).getDate();
  const first = (new Date(y, m-1, 1).getDay()+6)%7;
  $('#modalRoot').innerHTML = `<div class="modal-back" onclick="if(event.target===this)closeModal()">
    <div class="modal" style="max-width:360px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <button class="icon-btn" onclick="renderPickDay('${monthAdd(ym,-1)}')">‹</button>
        <b style="font-size:15px;cursor:pointer" title="Выбрать месяц" onclick="_pickYear=${y};renderPickMonth()">${fmtMonth(ym)}</b>
        <button class="icon-btn" onclick="renderPickDay('${monthAdd(ym,1)}')">›</button>
      </div>
      <div class="grid" style="grid-template-columns:repeat(7,1fr);gap:5px">
        ${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d=>`<div class="cal-h">${d}</div>`).join('')}
        ${Array(first).fill('<div></div>').join('')}
        ${Array.from({length:days},(_,i)=>{
          const ds = ym+'-'+String(i+1).padStart(2,'0');
          return `<button class="btn ${ds===todayStr()?'btn-primary':'btn-ghost'} btn-sm" style="padding:7px 0;justify-content:center" onclick="pickDayDone('${ds}')">${i+1}</button>`;
        }).join('')}
      </div>
    </div></div>`;
}
function pickDayDone(ds){ const cb=_pickCb; closeModal(); cb(ds); }
function pickDate(dateStr, cb){ pickMonth(String(dateStr||todayStr()).slice(0,7), cb, true); renderPickDay(String(dateStr||todayStr()).slice(0,7)); }


/* ================= UI-ХЕЛПЕРЫ (визуал) ================= */
function emptyBig(icon, title, hint){
  return `<div class="empty-big"><span class="ei">${icon}</span><div class="et">${title}</div><div class="eh">${hint||''}</div></div>`;
}
function sparkLine(values, color){
  if(!values.length || values.every(v=>!v)) return '';
  const w=100,h=26,max=Math.max(...values),min=Math.min(...values);
  const rng = (max-min)||1;
  const pts = values.map((v,i)=>((i/(values.length-1))*w).toFixed(1)+','+(h-3-((v-min)/rng)*(h-6)).toFixed(1)).join(' ');
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity=".9"/></svg>`;
}
function sparkBars(values, colorFn){
  if(!values.length || values.every(v=>!v)) return '';
  const w=100,h=26,max=Math.max(...values.map(Math.abs))||1;
  const step = w/values.length, bw = step-2;
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${values.map((v,i)=>{
    const bh = Math.max(2, Math.abs(v)/max*(h-4));
    return `<rect x="${(i*step+1).toFixed(1)}" y="${(h-2-bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="1.5" fill="${colorFn?colorFn(v):'var(--accent)'}" opacity=".85"/>`;
  }).join('')}</svg>`;
}
/* --- теги --- */
function parseTags(s){
  return String(s||'').split(',').map(t=>t.trim().replace(/^#/,'').toLowerCase()).filter(Boolean).slice(0,8);
}
function tagChips(tags){
  return (tags||[]).map(t=>`<span class="chip" style="color:var(--accent2)">#${esc(t)}</span>`).join('');
}
function tagsField(tags){
  return `<div class="field"><label>Теги (через запятую)</label><input name="tags" value="${esc((tags||[]).join(', '))}" placeholder="ждёт-ответа, 5минут"></div>`;
}
/* --- drag&drop сортировка --- */
let dragRowId=null, dragRowKind=null;
function rowDragStart(e, kind, id){
  dragRowId=id; dragRowKind=kind;
  e.currentTarget.classList.add('dragging');
  try{ e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed='move'; }catch(_){}
}
function rowDragEnd(e){ e.currentTarget.classList.remove('dragging'); }
function rowDrop(e, kind, targetId){
  e.preventDefault(); e.stopPropagation();
  if(dragRowKind!==kind || !dragRowId || dragRowId===targetId) return;
  const arr = kind==='day' ? S.work.dayTasks : S.personal.tasks;
  const from = arr.findIndex(x=>x.id===dragRowId);
  const to = arr.findIndex(x=>x.id===targetId);
  if(from<0||to<0) return;
  const [it] = arr.splice(from,1);
  arr.splice(to,0,it);
  dragRowId=null; save(); render();
}
/* --- импорт банковской выписки (CSV) --- */
const CAT_KEYWORDS = [
  ['Продукты', ['пятер','магнит','перекрест','лента','ашан','вкусвилл','дикси','продукт','супермаркет','азбука вкуса','самокат','лавка']],
  ['Кафе и рестораны', ['кафе','ресторан','кофе','бургер','пицц','суши','доставка еды','деливери','delivery','яндекс еда','додо','kfc','макдон','вкусно и точка','шоколадница']],
  ['Транспорт', ['такси','uber','метро','автобус','бензин','азс','лукойл','газпромнефт','роснефть','каршеринг','делимобиль','яндекс go','парковк','проезд']],
  ['Здоровье', ['аптек','клиник','стоматол','анализ','врач','фитнес','спортзал','world class','медицин']],
  ['Подписки', ['подписк','яндекс плюс','кинопоиск','иви','okko','netflix','spotify','apple.com','google','youtube','телеграм премиум']],
  ['Развлечения', ['кино','театр','концерт','бар','клуб','боулинг','квест','steam','playstation']],
  ['Одежда', ['одежд','обувь','wildberries','ozon','ламода','zara','спортмастер','h&m']],
  ['Жильё', ['жкх','квартплат','аренда','коммунал','электроэнерг','интернет','ростелеком','мтс','билайн','мегафон']],
  ['Образование', ['курс','школ','универ','книг','литрес','учеб']],
  ['Зарплата', ['зарплат','заработн','аванс','оклад']],
];
function autoCategory(name, type){
  const n = String(name||'').toLowerCase();
  for(const [cat, words] of CAT_KEYWORDS){
    if(words.some(w=>n.includes(w))){
      if(type==='income' && cat!=='Зарплата') continue;
      if(type==='expense' && cat==='Зарплата') continue;
      return cat;
    }
  }
  return 'Другое';
}
function parseCsvText(text){
  const firstLine = text.split(/\r?\n/)[0] || '';
  const delim = (firstLine.split(';').length > firstLine.split(',').length) ? ';' : ',';
  const rows = [];
  let row = [], cell = '', inQ = false;
  for(let i=0;i<text.length;i++){
    const c = text[i];
    if(inQ){
      if(c==='"' && text[i+1]==='"'){ cell+='"'; i++; }
      else if(c==='"') inQ = false;
      else cell += c;
    } else {
      if(c==='"') inQ = true;
      else if(c===delim){ row.push(cell); cell=''; }
      else if(c==='\n' || c==='\r'){
        if(cell!=='' || row.length){ row.push(cell); rows.push(row); row=[]; cell=''; }
        if(c==='\r' && text[i+1]==='\n') i++;
      }
      else cell += c;
    }
  }
  if(cell!=='' || row.length){ row.push(cell); rows.push(row); }
  return rows.filter(r=>r.some(x=>String(x).trim()!==''));
}
function parseCsvDate(s){
  s = String(s||'').trim();
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/);        // 2026-07-01
  if(m) return m[1]+'-'+m[2];
  m = s.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);  // 01.07.2026
  if(m) return m[3]+'-'+String(m[2]).padStart(2,'0');
  return null;
}
function parseCsvAmount(s){
  const n = parseFloat(String(s||'').replace(/\s|₽|руб\.?/gi,'').replace(',','.'));
  return isNaN(n) ? null : n;
}
let _csvRows = null;
function openCsvImport(){
  _csvRows = null;
  $('#modalRoot').innerHTML = `
  <div class="modal-back" onclick="if(event.target===this)closeModal()">
    <div class="modal" style="max-width:520px">
      <h3>⬆ Импорт банковской выписки (CSV)</h3>
      <div class="hint" style="margin-bottom:12px">Выгрузите операции из банка в CSV и выберите файл. Категории проставятся автоматически (Пятёрочка → Продукты, такси → Транспорт…), потом можно поправить.</div>
      <input type="file" accept=".csv,text/csv" onchange="csvFileChosen(this)">
      <div id="csvStep2" style="margin-top:14px"></div>
      <div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Отмена</button></div>
    </div>
  </div>`;
}
function csvFileChosen(input){
  const f = input.files[0]; if(!f) return;
  const r = new FileReader();
  r.onload = ()=>{
    _csvRows = parseCsvText(String(r.result));
    if(!_csvRows.length){ document.getElementById('csvStep2').innerHTML = '<div class="hint" style="color:var(--red)">Не удалось разобрать файл</div>'; return; }
    const cols = _csvRows[0].map((c,i)=>`<option value="${i}">${i+1}: ${esc(String(c).slice(0,28))}</option>`).join('');
    const guess = (words)=>{ const h=_csvRows[0].map(c=>String(c).toLowerCase()); const idx=h.findIndex(c=>words.some(w=>c.includes(w))); return idx; };
    const gd = guess(['дата','date']), ga = guess(['сумма','amount','сумм']), gn = guess(['описан','назнач','description','детали','категор','merchant','операц']);
    document.getElementById('csvStep2').innerHTML = `
      <div class="hint" style="margin-bottom:8px">Строк: ${_csvRows.length}. Укажите, где что:</div>
      <div class="frow">
        <div class="field"><label>Дата</label><select id="csvDate">${cols}</select></div>
        <div class="field"><label>Сумма</label><select id="csvAmt">${cols}</select></div>
        <div class="field"><label>Описание</label><select id="csvName">${cols}</select></div>
      </div>
      <label style="display:flex;gap:8px;align-items:center;font-size:13px;margin-bottom:8px">
        <input type="checkbox" id="csvHeader" checked style="width:auto"> Первая строка — заголовки</label>
      <label style="display:flex;gap:8px;align-items:center;font-size:13px;margin-bottom:12px">
        <input type="checkbox" id="csvNeg" checked style="width:auto"> Отрицательные суммы — расходы, положительные — доходы</label>
      <button class="btn btn-primary" style="width:100%;justify-content:center" onclick="runCsvImport()">Импортировать</button>`;
    if(gd>=0) document.getElementById('csvDate').value = gd;
    if(ga>=0) document.getElementById('csvAmt').value = ga;
    if(gn>=0) document.getElementById('csvName').value = gn;
  };
  r.readAsText(f, 'utf-8');
}
function runCsvImport(){
  const di = +document.getElementById('csvDate').value;
  const ai = +document.getElementById('csvAmt').value;
  const ni = +document.getElementById('csvName').value;
  const skipHeader = document.getElementById('csvHeader').checked;
  const negExpense = document.getElementById('csvNeg').checked;
  const rows = skipHeader ? _csvRows.slice(1) : _csvRows;
  let added = 0, skipped = 0;
  rows.forEach(r=>{
    const month = parseCsvDate(r[di]);
    const raw = parseCsvAmount(r[ai]);
    const name = String(r[ni]||'').trim().slice(0,80) || 'Операция';
    if(!month || raw===null || raw===0){ skipped++; return; }
    const type = negExpense ? (raw<0?'expense':'income') : 'expense';
    const amount = Math.abs(Math.round(raw*100)/100);
    if(S.budget.transactions.some(t=>t.month===month && t.amount===amount && t.name===name && t.type===type)){ skipped++; return; }
    S.budget.transactions.push({id:uid(), type, name, amount, month, category:autoCategory(name, type)});
    added++;
  });
  save(); closeModal(); render();
  toast(`Импортировано: ${added}${skipped?' · пропущено: '+skipped:''}`);
}

/* --- шаблоны проектов --- */
function saveAsTemplate(scope, projectId){
  let p, taskTitles;
  if(scope==='personal'){
    p = S.personal.projects.find(x=>x.id===projectId);
    taskTitles = S.personal.tasks.filter(t=>t.projectId===projectId).map(t=>t.title);
  } else {
    p = S.work.projects.find(x=>x.id===projectId);
    taskTitles = S.work.teamTasks.filter(t=>t.projectId===projectId).map(t=>t.title);
  }
  if(!p) return;
  openModal('Сохранить как шаблон', `
    <div class="field"><label>Название шаблона</label><input name="name" required value="${esc(p.name)}"></div>
    <div class="hint">Сохранится структура: иконка, описание и ${taskTitles.length} ${plural(taskTitles.length,'задача','задачи','задач')} (без дат и исполнителей). Потом создадите такой проект в один клик.</div>
  `, d=>{
    if(!d.name.trim()) return false;
    S.templates.push({id:uid(), scope, name:d.name.trim(), icon:p.icon||(scope==='personal'?'🚀':'📁'), desc:p.desc||'', tasks:taskTitles});
    save(); render(); toast('Шаблон сохранён ✓');
  });
}
function createFromTemplate(scope){
  const list = S.templates.filter(t=>t.scope===scope);
  if(!list.length){ toast('Пока нет шаблонов — сохраните проект как шаблон (кнопка ⧉)'); return; }
  openModal('Проект из шаблона', `
    <div class="field"><label>Шаблон</label><select name="tpl">
      ${list.map(t=>`<option value="${t.id}">${esc(t.icon)} ${esc(t.name)} · ${t.tasks.length} задач</option>`).join('')}
    </select></div>
    <div class="field"><label>Название нового проекта</label><input name="name" placeholder="Пусто — как у шаблона"></div>
  `, d=>{
    const tpl = S.templates.find(t=>t.id===d.tpl); if(!tpl) return false;
    const name = d.name.trim() || tpl.name;
    if(scope==='personal'){
      const pid = uid();
      S.personal.projects.push({id:pid, name, icon:tpl.icon, desc:tpl.desc, status:'active', partnerIds:[],
        color:PROJ_COLORS[S.personal.projects.length % PROJ_COLORS.length]});
      tpl.tasks.forEach(tt=>S.personal.tasks.push({id:uid(), projectId:pid, title:tt, done:false}));
    } else {
      const pid = uid();
      S.work.projects.push({id:pid, name, icon:tpl.icon, desc:tpl.desc, deadline:null, status:'active', memberIds:[],
        color:PROJ_COLORS[(S.work.projects.length+3) % PROJ_COLORS.length]});
      const firstMember = S.work.team[0];
      tpl.tasks.forEach(tt=>S.work.teamTasks.push({id:uid(), projectId:pid, memberId:firstMember?firstMember.id:null, title:tt, deadline:null, status:'todo'}));
    }
    save(); render(); toast('Проект создан из шаблона 🚀');
  }, 'Создать');
}
function delTemplate(id){ confirmDel('Удалить шаблон?',()=>{ S.templates=S.templates.filter(t=>t.id!==id); }); }

/* --- иконки категорий бюджета --- */
function catIcon(name){ return (S.budget.catIcons||{})[name] || '🏷️'; }
function editCatIcons(){
  const cats = [...new Set([...S.budget.categories.expense, ...S.budget.categories.income])];
  openModal('Иконки категорий', `<div class="hint" style="margin-bottom:12px">Поставьте свои эмодзи для категорий.</div>` +
    cats.map((c,i)=>`<div style="display:flex;gap:10px;align-items:center;margin-bottom:8px">
      <input name="ci_${i}" value="${esc(catIcon(c))}" maxlength="4" style="width:64px;flex:0 0 64px;text-align:center">
      <span style="font-size:14px">${esc(c)}</span></div>`).join(''), d=>{
    cats.forEach((c,i)=>{ const v=(d['ci_'+i]||'').trim(); if(v) S.budget.catIcons[c]=v; });
    save(); render();
  });
}
/* --- режим «Фокус дня» --- */
function openFocusMode(){ ensureRecurring(todayStr()); renderFocusMode(); }
function renderFocusMode(){
  const all = S.work.dayTasks.filter(t=>t.date===todayStr());
  const active = all.filter(t=>!t.done)
    .sort((a,b)=>({high:0,mid:1,low:2}[a.priority]??1)-({high:0,mid:1,low:2}[b.priority]??1))
    .slice(0,3);
  const doneCnt = all.filter(t=>t.done).length;
  $('#modalRoot').innerHTML = `<div class="focus-back">
    <div style="width:100%;max-width:560px">
      <div style="text-align:center;margin-bottom:24px">
        <div style="font-size:12px;color:var(--text3);letter-spacing:.18em;font-weight:700">ФОКУС ДНЯ</div>
        <div class="sub" style="margin-top:6px">${doneCnt} из ${all.length} выполнено · только самое важное</div>
      </div>
      ${active.length ? active.map(t=>`
        <div class="focus-task">
          <button class="checkbox" onclick="focusToggle('${t.id}')"></button>
          <div class="t" style="flex:1">${esc(t.title)}</div>
          ${t.priority==='high'?'<span class="chip red">важно</span>':''}
        </div>`).join('')
      : emptyBig('🎉','Все задачи дня выполнены!','Можно выдохнуть — или добавить ещё одну')}
      <div style="text-align:center;margin-top:28px">
        <button class="btn btn-ghost" onclick="closeModal();render()">Выйти из фокуса</button>
      </div>
    </div>
  </div>`;
}
function focusToggle(id){
  const t = S.work.dayTasks.find(x=>x.id===id);
  if(t){ t.done=true; t.doneAt=todayStr(); save(); toast('Сделано ✓'); renderFocusMode(); }
}
/* --- вводный тур --- */
function maybeTour(){
  // существующий пользователь (есть имя или данные) — тур не показываем, даже на новом устройстве
  if(S.settings.userName || !isEmptyState()){
    try{ localStorage.setItem('mytracker_tour_done','1'); }catch(e){}
    maybeAskName(); return;
  }
  if(localStorage.getItem('mytracker_tour_done')){ maybeAskName(); return; }
  showTour(0);
}
function showTour(i){
  const steps = [
    {h:'Добро пожаловать! 👋', b:`Это <b>Мой Трекер</b> — одна система вместо пяти приложений:
      <div style="margin-top:14px;line-height:2.1">💼 Работа: цели, команда, задачи<br>🚀 Личные проекты, идеи и бизнес<br>💰 Бюджет с прогнозом кэшфлоу<br>🏃 Спорт и активность<br>📝 Итоги недели</div>`},
    {h:'Как это устроено 🎯', b:`Логика простая — сверху вниз:<div style="margin-top:14px;line-height:2">
      1. Поставьте <b>цели на год</b><br>2. Разбейте на <b>квартальные</b> — прогресс года посчитается сам<br>3. Каждую неделю выбирайте <b>1–3 фокуса</b><br>4. Каждый день — <b>задачи дня</b> и режим «🎯 Фокус дня»</div>`},
    {h:'Деньги и форма 💪', b:`<div style="line-height:2">💰 <b>Бюджет</b>: план и факт по категориям, долги, копилки, прогноз на 12 месяцев<br>🏃 <b>Спорт</b>: тренировки, цель на неделю, серии<br>📝 Раз в неделю — 10 минут на <b>итоги</b>: сделанное подставится само</div>`},
    {h:'Начнём? 🚀', b:`<div class="field" style="margin-top:6px"><label>Как вас зовут?</label><input id="tourName" placeholder="Например: Сергей" value="${esc(S.settings.userName||'')}"></div>
      <div style="font-size:12.5px;font-weight:600;color:var(--text2);margin:12px 0 8px">ЧТО ЕЩЁ ХОТИТЕ ТРЕКАТЬ? (можно поменять в настройках)</div>
      ${MODULES.filter(m=>['health','learn','travel','people'].includes(m.id)).map(m=>`
        <label style="display:flex;align-items:center;gap:10px;font-size:14px;margin-bottom:7px;cursor:pointer">
          <input type="checkbox" id="tour_m_${m.id}" style="width:auto"> ${m.icon} ${m.name}
        </label>`).join('')}
      <div class="hint" style="margin-top:8px">Имя нужно только для приветствия. Можно начать с демо-данными — потом сотрёте одной кнопкой.</div>`}
  ];
  const s = steps[i];
  $('#modalRoot').innerHTML = `
  <div class="modal-back">
    <div class="modal" style="max-width:440px">
      <h3>${s.h}</h3>
      <div style="font-size:14px;color:var(--text2);line-height:1.6">${s.b}</div>
      <div style="display:flex;gap:6px;justify-content:center;margin:20px 0 4px">
        ${steps.map((_,k)=>`<span style="width:8px;height:8px;border-radius:50%;background:${k===i?'var(--accent)':'var(--border)'}"></span>`).join('')}
      </div>
      <div class="modal-actions" style="justify-content:space-between">
        <button class="btn btn-ghost" onclick="${i===0?'finishTour(false)':'showTour('+(i-1)+')'}">${i===0?'Пропустить':'← Назад'}</button>
        ${i<steps.length-1
          ? `<button class="btn btn-primary" onclick="showTour(${i+1})">Далее →</button>`
          : `<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">
              <button class="btn btn-ghost" onclick="finishTour(true)">🎲 С демо-данными</button>
              <button class="btn btn-primary" onclick="finishTour(false)">Начать →</button>
            </div>`}
      </div>
    </div>
  </div>`;
}
function finishTour(withDemo){
  const inp = document.getElementById('tourName');
  if(inp && inp.value.trim()){ S.settings.userName = inp.value.trim(); }
  ['health','learn','travel','people'].forEach(id=>{
    const el = document.getElementById('tour_m_'+id);
    if(el) S.settings.modules[id] = el.checked;
  });
  localStorage.setItem('mytracker_tour_done','1');
  nameAsked = true;
  closeModal();
  if(withDemo && isEmptyState()){ fillDemo(); }
  else { save(); render(); }
}

/* ================= МОДУЛИ И НАВИГАЦИЯ ================= */
const MODULES = [
  {id:'work',     icon:'💼', name:'Работа',          short:'Работа'},
  {id:'personal', icon:'🚀', name:'Личные проекты',  short:'Проекты'},
  {id:'budget',   icon:'💰', name:'Бюджет',          short:'Бюджет'},
  {id:'sport',    icon:'🏃', name:'Спорт',           short:'Спорт'},
  {id:'health',   icon:'❤️', name:'Здоровье',        short:'Здоровье'},
  {id:'learn',    icon:'📚', name:'Обучение',        short:'Учёба'},
  {id:'travel',   icon:'🌴', name:'Путешествия',     short:'Поездки'},
  {id:'people',   icon:'🤝', name:'Окружение',       short:'Люди'},
  {id:'review',   icon:'📝', name:'Итоги недели',    short:'Итоги'},
];
function modOn(id){
  const m = S.settings.modules || {};
  return m[id] !== false;
}
function renderNav(){
  const mods = MODULES.filter(m=>modOn(m.id));
  const side = document.getElementById('navMods');
  if(side) side.innerHTML = mods.map(m=>`<button class="nav-btn" data-view="${m.id}"><span class="ico">${m.icon}</span>${m.name}</button>`).join('');
  const bot = document.getElementById('bottomNav');
  if(bot) bot.innerHTML = `<button data-view="dashboard"><span class="ico">▦</span>Обзор</button>`
    + mods.map(m=>`<button data-view="${m.id}"><span class="ico">${m.icon}</span>${m.short}</button>`).join('')
    + `<button data-view="settings"><span class="ico">⚙︎</span>Ещё</button>`;
  document.querySelectorAll('[data-view]').forEach(b=>{ b.onclick = ()=>go(b.dataset.view); });
}
function toggleModule(id, on){
  S.settings.modules[id] = on;
  save();
  if(!on && VIEW===id) go('dashboard'); else render();
}

/* ================= ROUTER ================= */
let VIEW = localStorage.getItem('mytracker_view') || 'dashboard';
const SUB = JSON.parse(localStorage.getItem('mytracker_sub')||'{}'); // sub-tabs per view
function go(v){ VIEW=v; localStorage.setItem('mytracker_view',v); render(); window.scrollTo(0,0); }
function setSub(view, val){ SUB[view]=val; localStorage.setItem('mytracker_sub', JSON.stringify(SUB)); render(); }
renderNav();

let healthChart = null;
function destroyCharts(){
  try{
    [cfChart, histChart, catChart, sportChart, healthChart].forEach(c=>{ if(c) c.destroy(); });
    cfChart = histChart = catChart = sportChart = healthChart = null;
    Object.keys(bizCharts).forEach(k=>{ bizCharts[k].destroy(); delete bizCharts[k]; });
  }catch(e){}
}
function render(){
  destroyCharts();
  renderNav();
  if(MODULES.some(m=>m.id===VIEW) && !modOn(VIEW)) VIEW = 'dashboard';
  document.querySelectorAll('[data-view]').forEach(b=> b.classList.toggle('active', b.dataset.view===VIEW));
  const views = {dashboard:vDashboard, work:vWork, personal:vPersonal, budget:vBudget, sport:vSport, review:vReview, settings:vSettings,
    health:vHealth, learn:vLearn, travel:vTravel, people:vPeople};
  const vEl = $('#view');
  vEl.innerHTML = (views[VIEW]||vDashboard)();
  vEl.classList.remove('anim'); void vEl.offsetWidth; vEl.classList.add('anim');
  if(VIEW==='budget'){ drawForecast(); drawHistory(); drawDonut(); }
  if(VIEW==='sport'){ drawSportChart(); }
  if(VIEW==='health'){ drawHealthChart(); }
  if(VIEW==='personal'){ drawBizCharts(); }
}

/* theme: режим (тёмный/светлый) × цветовая схема */
const SCHEMES = {
  violet:  ['Стандарт', 'linear-gradient(135deg,#6366f1,#a855f7)'],
  ocean:   ['Океан',    'linear-gradient(135deg,#0284c7,#22d3ee)'],
  emerald: ['Изумруд',  'linear-gradient(135deg,#059669,#34d399)'],
  sunset:  ['Закат',    'linear-gradient(135deg,#ea580c,#f472b6)'],
  graphite:['Графит',   'linear-gradient(135deg,#475569,#94a3b8)'],
  margarita:['Маргарита','linear-gradient(135deg,#db2777,#f472b6)']
};
function applyTheme(){
  const el = document.documentElement;
  el.dataset.mode = S.settings.mode==='light' ? 'light' : 'dark';
  el.dataset.scheme = SCHEMES[S.settings.scheme] ? S.settings.scheme : 'violet';
}
function themeLabel(){
  return (S.settings.mode==='light'?'Светлый':'Тёмный')+' · '+(SCHEMES[S.settings.scheme]||SCHEMES.violet)[0];
}
function openThemePicker(){
  const mode = S.settings.mode==='light' ? 'light' : 'dark';
  const scheme = SCHEMES[S.settings.scheme] ? S.settings.scheme : 'violet';
  $('#modalRoot').innerHTML = `
  <div class="modal-back" onclick="if(event.target===this)closeModal()">
    <div class="modal" style="max-width:420px">
      <h3>🎨 Оформление</h3>
      <div style="font-size:12.5px;font-weight:600;color:var(--text2);margin-bottom:8px">РЕЖИМ</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:18px">
        <button class="btn ${mode==='dark'?'btn-primary':'btn-ghost'}" style="justify-content:center;padding:11px" onclick="setMode('dark')">🌙 Тёмный</button>
        <button class="btn ${mode==='light'?'btn-primary':'btn-ghost'}" style="justify-content:center;padding:11px" onclick="setMode('light')">☀️ Светлый</button>
      </div>
      <div style="font-size:12.5px;font-weight:600;color:var(--text2);margin-bottom:8px">ЦВЕТОВАЯ СХЕМА</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        ${Object.entries(SCHEMES).map(([k,[name,grad]])=>`
        <button class="btn btn-ghost" style="justify-content:flex-start;gap:10px;padding:11px;
          ${scheme===k?'border-color:var(--accent);color:var(--text)':''}"
          onclick="setScheme('${k}')">
          <span style="width:18px;height:18px;border-radius:50%;background:${grad};flex-shrink:0"></span>${name} ${scheme===k?'✓':''}
        </button>`).join('')}
      </div>
      <div class="hint" style="margin-top:12px">Схема подстраивается под выбранный режим: в тёмном — глубокие тона, в светлом — мягкие оттенки.</div>
      <div class="modal-actions"><button class="btn btn-ghost" onclick="closeModal()">Готово</button></div>
    </div>
  </div>`;
}
function setMode(m){ S.settings.mode = m; applyTheme(); save(); render(); openThemePicker(); }
function setScheme(k){ S.settings.scheme = k; applyTheme(); save(); render(); openThemePicker(); }
$('#themeBtn').addEventListener('click', openThemePicker);
/* ================= SHARED: GOALS ================= */
const G_STATUS = {track:['🟢 по плану','green'], risk:['🟡 под угрозой','yellow'], behind:['🔴 отстаю','red']};
function goalProgress(g, scope){
  if(scope==='work'){
    const linked = S.work.quarterGoals.filter(q=>q.goalId===g.id);
    if(linked.length) return {pct:Math.round(linked.filter(q=>q.done).length/linked.length*100), auto:true, n:linked.length};
  }
  return {pct:g.progress||0, auto:false};
}
function goalCard(g, scope){ // scope: 'work'|'personal'
  const p = goalProgress(g, scope);
  const st = G_STATUS[g.status];
  return `<div class="card" style="padding:16px 18px">
    <div style="display:flex;align-items:flex-start;gap:10px">
      <div class="grow" style="flex:1;min-width:0">
        <div class="item-title" style="font-size:15px;font-weight:600">${esc(g.title)}</div>
        ${g.desc?`<div class="sub">${esc(g.desc)}</div>`:''}
        ${st?`<div style="margin-top:6px"><span class="chip ${st[1]}">${st[0]}</span></div>`:''}
      </div>
      <button class="icon-btn" onclick="editGoal('${scope}','${g.id}')">✎</button>
      <button class="icon-btn btn-danger" onclick="delGoal('${scope}','${g.id}')">✕</button>
    </div>
    ${p.auto ? `<div class="item-meta" style="margin-top:12px"><span>прогресс из ${p.n} ${plural(p.n,'квартальной цели','квартальных целей','квартальных целей')}</span>
      <span class="mono" style="font-weight:700;color:var(--text)">${p.pct}%</span></div>`
    : `<div class="range-wrap" style="margin-top:12px">
      <input type="range" min="0" max="100" value="${p.pct}" style="flex:1"
        oninput="this.nextElementSibling.textContent=this.value+'%'"
        onchange="setGoalProgress('${scope}','${g.id}',this.value)">
      <span class="mono" style="font-size:13px;font-weight:700;width:42px;text-align:right">${p.pct}%</span>
    </div>`}
    <div class="progress" style="margin-top:8px"><div style="width:${p.pct}%"></div></div>
  </div>`;
}
function goalStatusField(g){
  return `<div class="field"><label>Статус</label><select name="status">
    <option value="">— не задан —</option>
    ${Object.entries(G_STATUS).map(([k,[l]])=>`<option value="${k}" ${g&&g.status===k?'selected':''}>${l}</option>`).join('')}
  </select></div>`;
}
function goalsList(scope){
  const yr = SUB[scope+'Year'] || curYear();
  return S[scope].yearGoals.filter(g=>+g.year===+yr);
}
function addGoal(scope){
  const yr = SUB[scope+'Year'] || curYear();
  openModal('Новая цель на '+yr+' год', `
    <div class="field"><label>Цель</label><input name="title" required placeholder="Например: вырасти до Senior PM"></div>
    <div class="field"><label>Описание / критерии успеха</label><textarea name="desc" placeholder="Как пойму, что достиг"></textarea></div>
    <div class="frow">
      <div class="field"><label>Год</label><input name="year" type="number" value="${yr}"></div>
      ${goalStatusField(null).replace('<div class="field">','<div class="field">')}
    </div>
  `, d=>{
    if(!d.title.trim()) return false;
    S[scope].yearGoals.push({id:uid(), title:d.title.trim(), desc:d.desc.trim(), year:+d.year||curYear(), progress:0, status:d.status});
    save(); render();
  });
}
function editGoal(scope,id){
  const g = S[scope].yearGoals.find(x=>x.id===id); if(!g) return;
  openModal('Редактировать цель', `
    <div class="field"><label>Цель</label><input name="title" required value="${esc(g.title)}"></div>
    <div class="field"><label>Описание</label><textarea name="desc">${esc(g.desc||'')}</textarea></div>
    <div class="frow">
      <div class="field"><label>Год</label><input name="year" type="number" value="${g.year}"></div>
      ${goalStatusField(g)}
    </div>
  `, d=>{ Object.assign(g,{title:d.title.trim(),desc:d.desc.trim(),year:+d.year||g.year||curYear(),status:d.status}); save(); render(); });
}
function delGoal(scope,id){ confirmDel('Удалить цель?', ()=>{
  S[scope].yearGoals = S[scope].yearGoals.filter(g=>g.id!==id);
  if(scope==='work') S.work.quarterGoals.forEach(q=>{ if(q.goalId===id) q.goalId=null; });
}); }
function setGoalProgress(scope,id,v){
  const g = S[scope].yearGoals.find(x=>x.id===id); if(g){ g.progress=+v; save(); render(); }
}
function yearSelector(scope){
  const years = new Set([curYear()-1, curYear(), curYear()+1]);
  S[scope].yearGoals.forEach(g=>years.add(+g.year));
  const yr = SUB[scope+'Year'] || curYear();
  return `<select style="width:auto" onchange="setSub('${scope}Year',+this.value)">
    ${[...years].sort().map(y=>`<option ${y===+yr?'selected':''}>${y}</option>`).join('')}
  </select>`;
}

/* ================= DASHBOARD ================= */
function greeting(){
  const h = new Date().getHours();
  const sets = {
    night:   ['Доброй ночи','Тихой ночи','Полуночный режим 🌙'],
    morning: ['Доброе утро','С добрым утром','Продуктивного утра','Отличного утра','Утро — время планов'],
    day:     ['Добрый день','Привет','Хорошего дня','Снова за дело','Рабочий настрой'],
    evening: ['Добрый вечер','Привет','Хорошего вечера','Время подвести итоги дня']
  };
  const arr = sets[h<5?'night':h<12?'morning':h<18?'day':'evening'];
  return arr[Math.floor(Date.now()/86400000) % arr.length];
}
let nameAsked = false;
function maybeAskName(){
  if(S.settings.userName || nameAsked) return;
  try{ if(localStorage.getItem('mytracker_name_asked')) return; }catch(e){}
  nameAsked = true;
  try{ localStorage.setItem('mytracker_name_asked','1'); }catch(e){}
  setTimeout(()=>{
    if(document.getElementById('modalForm')) return; // не перебиваем другую форму
    openModal('Как вас зовут? 👋', `
      <div class="field"><label>Имя</label><input name="name" required placeholder="Например: Сергей"></div>
      <div class="hint">Будет использоваться в приветствии на дашборде. Изменить можно в настройках.</div>
    `, d=>{
      if(!d.name.trim()) return false;
      S.settings.userName = d.name.trim();
      save(); render(); toast('Приятно познакомиться, '+S.settings.userName+'!');
    }, 'Сохранить');
  }, 500);
}
function overdueDayTasks(){ return S.work.dayTasks.filter(x=>!x.done && x.date && x.date<todayStr()); }
function moveTaskToToday(t){
  // повторяющаяся задача: если сегодняшняя копия уже создана — удаляем старую, а не дублируем
  if(t.recId && S.work.dayTasks.some(x=>x.id!==t.id && x.recId===t.recId && x.date===todayStr())){
    S.work.dayTasks = S.work.dayTasks.filter(x=>x.id!==t.id);
  } else t.date = todayStr();
}
function rolloverAll(){
  overdueDayTasks().slice().forEach(moveTaskToToday);
  save(); render(); toast('Перенесено на сегодня ✓');
}
function doneThisWeek(){
  const ws = weekStart(), we = addDays(ws,6);
  const day = S.work.dayTasks.filter(x=>{ const d=x.doneAt||x.date; return x.done && d && d>=ws && d<=we; }).length;
  const pers = S.personal.tasks.filter(x=>x.done && x.doneAt && x.doneAt>=ws && x.doneAt<=we).length;
  const team = S.work.teamTasks.filter(x=>x.status==='done' && x.doneAt && x.doneAt>=ws && x.doneAt<=we).length;
  return day+pers+team;
}
function upcomingDeadlines(){
  const items = [];
  S.work.teamTasks.filter(t=>t.status!=='done'&&t.deadline).forEach(t=>{
    const m = S.work.team.find(x=>x.id===t.memberId);
    items.push({title:t.title, sub:'👥 '+(m?m.name:''), dl:t.deadline, view:'work', subtab:['work','team']});
  });
  S.personal.tasks.filter(t=>!t.done&&t.deadline).forEach(t=>{
    const p = S.personal.projects.find(x=>x.id===t.projectId);
    items.push({title:t.title, sub:'🚀 '+(p?p.name:''), dl:t.deadline, view:'personal', subtab:['personal','projects']});
  });
  S.personal.businesses.forEach(b=>b.tasks.filter(t=>!t.done&&t.deadline).forEach(t=>{
    items.push({title:t.title, sub:'🏢 '+b.name, dl:t.deadline, view:'personal', subtab:['personal','biz']});
  }));
  if(modOn('health')) S.health.checkups.forEach(c=>{
    if(!c.lastDate || !c.intervalMonths) return;
    const next = monthAdd(c.lastDate.slice(0,7), c.intervalMonths) + c.lastDate.slice(7);
    if(next <= addDays(todayStr(),7)) items.push({title:'Чекап: '+c.name, sub:'🩺 здоровье', dl:next, view:'health', subtab:null});
  });
  if(modOn('travel')) S.travel.trips.forEach(t=>{
    if(t.start && t.start >= todayStr()) items.push({title:'Поездка: '+t.name, sub:'🌴 путешествия', dl:t.start, view:'travel', subtab:null});
  });
  return items.filter(i=>daysUntil(i.dl)<=7).sort((a,b)=>a.dl.localeCompare(b.dl)).slice(0,8);
}
function vDashboard(){
  ensureRecurring(todayStr());
  const t = todayStr();
  const workToday = S.work.dayTasks.filter(x=>x.date===t);
  const focuses = [
    ...S.work.weekFocuses.filter(f=>f.weekStart===weekStart()).map(f=>({f,scope:'work'})),
    ...S.personal.weekFocuses.filter(f=>f.weekStart===weekStart()).map(f=>({f,scope:'personal'}))
  ];
  const wGoals = S.work.yearGoals.filter(g=>+g.year===curYear());
  const pGoals = S.personal.yearGoals.filter(g=>+g.year===curYear());
  const allGoals = [...wGoals.map(g=>({g,p:goalProgress(g,'work').pct})), ...pGoals.map(g=>({g,p:goalProgress(g,'personal').pct}))];
  const avgProgress = allGoals.length ? Math.round(allGoals.reduce((s,x)=>s+x.p,0)/allGoals.length) : 0;
  const m = curMonth();
  const inc = factTotal('income',m), exp = factTotal('expense',m);
  const savTotal = S.budget.savings.reduce((s,x)=>s+(x.current||0),0);
  const debtTotal = S.budget.debts.reduce((s,x)=>s+Math.max(0,(x.total||0)-(x.paid||0)),0);
  const savingsRate = inc>0 ? Math.round((inc-exp)/inc*100) : null;
  const saldoHist = Array.from({length:6},(_,i)=>{ const mm = monthAdd(curMonth(), i-5); return factTotal('income',mm)-factTotal('expense',mm); });
  const capHist = saldoHist.reduce((acc,v)=>{ acc.push((acc.length?acc[acc.length-1]:0)+v); return acc; },[]);
  const teamDoneHist = Array.from({length:6},(_,i)=>{ const ws2 = addDays(weekStart(),-7*(5-i)), we2 = addDays(ws2,6);
    return S.work.teamTasks.filter(x=>x.status==='done' && x.doneAt && x.doneAt>=ws2 && x.doneAt<=we2).length; });
  const overdueTeam = S.work.teamTasks.filter(x=>x.status!=='done' && x.deadline && daysUntil(x.deadline)<0).length;
  const myOverdue = overdueDayTasks();
  const inbox = S.work.dayTasks.filter(x=>!x.date && !x.done);
  const deadlines = upcomingDeadlines();
  const dt = new Date();

  return `
  <div class="page-head">
    <div><h1>${greeting()}${S.settings.userName?', '+esc(S.settings.userName):''} 👋</h1>
    <div class="sub">${DAYS[dt.getDay()]}, ${dt.getDate()} ${MONTHS_SHORT[dt.getMonth()]} ${dt.getFullYear()} · Q${curQuarter()} · выполнено за неделю: <b>${doneThisWeek()}</b> ${modOn('sport')?` · 🏃 <b>${weekWorkouts(weekStart()).length}/${S.sport.weeklyGoal}</b>`:''}</div></div>
    <button class="btn btn-primary" onclick="openFocusMode()">🎯 Фокус дня</button>
  </div>
  <div class="quick-add">
    <input id="searchBox" placeholder="🔍 Поиск по задачам, целям, проектам, людям, финансам…" oninput="doSearch(this.value)">
  </div>
  <div id="searchOut"></div>
  ${isEmptyState()?`<div class="card" style="margin-bottom:16px;text-align:center;padding:28px">
    <div style="font-size:15px;font-weight:600;margin-bottom:6px">Трекер пока пуст</div>
    <div class="hint" style="margin-bottom:14px">Начните добавлять свои цели и задачи — или посмотрите, как всё выглядит на примере.</div>
    <button class="btn btn-primary" onclick="fillDemo()">🎲 Заполнить демо-данными</button>
  </div>`:''}
  ${myOverdue.length?`<div class="card" style="margin-bottom:16px;border-color:var(--red)">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <b style="color:var(--red)">⚠ Просрочено задач: ${myOverdue.length}</b>
      <button class="btn btn-ghost btn-sm" onclick="rolloverAll()">Перенести всё на сегодня →</button>
    </div>
    ${myOverdue.slice(0,5).map(x=>`<div class="item-row"><div class="grow"><div class="item-title">${esc(x.title)}</div>
      <div class="item-meta">${fmtDate(x.date)}</div></div>
      <button class="btn btn-ghost btn-sm" onclick="moveToToday('${x.id}')">→ сегодня</button></div>`).join('')}
  </div>`:''}
  <div class="grid grid4" style="margin-bottom:16px">
    <div class="card stat-card"><div class="lbl">🎯 Прогресс целей ${curYear()}</div><div class="val">${avgProgress}%</div>
      <div class="progress" style="margin-top:10px"><div style="width:${avgProgress}%"></div></div></div>
    <div class="card stat-card"><div class="lbl">💰 ${MONTHS[dt.getMonth()]}</div>
      <div class="val mono" style="color:${inc-exp>=0?'var(--green)':'var(--red)'}">${inc-exp>=0?'+':''}${fmtMoney(inc-exp)}</div>
      <div class="sub2 mono">${savingsRate!==null?`норма сбережений ${savingsRate}%`:`↑ ${fmtMoney(inc)} · ↓ ${fmtMoney(exp)}`}</div>
      ${sparkBars(saldoHist, v=>v>=0?'var(--green)':'var(--red)')}</div>
    <div class="card stat-card"><div class="lbl">🏛 Капитал (накопления − долги)</div>
      <div class="val mono" style="color:${savTotal-debtTotal>=0?'var(--green)':'var(--red)'}">${fmtMoney(savTotal-debtTotal)}</div>
      <div class="sub2 mono">🏦 ${fmtMoney(savTotal)} · 💳 ${fmtMoney(debtTotal)}</div>
      ${sparkLine(capHist,'var(--green)')}</div>
    <div class="card stat-card"><div class="lbl">👥 Команда</div><div class="val">${S.work.teamTasks.filter(x=>x.status!=='done').length} задач</div>
      <div class="sub2">${overdueTeam?`<span style="color:var(--red)">⚠ ${overdueTeam} просрочено</span>`:'Просрочек нет'}</div>
      ${sparkLine(teamDoneHist,'var(--accent2)')}</div>
  </div>
  <div style="margin-bottom:16px">${calendarBlock('all')}</div>
  <div class="grid grid2">
    <div class="card">
      <h2>✅ Сегодня</h2>
      ${workToday.length ? workToday.map(x=>dayTaskRow(x)).join('') : '<div class="empty">Задач на сегодня нет</div>'}
      ${inbox.length?`<div style="font-size:12px;font-weight:600;color:var(--text3);margin:12px 0 4px">📥 ИНБОКС · ${inbox.length}</div>
        ${inbox.slice(0,4).map(x=>`<div class="item-row"><div class="grow"><div class="item-title">${esc(x.title)}</div></div>
        <button class="btn btn-ghost btn-sm" onclick="moveToToday('${x.id}')">→ сегодня</button></div>`).join('')}`:''}
      ${deadlines.length?`<div style="font-size:12px;font-weight:600;color:var(--text3);margin:12px 0 4px">⏱ БЛИЖАЙШИЕ ДЕДЛАЙНЫ</div>
        ${deadlines.map(d=>`<div class="item-row"><div class="grow"><div class="item-title">${esc(d.title)}</div>
        <div class="item-meta">${esc(d.sub)} ${deadlineChip(d.dl)}</div></div></div>`).join('')}`:''}
    </div>
    <div class="card">
      <h2>🔥 Фокусы недели</h2>
      ${focuses.length ? focuses.map(x=>focusRow(x.f, x.scope, true)).join('') : '<div class="empty">Фокусы недели не заданы</div>'}
      <div style="display:flex;gap:8px;margin-top:12px">
        ${modOn('work')?`<button class="btn btn-ghost btn-sm" onclick="addFocus('work')">+ рабочий</button>`:''}
        ${modOn('personal')?`<button class="btn btn-ghost btn-sm" onclick="addFocus('personal')">+ личный</button>`:''}
      </div>
      ${allGoals.length?`<div style="font-size:12px;font-weight:600;color:var(--text3);margin:16px 0 4px">ЦЕЛИ ГОДА</div>
      ${allGoals.slice(0,5).map(x=>`<div class="item-row"><div class="grow"><div class="item-title">${esc(x.g.title)}</div>
        <div class="progress" style="margin-top:6px"><div style="width:${x.p}%"></div></div></div>
        <span class="mono" style="font-size:13px;font-weight:700">${x.p}%</span></div>`).join('')}`:''}
    </div>
  </div>`;
}
function moveToToday(id){
  const t = S.work.dayTasks.find(x=>x.id===id);
  if(t){ moveTaskToToday(t); save(); render(); }
}
/* ---- global search ---- */
function doSearch(q){
  const out = document.getElementById('searchOut');
  q = q.trim().toLowerCase();
  if(!q || q.length<2){ out.innerHTML=''; return; }
  const hit = s => String(s||'').toLowerCase().includes(q);
  const res = [];
  S.work.dayTasks.forEach(x=>{ if(hit(x.title)||hit(x.notes)||(x.tags||[]).some(hit)) res.push({l:x.title, s:'✅ задача · '+(x.date?fmtDate(x.date):'инбокс'), v:'work', t:['work','week']}); });
  S.work.teamTasks.forEach(x=>{ if(hit(x.title)||hit(x.notes)){ const m=S.work.team.find(y=>y.id===x.memberId);
    res.push({l:x.title, s:'👥 '+(m?m.name:'команда'), v:'work', t:['work','team']}); }});
  S.work.team.forEach(x=>{ if(hit(x.name)||hit(x.role)||hit(x.focus)) res.push({l:x.name, s:'👤 '+(x.role||'команда'), v:'work', t:['work','team']}); });
  S.work.yearGoals.forEach(x=>{ if(hit(x.title)||hit(x.desc)) res.push({l:x.title, s:'🎯 рабочая цель '+x.year, v:'work', t:['work','goals']}); });
  S.work.quarterGoals.forEach(x=>{ if(hit(x.title)) res.push({l:x.title, s:'📅 Q'+x.quarter+' '+x.year, v:'work', t:['work','goals']}); });
  S.work.weekFocuses.forEach(x=>{ if(hit(x.title)) res.push({l:x.title, s:'🔥 фокус недели '+fmtDate(x.weekStart), v:'work', t:['work','week']}); });
  S.work.projects.forEach(x=>{ if(hit(x.name)||hit(x.desc)) res.push({l:x.name, s:'📁 рабочий проект', v:'work', t:['work','team']}); });
  S.personal.projects.forEach(x=>{ if(hit(x.name)||hit(x.desc)) res.push({l:x.name, s:'🚀 проект', v:'personal', t:['personal','projects']}); });
  S.personal.tasks.forEach(x=>{ if(hit(x.title)||hit(x.notes)){ const p=S.personal.projects.find(y=>y.id===x.projectId);
    res.push({l:x.title, s:'🚀 '+(p?p.name:''), v:'personal', t:['personal','projects']}); }});
  S.personal.yearGoals.forEach(x=>{ if(hit(x.title)||hit(x.desc)) res.push({l:x.title, s:'🎯 личная цель '+x.year, v:'personal', t:['personal','goals']}); });
  S.personal.ideas.forEach(x=>{ if(hit(x.title)||hit(x.notes)) res.push({l:x.title, s:'💡 идея', v:'personal', t:['personal','ideas']}); });
  S.personal.people.forEach(x=>{ if(hit(x.name)||hit(x.role)) res.push({l:x.name, s:'🤝 партнёр', v:'personal', t:['personal','projects']}); });
  S.personal.businesses.forEach(b=>{
    if(hit(b.name)||hit(b.desc)) res.push({l:b.name, s:'🏢 бизнес', v:'personal', t:['personal','biz']});
    b.tasks.forEach(x=>{ if(hit(x.title)||hit(x.notes)) res.push({l:x.title, s:'🏢 '+b.name, v:'personal', t:['personal','biz']}); });
    b.goals.forEach(x=>{ if(hit(x.title)) res.push({l:x.title, s:'🎯 цель · '+b.name, v:'personal', t:['personal','biz']}); });
  });
  S.budget.transactions.forEach(x=>{ if(hit(x.name)||hit(x.category)) res.push({l:x.name+' · '+fmtMoney(x.amount), s:(x.type==='income'?'💵 доход':'🛒 расход')+' · '+fmtMonth(x.month), v:'budget', t:['budget','month'], m:x.month}); });
  S.budget.debts.forEach(x=>{ if(hit(x.name)) res.push({l:x.name, s:'💳 долг', v:'budget', t:['budget','assets']}); });
  S.budget.savings.forEach(x=>{ if(hit(x.name)) res.push({l:x.name, s:'🏦 копилка', v:'budget', t:['budget','assets']}); });
  S.reviews.forEach(x=>{ if(hit(x.wins)||hit(x.fails)||hit(x.plans)) res.push({l:'Итоги недели '+fmtDate(x.weekStart), s:'📝 итоги недели', v:'review', t:null}); });
  S.sport.workouts.forEach(x=>{ if(hit(x.type)||hit(x.notes)) res.push({l:x.type+' · '+fmtDate(x.date), s:'🏃 тренировка · '+(x.minutes||0)+' мин', v:'sport', t:null}); });
  S.sport.goals.forEach(x=>{ if(hit(x.title)) res.push({l:x.title, s:'🎯 спортивная цель', v:'sport', t:null}); });
  if(modOn('learn')){
    S.learn.books.forEach(x=>{ if(hit(x.title)||hit(x.author)||hit(x.note)) res.push({l:x.title, s:'📚 книга', v:'learn', t:null}); });
    S.learn.courses.forEach(x=>{ if(hit(x.name)) res.push({l:x.name, s:'🎓 курс', v:'learn', t:null}); });
  }
  if(modOn('travel')){
    S.travel.trips.forEach(x=>{ if(hit(x.name)) res.push({l:x.name, s:'🌴 поездка', v:'travel', t:null}); });
    S.travel.wishlist.forEach(x=>{ if(hit(x.place)) res.push({l:x.place, s:'🗺 хочу посетить', v:'travel', t:null}); });
  }
  if(modOn('people')){
    S.people.contacts.forEach(x=>{ if(hit(x.name)||hit(x.tag)||hit(x.notes)) res.push({l:x.name, s:'🤝 окружение', v:'people', t:null}); });
  }
  if(modOn('health')){
    S.health.checkups.forEach(x=>{ if(hit(x.name)) res.push({l:x.name, s:'🩺 чекап', v:'health', t:null}); });
  }
  window._searchRes = res.slice(0,15);
  out.innerHTML = res.length ? `<div class="card" style="margin-bottom:16px">
    <div class="sub" style="margin-bottom:6px">Найдено: ${res.length}</div>
    ${window._searchRes.map((r,i)=>`<div class="search-res" onclick="goSearch(${i})">
      <div class="item-title">${esc(r.l)}</div><div class="item-meta">${esc(r.s)}</div></div>`).join('')}
  </div>` : `<div class="card empty" style="margin-bottom:16px">Ничего не найдено</div>`;
}
function goSearch(i){
  const r = window._searchRes[i]; if(!r) return;
  if(r.m) SUB.budgetMonth = r.m;
  if(r.t){ SUB[r.t[0]] = r.t[1]; }
  localStorage.setItem('mytracker_sub', JSON.stringify(SUB));
  go(r.v);
}

/* ================= WORK ================= */
function vWork(){
  const sub = SUB.work || 'week';
  return `
  <div class="page-head"><div><h1>Работа</h1><div class="sub">Цели, фокусы и команда</div></div></div>
  <div class="tabs">
    <button class="${sub==='week'?'active':''}" onclick="setSub('work','week')">Неделя и день</button>
    <button class="${sub==='goals'?'active':''}" onclick="setSub('work','goals')">Цели</button>
    <button class="${sub==='team'?'active':''}" onclick="setSub('work','team')">Команда</button>
    <button class="${sub==='calendar'?'active':''}" onclick="setSub('work','calendar')">Календарь</button>
    <button class="${sub==='archive'?'active':''}" onclick="setSub('work','archive')">Архив</button>
  </div>
  ${sub==='goals' ? workGoals() : sub==='team' ? workTeam() : sub==='calendar' ? workCalendar() : sub==='archive' ? workArchive() : workWeek()}`;
}

/* --- work: goals --- */
function workGoals(){
  const yr = SUB.workYear || curYear();
  const goals = goalsList('work');
  const qGoals = q => S.work.quarterGoals.filter(g=>+g.year===+yr && +g.quarter===q);
  return `
  <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap">
    <h2 style="margin:0">🎯 Годовые цели</h2>
    <div style="display:flex;gap:8px">${yearSelector('work')}
    <button class="btn btn-primary btn-sm" onclick="addGoal('work')">+ Цель</button></div>
  </div>
  <div class="grid grid2" style="margin-bottom:26px">
    ${goals.length ? goals.map(g=>goalCard(g,'work')).join('') : '<div class="card empty">Целей на этот год пока нет — добавьте первую</div>'}
  </div>
  <h2>📅 Квартальные цели · ${yr}</h2>
  <div class="grid grid4">
    ${[1,2,3,4].map(q=>`
      <div class="card" style="padding:16px ${q===curQuarter()&&+yr===curYear()?';border-color:var(--accent)':''}">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <b style="font-size:14px">Q${q} ${q===curQuarter()&&+yr===curYear()?'<span class="chip violet">сейчас</span>':''}</b>
          <button class="icon-btn" onclick="addQGoal(${q})">＋</button>
        </div>
        ${qGoals(q).map(g=>{
          const yg = g.goalId ? S.work.yearGoals.find(y=>y.id===g.goalId) : null;
          return `
          <div class="item-row ${g.done?'done':''}">
            <button class="checkbox ${g.done?'on':''}" onclick="toggleQGoal('${g.id}')">${g.done?'✓':''}</button>
            <div class="grow"><div class="item-title" style="font-size:13.5px">${esc(g.title)}</div>
              ${yg?`<div class="item-meta">🎯 ${esc(yg.title)}</div>`:''}</div>
            <button class="icon-btn" onclick="editQGoal('${g.id}')">✎</button>
            <button class="icon-btn btn-danger" onclick="delQGoal('${g.id}')">✕</button>
          </div>`;}).join('') || '<div class="empty" style="padding:10px">—</div>'}
      </div>`).join('')}
  </div>`;
}
function yearGoalSelect(yr, selected){
  const goals = S.work.yearGoals.filter(g=>+g.year===+yr);
  return `<div class="field"><label>Связать с годовой целью (прогресс цели будет считаться автоматически)</label>
    <select name="goalId"><option value="">— без привязки —</option>
    ${goals.map(g=>`<option value="${g.id}" ${selected===g.id?'selected':''}>${esc(g.title)}</option>`).join('')}
  </select></div>`;
}
function addQGoal(q){
  const yr = SUB.workYear || curYear();
  openModal(`Цель на Q${q} ${yr}`, `
    <div class="field"><label>Цель</label><input name="title" required placeholder="Что нужно сделать за квартал"></div>
    ${yearGoalSelect(yr)}
  `, d=>{
    if(!d.title.trim()) return false;
    S.work.quarterGoals.push({id:uid(), title:d.title.trim(), year:+yr, quarter:q, done:false, goalId:d.goalId||null});
    save(); render();
  });
}
function editQGoal(id){
  const g = S.work.quarterGoals.find(x=>x.id===id); if(!g) return;
  openModal('Квартальная цель', `
    <div class="field"><label>Цель</label><input name="title" required value="${esc(g.title)}"></div>
    ${yearGoalSelect(g.year, g.goalId)}
  `, d=>{ Object.assign(g,{title:d.title.trim(), goalId:d.goalId||null}); save(); render(); });
}
function toggleQGoal(id){ const g=S.work.quarterGoals.find(x=>x.id===id); if(g){g.done=!g.done; save(); render();} }
function delQGoal(id){ confirmDel('Удалить квартальную цель?',()=>{ S.work.quarterGoals=S.work.quarterGoals.filter(x=>x.id!==id); }); }

/* --- work: week & day --- */
function focusRow(f, scope, showScope){
  scope = scope||'work';
  return `<div class="item-row ${f.done?'done':''}">
    <button class="checkbox ${f.done?'on':''}" onclick="toggleFocus('${scope}','${f.id}')">${f.done?'✓':''}</button>
    <div class="grow"><div class="item-title">${esc(f.title)} ${showScope?`<span class="chip" style="vertical-align:1px">${scope==='work'?'💼 работа':'🚀 личное'}</span>`:''}</div>
      ${f.notes?`<div class="notes-line" title="${esc(f.notes)}">${esc(f.notes)}</div>`:''}</div>
    <button class="icon-btn" onclick="editFocus('${scope}','${f.id}')">✎</button>
    <button class="icon-btn btn-danger" onclick="delFocus('${scope}','${f.id}')">✕</button>
  </div>`;
}
function dayTaskRow(x){
  const pr = {high:'red',mid:'yellow',low:''}[x.priority]||'';
  const prTxt = {high:'важно',mid:'средне',low:''}[x.priority]||'';
  const meta = [];
  if(x.time) meta.push(`<span class="chip blue">⏰ ${x.time}</span>`);
  if(prTxt) meta.push(`<span class="chip ${pr}">${prTxt}</span>`);
  if(x.recId) meta.push('<span class="chip">🔁</span>');
  if(x.tags && x.tags.length) meta.push(tagChips(x.tags));
  return `<div class="item-row ${x.done?'done':''}" draggable="true" ondragstart="rowDragStart(event,'day','${x.id}')" ondragend="rowDragEnd(event)" ondragover="event.preventDefault()" ondrop="rowDrop(event,'day','${x.id}')">
    <span class="drag-handle">⠿</span>
    <button class="checkbox ${x.done?'on':''}" onclick="toggleDayTask('${x.id}')">${x.done?'✓':''}</button>
    <div class="grow"><div class="item-title">${esc(x.title)}</div>
      ${meta.length?`<div class="item-meta">${meta.join(' ')}</div>`:''}
      ${x.notes?`<div class="notes-line" title="${esc(x.notes)}">${esc(x.notes)}</div>`:''}</div>
    <button class="icon-btn" onclick="editDayTask('${x.id}')">✎</button>
    <button class="icon-btn btn-danger" onclick="delDayTask('${x.id}')">✕</button>
  </div>`;
}
/* --- recurring tasks --- */
const FREQ_LBL = {daily:'каждый день', weekly:'еженедельно', monthly:'ежемесячно'};
function recMatches(r, dateStr){
  const d = new Date(dateStr+'T12:00:00');
  if(r.freq==='daily') return true;
  if(r.freq==='weekly') return d.getDay()===+r.weekday;
  if(r.freq==='monthly') return d.getDate()===Math.min(+r.monthday, new Date(d.getFullYear(),d.getMonth()+1,0).getDate());
  return false;
}
function ensureRecurring(dateStr){
  if(!dateStr || dateStr<todayStr()) return;
  let added = false;
  S.work.recurring.forEach(r=>{
    if(recMatches(r,dateStr) && !S.work.dayTasks.some(t=>t.recId===r.id && t.date===dateStr)){
      S.work.dayTasks.push({id:uid(), recId:r.id, title:r.title, date:dateStr, priority:r.priority||'mid', done:false});
      added = true;
    }
  });
  if(added) save();
}
function addRecurring(){
  openModal('Повторяющаяся задача', `
    <div class="field"><label>Задача</label><input name="title" required placeholder="Например: планёрка с командой"></div>
    <div class="frow">
      <div class="field"><label>Повтор</label><select name="freq" onchange="
        document.getElementById('recWd').style.display=this.value==='weekly'?'block':'none';
        document.getElementById('recMd').style.display=this.value==='monthly'?'block':'none';">
        <option value="daily">Каждый день</option><option value="weekly">Еженедельно</option><option value="monthly">Ежемесячно</option>
      </select></div>
      <div class="field"><label>Приоритет</label><select name="priority">
        <option value="mid">Средний</option><option value="high">Высокий</option><option value="low">Низкий</option>
      </select></div>
    </div>
    <div class="field" id="recWd" style="display:none"><label>День недели</label><select name="weekday">
      ${[1,2,3,4,5,6,0].map(d=>`<option value="${d}">${['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'][d]}</option>`).join('')}
    </select></div>
    <div class="field" id="recMd" style="display:none"><label>Число месяца</label><input name="monthday" type="number" min="1" max="31" value="1"></div>
  `, d=>{
    if(!d.title.trim()) return false;
    S.work.recurring.push({id:uid(), title:d.title.trim(), freq:d.freq, weekday:+d.weekday, monthday:+d.monthday||1, priority:d.priority});
    ensureRecurring(SUB.workDay||todayStr());
    save(); render();
  }, 'Добавить');
}
function delRecurring(id){
  confirmDel('Удалить повторяющуюся задачу? (уже созданные копии останутся)', ()=>{
    S.work.recurring = S.work.recurring.filter(r=>r.id!==id);
  });
}
function workWeek(){
  const ws = SUB.workWeekStart || weekStart();
  const day = SUB.workDay || todayStr();
  ensureRecurring(day);
  const focuses = S.work.weekFocuses.filter(f=>f.weekStart===ws);
  const tagFilter = SUB.dayTag || '';
  let tasks = S.work.dayTasks.filter(x=>x.date===day)
    .sort((a,b)=>(a.done-b.done)); // порядок настраивается перетаскиванием
  const dayTags = [...new Set(tasks.flatMap(t=>t.tags||[]))];
  if(tagFilter) tasks = tasks.filter(t=>(t.tags||[]).includes(tagFilter));
  const doneCnt = tasks.filter(x=>x.done).length;
  const dayDate = new Date(day+'T12:00:00');
  const inbox = S.work.dayTasks.filter(x=>!x.date && !x.done);
  const myOverdue = overdueDayTasks();
  return `
  ${myOverdue.length?`<div class="card" style="margin-bottom:16px;border-color:var(--red);padding:12px 18px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
    <b style="color:var(--red);font-size:14px">⚠ Просрочено: ${myOverdue.length}</b>
    <button class="btn btn-ghost btn-sm" onclick="rolloverAll()">Перенести всё на сегодня →</button>
  </div>`:''}
  <div class="grid grid2">
    <div>
    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h2 style="margin:0">🔥 Фокусы недели</h2>
        <div class="week-nav">
          <button class="icon-btn" onclick="setSub('workWeekStart','${addDays(ws,-7)}')">‹</button>
          <span style="font-size:12.5px;color:var(--text2);cursor:pointer" title="Выбрать неделю" onclick="pickDate('${ws}', v=>setSub('workWeekStart', weekStart(v)))">${fmtDate(ws)} – ${fmtDate(addDays(ws,6))}</span>
          <button class="icon-btn" onclick="setSub('workWeekStart','${addDays(ws,7)}')">›</button>
        </div>
      </div>
      ${ws!==weekStart()?`<div style="margin-bottom:8px"><button class="btn btn-ghost btn-sm" onclick="setSub('workWeekStart','${weekStart()}')">← к текущей неделе</button></div>`:''}
      ${focuses.length ? focuses.map(f=>focusRow(f,'work')).join('') : '<div class="empty">Задайте 1–3 главных фокуса на неделю</div>'}
      <button class="btn btn-primary btn-sm" style="margin-top:14px" onclick="addFocus('work','${ws}')">+ Фокус</button>
    </div>
    <div class="card" style="margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <h2 style="margin:0">📥 Инбокс</h2>
        <span class="chip">${inbox.length}</span>
      </div>
      <div class="hint" style="margin-bottom:8px">Быстро фиксируйте всё, что пришло в голову — разберёте потом.</div>
      <div class="quick-add" style="margin-bottom:8px">
        <input placeholder="Закинуть в инбокс… (Enter)" onkeydown="if(event.key==='Enter'&&this.value.trim()){addToInbox(this.value.trim());this.value=''}">
      </div>
      ${inbox.map(x=>`<div class="item-row"><div class="grow"><div class="item-title">${esc(x.title)}</div></div>
        <button class="btn btn-ghost btn-sm" onclick="moveToToday('${x.id}')">→ сегодня</button>
        <button class="icon-btn" onclick="editDayTask('${x.id}')">✎</button>
        <button class="icon-btn btn-danger" onclick="delDayTask('${x.id}')">✕</button></div>`).join('') || ''}
    </div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <h2 style="margin:0">🔁 Повторяющиеся</h2>
        <button class="btn btn-ghost btn-sm" onclick="addRecurring()">+ Добавить</button>
      </div>
      ${S.work.recurring.map(r=>`<div class="item-row"><div class="grow">
        <div class="item-title">${esc(r.title)}</div>
        <div class="item-meta">${FREQ_LBL[r.freq]}${r.freq==='weekly'?' · '+['вс','пн','вт','ср','чт','пт','сб'][r.weekday]:''}${r.freq==='monthly'?' · '+r.monthday+'-е число':''}</div></div>
        <button class="icon-btn btn-danger" onclick="delRecurring('${r.id}')">✕</button></div>`).join('')
        || '<div class="empty" style="padding:10px">Планёрки, отчёты, 1:1 — добавьте, и они будут появляться в задачах дня сами</div>'}
    </div>
    </div>
    <div class="card" style="align-self:start">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h2 style="margin:0">✅ Задачи дня</h2>
        <div class="week-nav">
          <button class="icon-btn" onclick="setSub('workDay','${addDays(day,-1)}')">‹</button>
          <span style="font-size:12.5px;color:var(--text2);cursor:pointer" title="Выбрать дату" onclick="pickDate('${day}', v=>setSub('workDay', v))">${DAYS[dayDate.getDay()]}, ${fmtDate(day)}</span>
          <button class="icon-btn" onclick="setSub('workDay','${addDays(day,1)}')">›</button>
        </div>
      </div>
      ${day!==todayStr()?`<div style="margin-bottom:8px"><button class="btn btn-ghost btn-sm" onclick="setSub('workDay','${todayStr()}')">← к сегодня</button></div>`:''}
      <div class="quick-add" style="margin-bottom:8px">
        <input placeholder="Добавить задачу… (Enter)" onkeydown="if(event.key==='Enter'&&this.value.trim()){quickAddDay(this.value.trim(),'${day}');this.value=''}">
      </div>
      ${dayTags.length?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
        ${dayTags.map(t=>`<button class="chip ${tagFilter===t?'violet':''}" onclick="setSub('dayTag','${t}'===('${tagFilter}')?'':'${t}')">#${esc(t)}</button>`).join('')}
        ${tagFilter?`<button class="chip red" onclick="setSub('dayTag','')">✕ сброс</button>`:''}
      </div>`:''}
      ${tasks.length?`<div class="sub" style="margin-bottom:6px">${doneCnt} из ${tasks.length} выполнено</div>
      <div class="progress green" style="margin-bottom:10px"><div style="width:${tasks.length?Math.round(doneCnt/tasks.length*100):0}%"></div></div>`:''}
      ${tasks.length ? tasks.map(dayTaskRow).join('') : '<div class="empty">Задач нет</div>'}
      <button class="btn btn-primary btn-sm" style="margin-top:14px" onclick="addDayTask('${day}')">+ Задача с деталями</button>
    </div>
  </div>`;
}
function addToInbox(title){
  S.work.dayTasks.push({id:uid(), title, date:null, priority:'mid', done:false});
  save(); render();
}
function quickAddDay(title, day){
  S.work.dayTasks.push({id:uid(), title, date:day, priority:'mid', done:false});
  save(); render();
}
function addFocus(scope, ws){
  scope = scope||'work';
  ws = ws || (scope==='work' ? (SUB.workWeekStart||weekStart()) : weekStart());
  openModal(scope==='work'?'Рабочий фокус недели':'Личный фокус недели', `
    <div class="field"><label>Главное на этой неделе</label><input name="title" required placeholder="${scope==='work'?'Например: закрыть найм аналитика':'Например: дописать главу'}"></div>
    <div class="field"><label>Заметка</label><textarea name="notes"></textarea></div>
  `, d=>{
    if(!d.title.trim()) return false;
    S[scope].weekFocuses.push({id:uid(), title:d.title.trim(), notes:d.notes.trim(), weekStart:ws, done:false});
    save(); render();
  });
}
function editFocus(scope,id){
  const f = S[scope].weekFocuses.find(x=>x.id===id); if(!f) return;
  openModal('Фокус недели', `
    <div class="field"><label>Фокус</label><input name="title" required value="${esc(f.title)}"></div>
    <div class="field"><label>Заметка</label><textarea name="notes">${esc(f.notes||'')}</textarea></div>
  `, d=>{ Object.assign(f,{title:d.title.trim(), notes:d.notes.trim()}); save(); render(); });
}
function toggleFocus(scope,id){ const f=S[scope].weekFocuses.find(x=>x.id===id); if(f){f.done=!f.done; save(); render();} }
function delFocus(scope,id){ confirmDel('Удалить фокус?',()=>{ S[scope].weekFocuses=S[scope].weekFocuses.filter(x=>x.id!==id); }); }
function addDayTask(date){
  date = date || SUB.workDay || todayStr();
  openModal('Задача дня', `
    <div class="field"><label>Задача</label><input name="title" required placeholder="Что нужно сделать"></div>
    <div class="frow">
      <div class="field"><label>Дата (пусто = инбокс)</label><input name="date" type="date" value="${date}"></div>
      <div class="field"><label>Время</label><input name="time" type="time"></div>
      <div class="field"><label>Приоритет</label><select name="priority">
        <option value="mid">Средний</option><option value="high">Высокий</option><option value="low">Низкий</option>
      </select></div>
    </div>
    ${tagsField()}
    <div class="field"><label>Заметка</label><textarea name="notes" placeholder="Контекст, ссылки, детали"></textarea></div>
  `, d=>{
    if(!d.title.trim()) return false;
    S.work.dayTasks.push({id:uid(), title:d.title.trim(), date:d.date||null, time:d.time||null, priority:d.priority, tags:parseTags(d.tags), notes:d.notes.trim(), done:false});
    save(); render();
  }, 'Добавить');
}
function editDayTask(id){
  const t = S.work.dayTasks.find(x=>x.id===id); if(!t) return;
  openModal('Редактировать задачу', `
    <div class="field"><label>Задача</label><input name="title" required value="${esc(t.title)}"></div>
    <div class="frow">
      <div class="field"><label>Дата (пусто = инбокс)</label><input name="date" type="date" value="${t.date||''}"></div>
      <div class="field"><label>Время</label><input name="time" type="time" value="${t.time||''}"></div>
      <div class="field"><label>Приоритет</label><select name="priority">
        ${['mid','high','low'].map(p=>`<option value="${p}" ${t.priority===p?'selected':''}>${{mid:'Средний',high:'Высокий',low:'Низкий'}[p]}</option>`).join('')}
      </select></div>
    </div>
    ${tagsField(t.tags)}
    <div class="field"><label>Заметка</label><textarea name="notes">${esc(t.notes||'')}</textarea></div>
  `, d=>{ Object.assign(t,{title:d.title.trim(), date:d.date||null, time:d.time||null, priority:d.priority, tags:parseTags(d.tags), notes:d.notes.trim()}); save(); render(); });
}
function toggleDayTask(id){
  const t=S.work.dayTasks.find(x=>x.id===id);
  if(t){ t.done=!t.done; t.doneAt = t.done ? todayStr() : null; save(); render(); }
}

/* --- work: archive --- */
function workArchive(){
  const day = S.work.dayTasks.filter(t=>t.done)
    .sort((a,b)=>String(b.doneAt||b.date||'').localeCompare(String(a.doneAt||a.date||'')));
  const team = S.work.teamTasks.filter(t=>t.status==='done')
    .sort((a,b)=>String(b.doneAt||'').localeCompare(String(a.doneAt||'')));
  return `
  <div class="grid grid2">
    <div class="card">
      <h2>📦 Мои выполненные задачи · ${day.length}</h2>
      ${day.map(t=>`<div class="item-row">
        <div class="grow"><div class="item-title" style="color:var(--text2)">${esc(t.title)}</div>
          <div class="item-meta"><span class="chip green">✓ ${fmtDate(t.doneAt||t.date)}</span>${t.recId?'<span class="chip">🔁</span>':''}</div>
          ${t.notes?`<div class="notes-line" title="${esc(t.notes)}">${esc(t.notes)}</div>`:''}</div>
        <button class="btn btn-ghost btn-sm" title="Вернуть в работу" onclick="toggleDayTask('${t.id}')">↩</button>
        <button class="icon-btn btn-danger" onclick="delDayTask('${t.id}')">✕</button>
      </div>`).join('') || '<div class="empty">Пока пусто — выполненные задачи дня будут копиться здесь</div>'}
    </div>
    <div class="card">
      <h2>📦 Выполнено командой · ${team.length}</h2>
      ${team.map(t=>{
        const m = S.work.team.find(x=>x.id===t.memberId);
        return `<div class="item-row">
        <div class="grow"><div class="item-title" style="color:var(--text2)">${esc(t.title)}</div>
          <div class="item-meta">${m?`<span class="chip">${esc(m.name)}</span>`:''}<span class="chip green">✓ ${t.doneAt?fmtDate(t.doneAt):'дата неизвестна'}</span></div></div>
        <button class="btn btn-ghost btn-sm" title="Вернуть в работу" onclick="restoreTeamTask('${t.id}')">↩</button>
        <button class="icon-btn btn-danger" onclick="delTeamTask('${t.id}')">✕</button>
      </div>`;}).join('') || '<div class="empty">Выполненные задачи команды будут здесь</div>'}
    </div>
  </div>`;
}
function restoreTeamTask(id){
  const t = S.work.teamTasks.find(x=>x.id===id);
  if(t){ setTeamStatus(t,'progress'); save(); render(); }
}
function delDayTask(id){ confirmDel('Удалить задачу?',()=>{ S.work.dayTasks=S.work.dayTasks.filter(x=>x.id!==id); }); }

/* --- subtasks (team & personal) --- */
function findTask(kind,id){ return kind==='team' ? S.work.teamTasks.find(t=>t.id===id) : S.personal.tasks.find(t=>t.id===id); }
function subRows(t, kind){
  const subs = t.subs||[];
  return subs.map(s=>`<div class="sub-row ${s.done?'done':''}">
    <button class="checkbox ${s.done?'on':''}" onclick="toggleSub('${kind}','${t.id}','${s.id}')">${s.done?'✓':''}</button>
    <span style="flex:1;word-break:break-word">${esc(s.t)}</span>
    <button class="icon-btn" style="width:22px;height:22px;font-size:11px" onclick="delSub('${kind}','${t.id}','${s.id}')">✕</button>
  </div>`).join('');
}
function subChip(t){
  const subs = t.subs||[];
  return subs.length ? `<span class="chip">☑ ${subs.filter(s=>s.done).length}/${subs.length}</span>` : '';
}
function addSub(kind, taskId){
  openModal('Подзадача', `<div class="field"><label>Шаг</label><input name="t" required></div>`, d=>{
    if(!d.t.trim()) return false;
    const t = findTask(kind,taskId); if(!t) return false;
    (t.subs = t.subs||[]).push({id:uid(), t:d.t.trim(), done:false});
    save(); render();
  }, 'Добавить');
}
function toggleSub(kind,taskId,subId){
  const t = findTask(kind,taskId); const s = t && (t.subs||[]).find(x=>x.id===subId);
  if(s){ s.done=!s.done; save(); render(); }
}
function delSub(kind,taskId,subId){
  const t = findTask(kind,taskId); if(!t) return;
  t.subs = (t.subs||[]).filter(x=>x.id!==subId); save(); render();
}

/* --- work: team --- */
const T_STATUS = {todo:['К работе',''],progress:['В работе','blue'],review:['На проверке','yellow'],done:['Готово','green']};
function setTeamStatus(t, status){
  t.status = status;
  t.doneAt = status==='done' ? todayStr() : null;
}
function workTeam(){
  const view = SUB.teamView || 'list';
  return `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">
    <h2 style="margin:0">📁 Рабочие проекты</h2>
    <div style="display:flex;gap:8px">
      <button class="btn btn-ghost btn-sm" onclick="createFromTemplate('work')">⧉ Из шаблона</button>
      <button class="btn btn-primary btn-sm" onclick="addWorkProject()">+ Проект</button>
    </div>
  </div>
  ${S.work.projects.length ? `<div class="grid grid2" style="margin-bottom:24px">${[...S.work.projects]
      .sort((a,b)=>((a.status==='done')-(b.status==='done')))
      .map(workProjectCard).join('')}</div>`
    : `<div class="card" style="margin-bottom:24px">${emptyBig('📁','Пока нет рабочих проектов','Создайте проект и назначьте людей — появятся задачи, прогресс и дедлайны')}</div>`}
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">
    <h2 style="margin:0">👥 Команда</h2>
    <div style="display:flex;gap:8px">
      <div class="tabs" style="margin:0;padding:3px">
        <button class="${view==='list'?'active':''}" onclick="setSub('teamView','list')">Люди</button>
        <button class="${view==='board'?'active':''}" onclick="setSub('teamView','board')">Доска</button>
      </div>
      <button class="btn btn-primary btn-sm" onclick="addMember()">+ Человек</button>
    </div>
  </div>
  ${!S.work.team.length ? `<div class="card">${emptyBig('👥','Команда пока пуста','Добавьте людей — сможете вести их задачи, дедлайны, загрузку и темы к 1:1')}</div>`
    : view==='board' ? teamBoard() : `<div class="grid grid2">${S.work.team.map(memberCard).join('')}</div>`}`;
}

/* --- work projects --- */
function workProjectCard(p){
  const members = (p.memberIds||[]).map(id=>S.work.team.find(m=>m.id===id)).filter(Boolean);
  const tasks = S.work.teamTasks.filter(t=>t.projectId===p.id);
  const active = tasks.filter(t=>t.status!=='done');
  const pct = tasks.length ? Math.round(tasks.filter(t=>t.status==='done').length/tasks.length*100) : 0;
  const st = P_STATUS[p.status||'active'];
  return `<div class="card" style="border-top:3px solid ${p.color||'var(--accent)'};${p.status==='done'?'opacity:.65':''}">
    <div style="display:flex;align-items:flex-start;gap:10px">
      <div class="grow" style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:15.5px">${esc(p.icon||'📁')} ${esc(p.name)} <span class="chip ${st[1]}" style="vertical-align:2px">${st[0]}</span></div>
        ${p.desc?`<div class="sub">${esc(p.desc)}</div>`:''}
      </div>
      <button class="icon-btn" title="Сохранить как шаблон" onclick="saveAsTemplate('work','${p.id}')">⧉</button>
      <button class="icon-btn" onclick="editWorkProject('${p.id}')">✎</button>
      <button class="icon-btn btn-danger" onclick="delWorkProject('${p.id}')">✕</button>
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin:10px 0 8px;flex-wrap:wrap">
      <div style="display:flex">${members.map((m,i)=>`<span class="mini-av" style="background:${m.color};margin-left:${i?'-6px':'0'};border:2px solid var(--surface)" title="${esc(m.name)}">${initials(m.name)}</span>`).join('')}</div>
      ${members.length?'':'<span class="hint">никто не назначен</span>'}
      ${deadlineChip(p.deadline)}
      <span class="chip">${active.length} актив.</span>
      <span class="mono" style="font-size:12px;font-weight:700;margin-left:auto">${pct}%</span>
    </div>
    <div class="progress green" style="margin-bottom:8px"><div style="width:${pct}%"></div></div>
    ${active.slice(0,6).map(t=>{
      const m = S.work.team.find(x=>x.id===t.memberId);
      const [lbl,cls] = T_STATUS[t.status]||T_STATUS.todo;
      return `<div class="item-row">
        <div class="grow"><div class="item-title" style="font-size:13.5px">${esc(t.title)}</div>
        <div class="item-meta"><button class="chip ${cls}" onclick="cycleTeamTask('${t.id}')">${lbl}</button>
        ${m?`<span class="chip">${esc(m.name.split(' ')[0])}</span>`:''}${deadlineChip(t.deadline)}</div></div>
        <button class="icon-btn" onclick="editTeamTask('${t.id}')">✎</button>
      </div>`;
    }).join('')}
    <button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="addTeamTask(null,'${p.id}')">+ Задача в проект</button>
  </div>`;
}
function workProjForm(p){
  p = p||{};
  return `
    <div class="frow">
      <div class="field" style="flex:0 0 84px"><label>Иконка</label><input name="icon" value="${esc(p.icon||'📁')}" maxlength="4" style="text-align:center"></div>
      <div class="field"><label>Название</label><input name="name" required value="${esc(p.name||'')}" placeholder="Например: запуск нового продукта"></div>
    </div>
    <div class="field"><label>Описание</label><textarea name="desc">${esc(p.desc||'')}</textarea></div>
    <div class="frow">
      <div class="field"><label>Дедлайн</label><input name="deadline" type="date" value="${p.deadline||''}"></div>
      ${projStatusField(p)}
    </div>
    <div class="field"><label>Команда проекта</label>
      ${S.work.team.length ? S.work.team.map(m=>`
        <label style="display:flex;align-items:center;gap:8px;font-size:14px;font-weight:400;color:var(--text);margin-bottom:6px">
          <input type="checkbox" name="mem_${m.id}" ${(p.memberIds||[]).includes(m.id)?'checked':''} style="width:auto">
          <span class="mini-av" style="background:${m.color}">${initials(m.name)}</span> ${esc(m.name)}
        </label>`).join('') : '<div class="hint">Сначала добавьте людей в блоке «Команда»</div>'}
    </div>`;
}
function collectMembers(d){
  return Object.keys(d).filter(k=>k.startsWith('mem_') && d[k]).map(k=>k.slice(4));
}
function addWorkProject(){
  openModal('Новый рабочий проект', workProjForm(), d=>{
    if(!d.name.trim()) return false;
    S.work.projects.push({id:uid(), name:d.name.trim(), icon:(d.icon||'📁').trim(), desc:d.desc.trim(), deadline:d.deadline||null,
      status:d.status, memberIds:collectMembers(d),
      color:PROJ_COLORS[(S.work.projects.length+3) % PROJ_COLORS.length]});
    save(); render();
  }, 'Создать');
}
function editWorkProject(id){
  const p = S.work.projects.find(x=>x.id===id); if(!p) return;
  openModal('Редактировать проект', workProjForm(p), d=>{
    Object.assign(p,{name:d.name.trim(), icon:(d.icon||'📁').trim(), desc:d.desc.trim(), deadline:d.deadline||null, status:d.status, memberIds:collectMembers(d)});
    save(); render();
  });
}
function delWorkProject(id){
  confirmDel('Удалить проект? Задачи останутся у исполнителей (без привязки к проекту).', ()=>{
    S.work.projects = S.work.projects.filter(p=>p.id!==id);
    S.work.teamTasks.forEach(t=>{ if(t.projectId===id) t.projectId=null; });
  });
}
let dragTaskId = null;
function dragTeam(e,id){ dragTaskId = id; try{e.dataTransfer.setData('text/plain',id);}catch(_){} }
function dropTeam(e,status){
  e.preventDefault();
  const t = S.work.teamTasks.find(x=>x.id===dragTaskId);
  if(t && t.status!==status){ setTeamStatus(t,status); save(); render(); }
}
function teamBoard(){
  const mf = SUB.teamFilter || '';
  const tasks = S.work.teamTasks.filter(t=>!mf || t.memberId===mf);
  return `
  <div style="margin-bottom:12px;max-width:280px">
    <select onchange="setSub('teamFilter',this.value)">
      <option value="">Все люди</option>
      ${S.work.team.map(m=>`<option value="${m.id}" ${mf===m.id?'selected':''}>${esc(m.name)}</option>`).join('')}
    </select>
  </div>
  <div class="kanban">
    ${Object.entries(T_STATUS).map(([k,[lbl]])=>{
      const col = tasks.filter(t=>(t.status||'todo')===k)
        .sort((a,b)=>String(a.deadline||'9999').localeCompare(String(b.deadline||'9999')));
      return `<div class="kcol" ondragover="event.preventDefault();this.classList.add('dragover')"
        ondragleave="this.classList.remove('dragover')" ondrop="this.classList.remove('dragover');dropTeam(event,'${k}')">
        <div class="kcol-head"><span>${lbl}</span><span>${col.length}</span></div>
        ${col.map(t=>{
          const m = S.work.team.find(x=>x.id===t.memberId);
          const proj = t.projectId ? S.work.projects.find(pp=>pp.id===t.projectId) : null;
          return `<div class="kcard" draggable="true" ondragstart="dragTeam(event,'${t.id}')" onclick="editTeamTask('${t.id}')">
            <div class="t">${esc(t.title)}</div>
            <div class="m">
              ${m?`<span class="mini-av" style="background:${m.color}" title="${esc(m.name)}">${initials(m.name)}</span>`:''}
              ${proj?`<span class="chip" style="color:${proj.color}">${esc(proj.icon||'📁')} ${esc(proj.name)}</span>`:''}
              ${deadlineChip(t.deadline)} ${subChip(t)}
            </div>
          </div>`;
        }).join('')}
      </div>`;
    }).join('')}
  </div>
  <div class="hint" style="margin-top:10px">Перетаскивайте карточки между колонками. Клик по карточке — редактирование.</div>`;
}
function memberCard(m){
  const tasks = S.work.teamTasks.filter(t=>t.memberId===m.id && t.status!=='done')
    .sort((a,b)=>String(a.deadline||'9999').localeCompare(String(b.deadline||'9999')));
  const active = tasks;
  const overdue = active.filter(t=>t.deadline && daysUntil(t.deadline)<0).length;
  const load = active.length>=6 ? 'red' : active.length>=4 ? 'yellow' : 'green';
  const topics = m.topics||[];
  return `<div class="card">
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">
      <div class="member-avatar" style="background:${m.color}">${initials(m.name)}</div>
      <div class="grow" style="flex:1">
        <div style="font-weight:600">${esc(m.name)}</div>
        <div class="sub" style="margin:0">${esc(m.role||'')}</div>
      </div>
      <button class="icon-btn" onclick="editMember('${m.id}')">✎</button>
      <button class="icon-btn btn-danger" onclick="delMember('${m.id}')">✕</button>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 8px">
      <span class="chip ${load}">${active.length} в работе</span>
      ${overdue?`<span class="chip red">⚠ ${overdue} просрочено</span>`:''}
      ${m.focus?`<span class="chip violet">🔥 ${esc(m.focus)}</span>`:''}
    </div>
    ${tasks.map(t=>{
      const [lbl,cls] = T_STATUS[t.status]||T_STATUS.todo;
      const proj = t.projectId ? S.work.projects.find(pp=>pp.id===t.projectId) : null;
      return `<div class="item-row ${t.status==='done'?'done':''}" style="flex-wrap:wrap">
        <div class="grow" style="flex:1;min-width:60%">
          <div class="item-title">${esc(t.title)}</div>
          <div class="item-meta">
            <button class="chip ${cls}" onclick="cycleTeamTask('${t.id}')" title="Сменить статус">${lbl}</button>
            ${proj?`<span class="chip" style="color:${proj.color}">${esc(proj.icon||'📁')} ${esc(proj.name)}</span>`:''}
            ${deadlineChip(t.deadline)} ${subChip(t)} ${tagChips(t.tags)}
            <button class="chip" onclick="addSub('team','${t.id}')" title="Добавить подзадачу">＋ шаг</button>
          </div>
          ${t.notes?`<div class="notes-line" title="${esc(t.notes)}">${esc(t.notes)}</div>`:''}
        </div>
        <button class="icon-btn" onclick="editTeamTask('${t.id}')">✎</button>
        <button class="icon-btn btn-danger" onclick="delTeamTask('${t.id}')">✕</button>
        <div style="width:100%">${subRows(t,'team')}</div>
      </div>`;
    }).join('') || '<div class="empty" style="padding:12px">Задач нет</div>'}
    <button class="btn btn-ghost btn-sm" style="margin-top:10px" onclick="addTeamTask('${m.id}')">+ Задача</button>
    <div style="margin-top:14px;border-top:1px solid var(--border);padding-top:10px">
      <div style="font-size:12px;font-weight:700;color:var(--text3);margin-bottom:6px">💬 К ОБСУЖДЕНИЮ НА 1:1 ${topics.length?'· '+topics.length:''}</div>
      ${topics.map(tp=>`<div class="sub-row" style="padding-left:0">
        <button class="checkbox" onclick="delTopic('${m.id}','${tp.id}')" title="Обсудили — убрать"></button>
        <span style="flex:1">${esc(tp.t)}</span></div>`).join('')}
      <div class="quick-add" style="margin:6px 0 0">
        <input placeholder="Тема к встрече… (Enter)" onkeydown="if(event.key==='Enter'&&this.value.trim()){addTopic('${m.id}',this.value.trim());this.value=''}">
      </div>
    </div>
  </div>`;
}
function addTopic(memberId, t){
  const m = S.work.team.find(x=>x.id===memberId); if(!m) return;
  (m.topics = m.topics||[]).push({id:uid(), t});
  save(); render();
}
function delTopic(memberId, topicId){
  const m = S.work.team.find(x=>x.id===memberId); if(!m) return;
  m.topics = (m.topics||[]).filter(x=>x.id!==topicId);
  save(); render(); toast('Обсудили ✓');
}
function addMember(){
  openModal('Новый член команды', `
    <div class="field"><label>Имя</label><input name="name" required placeholder="Имя Фамилия"></div>
    <div class="field"><label>Роль</label><input name="role" placeholder="Например: аналитик"></div>
    <div class="field"><label>Текущий фокус (необязательно)</label><input name="focus" placeholder="Над чем сейчас работает"></div>
  `, d=>{
    if(!d.name.trim()) return false;
    S.work.team.push({id:uid(), name:d.name.trim(), role:d.role.trim(), focus:d.focus.trim(),
      color:AVATAR_COLORS[S.work.team.length % AVATAR_COLORS.length]});
    save(); render();
  }, 'Добавить');
}
function editMember(id){
  const m = S.work.team.find(x=>x.id===id); if(!m) return;
  openModal('Редактировать', `
    <div class="field"><label>Имя</label><input name="name" required value="${esc(m.name)}"></div>
    <div class="field"><label>Роль</label><input name="role" value="${esc(m.role||'')}"></div>
    <div class="field"><label>Текущий фокус</label><input name="focus" value="${esc(m.focus||'')}"></div>
  `, d=>{ Object.assign(m,{name:d.name.trim(),role:d.role.trim(),focus:d.focus.trim()}); save(); render(); });
}
function delMember(id){
  confirmDel('Удалить человека и все его задачи?', ()=>{
    S.work.team = S.work.team.filter(m=>m.id!==id);
    S.work.teamTasks = S.work.teamTasks.filter(t=>t.memberId!==id);
    S.work.projects.forEach(p=>{ p.memberIds = (p.memberIds||[]).filter(x=>x!==id); });
    if(SUB.teamFilter===id) SUB.teamFilter='';
  });
}
function workProjSelect(selected){
  if(!S.work.projects.length) return '';
  return `<div class="field"><label>Проект</label><select name="projectId">
    <option value="">— без проекта —</option>
    ${S.work.projects.map(p=>`<option value="${p.id}" ${selected===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}
  </select></div>`;
}
function addTeamTask(memberId, projectId){
  if(!S.work.team.length){ toast('Сначала добавьте людей в команду'); return; }
  const proj = projectId ? S.work.projects.find(p=>p.id===projectId) : null;
  const candidates = proj && proj.memberIds && proj.memberIds.length
    ? S.work.team.filter(m=>proj.memberIds.includes(m.id)) : S.work.team;
  openModal(proj ? 'Задача в проект «'+esc(proj.name)+'»' : 'Задача для '+esc((S.work.team.find(m=>m.id===memberId)||{}).name||'команды'), `
    <div class="field"><label>Задача</label><input name="title" required></div>
    <div class="frow">
      <div class="field"><label>Дедлайн</label><input name="deadline" type="date"></div>
      <div class="field"><label>Статус</label><select name="status">
        ${Object.entries(T_STATUS).map(([k,[l]])=>`<option value="${k}">${l}</option>`).join('')}
      </select></div>
    </div>
    <div class="field"><label>Исполнитель</label><select name="memberId">
      ${candidates.map(m=>`<option value="${m.id}" ${memberId===m.id?'selected':''}>${esc(m.name)}</option>`).join('')}
    </select></div>
    ${workProjSelect(projectId)}
    ${tagsField()}
    <div class="field"><label>Заметка</label><textarea name="notes"></textarea></div>
  `, d=>{
    if(!d.title.trim()) return false;
    const t = {id:uid(), memberId:d.memberId||memberId, projectId:d.projectId||projectId||null,
      title:d.title.trim(), deadline:d.deadline, tags:parseTags(d.tags), notes:d.notes.trim()};
    setTeamStatus(t, d.status);
    S.work.teamTasks.push(t);
    save(); render();
  }, 'Добавить');
}
function editTeamTask(id){
  const t = S.work.teamTasks.find(x=>x.id===id); if(!t) return;
  openModal('Редактировать задачу', `
    <div class="field"><label>Задача</label><input name="title" required value="${esc(t.title)}"></div>
    <div class="frow">
      <div class="field"><label>Дедлайн</label><input name="deadline" type="date" value="${t.deadline||''}"></div>
      <div class="field"><label>Статус</label><select name="status">
        ${Object.entries(T_STATUS).map(([k,[l]])=>`<option value="${k}" ${t.status===k?'selected':''}>${l}</option>`).join('')}
      </select></div>
    </div>
    <div class="field"><label>Исполнитель</label><select name="memberId">
      ${S.work.team.map(m=>`<option value="${m.id}" ${t.memberId===m.id?'selected':''}>${esc(m.name)}</option>`).join('')}
    </select></div>
    ${workProjSelect(t.projectId)}
    ${tagsField(t.tags)}
    <div class="field"><label>Заметка</label><textarea name="notes">${esc(t.notes||'')}</textarea></div>
  `, d=>{
    Object.assign(t,{title:d.title.trim(), deadline:d.deadline, memberId:d.memberId, projectId:d.projectId||null, tags:parseTags(d.tags), notes:d.notes.trim()});
    if(d.status!==t.status) setTeamStatus(t, d.status);
    save(); render();
  });
}
function cycleTeamTask(id){
  const t = S.work.teamTasks.find(x=>x.id===id); if(!t) return;
  const keys = Object.keys(T_STATUS);
  setTeamStatus(t, keys[(keys.indexOf(t.status)+1) % keys.length]);
  save(); render();
}
function delTeamTask(id){ confirmDel('Удалить задачу?',()=>{ S.work.teamTasks=S.work.teamTasks.filter(x=>x.id!==id); }); }

/* --- calendar (переиспользуемый: work / personal / all) --- */
const CAL_TITLES = {work:'🗓 Рабочий календарь', personal:'🗓 Календарь личных проектов', all:'🗓 Общий календарь'};
function calEvents(scope){
  const events = {};
  const push = (date, txt, color, time) => { (events[date] = events[date]||[]).push({txt, color, time:time||null}); };
  if(scope!=='personal'){
    S.work.dayTasks.forEach(t=>{ if(t.date && !t.done) push(t.date, t.title, 'var(--accent)', t.time); });
    S.work.teamTasks.forEach(t=>{ if(t.deadline && t.status!=='done'){
      const mb = S.work.team.find(x=>x.id===t.memberId);
      push(t.deadline, (mb?initials(mb.name)+': ':'')+t.title, 'var(--blue)'); }});
    S.work.projects.forEach(p=>{ if(p.deadline && p.status!=='done') push(p.deadline, (p.icon||'📁')+' '+p.name, 'var(--yellow)'); });
  }
  if(scope!=='work'){
    S.personal.tasks.forEach(t=>{ if(t.deadline && !t.done) push(t.deadline, t.title, 'var(--pink)'); });
    S.personal.businesses.forEach(b=>b.tasks.forEach(t=>{ if(t.deadline && !t.done) push(t.deadline, (b.icon||'🏢')+' '+t.title, '#2dd4bf'); }));
    if(modOn('travel')) S.travel.trips.forEach(t=>{ if(t.start && (!t.end || t.end>=todayStr())) push(t.start, '🌴 '+t.name, '#fb923c'); });
  }
  return events;
}
function calLegend(scope){
  const legend = [];
  if(scope!=='personal') legend.push('<span><span class="cal-dot" style="background:var(--accent);display:inline-block"></span> мои задачи</span>',
    '<span><span class="cal-dot" style="background:var(--blue);display:inline-block"></span> команда</span>',
    '<span><span class="cal-dot" style="background:var(--yellow);display:inline-block"></span> рабочие проекты</span>');
  if(scope!=='work') legend.push('<span><span class="cal-dot" style="background:var(--pink);display:inline-block"></span> личные проекты</span>',
    '<span><span class="cal-dot" style="background:#2dd4bf;display:inline-block"></span> бизнес</span>');
  return legend.join('');
}
function calendarBlock(scope){
  const view = SUB['calV_'+scope] || 'month';
  const events = calEvents(scope);
  const dayClick = d => scope==='personal' ? '' :
    `onclick="SUB.workDay='${d}';SUB.work='week';localStorage.setItem('mytracker_sub',JSON.stringify(SUB));go('work')"`;
  const toggle = `<div class="tabs" style="margin:0;padding:3px">
      <button class="${view==='month'?'active':''}" onclick="setSub('calV_${scope}','month')">Месяц</button>
      <button class="${view==='week'?'active':''}" onclick="setSub('calV_${scope}','week')">Неделя</button>
    </div>`;
  if(view==='week'){
    const wkey = 'calWS_'+scope;
    const ws = SUB[wkey] || weekStart();
    let cols = '';
    for(let i=0;i<7;i++){
      const d = addDays(ws,i);
      const evs = (events[d]||[]).slice().sort((a,b)=>String(a.time||'99:99').localeCompare(String(b.time||'99:99')));
      cols += `<div class="wk-col ${d===todayStr()?'today':''}" ${dayClick(d)}>
        <div class="wk-h">${DAYS[new Date(d+'T12:00:00').getDay()]} · ${+d.slice(8)}</div>
        ${evs.map(e=>`<div class="wk-ev" style="background:${e.color}">${e.time?`<span class="tm">${e.time}</span>`:''}${esc(e.txt)}</div>`).join('') || '<div style="font-size:11px;color:var(--text3);text-align:center;padding-top:14px">—</div>'}
      </div>`;
    }
    return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">
      <h2 style="margin:0">${CAL_TITLES[scope]}</h2>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        ${toggle}
        <div class="week-nav">
          <button class="icon-btn" onclick="setSub('${wkey}','${addDays(ws,-7)}')">‹</button>
          <b style="font-size:13px;min-width:110px;text-align:center;cursor:pointer" title="Выбрать неделю" onclick="pickDate('${ws}', v=>setSub('${wkey}', weekStart(v)))">${fmtDate(ws)} – ${fmtDate(addDays(ws,6))}</b>
          <button class="icon-btn" onclick="setSub('${wkey}','${addDays(ws,7)}')">›</button>
        </div>
      </div>
    </div>
    <div class="card" style="padding:14px">
      <div class="wk">${cols}</div>
      <div class="item-meta" style="margin-top:12px">${calLegend(scope)}</div>
    </div>`;
  }
  const key = 'calM_'+scope;
  const m = SUB[key] || curMonth();
  const startOffset = (new Date(+m.slice(0,4), +m.slice(5)-1, 1).getDay()+6)%7; // Monday=0
  const gridStart = addDays(m+'-01', -startOffset);
  let cells = '';
  for(let i=0;i<42;i++){
    const d = addDays(gridStart, i);
    const evs = events[d]||[];
    const inMonth = d.slice(0,7)===m;
    cells += `<div class="cal-d ${inMonth?'':'other'} ${d===todayStr()?'today':''}" ${dayClick(d)}>
      <div class="n">${+d.slice(8)}</div>
      ${evs.slice(0,3).map(e=>`<div class="cal-ev" style="background:${e.color}" title="${esc(e.txt)}">${e.time?e.time+' ':''}${esc(e.txt)}</div>`).join('')}
      ${evs.length>3?`<div class="cal-ev" style="background:var(--surface2);color:var(--text2)">+${evs.length-3}</div>`:''}
      <div class="cal-dots">${evs.slice(0,6).map(e=>`<span class="cal-dot" style="background:${e.color}"></span>`).join('')}</div>
    </div>`;
  }
  return `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">
    <h2 style="margin:0">${CAL_TITLES[scope]}</h2>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      ${toggle}
      <div class="week-nav">
        <button class="icon-btn" onclick="setSub('${key}','${monthAdd(m,-1)}')">‹</button>
        <b style="font-size:14px;min-width:120px;text-align:center;cursor:pointer" title="Выбрать месяц" onclick="pickMonth('${m}', v=>setSub('${key}',v))">${fmtMonth(m)}</b>
        <button class="icon-btn" onclick="setSub('${key}','${monthAdd(m,1)}')">›</button>
      </div>
    </div>
  </div>
  <div class="card" style="padding:14px">
    <div class="cal" style="margin-bottom:6px">${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d=>`<div class="cal-h">${d}</div>`).join('')}</div>
    <div class="cal">${cells}</div>
    <div class="item-meta" style="margin-top:12px">${calLegend(scope)}</div>
  </div>`;
}
function workCalendar(){ return calendarBlock('work'); }
/* ================= PERSONAL ================= */
const P_STATUS = {active:['🟢 активный','green'], paused:['⏸ на паузе','yellow'], idea:['💡 идея','blue'], done:['✔ завершён','']};
function assigneeChip(assigneeId){
  if(!assigneeId) return '';
  const p = S.personal.people.find(x=>x.id===assigneeId);
  return p ? `<span class="chip" style="color:${p.color}">👤 ${esc(p.name.split(' ')[0])}</span>` : '';
}
function persTaskRow(x){
  return `<div class="item-row ${x.done?'done':''}" style="flex-wrap:wrap" draggable="true" ondragstart="rowDragStart(event,'pers','${x.id}')" ondragend="rowDragEnd(event)" ondragover="event.preventDefault()" ondrop="rowDrop(event,'pers','${x.id}')">
    <span class="drag-handle">⠿</span>
    <button class="checkbox ${x.done?'on':''}" onclick="togglePersTask('${x.id}')">${x.done?'✓':''}</button>
    <div class="grow" style="flex:1;min-width:55%"><div class="item-title">${esc(x.title)}</div>
      <div class="item-meta">${x.priority==='high'?'<span class="chip red">важно</span>':''}${assigneeChip(x.assigneeId)}${deadlineChip(x.deadline)} ${subChip(x)} ${tagChips(x.tags)}
      <button class="chip" onclick="addSub('pers','${x.id}')" title="Добавить подзадачу">＋ шаг</button></div>
      ${x.notes?`<div class="notes-line" title="${esc(x.notes)}">${esc(x.notes)}</div>`:''}</div>
    <button class="icon-btn" onclick="editPersTask('${x.id}')">✎</button>
    <button class="icon-btn btn-danger" onclick="delPersTask('${x.id}')">✕</button>
    <div style="width:100%">${subRows(x,'pers')}</div>
  </div>`;
}
/* --- партнёры --- */
function assigneeSelect(selected){
  return `<div class="field"><label>Ответственный</label><select name="assigneeId">
    <option value="">Я</option>
    ${S.personal.people.map(p=>`<option value="${p.id}" ${selected===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}
  </select></div>`;
}
function addPartner(){
  openModal('Новый партнёр', `
    <div class="field"><label>Имя</label><input name="name" required placeholder="Имя Фамилия"></div>
    <div class="field"><label>Роль</label><input name="role" placeholder="Партнёр по бизнесу, подрядчик…"></div>
  `, d=>{
    if(!d.name.trim()) return false;
    S.personal.people.push({id:uid(), name:d.name.trim(), role:d.role.trim(),
      color:AVATAR_COLORS[(S.personal.people.length+2) % AVATAR_COLORS.length]});
    save(); render();
  }, 'Добавить');
}
function editPartner(id){
  const p = S.personal.people.find(x=>x.id===id); if(!p) return;
  openModal('Редактировать', `
    <div class="field"><label>Имя</label><input name="name" required value="${esc(p.name)}"></div>
    <div class="field"><label>Роль</label><input name="role" value="${esc(p.role||'')}"></div>
  `, d=>{ Object.assign(p,{name:d.name.trim(),role:d.role.trim()}); save(); render(); });
}
function delPartner(id){
  confirmDel('Удалить партнёра? Его задачи останутся без ответственного.', ()=>{
    S.personal.people = S.personal.people.filter(p=>p.id!==id);
    S.personal.tasks.forEach(t=>{ if(t.assigneeId===id) t.assigneeId=null; });
    S.personal.businesses.forEach(b=>b.tasks.forEach(t=>{ if(t.assigneeId===id) t.assigneeId=null; }));
    S.personal.projects.forEach(p=>{ p.partnerIds = (p.partnerIds||[]).filter(x=>x!==id); });
  });
}
function vPersonal(){
  const sub = SUB.personal || 'projects';
  return `
  <div class="page-head"><div><h1>Личные проекты</h1><div class="sub">Свои проекты и цели вне работы</div></div></div>
  <div class="tabs">
    <button class="${sub==='projects'?'active':''}" onclick="setSub('personal','projects')">Проекты</button>
    <button class="${sub==='biz'?'active':''}" onclick="setSub('personal','biz')">Бизнес</button>
    <button class="${sub==='ideas'?'active':''}" onclick="setSub('personal','ideas')">Идеи</button>
    <button class="${sub==='goals'?'active':''}" onclick="setSub('personal','goals')">Цели года</button>
    <button class="${sub==='calendar'?'active':''}" onclick="setSub('personal','calendar')">Календарь</button>
  </div>
  ${sub==='goals' ? persGoals() : sub==='calendar' ? calendarBlock('personal') : sub==='ideas' ? persIdeas() : sub==='biz' ? persBiz() : persProjects()}`;
}
function persGoals(){
  const goals = goalsList('personal');
  return `
  <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap">
    <h2 style="margin:0">🎯 Личные цели</h2>
    <div style="display:flex;gap:8px">${yearSelector('personal')}
    <button class="btn btn-primary btn-sm" onclick="addGoal('personal')">+ Цель</button></div>
  </div>
  <div class="grid grid2">
    ${goals.length ? goals.map(g=>goalCard(g,'personal')).join('') : '<div class="card empty">Целей на этот год пока нет</div>'}
  </div>`;
}
const PROJ_COLORS = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#a855f7','#14b8a6','#f43f5e'];
function persProjects(){
  const focuses = S.personal.weekFocuses.filter(f=>f.weekStart===weekStart());
  return `
  <div class="card" style="margin-bottom:16px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <h2 style="margin:0">🔥 Личные фокусы недели</h2>
      <button class="btn btn-ghost btn-sm" onclick="addFocus('personal')">+ Фокус</button>
    </div>
    ${focuses.length ? focuses.map(f=>focusRow(f,'personal')).join('') : '<div class="empty" style="padding:10px">Главное в личных проектах на этой неделе</div>'}
  </div>
  <div class="card" style="margin-bottom:16px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <h2 style="margin:0">🤝 Партнёры</h2>
      <button class="btn btn-ghost btn-sm" onclick="addPartner()">+ Партнёр</button>
    </div>
    ${S.personal.people.length ? `<div style="display:flex;gap:14px;flex-wrap:wrap">
      ${S.personal.people.map(p=>`<div style="display:flex;align-items:center;gap:8px;background:var(--surface2);padding:7px 12px;border-radius:11px">
        <span class="mini-av" style="background:${p.color}">${initials(p.name)}</span>
        <div><div style="font-size:13.5px;font-weight:600">${esc(p.name)}</div>
        <div style="font-size:11.5px;color:var(--text3)">${esc(p.role||'')}</div></div>
        <button class="icon-btn" style="width:24px;height:24px" onclick="editPartner('${p.id}')">✎</button>
        <button class="icon-btn btn-danger" style="width:24px;height:24px" onclick="delPartner('${p.id}')">✕</button>
      </div>`).join('')}</div>`
    : '<div class="hint">Добавьте партнёров по проектам и бизнесу — сможете назначать их ответственными за задачи</div>'}
  </div>
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
    <h2 style="margin:0">🚀 Проекты</h2>
    <div style="display:flex;gap:8px">
      <button class="btn btn-ghost btn-sm" onclick="createFromTemplate('personal')">⧉ Из шаблона</button>
      <button class="btn btn-primary btn-sm" onclick="addProject()">+ Проект</button>
    </div>
  </div>
  ${S.personal.projects.length ? `<div class="grid grid2">${[...S.personal.projects]
      .sort((a,b)=>((a.status==='done')-(b.status==='done')))
      .map(projectCard).join('')}</div>`
    : `<div class="card">${emptyBig('🚀','Пока нет проектов','Создайте первый — внутри задачи с дедлайнами, партнёры и прогресс')}</div>`}`;
}
function projectCard(p){
  const tasks = S.personal.tasks.filter(t=>t.projectId===p.id)
    .sort((a,b)=>(a.done-b.done)); // порядок настраивается перетаскиванием
  const done = tasks.filter(t=>t.done).length;
  const pct = tasks.length ? Math.round(done/tasks.length*100) : 0;
  const st = P_STATUS[p.status||'active'];
  const partners = (p.partnerIds||[]).map(id=>S.personal.people.find(x=>x.id===id)).filter(Boolean);
  return `<div class="card" style="border-top:3px solid ${p.color||'var(--accent)'};${p.status==='done'?'opacity:.65':''}">
    <div style="display:flex;align-items:flex-start;gap:10px">
      <div class="grow" style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:15.5px">${esc(p.icon||'🚀')} ${esc(p.name)} <span class="chip ${st[1]}" style="vertical-align:2px">${st[0]}</span></div>
        ${p.desc?`<div class="sub">${esc(p.desc)}</div>`:''}
      </div>
      <button class="icon-btn" title="Сохранить как шаблон" onclick="saveAsTemplate('personal','${p.id}')">⧉</button>
      <button class="icon-btn" onclick="editProject('${p.id}')">✎</button>
      <button class="icon-btn btn-danger" onclick="delProject('${p.id}')">✕</button>
    </div>
    <div class="item-meta" style="margin:10px 0 6px;align-items:center">
      ${partners.length?`<span style="display:flex">${partners.map((x,i)=>`<span class="mini-av" style="background:${x.color};margin-left:${i?'-6px':'0'};border:2px solid var(--surface)" title="${esc(x.name)}">${initials(x.name)}</span>`).join('')}</span>`:''}
      <span>${done}/${tasks.length} задач</span><span class="mono" style="font-weight:700;color:var(--text)">${pct}%</span>
    </div>
    <div class="progress green" style="margin-bottom:8px"><div style="width:${pct}%"></div></div>
    ${tasks.map(persTaskRow).join('')}
    <div class="quick-add" style="margin-top:10px">
      <input placeholder="Добавить задачу… (Enter)" onkeydown="if(event.key==='Enter'&&this.value.trim()){quickAddPers('${p.id}',this.value.trim());this.value=''}">
      <button class="btn btn-ghost btn-sm" onclick="addPersTask('${p.id}')">＋ детали</button>
    </div>
  </div>`;
}
function quickAddPers(projectId, title){
  S.personal.tasks.push({id:uid(), projectId, title, done:false});
  save(); render();
}
function projStatusField(p){
  return `<div class="field"><label>Статус</label><select name="status">
    ${Object.entries(P_STATUS).map(([k,[l]])=>`<option value="${k}" ${(p&&p.status||'active')===k?'selected':''}>${l}</option>`).join('')}
  </select></div>`;
}
function partnerChecks(p){
  if(!S.personal.people.length) return '';
  return `<div class="field"><label>Партнёры проекта</label>
    ${S.personal.people.map(x=>`
      <label style="display:flex;align-items:center;gap:8px;font-size:14px;font-weight:400;color:var(--text);margin-bottom:6px">
        <input type="checkbox" name="mem_${x.id}" ${(p&&p.partnerIds||[]).includes(x.id)?'checked':''} style="width:auto">
        <span class="mini-av" style="background:${x.color}">${initials(x.name)}</span> ${esc(x.name)}
      </label>`).join('')}</div>`;
}
function addProject(){
  openModal('Новый проект', `
    <div class="frow">
      <div class="field" style="flex:0 0 84px"><label>Иконка</label><input name="icon" value="🚀" maxlength="4" style="text-align:center"></div>
      <div class="field"><label>Название</label><input name="name" required placeholder="Например: свой блог"></div>
    </div>
    <div class="field"><label>Описание</label><textarea name="desc" placeholder="Цель проекта"></textarea></div>
    ${projStatusField(null)}
    ${partnerChecks(null)}
  `, d=>{
    if(!d.name.trim()) return false;
    S.personal.projects.push({id:uid(), name:d.name.trim(), icon:(d.icon||'🚀').trim(), desc:d.desc.trim(), status:d.status, partnerIds:collectMembers(d),
      color:PROJ_COLORS[S.personal.projects.length % PROJ_COLORS.length]});
    save(); render();
  }, 'Создать');
}
function editProject(id){
  const p = S.personal.projects.find(x=>x.id===id); if(!p) return;
  openModal('Редактировать проект', `
    <div class="frow">
      <div class="field" style="flex:0 0 84px"><label>Иконка</label><input name="icon" value="${esc(p.icon||'🚀')}" maxlength="4" style="text-align:center"></div>
      <div class="field"><label>Название</label><input name="name" required value="${esc(p.name)}"></div>
    </div>
    <div class="field"><label>Описание</label><textarea name="desc">${esc(p.desc||'')}</textarea></div>
    ${projStatusField(p)}
    ${partnerChecks(p)}
  `, d=>{ Object.assign(p,{name:d.name.trim(),icon:(d.icon||'🚀').trim(),desc:d.desc.trim(),status:d.status,partnerIds:collectMembers(d)}); save(); render(); });
}
function delProject(id){
  confirmDel('Удалить проект и все его задачи?', ()=>{
    S.personal.projects = S.personal.projects.filter(p=>p.id!==id);
    S.personal.tasks = S.personal.tasks.filter(t=>t.projectId!==id);
  });
}
function addPersTask(projectId){
  openModal('Новая задача', `
    <div class="field"><label>Задача</label><input name="title" required></div>
    <div class="frow">
      <div class="field"><label>Дедлайн</label><input name="deadline" type="date"></div>
      <div class="field"><label>Приоритет</label><select name="priority">
        <option value="mid">Обычный</option><option value="high">Важно</option>
      </select></div>
    </div>
    ${assigneeSelect(null)}
    ${tagsField()}
    <div class="field"><label>Заметка</label><textarea name="notes"></textarea></div>
  `, d=>{
    if(!d.title.trim()) return false;
    S.personal.tasks.push({id:uid(), projectId, title:d.title.trim(), deadline:d.deadline, priority:d.priority, assigneeId:d.assigneeId||null, tags:parseTags(d.tags), notes:d.notes.trim(), done:false});
    save(); render();
  }, 'Добавить');
}
function editPersTask(id){
  const t = S.personal.tasks.find(x=>x.id===id); if(!t) return;
  openModal('Редактировать задачу', `
    <div class="field"><label>Задача</label><input name="title" required value="${esc(t.title)}"></div>
    <div class="frow">
      <div class="field"><label>Дедлайн</label><input name="deadline" type="date" value="${t.deadline||''}"></div>
      <div class="field"><label>Приоритет</label><select name="priority">
        <option value="mid" ${t.priority!=='high'?'selected':''}>Обычный</option>
        <option value="high" ${t.priority==='high'?'selected':''}>Важно</option>
      </select></div>
    </div>
    <div class="field"><label>Проект</label><select name="projectId">
      ${S.personal.projects.map(p=>`<option value="${p.id}" ${t.projectId===p.id?'selected':''}>${esc(p.name)}</option>`).join('')}
    </select></div>
    ${assigneeSelect(t.assigneeId)}
    ${tagsField(t.tags)}
    <div class="field"><label>Заметка</label><textarea name="notes">${esc(t.notes||'')}</textarea></div>
  `, d=>{ Object.assign(t,{title:d.title.trim(), deadline:d.deadline, priority:d.priority, projectId:d.projectId, assigneeId:d.assigneeId||null, tags:parseTags(d.tags), notes:d.notes.trim()}); save(); render(); });
}
function togglePersTask(id){
  const t=S.personal.tasks.find(x=>x.id===id);
  if(t){ t.done=!t.done; t.doneAt = t.done ? todayStr() : null; save(); render(); }
}
function delPersTask(id){ confirmDel('Удалить задачу?',()=>{ S.personal.tasks=S.personal.tasks.filter(x=>x.id!==id); }); }

/* --- personal: бэклог идей --- */
function persIdeas(){
  const ideas = [...S.personal.ideas].sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  return `
  <div class="card" style="max-width:860px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <h2 style="margin:0">💡 Бэклог идей</h2>
      <span class="chip">${ideas.length}</span>
    </div>
    <div class="hint" style="margin-bottom:10px">Записывайте мысли, которые пока не превратились в проекты. Когда идея созреет — одним кликом сделайте из неё проект.</div>
    <div class="quick-add">
      <input placeholder="Записать идею… (Enter)" onkeydown="if(event.key==='Enter'&&this.value.trim()){addIdea(this.value.trim());this.value=''}">
    </div>
    ${ideas.map(i=>`<div class="item-row" style="align-items:flex-start">
      <span style="font-size:16px;margin-top:2px">💡</span>
      <div class="grow">
        <div class="item-title">${esc(i.title)}</div>
        ${i.notes?`<div style="font-size:13px;color:var(--text2);margin-top:3px;white-space:pre-wrap">${esc(i.notes)}</div>`:''}
        <div class="item-meta"><span>${fmtDate(i.createdAt)}</span></div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="ideaToProject('${i.id}')" title="Превратить в проект">→ в проект</button>
      <button class="icon-btn" onclick="editIdea('${i.id}')">✎</button>
      <button class="icon-btn btn-danger" onclick="delIdea('${i.id}')">✕</button>
    </div>`).join('') || emptyBig('💡','Идей пока нет','Записывайте всё, что приходит в голову — лучшие превратите в проекты')}
  </div>`;
}
function addIdea(title){
  S.personal.ideas.push({id:uid(), title, notes:'', createdAt:todayStr()});
  save(); render();
}
function editIdea(id){
  const i = S.personal.ideas.find(x=>x.id===id); if(!i) return;
  openModal('Идея', `
    <div class="field"><label>Идея</label><input name="title" required value="${esc(i.title)}"></div>
    <div class="field"><label>Мысли, детали</label><textarea name="notes" style="min-height:110px">${esc(i.notes||'')}</textarea></div>
  `, d=>{ Object.assign(i,{title:d.title.trim(), notes:d.notes.trim()}); save(); render(); });
}
function delIdea(id){ confirmDel('Удалить идею?',()=>{ S.personal.ideas=S.personal.ideas.filter(x=>x.id!==id); }); }
function ideaToProject(id){
  const i = S.personal.ideas.find(x=>x.id===id); if(!i) return;
  if(!confirm('Создать проект «'+i.title+'» из этой идеи?')) return;
  S.personal.projects.push({id:uid(), name:i.title, desc:i.notes||'', status:'active', partnerIds:[],
    color:PROJ_COLORS[S.personal.projects.length % PROJ_COLORS.length]});
  S.personal.ideas = S.personal.ideas.filter(x=>x.id!==id);
  save(); setSub('personal','projects'); toast('Проект создан 🚀');
}

/* --- personal: бизнес --- */
function persBiz(){
  return `
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
    <h2 style="margin:0">🏢 Мой бизнес</h2>
    <button class="btn btn-primary btn-sm" onclick="addBiz()">+ Бизнес</button>
  </div>
  ${S.personal.businesses.length ? `<div class="grid grid2">${S.personal.businesses.map(bizCard).join('')}</div>`
    : `<div class="card">${emptyBig('🏢','Бизнес ещё не добавлен','Цели, задачи с ответственными и выручка/прибыль по месяцам — всё в одной карточке')}</div>`}`;
}
function findBiz(id){ return S.personal.businesses.find(b=>b.id===id); }
function bizCard(b){
  const st = P_STATUS[b.status||'active'];
  const fin = [...b.finance].sort((a,y)=>a.month.localeCompare(y.month));
  const last = fin[fin.length-1];
  const yearFin = fin.filter(f=>f.month.slice(0,4)===String(curYear()));
  const yearProfit = yearFin.reduce((s,f)=>s+(f.revenue||0)-(f.expenses||0),0);
  const activeTasks = b.tasks.filter(t=>!t.done);
  return `<div class="card" style="border-top:3px solid ${b.color||'var(--accent)'}">
    <div style="display:flex;align-items:flex-start;gap:10px">
      <div class="grow" style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:15.5px">${esc(b.icon||'🏢')} ${esc(b.name)} <span class="chip ${st[1]}" style="vertical-align:2px">${st[0]}</span></div>
        ${b.desc?`<div class="sub">${esc(b.desc)}</div>`:''}
      </div>
      <button class="icon-btn" onclick="editBiz('${b.id}')">✎</button>
      <button class="icon-btn btn-danger" onclick="delBiz('${b.id}')">✕</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:12px 0">
      <div class="card" style="padding:12px;box-shadow:none">
        <div class="lbl" style="font-size:11.5px;color:var(--text2)">${last?fmtMonth(last.month):'Последний месяц'}</div>
        ${last?`<div class="mono" style="font-size:16px;font-weight:700;color:${last.revenue-last.expenses>=0?'var(--green)':'var(--red)'}">${last.revenue-last.expenses>=0?'+':''}${fmtMoney(last.revenue-last.expenses)}</div>
        <div class="sub2 mono" style="font-size:11px">↑ ${fmtMoney(last.revenue)} · ↓ ${fmtMoney(last.expenses)}</div>`
        :'<div class="hint">нет данных</div>'}
      </div>
      <div class="card" style="padding:12px;box-shadow:none">
        <div class="lbl" style="font-size:11.5px;color:var(--text2)">Прибыль за ${curYear()}</div>
        <div class="mono" style="font-size:16px;font-weight:700;color:${yearProfit>=0?'var(--green)':'var(--red)'}">${yearProfit>=0?'+':''}${fmtMoney(yearProfit)}</div>
        <div class="sub2" style="font-size:11px">${yearFin.length} ${plural(yearFin.length,'месяц','месяца','месяцев')} с данными</div>
      </div>
    </div>
    ${fin.length>1?`<div style="position:relative;height:150px;margin-bottom:12px"><canvas id="bizChart_${b.id}"></canvas></div>`:''}
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <div style="font-size:12px;font-weight:700;color:var(--text3)">💰 ФИНАНСЫ ПО МЕСЯЦАМ</div>
      <button class="btn btn-ghost btn-sm" onclick="addBizFin('${b.id}')">+ Месяц</button>
    </div>
    ${fin.slice(-4).reverse().map(f=>`<div class="item-row" style="padding:7px 4px">
      <div class="grow"><span style="font-size:13px">${fmtMonth(f.month)}</span></div>
      <span class="mono" style="font-size:13px;color:var(--green)">↑ ${fmtMoney(f.revenue)}</span>
      <span class="mono" style="font-size:13px;color:var(--red)">↓ ${fmtMoney(f.expenses)}</span>
      <span class="mono" style="font-size:13px;font-weight:700;color:${f.revenue-f.expenses>=0?'var(--green)':'var(--red)'}">${f.revenue-f.expenses>=0?'+':''}${fmtMoney(f.revenue-f.expenses)}</span>
      <button class="icon-btn" onclick="editBizFin('${b.id}','${f.id}')">✎</button>
      <button class="icon-btn btn-danger" onclick="delBizFin('${b.id}','${f.id}')">✕</button>
    </div>`).join('') || '<div class="empty" style="padding:8px">Добавьте выручку и расходы за месяц</div>'}
    <div style="display:flex;justify-content:space-between;align-items:center;margin:14px 0 4px">
      <div style="font-size:12px;font-weight:700;color:var(--text3)">🎯 ЦЕЛИ</div>
      <button class="btn btn-ghost btn-sm" onclick="addBizGoal('${b.id}')">+ Цель</button>
    </div>
    ${b.goals.map(g=>`<div class="item-row ${g.done?'done':''}" style="padding:7px 4px">
      <button class="checkbox ${g.done?'on':''}" onclick="toggleBizGoal('${b.id}','${g.id}')">${g.done?'✓':''}</button>
      <div class="grow"><div class="item-title" style="font-size:13.5px">${esc(g.title)}</div></div>
      <button class="icon-btn btn-danger" onclick="delBizGoal('${b.id}','${g.id}')">✕</button>
    </div>`).join('') || '<div class="empty" style="padding:8px">Например: выйти на 500К выручки/мес</div>'}
    <div style="display:flex;justify-content:space-between;align-items:center;margin:14px 0 4px">
      <div style="font-size:12px;font-weight:700;color:var(--text3)">✅ ЗАДАЧИ · ${activeTasks.length} актив.</div>
      <button class="btn btn-ghost btn-sm" onclick="addBizTask('${b.id}')">+ Задача</button>
    </div>
    ${[...b.tasks].sort((a,y)=>(a.done-y.done)||String(a.deadline||'9999').localeCompare(String(y.deadline||'9999'))).map(t=>`
    <div class="item-row ${t.done?'done':''}" style="padding:7px 4px">
      <button class="checkbox ${t.done?'on':''}" onclick="toggleBizTask('${b.id}','${t.id}')">${t.done?'✓':''}</button>
      <div class="grow"><div class="item-title" style="font-size:13.5px">${esc(t.title)}</div>
        <div class="item-meta">${assigneeChip(t.assigneeId)}${deadlineChip(t.deadline)}</div>
        ${t.notes?`<div class="notes-line" title="${esc(t.notes)}">${esc(t.notes)}</div>`:''}</div>
      <button class="icon-btn" onclick="editBizTask('${b.id}','${t.id}')">✎</button>
      <button class="icon-btn btn-danger" onclick="delBizTask('${b.id}','${t.id}')">✕</button>
    </div>`).join('') || '<div class="empty" style="padding:8px">Задач нет</div>'}
  </div>`;
}
function addBiz(){
  openModal('Новый бизнес', `
    <div class="frow">
      <div class="field" style="flex:0 0 84px"><label>Иконка</label><input name="icon" value="🏢" maxlength="4" style="text-align:center"></div>
      <div class="field"><label>Название</label><input name="name" required placeholder="Например: кофейня"></div>
    </div>
    <div class="field"><label>Описание</label><textarea name="desc" placeholder="Что за бизнес, модель"></textarea></div>
    ${projStatusField(null)}
  `, d=>{
    if(!d.name.trim()) return false;
    S.personal.businesses.push({id:uid(), name:d.name.trim(), icon:(d.icon||'🏢').trim(), desc:d.desc.trim(), status:d.status,
      goals:[], tasks:[], finance:[], color:PROJ_COLORS[(S.personal.businesses.length+5) % PROJ_COLORS.length]});
    save(); render();
  }, 'Создать');
}
function editBiz(id){
  const b = findBiz(id); if(!b) return;
  openModal('Редактировать бизнес', `
    <div class="frow">
      <div class="field" style="flex:0 0 84px"><label>Иконка</label><input name="icon" value="${esc(b.icon||'🏢')}" maxlength="4" style="text-align:center"></div>
      <div class="field"><label>Название</label><input name="name" required value="${esc(b.name)}"></div>
    </div>
    <div class="field"><label>Описание</label><textarea name="desc">${esc(b.desc||'')}</textarea></div>
    ${projStatusField(b)}
  `, d=>{ Object.assign(b,{name:d.name.trim(),icon:(d.icon||'🏢').trim(),desc:d.desc.trim(),status:d.status}); save(); render(); });
}
function delBiz(id){ confirmDel('Удалить бизнес со всеми целями, задачами и финансами?',()=>{ S.personal.businesses=S.personal.businesses.filter(b=>b.id!==id); }); }
function addBizGoal(bizId){
  openModal('Цель бизнеса', `<div class="field"><label>Цель</label><input name="title" required placeholder="Выйти на 500 000 ₽ выручки/мес"></div>`, d=>{
    const b = findBiz(bizId);
    if(!d.title.trim() || !b) return false;
    b.goals.push({id:uid(), title:d.title.trim(), done:false});
    save(); render();
  }, 'Добавить');
}
function toggleBizGoal(bizId,id){ const b=findBiz(bizId); const g=b&&b.goals.find(x=>x.id===id); if(g){g.done=!g.done; save(); render();} }
function delBizGoal(bizId,id){ confirmDel('Удалить цель?',()=>{ const b=findBiz(bizId); if(b) b.goals=b.goals.filter(x=>x.id!==id); }); }
function addBizTask(bizId){
  openModal('Задача по бизнесу', `
    <div class="field"><label>Задача</label><input name="title" required></div>
    <div class="field"><label>Дедлайн</label><input name="deadline" type="date"></div>
    ${assigneeSelect(null)}
    <div class="field"><label>Заметка</label><textarea name="notes"></textarea></div>
  `, d=>{
    const b = findBiz(bizId);
    if(!d.title.trim() || !b) return false;
    b.tasks.push({id:uid(), title:d.title.trim(), deadline:d.deadline||null, assigneeId:d.assigneeId||null, notes:d.notes.trim(), done:false});
    save(); render();
  }, 'Добавить');
}
function editBizTask(bizId,id){
  const b = findBiz(bizId); const t = b && b.tasks.find(x=>x.id===id); if(!t) return;
  openModal('Редактировать задачу', `
    <div class="field"><label>Задача</label><input name="title" required value="${esc(t.title)}"></div>
    <div class="field"><label>Дедлайн</label><input name="deadline" type="date" value="${t.deadline||''}"></div>
    ${assigneeSelect(t.assigneeId)}
    <div class="field"><label>Заметка</label><textarea name="notes">${esc(t.notes||'')}</textarea></div>
  `, d=>{ Object.assign(t,{title:d.title.trim(),deadline:d.deadline||null,assigneeId:d.assigneeId||null,notes:d.notes.trim()}); save(); render(); });
}
function toggleBizTask(bizId,id){ const b=findBiz(bizId); const t=b&&b.tasks.find(x=>x.id===id); if(t){t.done=!t.done; t.doneAt=t.done?todayStr():null; save(); render();} }
function delBizTask(bizId,id){ confirmDel('Удалить задачу?',()=>{ const b=findBiz(bizId); if(b) b.tasks=b.tasks.filter(x=>x.id!==id); }); }
function bizFinForm(f){
  f = f||{};
  return `
    <div class="field"><label>Месяц</label><input name="month" type="month" value="${f.month||curMonth()}"></div>
    <div class="frow">
      <div class="field"><label>Выручка, ₽</label><input name="revenue" type="number" min="0" value="${f.revenue||''}" required></div>
      <div class="field"><label>Расходы, ₽</label><input name="expenses" type="number" min="0" value="${f.expenses||''}" required></div>
    </div>`;
}
function addBizFin(bizId){
  openModal('Финансы за месяц', bizFinForm(), d=>{
    const b = findBiz(bizId);
    if(!b) return false;
    const ex = b.finance.find(f=>f.month===d.month);
    if(ex){ Object.assign(ex,{revenue:+d.revenue||0, expenses:+d.expenses||0}); }
    else b.finance.push({id:uid(), month:d.month||curMonth(), revenue:+d.revenue||0, expenses:+d.expenses||0});
    save(); render();
  }, 'Записать');
}
function editBizFin(bizId,id){
  const b = findBiz(bizId); const f = b && b.finance.find(x=>x.id===id); if(!f) return;
  openModal('Финансы · '+fmtMonth(f.month), bizFinForm(f), d=>{
    Object.assign(f,{month:d.month||f.month, revenue:+d.revenue||0, expenses:+d.expenses||0});
    save(); render();
  });
}
function delBizFin(bizId,id){ confirmDel('Удалить запись?',()=>{ const b=findBiz(bizId); if(b) b.finance=b.finance.filter(x=>x.id!==id); }); }
const bizCharts = {};
function drawBizCharts(){
  if(typeof Chart==='undefined') return;
  S.personal.businesses.forEach(b=>{
    const cv = document.getElementById('bizChart_'+b.id);
    if(!cv) return;
    const fin = [...b.finance].sort((a,y)=>a.month.localeCompare(y.month)).slice(-8);
    const css = getComputedStyle(document.documentElement);
    const txt = css.getPropertyValue('--text2').trim();
    if(bizCharts[b.id]) bizCharts[b.id].destroy();
    bizCharts[b.id] = new Chart(cv, {
      type:'bar',
      data:{ labels:fin.map(f=>fmtMonthShort(f.month)), datasets:[
        {label:'Выручка', data:fin.map(f=>f.revenue), backgroundColor:'rgba(52,211,153,.75)', borderRadius:4},
        {label:'Расходы', data:fin.map(f=>f.expenses), backgroundColor:'rgba(248,113,113,.7)', borderRadius:4}
      ]},
      options:{ responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false}, tooltip:{callbacks:{label:c=>c.dataset.label+': '+fmtMoney(c.parsed.y)}} },
        scales:{ x:{grid:{display:false}, ticks:{color:txt,font:{size:9}}},
          y:{display:false} }
      }
    });
  });
}

/* ================= BUDGET ================= */
function vBudget(){
  const sub = SUB.budget || 'month';
  return `
  <div class="page-head"><div><h1>Бюджет</h1><div class="sub">План, факт, долги и прогноз кэшфлоу</div></div></div>
  <div class="tabs">
    <button class="${sub==='month'?'active':''}" onclick="setSub('budget','month')">Месяц</button>
    <button class="${sub==='assets'?'active':''}" onclick="setSub('budget','assets')">Долги и накопления</button>
    <button class="${sub==='forecast'?'active':''}" onclick="setSub('budget','forecast')">Прогноз CF</button>
  </div>
  ${sub==='assets' ? budgetAssets() : sub==='forecast' ? budgetForecast() : budgetMonth()}`;
}
function recurTotal(type){ return S.budget.plan.filter(x=>x.type===type).reduce((s,x)=>s+x.amount,0); }
function oneoffTotal(type,m){ return S.budget.planned.filter(x=>x.type===type&&x.month===m).reduce((s,x)=>s+x.amount,0); }
function planTotal(type,m){ return recurTotal(type) + (m?oneoffTotal(type,m):0); }
function factTotal(type,m){ return S.budget.transactions.filter(x=>x.type===type&&x.month===m).reduce((s,x)=>s+x.amount,0); }
function debtMonthly(){ return S.budget.debts.reduce((s,d)=> s + ((d.total-(d.paid||0))>0 ? (d.monthly||0) : 0), 0); }
function catOptions(type, selected){
  return S.budget.categories[type].map(c=>`<option ${c===selected?'selected':''}>${esc(c)}</option>`).join('');
}
function catFields(type, selected){
  return `<div class="frow">
    <div class="field"><label>Категория</label><select name="category">${catOptions(type,selected)}</select></div>
    <div class="field"><label>…или новая</label><input name="newcat" placeholder="Своя категория"></div>
  </div>`;
}
function resolveCat(type, d){
  const c = (d.newcat||'').trim();
  if(c){ if(!S.budget.categories[type].includes(c)) S.budget.categories[type].push(c); return c; }
  return d.category || 'Другое';
}

function budgetMonth(){
  const m = SUB.budgetMonth || curMonth();
  const prevM = monthAdd(m,-1), nextM = monthAdd(m,1);
  const planInc = planTotal('income',m), planExp = planTotal('expense',m);
  const factInc = factTotal('income',m), factExp = factTotal('expense',m);
  const prevExp = factTotal('expense',prevM);
  const expDiff = prevExp>0 ? Math.round((factExp-prevExp)/prevExp*100) : null;
  const savingsRate = factInc>0 ? Math.round((factInc-factExp)/factInc*100) : null;
  // категории расходов: лимит (план) vs факт
  const catRows = S.budget.categories.expense.map(c=>{
    const limit = S.budget.plan.filter(x=>x.type==='expense'&&x.category===c).reduce((s,x)=>s+x.amount,0)
      + S.budget.planned.filter(x=>x.type==='expense'&&x.category===c&&x.month===m).reduce((s,x)=>s+x.amount,0);
    const fact = S.budget.transactions.filter(x=>x.type==='expense'&&x.category===c&&x.month===m).reduce((s,x)=>s+x.amount,0);
    return {c, limit, fact};
  }).filter(x=>x.limit>0 || x.fact>0).sort((a,b)=>b.fact-a.fact);

  const section = (type, title, icon) => {
    const plan = S.budget.plan.filter(x=>x.type===type);
    const oneoffs = S.budget.planned.filter(x=>x.type===type&&x.month===m);
    const fact = S.budget.transactions.filter(x=>x.type===type&&x.month===m);
    const clr = type==='income'?'var(--green)':'var(--red)';
    return `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <h2 style="margin:0">${icon} ${title}</h2>
        <span class="mono" style="font-weight:700;color:${clr}">${fmtMoney(type==='income'?factInc:factExp)}</span>
      </div>
      <div style="font-size:12px;font-weight:600;color:var(--text3);margin-bottom:2px">ЕЖЕМЕСЯЧНЫЙ ПЛАН · ${fmtMoney(recurTotal(type))}</div>
      ${plan.map(x=>{
        const paid = (x.paidMonths||[]).includes(m);
        return `<div class="item-row">
        <div class="grow"><div class="item-title">${esc(x.name)}</div><div class="item-meta"><span class="chip">${catIcon(x.category)} ${esc(x.category)}</span>${paid?'<span class="chip green">оплачено ✓</span>':''}</div></div>
        <span class="mono" style="font-size:14px">${fmtMoney(x.amount)}</span>
        ${paid?'':`<button class="icon-btn" title="Оплачено — записать в факт" onclick="payPlan('${x.id}','${m}')" style="color:var(--green)">✓</button>`}
        <button class="icon-btn" onclick="editPlanItem('${x.id}')">✎</button>
        <button class="icon-btn btn-danger" onclick="delPlanItem('${x.id}')">✕</button>
      </div>`;}).join('') || '<div class="empty" style="padding:8px">Плановых позиций нет</div>'}
      <div style="display:flex;gap:8px;margin:6px 0 16px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" onclick="addPlanItem('${type}')">+ В ежемесячный план</button>
        <button class="btn btn-ghost btn-sm" onclick="addPlanned('${type}','${m}')">+ Разовое (отпуск, премия…)</button>
      </div>
      ${oneoffs.length?`<div style="font-size:12px;font-weight:600;color:var(--text3);margin-bottom:2px">РАЗОВОЕ В ЭТОМ МЕСЯЦЕ · ${fmtMoney(oneoffTotal(type,m))}</div>
      ${oneoffs.map(x=>`<div class="item-row ${x.done?'done':''}">
        <div class="grow"><div class="item-title">${esc(x.name)}</div><div class="item-meta"><span class="chip">${catIcon(x.category)} ${esc(x.category)}</span>${x.done?'<span class="chip green">оплачено</span>':''}</div></div>
        <span class="mono" style="font-size:14px">${fmtMoney(x.amount)}</span>
        ${x.done?'':`<button class="icon-btn" title="Оплачено" onclick="payPlanned('${x.id}')" style="color:var(--green)">✓</button>`}
        <button class="icon-btn btn-danger" onclick="delPlanned('${x.id}')">✕</button>
      </div>`).join('')}<div style="margin-bottom:16px"></div>`:''}
      <div style="font-size:12px;font-weight:600;color:var(--text3);margin-bottom:2px">ФАКТ · ${fmtMonth(m).toUpperCase()}</div>
      ${fact.map(x=>`<div class="item-row">
        <div class="grow"><div class="item-title">${esc(x.name)}</div><div class="item-meta"><span class="chip">${catIcon(x.category)} ${esc(x.category)}</span></div></div>
        <span class="mono" style="font-size:14px">${fmtMoney(x.amount)}</span>
        <button class="icon-btn" title="Повторить запись" onclick="repeatTx('${x.id}')">⟳</button>
        <button class="icon-btn" onclick="editTx('${x.id}')">✎</button>
        <button class="icon-btn btn-danger" onclick="delTx('${x.id}')">✕</button>
      </div>`).join('') || '<div class="empty" style="padding:8px">Записей нет</div>'}
      <button class="btn btn-primary btn-sm" style="margin-top:6px" onclick="addTx('${type}','${m}')">+ Записать</button>
    </div>`;
  };
  return `
  <div style="display:flex;justify-content:center;margin-bottom:16px">
    <div class="week-nav card" style="padding:8px 14px">
      <button class="icon-btn" onclick="setSub('budgetMonth','${prevM}')">‹</button>
      <b style="font-size:14.5px;min-width:130px;text-align:center;cursor:pointer" title="Выбрать месяц" onclick="pickMonth('${m}', v=>setSub('budgetMonth',v))">${fmtMonth(m)}</b>
      <button class="icon-btn" onclick="setSub('budgetMonth','${nextM}')">›</button>
    </div>
  </div>
  <div class="grid grid3" style="margin-bottom:16px">
    <div class="card stat-card"><div class="lbl">План: баланс месяца</div>
      <div class="val mono" style="color:${planInc-planExp>=0?'var(--green)':'var(--red)'}">${planInc-planExp>=0?'+':''}${fmtMoney(planInc-planExp)}</div>
      <div class="sub2 mono">↑ ${fmtMoney(planInc)} · ↓ ${fmtMoney(planExp)}</div></div>
    <div class="card stat-card"><div class="lbl">Факт: баланс месяца</div>
      <div class="val mono" style="color:${factInc-factExp>=0?'var(--green)':'var(--red)'}">${factInc-factExp>=0?'+':''}${fmtMoney(factInc-factExp)}</div>
      <div class="sub2 mono">↑ ${fmtMoney(factInc)} · ↓ ${fmtMoney(factExp)}${savingsRate!==null?' · сбережения '+savingsRate+'%':''}</div></div>
    <div class="card stat-card"><div class="lbl">Расходы vs прошлый месяц</div>
      <div class="val mono" style="color:${expDiff===null?'var(--text)':expDiff>0?'var(--red)':'var(--green)'}">${expDiff===null?'—':(expDiff>0?'+':'')+expDiff+'%'}</div>
      <div class="sub2 mono">${prevExp>0?fmtMonthShort(prevM)+': '+fmtMoney(prevExp):'нет данных за '+fmtMonthShort(prevM)}</div></div>
  </div>
  <div class="card" style="margin-bottom:16px">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <h2>📊 Расходы по категориям · ${fmtMonth(m)}</h2>
      <button class="btn btn-ghost btn-sm" onclick="editCatIcons()" title="Настроить иконки категорий">🏷️ Иконки</button>
    </div>
    ${catRows.length?`<div class="grid grid2" style="align-items:center">
      <div>
      ${catRows.map(x=>{
        const pct = x.limit>0 ? Math.round(x.fact/x.limit*100) : null;
        const over = pct!==null && pct>100;
        const share = factExp>0 ? Math.round(x.fact/factExp*100) : 0;
        return `<div class="cat-row">
          <div style="flex:1;min-width:0">
            <div style="display:flex;justify-content:space-between;font-size:13.5px;gap:8px">
              <span style="font-weight:500">${catIcon(x.c)} ${esc(x.c)} ${x.fact>0?`<span class="chip" style="font-size:10.5px;padding:1px 7px">${share}%</span>`:''}</span>
              <span class="mono" style="color:${over?'var(--red)':'var(--text2)'};white-space:nowrap">${fmtMoney(x.fact)}${x.limit?' / '+fmtMoney(x.limit):''}</span>
            </div>
            ${x.limit?`<div class="progress" style="margin-top:5px"><div style="width:${Math.min(100,pct)}%;${over?'background:var(--red)':''}"></div></div>`:''}
          </div>
        </div>`;
      }).join('')}
      </div>
      <div style="position:relative;height:260px"><canvas id="catChart"></canvas></div>
    </div>`
    :'<div class="empty">Добавьте плановые лимиты и записывайте расходы с категориями — здесь появится структура трат с процентами и диаграммой</div>'}
  </div>
  <div class="grid grid2">
    ${section('income','Доходы','💵')}
    ${section('expense','Расходы','🛒')}
  </div>`;
}
function addPlanItem(type){
  openModal(type==='income'?'Плановый доход (ежемесячно)':'Плановый расход (ежемесячно)', `
    <div class="field"><label>Название</label><input name="name" required placeholder="${type==='income'?'Зарплата':'Аренда, продукты…'}"></div>
    <div class="field"><label>Сумма в месяц, ₽</label><input name="amount" type="number" min="0" required></div>
    ${catFields(type)}
  `, d=>{
    if(!d.name.trim()||!+d.amount) return false;
    S.budget.plan.push({id:uid(), type, name:d.name.trim(), amount:+d.amount, category:resolveCat(type,d)});
    save(); render();
  }, 'Добавить');
}
function editPlanItem(id){
  const x = S.budget.plan.find(i=>i.id===id); if(!x) return;
  openModal('Изменить', `
    <div class="field"><label>Название</label><input name="name" required value="${esc(x.name)}"></div>
    <div class="field"><label>Сумма в месяц, ₽</label><input name="amount" type="number" min="0" value="${x.amount}"></div>
    ${catFields(x.type, x.category)}
  `, d=>{ Object.assign(x,{name:d.name.trim(),amount:+d.amount||0,category:resolveCat(x.type,d)}); save(); render(); });
}
function delPlanItem(id){ confirmDel('Убрать из плана?',()=>{ S.budget.plan=S.budget.plan.filter(x=>x.id!==id); }); }
function payPlan(id, m){
  const x = S.budget.plan.find(i=>i.id===id); if(!x) return;
  x.paidMonths = x.paidMonths||[];
  if(x.paidMonths.includes(m)) return; // защита от двойного клика
  x.paidMonths.push(m);
  S.budget.transactions.push({id:uid(), type:x.type, name:x.name, amount:x.amount, month:m, category:x.category});
  save(); render(); toast('Записано в факт ✓');
}
function addPlanned(type, m){
  openModal(type==='income'?'Разовый плановый доход':'Разовый плановый расход', `
    <div class="field"><label>Название</label><input name="name" required placeholder="${type==='income'?'Годовая премия':'Отпуск, ремонт…'}"></div>
    <div class="frow">
      <div class="field"><label>Сумма, ₽</label><input name="amount" type="number" min="0" required></div>
      <div class="field"><label>Месяц</label><input name="month" type="month" value="${m}"></div>
    </div>
    ${catFields(type)}
    <div class="hint">Учитывается в плане месяца и в прогнозе CF.</div>
  `, d=>{
    if(!d.name.trim()||!+d.amount) return false;
    S.budget.planned.push({id:uid(), type, name:d.name.trim(), amount:+d.amount, month:d.month||m, category:resolveCat(type,d), done:false});
    save(); render();
  }, 'Добавить');
}
function payPlanned(id){
  const x = S.budget.planned.find(i=>i.id===id); if(!x) return;
  S.budget.transactions.push({id:uid(), type:x.type, name:x.name, amount:x.amount, month:x.month, category:x.category});
  x.done = true;
  save(); render(); toast('Записано в факт ✓');
}
function delPlanned(id){ confirmDel('Удалить плановую операцию?',()=>{ S.budget.planned=S.budget.planned.filter(x=>x.id!==id); }); }
function addTx(type,m){
  const names = [...new Set(S.budget.transactions.filter(x=>x.type===type).map(x=>x.name))].slice(-30);
  openModal(type==='income'?'Записать доход':'Записать расход', `
    <div class="field"><label>Название</label>
      <input name="name" required list="txNames" placeholder="${type==='income'?'Зарплата за июнь':'Продукты'}">
      <datalist id="txNames">${names.map(n=>`<option value="${esc(n)}">`).join('')}</datalist></div>
    <div class="frow">
      <div class="field"><label>Сумма, ₽</label><input name="amount" type="number" min="0" required></div>
      <div class="field"><label>Месяц</label><input name="month" type="month" value="${m}"></div>
    </div>
    ${catFields(type)}
  `, d=>{
    if(!d.name.trim()||!+d.amount) return false;
    S.budget.transactions.push({id:uid(), type, name:d.name.trim(), amount:+d.amount, month:d.month||m, category:resolveCat(type,d)});
    save(); render();
  }, 'Записать');
}
function editTx(id){
  const x = S.budget.transactions.find(i=>i.id===id); if(!x) return;
  openModal('Изменить запись', `
    <div class="field"><label>Название</label><input name="name" required value="${esc(x.name)}"></div>
    <div class="frow">
      <div class="field"><label>Сумма, ₽</label><input name="amount" type="number" min="0" value="${x.amount}"></div>
      <div class="field"><label>Месяц</label><input name="month" type="month" value="${x.month}"></div>
    </div>
    ${catFields(x.type, x.category)}
  `, d=>{ Object.assign(x,{name:d.name.trim(),amount:+d.amount||0,month:d.month||x.month,category:resolveCat(x.type,d)}); save(); render(); });
}
function repeatTx(id){
  const x = S.budget.transactions.find(i=>i.id===id); if(!x) return;
  S.budget.transactions.push({...x, id:uid()});
  save(); render(); toast('Продублировано ✓');
}
function delTx(id){ confirmDel('Удалить запись?',()=>{ S.budget.transactions=S.budget.transactions.filter(x=>x.id!==id); }); }

function budgetAssets(){
  const savTotal = S.budget.savings.reduce((s,x)=>s+(x.current||0),0);
  const debtLeft = S.budget.debts.reduce((s,x)=>s+Math.max(0,x.total-(x.paid||0)),0);
  return `
  <div class="grid grid3" style="margin-bottom:16px">
    <div class="card stat-card"><div class="lbl">🏛 Собственный капитал</div>
      <div class="val mono" style="color:${savTotal-debtLeft>=0?'var(--green)':'var(--red)'}">${fmtMoney(savTotal-debtLeft)}</div>
      <div class="sub2">накопления − долги</div></div>
    <div class="card stat-card"><div class="lbl">🏦 Всего накоплений</div><div class="val mono" style="color:var(--green)">${fmtMoney(savTotal)}</div></div>
    <div class="card stat-card"><div class="lbl">💳 Осталось по долгам</div><div class="val mono" style="color:var(--red)">${fmtMoney(debtLeft)}</div>
      <div class="sub2 mono">платёж ${fmtMoney(debtMonthly())}/мес</div></div>
  </div>
  <div class="grid grid2">
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <h2 style="margin:0">🏦 Накопления</h2>
        <button class="btn btn-primary btn-sm" onclick="addSaving()">+ Копилка</button>
      </div>
      ${S.budget.savings.map(x=>{
        const pct = x.goal ? Math.min(100,Math.round((x.current||0)/x.goal*100)) : 0;
        let deadline = '';
        if(x.goal && x.targetDate && x.current<x.goal){
          const months = Math.max(1, Math.round((new Date(x.targetDate)-new Date())/2629800000));
          deadline = ` · к ${fmtDate(x.targetDate)} нужно ${fmtMoney(Math.ceil((x.goal-x.current)/months))}/мес`;
        }
        return `<div class="item-row">
          <div class="grow">
            <div class="item-title">${esc(x.name)} ${x.goal&&x.current>=x.goal?'<span class="chip green">цель достигнута 🎉</span>':''}</div>
            <div class="item-meta mono">${fmtMoney(x.current)}${x.goal?` из ${fmtMoney(x.goal)} · ${pct}%`:''}${deadline}</div>
            ${x.goal?`<div class="progress green" style="margin-top:6px"><div style="width:${pct}%"></div></div>`:''}
          </div>
          <button class="btn btn-ghost btn-sm" onclick="contribSaving('${x.id}')">± взнос</button>
          <button class="icon-btn" onclick="editSaving('${x.id}')">✎</button>
          <button class="icon-btn btn-danger" onclick="delSaving('${x.id}')">✕</button>
        </div>`;
      }).join('') || '<div class="empty">Добавьте накопления — подушка, инвестиции, цели</div>'}
    </div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <h2 style="margin:0">💳 Долги и кредиты</h2>
        <button class="btn btn-primary btn-sm" onclick="addDebt()">+ Долг</button>
      </div>
      ${S.budget.debts.map(x=>{
        const left = Math.max(0, x.total-(x.paid||0));
        const pct = x.total ? Math.min(100,Math.round((x.paid||0)/x.total*100)) : 0;
        let payoff = '';
        if(left>0 && x.monthly>0){
          const months = Math.ceil(left/x.monthly);
          payoff = ` · закроется к ${fmtMonth(monthAdd(curMonth(), months)).toLowerCase()}`;
        }
        return `<div class="item-row">
          <div class="grow">
            <div class="item-title">${esc(x.name)} ${left===0?'<span class="chip green">закрыт 🎉</span>':''}</div>
            <div class="item-meta mono">осталось ${fmtMoney(left)} из ${fmtMoney(x.total)}${x.monthly?` · ${fmtMoney(x.monthly)}/мес`:''}${payoff}</div>
            <div class="progress green" style="margin-top:6px"><div style="width:${pct}%"></div></div>
          </div>
          ${left>0?`<button class="btn btn-ghost btn-sm" onclick="payDebt('${x.id}')">платёж</button>`:''}
          <button class="icon-btn" onclick="editDebt('${x.id}')">✎</button>
          <button class="icon-btn btn-danger" onclick="delDebt('${x.id}')">✕</button>
        </div>`;
      }).join('') || '<div class="empty">Долгов нет 🎉</div>'}
    </div>
  </div>`;
}
function contribSaving(id){
  const x = S.budget.savings.find(i=>i.id===id); if(!x) return;
  openModal('Взнос в «'+esc(x.name)+'»', `
    <div class="field"><label>Сумма, ₽ (отрицательная — снятие)</label><input name="amount" type="number" required autofocus></div>
  `, d=>{
    const a = +d.amount; if(!a) return false;
    x.current = Math.max(0,(x.current||0)+a);
    save(); render(); toast(a>0?'Пополнено ✓':'Снято ✓');
  }, 'Записать');
}
function payDebt(id){
  const x = S.budget.debts.find(i=>i.id===id); if(!x) return;
  openModal('Платёж по «'+esc(x.name)+'»', `
    <div class="field"><label>Сумма платежа, ₽</label><input name="amount" type="number" min="0" value="${x.monthly||''}" required></div>
    <div class="field" style="display:flex;align-items:center;gap:8px">
      <input type="checkbox" name="asTx" checked style="width:auto"> <label style="margin:0">Записать в расходы месяца (категория «Долги»)</label>
    </div>
  `, d=>{
    const a = +d.amount; if(!a) return false;
    x.paid = (x.paid||0)+a;
    if(d.asTx){
      if(!S.budget.categories.expense.includes('Долги')) S.budget.categories.expense.push('Долги');
      S.budget.transactions.push({id:uid(), type:'expense', name:'Платёж: '+x.name, amount:a, month:curMonth(), category:'Долги'});
    }
    save(); render(); toast('Платёж записан ✓');
  }, 'Записать');
}
function addSaving(){
  openModal('Новая копилка', `
    <div class="field"><label>Название</label><input name="name" required placeholder="Подушка безопасности"></div>
    <div class="frow">
      <div class="field"><label>Сейчас накоплено, ₽</label><input name="current" type="number" min="0" value="0"></div>
      <div class="field"><label>Цель, ₽ (необяз.)</label><input name="goal" type="number" min="0"></div>
    </div>
    <div class="field"><label>Срок цели (необяз. — посчитаю нужный взнос/мес)</label><input name="targetDate" type="date"></div>
  `, d=>{
    if(!d.name.trim()) return false;
    S.budget.savings.push({id:uid(), name:d.name.trim(), current:+d.current||0, goal:+d.goal||0, targetDate:d.targetDate||null});
    save(); render();
  }, 'Добавить');
}
function editSaving(id){
  const x = S.budget.savings.find(i=>i.id===id); if(!x) return;
  openModal('Изменить копилку', `
    <div class="field"><label>Название</label><input name="name" required value="${esc(x.name)}"></div>
    <div class="frow">
      <div class="field"><label>Сейчас, ₽</label><input name="current" type="number" min="0" value="${x.current||0}"></div>
      <div class="field"><label>Цель, ₽</label><input name="goal" type="number" min="0" value="${x.goal||''}"></div>
    </div>
    <div class="field"><label>Срок цели</label><input name="targetDate" type="date" value="${x.targetDate||''}"></div>
  `, d=>{ Object.assign(x,{name:d.name.trim(),current:+d.current||0,goal:+d.goal||0,targetDate:d.targetDate||null}); save(); render(); });
}
function delSaving(id){ confirmDel('Удалить копилку?',()=>{ S.budget.savings=S.budget.savings.filter(x=>x.id!==id); }); }
function addDebt(){
  openModal('Новый долг', `
    <div class="field"><label>Название</label><input name="name" required placeholder="Ипотека, кредитка…"></div>
    <div class="frow">
      <div class="field"><label>Сумма долга, ₽</label><input name="total" type="number" min="0" required></div>
      <div class="field"><label>Уже выплачено, ₽</label><input name="paid" type="number" min="0" value="0"></div>
    </div>
    <div class="field"><label>Ежемесячный платёж, ₽</label><input name="monthly" type="number" min="0"></div>
  `, d=>{
    if(!d.name.trim()||!+d.total) return false;
    S.budget.debts.push({id:uid(), name:d.name.trim(), total:+d.total, paid:+d.paid||0, monthly:+d.monthly||0});
    save(); render();
  }, 'Добавить');
}
function editDebt(id){
  const x = S.budget.debts.find(i=>i.id===id); if(!x) return;
  openModal('Изменить долг', `
    <div class="field"><label>Название</label><input name="name" required value="${esc(x.name)}"></div>
    <div class="frow">
      <div class="field"><label>Сумма, ₽</label><input name="total" type="number" min="0" value="${x.total}"></div>
      <div class="field"><label>Выплачено, ₽</label><input name="paid" type="number" min="0" value="${x.paid||0}"></div>
    </div>
    <div class="field"><label>Платёж/мес, ₽</label><input name="monthly" type="number" min="0" value="${x.monthly||0}"></div>
  `, d=>{ Object.assign(x,{name:d.name.trim(),total:+d.total||0,paid:+d.paid||0,monthly:+d.monthly||0}); save(); render(); });
}
function delDebt(id){ confirmDel('Удалить долг?',()=>{ S.budget.debts=S.budget.debts.filter(x=>x.id!==id); }); }

/* --- forecast --- */
function forecastData(){
  const months=[], values=[];
  let cash = S.budget.savings.reduce((s,x)=>s+(x.current||0),0);
  const debts = S.budget.debts.map(d=>({left:Math.max(0,d.total-(d.paid||0)), monthly:d.monthly||0}));
  const recInc = recurTotal('income'), recExp = recurTotal('expense');
  months.push('Сейчас'); values.push(cash);
  let ym = curMonth();
  for(let i=0;i<12;i++){
    let debtPay = 0;
    debts.forEach(d=>{ if(d.left>0){ const p=Math.min(d.monthly,d.left); d.left-=p; debtPay+=p; } });
    const oneInc = S.budget.planned.filter(x=>x.type==='income'&&x.month===ym&&!x.done).reduce((s,x)=>s+x.amount,0);
    const oneExp = S.budget.planned.filter(x=>x.type==='expense'&&x.month===ym&&!x.done).reduce((s,x)=>s+x.amount,0);
    cash += recInc + oneInc - recExp - oneExp - debtPay;
    values.push(Math.round(cash));
    months.push(fmtMonthShort(ym));
    ym = monthAdd(ym,1);
  }
  return {months, values};
}
function budgetForecast(){
  const {values} = forecastData();
  const delta = recurTotal('income') - recurTotal('expense') - debtMonthly();
  const in12 = values[values.length-1];
  const debtNotes = S.budget.debts.map(d=>{
    const left = Math.max(0,d.total-(d.paid||0));
    if(left>0 && d.monthly>0) return `«${esc(d.name)}» закроется к ${fmtMonth(monthAdd(curMonth(), Math.ceil(left/d.monthly))).toLowerCase()} (+${fmtMoney(d.monthly)}/мес к свободному CF)`;
    return null;
  }).filter(Boolean);
  return `
  <div class="grid grid3" style="margin-bottom:16px">
    <div class="card stat-card"><div class="lbl">Свободный CF / мес (план)</div>
      <div class="val mono" style="color:${delta>=0?'var(--green)':'var(--red)'}">${delta>=0?'+':''}${fmtMoney(delta)}</div>
      <div class="sub2">доход − расход − платежи по долгам</div></div>
    <div class="card stat-card"><div class="lbl">Капитал сейчас</div><div class="val mono">${fmtMoney(values[0])}</div>
      <div class="sub2">сумма всех накоплений</div></div>
    <div class="card stat-card"><div class="lbl">Прогноз через 12 мес</div>
      <div class="val mono" style="color:${in12>=values[0]?'var(--green)':'var(--red)'}">${fmtMoney(in12)}</div>
      <div class="sub2 mono">${in12-values[0]>=0?'+':''}${fmtMoney(in12-values[0])} к текущему</div></div>
  </div>
  <div class="card" style="margin-bottom:16px">
    <h2>📈 Прогноз накоплений на 12 месяцев</h2>
    <div class="hint" style="margin-bottom:14px">Строится из ежемесячного плана, разовых плановых операций и платежей по долгам (прекращаются после выплаты долга).</div>
    <div style="position:relative;height:300px"><canvas id="cfChart"></canvas></div>
    ${debtNotes.length?`<div class="hint" style="margin-top:12px">💡 ${debtNotes.join('<br>💡 ')}</div>`:''}
  </div>
  <div class="card">
    <h2>📊 История: доходы и расходы по месяцам</h2>
    <div style="position:relative;height:260px"><canvas id="histChart"></canvas></div>
  </div>`;
}
let histChart, catChart;
function drawHistory(){
  const cv = document.getElementById('histChart');
  if(!cv || typeof Chart==='undefined') return;
  const labels=[], incs=[], exps=[];
  let ym = monthAdd(curMonth(),-11);
  for(let i=0;i<12;i++){
    labels.push(fmtMonthShort(ym));
    incs.push(factTotal('income',ym));
    exps.push(factTotal('expense',ym));
    ym = monthAdd(ym,1);
  }
  const css = getComputedStyle(document.documentElement);
  const grid = css.getPropertyValue('--border').trim();
  const txt = css.getPropertyValue('--text2').trim();
  if(histChart) histChart.destroy();
  histChart = new Chart(cv, {
    type:'bar',
    data:{ labels, datasets:[
      {label:'Доходы', data:incs, backgroundColor:'rgba(52,211,153,.75)', borderRadius:4},
      {label:'Расходы', data:exps, backgroundColor:'rgba(248,113,113,.75)', borderRadius:4}
    ]},
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{labels:{color:txt, font:{size:11}}}, tooltip:{callbacks:{label:c=>c.dataset.label+': '+fmtMoney(c.parsed.y)}} },
      scales:{ x:{grid:{display:false}, ticks:{color:txt,font:{size:10}}},
        y:{grid:{color:grid}, ticks:{color:txt,font:{size:10}, callback:v=>new Intl.NumberFormat('ru-RU',{notation:'compact'}).format(v)}} }
    }
  });
}
const CAT_COLORS = ['#8b5cf6','#f472b6','#60a5fa','#34d399','#fbbf24','#f87171','#2dd4bf','#a3e635','#fb923c','#c084fc','#94a3b8'];
function drawDonut(){
  const cv = document.getElementById('catChart');
  if(!cv || typeof Chart==='undefined') return;
  const m = SUB.budgetMonth || curMonth();
  const byCat = {};
  S.budget.transactions.filter(x=>x.type==='expense'&&x.month===m).forEach(x=>{
    byCat[x.category||'Другое'] = (byCat[x.category||'Другое']||0)+x.amount;
  });
  const entries = Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
  if(!entries.length) return;
  const total = entries.reduce((s,e)=>s+e[1],0);
  const pctOf = v => total>0 ? Math.round(v/total*100) : 0;
  const css = getComputedStyle(document.documentElement);
  if(catChart) catChart.destroy();
  catChart = new Chart(cv, {
    type:'pie',
    data:{ labels:entries.map(e=>catIcon(e[0])+' '+e[0]), datasets:[{ data:entries.map(e=>e[1]),
      backgroundColor:entries.map((_,i)=>CAT_COLORS[i%CAT_COLORS.length]), borderWidth:0 }]},
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{
        legend:{position:window.innerWidth<600?'bottom':'right', labels:{color:css.getPropertyValue('--text2').trim(), font:{size:11}, boxWidth:12,
          generateLabels:(chart)=>{
            const ds = chart.data.datasets[0];
            return chart.data.labels.map((l,i)=>({
              text:`${l} · ${pctOf(ds.data[i])}%`,
              fillStyle:ds.backgroundColor[i], strokeStyle:'transparent',
              fontColor:css.getPropertyValue('--text2').trim(), index:i
            }));
          }}},
        tooltip:{callbacks:{label:c=>c.label+': '+fmtMoney(c.parsed)+' · '+pctOf(c.parsed)+'%'}}
      }
    }
  });
}
let cfChart;
function drawForecast(){
  const cv = document.getElementById('cfChart');
  if(!cv || typeof Chart==='undefined') return;
  const {months, values} = forecastData();
  const css = getComputedStyle(document.documentElement);
  const grid = css.getPropertyValue('--border').trim();
  const txt = css.getPropertyValue('--text2').trim();
  if(cfChart) cfChart.destroy();
  cfChart = new Chart(cv, {
    type:'line',
    data:{ labels:months, datasets:[{
      data:values, borderColor:'#8b5cf6', borderWidth:2.5, tension:.35, fill:true,
      backgroundColor:(ctx)=>{
        const g = ctx.chart.ctx.createLinearGradient(0,0,0,300);
        g.addColorStop(0,'rgba(139,92,246,.28)'); g.addColorStop(1,'rgba(139,92,246,0)');
        return g;
      },
      pointRadius:3, pointBackgroundColor:'#8b5cf6'
    }]},
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false},
        tooltip:{callbacks:{label:c=>fmtMoney(c.parsed.y)}} },
      scales:{
        x:{grid:{color:grid}, ticks:{color:txt,font:{size:11}}},
        y:{grid:{color:grid}, ticks:{color:txt,font:{size:11}, callback:v=>new Intl.NumberFormat('ru-RU',{notation:'compact'}).format(v)}}
      }
    }
  });
}
/* ================= SPORT ================= */
const SPORT_EMOJI = {'Бег':'🏃','Силовая':'🏋️','Плавание':'🏊','Вело':'🚴','Йога':'🧘','Футбол':'⚽','Теннис':'🎾','Лыжи':'⛷️','Ходьба':'🚶'};
const sEmoji = t => SPORT_EMOJI[t] || '💪';
function weekWorkouts(ws){
  const we = addDays(ws,6);
  return S.sport.workouts.filter(w=>w.date>=ws && w.date<=we);
}
function sportStreak(){
  let streak = 0, ws = weekStart();
  if(weekWorkouts(ws).length >= S.sport.weeklyGoal) streak++;
  ws = addDays(ws,-7);
  while(weekWorkouts(ws).length >= S.sport.weeklyGoal){ streak++; ws = addDays(ws,-7); }
  return streak;
}
function vSport(){
  const ws = weekStart();
  const wk = weekWorkouts(ws);
  const wkMin = wk.reduce((s,w)=>s+(w.minutes||0),0);
  const m = curMonth();
  const mo = S.sport.workouts.filter(w=>w.date && w.date.slice(0,7)===m);
  const moMin = mo.reduce((s,w)=>s+(w.minutes||0),0);
  const yearCnt = S.sport.workouts.filter(w=>w.date && w.date.slice(0,4)===String(curYear())).length;
  const goal = S.sport.weeklyGoal;
  const pct = Math.min(100, Math.round(wk.length/goal*100));
  const streak = sportStreak();
  // разбивка по видам за месяц
  const byType = {};
  mo.forEach(w=>{ byType[w.type] = byType[w.type]||{n:0,min:0}; byType[w.type].n++; byType[w.type].min+=w.minutes||0; });
  // календарь активности
  const calM = SUB.calM_sport || curMonth();
  const startOffset = (new Date(+calM.slice(0,4), +calM.slice(5)-1, 1).getDay()+6)%7;
  const gridStart = addDays(calM+'-01', -startOffset);
  let cells='';
  for(let i=0;i<42;i++){
    const d = addDays(gridStart,i);
    const dayW = S.sport.workouts.filter(w=>w.date===d);
    const min = dayW.reduce((s,w)=>s+(w.minutes||0),0);
    const alpha = min ? Math.min(.85, .25 + min/120) : 0;
    cells += `<div class="cal-d ${d.slice(0,7)===calM?'':'other'} ${d===todayStr()?'today':''}"
      style="${min?`background:rgba(52,211,153,${alpha});border-color:rgba(52,211,153,.4)`:''};min-height:58px;cursor:default">
      <div class="n" ${min?'style="color:#fff"':''}>${+d.slice(8)}</div>
      ${dayW.length?`<div style="font-size:13px" title="${esc(dayW.map(w=>w.type+' '+(w.minutes||0)+' мин').join(', '))}">${dayW.map(w=>sEmoji(w.type)).join('')}</div>
      <div style="font-size:10px;color:${min?'#fff':'var(--text3)'}">${min} мин</div>`:''}
    </div>`;
  }
  const recent = [...S.sport.workouts].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,15);
  return `
  <div class="page-head">
    <div><h1>Спорт</h1><div class="sub">Тренировки и активность</div></div>
    <button class="btn btn-primary" onclick="addWorkout()">+ Тренировка</button>
  </div>
  <div class="grid grid4" style="margin-bottom:16px">
    <div class="card stat-card">
      <div class="lbl">🎯 Эта неделя</div>
      <div class="val">${wk.length} из ${goal}</div>
      <div class="progress green" style="margin-top:10px"><div style="width:${pct}%"></div></div>
      <div class="sub2" style="display:flex;align-items:center;gap:6px;margin-top:8px">цель:
        <select style="width:auto;padding:3px 8px;font-size:12px" onchange="S.sport.weeklyGoal=+this.value;save();render()">
          ${[1,2,3,4,5,6,7].map(n=>`<option ${goal===n?'selected':''}>${n}</option>`).join('')}
        </select> тренировок/нед</div>
    </div>
    <div class="card stat-card"><div class="lbl">⏱ Минут на этой неделе</div><div class="val mono">${wkMin}</div>
      <div class="sub2">${MONTHS[+m.slice(5)-1]}: ${mo.length} трен. · ${moMin} мин</div></div>
    <div class="card stat-card"><div class="lbl">🔥 Серия недель с выполненной целью</div>
      <div class="val">${streak} ${plural(streak,'неделя','недели','недель')}</div>
      <div class="sub2">${streak>=4?'Отличная форма!':streak>0?'Так держать!':'Начните серию на этой неделе'}</div></div>
    <div class="card stat-card"><div class="lbl">📅 За ${curYear()} год</div><div class="val">${yearCnt} ${plural(yearCnt,'тренировка','тренировки','тренировок')}</div>
      <div class="sub2">${Object.keys(byType).length?'в этом месяце: '+Object.entries(byType).map(([t,x])=>sEmoji(t)+' '+x.n).join(' · '):''}</div></div>
  </div>
  <div class="card" style="margin-bottom:16px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <h2 style="margin:0">🎯 Спортивные цели</h2>
      <button class="btn btn-primary btn-sm" onclick="addSportGoal()">+ Цель</button>
    </div>
    ${S.sport.goals.length ? S.sport.goals.map(g=>{
      const val = sportGoalValue(g);
      const pct = g.target ? Math.min(100, Math.round(val/g.target*100)) : 0;
      const unit = g.kind==='manual' ? (g.unit||'') : {count:'тренировок', minutes:'мин', distance:'км'}[g.metric]||'';
      return `<div class="item-row" style="flex-wrap:wrap">
        <div class="grow" style="flex:1;min-width:60%">
          <div class="item-title">${esc(g.title)} ${pct>=100?'<span class="chip green">достигнута 🎉</span>':''}</div>
          <div class="item-meta">
            <span class="mono" style="font-weight:700;color:var(--text)">${val} из ${g.target} ${unit}</span>
            ${g.kind==='auto'?`<span class="chip">${g.sportType?sEmoji(g.sportType)+' '+esc(g.sportType):'все виды'} · авто за ${curYear()}</span>`:''}
            ${g.deadline?deadlineChip(g.deadline):''}
          </div>
          <div class="progress green" style="margin-top:7px"><div style="width:${pct}%"></div></div>
        </div>
        ${g.kind==='manual'?`<button class="btn btn-ghost btn-sm" onclick="updateSportGoal('${g.id}')">обновить</button>`:''}
        <button class="icon-btn" onclick="editSportGoal('${g.id}')">✎</button>
        <button class="icon-btn btn-danger" onclick="delSportGoal('${g.id}')">✕</button>
      </div>`;
    }).join('') : '<div class="empty">Например: 50 пробежек за год, 300 км на веле, жим 100 кг</div>'}
  </div>
  <div class="grid grid2" style="margin-bottom:16px">
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <h2 style="margin:0">🗓 Календарь активности</h2>
        <div class="week-nav">
          <button class="icon-btn" onclick="setSub('calM_sport','${monthAdd(calM,-1)}')">‹</button>
          <b style="font-size:13.5px;min-width:110px;text-align:center;cursor:pointer" onclick="pickMonth('${calM}', v=>setSub('calM_sport',v))">${fmtMonth(calM)}</b>
          <button class="icon-btn" onclick="setSub('calM_sport','${monthAdd(calM,1)}')">›</button>
        </div>
      </div>
      <div class="cal" style="margin-bottom:5px">${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d=>`<div class="cal-h">${d}</div>`).join('')}</div>
      <div class="cal">${cells}</div>
    </div>
    <div class="card">
      <h2>📈 Активность по неделям</h2>
      <div style="position:relative;height:260px"><canvas id="sportChart"></canvas></div>
    </div>
  </div>
  <div class="card">
    <h2>🏅 Последние тренировки</h2>
    ${recent.map(w=>`<div class="item-row">
      <span style="font-size:20px;width:28px;text-align:center">${sEmoji(w.type)}</span>
      <div class="grow">
        <div class="item-title">${esc(w.type)}${w.distance?` · ${w.distance} км`:''}</div>
        <div class="item-meta"><span>${fmtDate(w.date)}</span><span class="chip green">${w.minutes||0} мин</span></div>
        ${w.notes?`<div class="notes-line" title="${esc(w.notes)}">${esc(w.notes)}</div>`:''}
      </div>
      <button class="icon-btn" onclick="editWorkout('${w.id}')">✎</button>
      <button class="icon-btn btn-danger" onclick="delWorkout('${w.id}')">✕</button>
    </div>`).join('') || emptyBig('🏃','Первой тренировки ещё не было','Запишите её — появятся календарь активности, график и серии')}
  </div>`;
}
/* --- спортивные цели --- */
function sportGoalValue(g){
  if(g.kind==='manual') return g.current||0;
  const yr = String(curYear());
  const ws = S.sport.workouts.filter(w=>w.date && w.date.slice(0,4)===yr && (!g.sportType || w.type===g.sportType));
  if(g.metric==='minutes') return ws.reduce((s,w)=>s+(w.minutes||0),0);
  if(g.metric==='distance') return Math.round(ws.reduce((s,w)=>s+(w.distance||0),0)*10)/10;
  return ws.length;
}
function sportGoalForm(g){
  g = g||{kind:'auto'};
  const auto = g.kind!=='manual';
  return `
    <div class="field"><label>Цель</label><input name="title" required value="${esc(g.title||'')}" placeholder="Например: 50 пробежек за год"></div>
    <div class="field"><label>Как считать прогресс</label><select name="kind" onchange="
      document.getElementById('sgAuto').style.display=this.value==='auto'?'block':'none';
      document.getElementById('sgMan').style.display=this.value==='manual'?'block':'none';">
      <option value="auto" ${auto?'selected':''}>Автоматически из тренировок (за ${curYear()} год)</option>
      <option value="manual" ${!auto?'selected':''}>Вручную (результат: вес, время, кг…)</option>
    </select></div>
    <div id="sgAuto" style="display:${auto?'block':'none'}">
      <div class="frow">
        <div class="field"><label>Что считаем</label><select name="metric">
          <option value="count" ${g.metric==='count'?'selected':''}>Тренировки, шт</option>
          <option value="minutes" ${g.metric==='minutes'?'selected':''}>Минуты</option>
          <option value="distance" ${g.metric==='distance'?'selected':''}>Километры</option>
        </select></div>
        <div class="field"><label>Вид спорта</label><select name="sportType">
          <option value="">Все виды</option>
          ${S.sport.types.map(t=>`<option ${g.sportType===t?'selected':''}>${esc(t)}</option>`).join('')}
        </select></div>
      </div>
    </div>
    <div id="sgMan" style="display:${!auto?'block':'none'}">
      <div class="frow">
        <div class="field"><label>Текущее значение</label><input name="current" type="number" step="0.1" value="${g.current||0}"></div>
        <div class="field"><label>Единица</label><input name="unit" value="${esc(g.unit||'')}" placeholder="кг, км, мин…"></div>
      </div>
    </div>
    <div class="frow">
      <div class="field"><label>Целевое значение</label><input name="target" type="number" step="0.1" required value="${g.target||''}"></div>
      <div class="field"><label>Срок (необяз.)</label><input name="deadline" type="date" value="${g.deadline||''}"></div>
    </div>`;
}
function sportGoalFromForm(d){
  return {title:d.title.trim(), kind:d.kind, metric:d.metric, sportType:d.sportType||null,
    current:+d.current||0, unit:(d.unit||'').trim(), target:+d.target||0, deadline:d.deadline||null};
}
function addSportGoal(){
  openModal('Спортивная цель', sportGoalForm(), d=>{
    if(!d.title.trim()||!+d.target) return false;
    S.sport.goals.push(Object.assign({id:uid()}, sportGoalFromForm(d)));
    save(); render();
  }, 'Добавить');
}
function editSportGoal(id){
  const g = S.sport.goals.find(x=>x.id===id); if(!g) return;
  openModal('Редактировать цель', sportGoalForm(g), d=>{
    if(!d.title.trim()||!+d.target) return false;
    Object.assign(g, sportGoalFromForm(d));
    save(); render();
  });
}
function updateSportGoal(id){
  const g = S.sport.goals.find(x=>x.id===id); if(!g) return;
  openModal('«'+esc(g.title)+'»', `
    <div class="field"><label>Текущее значение${g.unit?', '+esc(g.unit):''}</label>
    <input name="current" type="number" step="0.1" value="${g.current||0}" autofocus></div>
  `, d=>{
    g.current = +d.current||0;
    save(); render();
    if(g.current>=g.target) toast('Цель достигнута! 🎉');
  }, 'Обновить');
}
function delSportGoal(id){ confirmDel('Удалить цель?',()=>{ S.sport.goals=S.sport.goals.filter(x=>x.id!==id); }); }

function workoutForm(w){
  w = w||{};
  return `
    <div class="frow">
      <div class="field"><label>Дата</label><input name="date" type="date" value="${w.date||todayStr()}"></div>
      <div class="field"><label>Вид спорта</label><select name="type">
        ${S.sport.types.map(t=>`<option ${w.type===t?'selected':''}>${esc(t)}</option>`).join('')}
      </select></div>
    </div>
    <div class="field"><label>…или новый вид</label><input name="newtype" placeholder="Например: бокс"></div>
    <div class="frow">
      <div class="field"><label>Длительность, мин</label><input name="minutes" type="number" min="0" value="${w.minutes||60}" required></div>
      <div class="field"><label>Дистанция, км (необяз.)</label><input name="distance" type="number" min="0" step="0.1" value="${w.distance||''}"></div>
    </div>
    <div class="field"><label>Заметка</label><textarea name="notes" placeholder="Как прошло, самочувствие">${esc(w.notes||'')}</textarea></div>`;
}
function resolveSportType(d){
  const t = (d.newtype||'').trim();
  if(t){ if(!S.sport.types.includes(t)) S.sport.types.push(t); return t; }
  return d.type;
}
function addWorkout(){
  openModal('Новая тренировка', workoutForm(), d=>{
    if(!+d.minutes) return false;
    S.sport.workouts.push({id:uid(), date:d.date||todayStr(), type:resolveSportType(d), minutes:+d.minutes, distance:+d.distance||null, notes:d.notes.trim()});
    save(); render(); toast('Тренировка записана 💪');
  }, 'Записать');
}
function editWorkout(id){
  const w = S.sport.workouts.find(x=>x.id===id); if(!w) return;
  openModal('Редактировать тренировку', workoutForm(w), d=>{
    Object.assign(w,{date:d.date||w.date, type:resolveSportType(d), minutes:+d.minutes||0, distance:+d.distance||null, notes:d.notes.trim()});
    save(); render();
  });
}
function delWorkout(id){ confirmDel('Удалить тренировку?',()=>{ S.sport.workouts=S.sport.workouts.filter(x=>x.id!==id); }); }
let sportChart;
function drawSportChart(){
  const cv = document.getElementById('sportChart');
  if(!cv || typeof Chart==='undefined') return;
  const labels=[], mins=[], cnts=[];
  for(let k=7;k>=0;k--){
    const ws = addDays(weekStart(),-7*k);
    const wk = weekWorkouts(ws);
    labels.push(fmtDate(ws));
    mins.push(wk.reduce((s,w)=>s+(w.minutes||0),0));
    cnts.push(wk.length);
  }
  const css = getComputedStyle(document.documentElement);
  const grid = css.getPropertyValue('--border').trim();
  const txt = css.getPropertyValue('--text2').trim();
  if(sportChart) sportChart.destroy();
  sportChart = new Chart(cv, {
    type:'bar',
    data:{ labels, datasets:[{ data:mins, backgroundColor:'rgba(52,211,153,.75)', borderRadius:6 }]},
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false},
        tooltip:{callbacks:{label:c=>c.parsed.y+' мин · '+cnts[c.dataIndex]+' '+plural(cnts[c.dataIndex],'тренировка','тренировки','тренировок')}} },
      scales:{ x:{grid:{display:false}, ticks:{color:txt,font:{size:10}}},
        y:{grid:{color:grid}, ticks:{color:txt,font:{size:10}, callback:v=>v+' мин'}} }
    }
  });
}


/* ================= ЗДОРОВЬЕ ================= */
function todayMetric(){ return S.health.metrics.find(m=>m.date===todayStr()); }
function vHealth(){
  const t = todayMetric() || {};
  const recent = [...S.health.metrics].sort((a,b)=>b.date.localeCompare(a.date));
  const lastW = recent.find(m=>m.weight);
  const avgSleep7 = (()=>{ const xs = recent.slice(0,7).map(m=>m.sleep).filter(Boolean); return xs.length? (xs.reduce((a,b)=>a+b,0)/xs.length).toFixed(1) : null; })();
  const avgEnergy7 = (()=>{ const xs = recent.slice(0,7).map(m=>m.energy).filter(Boolean); return xs.length? (xs.reduce((a,b)=>a+b,0)/xs.length).toFixed(1) : null; })();
  const vits = S.health.vitamins;
  const logToday = S.health.vitaminLog[todayStr()] || [];
  const checkups = [...S.health.checkups].map(c=>{
    const next = c.lastDate ? monthAdd(c.lastDate.slice(0,7), c.intervalMonths) + c.lastDate.slice(7) : null;
    return Object.assign({next}, c);
  }).sort((a,b)=>String(a.next||'0').localeCompare(String(b.next||'0')));
  return `
  <div class="page-head"><div><h1>Здоровье</h1><div class="sub">Минутка в день — и вся динамика перед глазами</div></div></div>
  <div class="grid grid4" style="margin-bottom:16px">
    <div class="card stat-card"><div class="lbl">⚖️ Вес</div><div class="val mono">${lastW?lastW.weight+' кг':'—'}</div>
      <div class="sub2">${lastW?'запись от '+fmtDate(lastW.date):'добавьте первую запись'}</div></div>
    <div class="card stat-card"><div class="lbl">😴 Сон · среднее 7 дней</div><div class="val mono">${avgSleep7?avgSleep7+' ч':'—'}</div></div>
    <div class="card stat-card"><div class="lbl">⚡ Энергия · среднее 7 дней</div><div class="val mono">${avgEnergy7?avgEnergy7+' / 5':'—'}</div></div>
    <div class="card stat-card"><div class="lbl">💊 Витамины сегодня</div><div class="val">${logToday.length} из ${vits.length||0}</div></div>
  </div>
  <div class="grid grid2" style="margin-bottom:16px">
    <div class="card">
      <h2>📝 Сегодня, ${fmtDate(todayStr())}</h2>
      <div class="frow">
        <div class="field"><label>Вес, кг</label><input id="hWeight" type="number" step="0.1" value="${t.weight||''}" placeholder="82.5"></div>
        <div class="field"><label>Сон, часов</label><input id="hSleep" type="number" step="0.5" min="0" max="24" value="${t.sleep||''}" placeholder="7.5"></div>
        <div class="field"><label>Энергия 1–5</label><select id="hEnergy">
          <option value="">—</option>${[1,2,3,4,5].map(n=>`<option ${t.energy===n?'selected':''}>${n}</option>`).join('')}
        </select></div>
      </div>
      <button class="btn btn-primary btn-sm" onclick="saveHealthToday()">Сохранить</button>
      ${vits.length?`<div style="font-size:12px;font-weight:700;color:var(--text3);margin:18px 0 6px">💊 ВИТАМИНЫ И ЛЕКАРСТВА</div>
      ${vits.map(v=>`<div class="item-row" style="padding:8px 0">
        <button class="checkbox ${logToday.includes(v.id)?'on':''}" onclick="toggleVitamin('${v.id}')">${logToday.includes(v.id)?'✓':''}</button>
        <div class="grow"><div class="item-title" style="font-size:13.5px">${esc(v.name)}</div></div>
        <button class="icon-btn btn-danger" onclick="delVitamin('${v.id}')">✕</button>
      </div>`).join('')}`:''}
      <div class="quick-add" style="margin-top:10px">
        <input placeholder="Добавить витамин/лекарство… (Enter)" onkeydown="if(event.key==='Enter'&&this.value.trim()){addVitamin(this.value.trim());this.value=''}">
      </div>
    </div>
    <div class="card">
      <h2>⚖️ Динамика веса</h2>
      ${S.health.metrics.filter(m=>m.weight).length>=2
        ? '<div style="position:relative;height:240px"><canvas id="healthChart"></canvas></div>'
        : emptyBig('⚖️','Мало данных для графика','Вносите вес пару раз в неделю — появится динамика')}
    </div>
  </div>
  <div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
      <h2 style="margin:0">🩺 Чекапы и врачи</h2>
      <button class="btn btn-primary btn-sm" onclick="addCheckup()">+ Чекап</button>
    </div>
    ${checkups.map(c=>{
      const overdue = c.next && c.next <= todayStr();
      const soon = c.next && !overdue && daysUntil(c.next) <= 30;
      return `<div class="item-row">
        <div class="grow"><div class="item-title">${esc(c.name)}</div>
          <div class="item-meta">раз в ${c.intervalMonths} мес · был: ${c.lastDate?fmtDate(c.lastDate):'—'}
          ${c.next?`<span class="chip ${overdue?'red':soon?'yellow':''}">${overdue?'⚠ пора!':'след: '+fmtDate(c.next)}</span>`:''}</div></div>
        <button class="btn btn-ghost btn-sm" onclick="doneCheckup('${c.id}')">✓ пройден</button>
        <button class="icon-btn" onclick="editCheckup('${c.id}')">✎</button>
        <button class="icon-btn btn-danger" onclick="delCheckup('${c.id}')">✕</button>
      </div>`;
    }).join('') || emptyBig('🩺','Добавьте регулярные чекапы','Стоматолог раз в 6 месяцев, анализы раз в год — трекер напомнит')}
  </div>`;
}
function saveHealthToday(){
  const w = parseFloat(document.getElementById('hWeight').value)||null;
  const sl = parseFloat(document.getElementById('hSleep').value)||null;
  const en = parseInt(document.getElementById('hEnergy').value)||null;
  let m = todayMetric();
  if(!m){ m = {id:uid(), date:todayStr()}; S.health.metrics.push(m); }
  Object.assign(m, {weight:w, sleep:sl, energy:en});
  save(); render(); toast('Сохранено ✓');
}
function addVitamin(name){ S.health.vitamins.push({id:uid(), name}); save(); render(); }
function delVitamin(id){ confirmDel('Удалить?',()=>{ S.health.vitamins = S.health.vitamins.filter(v=>v.id!==id); }); }
function toggleVitamin(id){
  const day = todayStr();
  const log = S.health.vitaminLog[day] || [];
  S.health.vitaminLog[day] = log.includes(id) ? log.filter(x=>x!==id) : [...log, id];
  save(); render();
}
function checkupForm(c){
  c = c||{};
  return `
    <div class="field"><label>Название</label><input name="name" required value="${esc(c.name||'')}" placeholder="Стоматолог, анализы, окулист…"></div>
    <div class="frow">
      <div class="field"><label>Раз в N месяцев</label><input name="intervalMonths" type="number" min="1" max="60" value="${c.intervalMonths||6}"></div>
      <div class="field"><label>Последний раз</label><input name="lastDate" type="date" value="${c.lastDate||''}"></div>
    </div>`;
}
function addCheckup(){
  openModal('Регулярный чекап', checkupForm(), d=>{
    if(!d.name.trim()) return false;
    S.health.checkups.push({id:uid(), name:d.name.trim(), intervalMonths:+d.intervalMonths||6, lastDate:d.lastDate||null});
    save(); render();
  }, 'Добавить');
}
function editCheckup(id){
  const c = S.health.checkups.find(x=>x.id===id); if(!c) return;
  openModal('Чекап', checkupForm(c), d=>{
    Object.assign(c,{name:d.name.trim(), intervalMonths:+d.intervalMonths||6, lastDate:d.lastDate||null});
    save(); render();
  });
}
function doneCheckup(id){
  const c = S.health.checkups.find(x=>x.id===id); if(!c) return;
  c.lastDate = todayStr(); save(); render(); toast('Отмечено ✓');
}
function delCheckup(id){ confirmDel('Удалить чекап?',()=>{ S.health.checkups = S.health.checkups.filter(x=>x.id!==id); }); }
function drawHealthChart(){
  const cv = document.getElementById('healthChart');
  if(!cv || typeof Chart==='undefined') return;
  const data = S.health.metrics.filter(m=>m.weight).sort((a,b)=>a.date.localeCompare(b.date)).slice(-30);
  if(data.length<2) return;
  const css = getComputedStyle(document.documentElement);
  healthChart = new Chart(cv, {
    type:'line',
    data:{ labels:data.map(m=>fmtDate(m.date)), datasets:[{ data:data.map(m=>m.weight),
      borderColor:'#34d399', borderWidth:2.5, tension:.35, pointRadius:3, pointBackgroundColor:'#34d399', fill:false }]},
    options:{ responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{callbacks:{label:c=>c.parsed.y+' кг'}} },
      scales:{ x:{grid:{display:false}, ticks:{color:css.getPropertyValue('--text2').trim(), font:{size:10}}},
        y:{grid:{color:css.getPropertyValue('--border').trim()}, ticks:{color:css.getPropertyValue('--text2').trim(), font:{size:10}}} }
    }
  });
}

/* ================= ОБУЧЕНИЕ ================= */
const BOOK_STATUS = {reading:['📖 Читаю','blue'], want:['🔖 Хочу прочитать',''], done:['✅ Прочитано','green']};
function vLearn(){
  const books = S.learn.books;
  const byStatus = st => books.filter(b=>b.status===st);
  const doneThisYear = books.filter(b=>b.status==='done' && b.doneAt && b.doneAt.slice(0,4)===String(curYear())).length;
  const bookRow = b => `<div class="item-row book-row">
    <span class="cover">${b.status==='done'?'✓':'📕'}</span>
    <div class="grow"><div class="item-title">${esc(b.title)}</div>
      <div class="item-meta">${b.author?esc(b.author)+' · ':''}${b.rating?'★'.repeat(b.rating):''}${b.status==='done'&&b.doneAt?' · '+fmtDate(b.doneAt):''}</div>
      ${b.note?`<div class="notes-line" title="${esc(b.note)}">${esc(b.note)}</div>`:''}</div>
    ${b.status==='want'?`<button class="btn btn-ghost btn-sm" onclick="setBookStatus('${b.id}','reading')">начать</button>`:''}
    ${b.status==='reading'?`<button class="btn btn-ghost btn-sm" onclick="finishBook('${b.id}')">✓ прочитал</button>`:''}
    <button class="icon-btn" onclick="editBook('${b.id}')">✎</button>
    <button class="icon-btn btn-danger" onclick="delBook('${b.id}')">✕</button>
  </div>`;
  return `
  <div class="page-head"><div><h1>Обучение</h1><div class="sub">Книги и курсы · прочитано в ${curYear()}: <b>${doneThisYear}</b></div></div></div>
  <div class="grid grid2">
    <div class="card">
      <h2>📚 Книги</h2>
      <div class="quick-add" style="margin-bottom:10px">
        <input placeholder="Добавить книгу… (Enter)" onkeydown="if(event.key==='Enter'&&this.value.trim()){addBook(this.value.trim());this.value=''}">
      </div>
      ${['reading','want','done'].map(st=>{
        const list = byStatus(st);
        if(!list.length) return '';
        return `<div style="font-size:12px;font-weight:700;color:var(--text3);margin:14px 0 4px">${BOOK_STATUS[st][0].toUpperCase()} · ${list.length}</div>`
          + (st==='done' ? list.slice(0,8).map(bookRow).join('') + (list.length>8?`<div class="hint" style="padding:6px 0">…и ещё ${list.length-8}</div>`:'') : list.map(bookRow).join(''));
      }).join('') || emptyBig('📚','Полка пуста','Добавьте книгу, которую читаете или хотите прочитать')}
    </div>
    <div class="card" style="align-self:start">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <h2 style="margin:0">🎓 Курсы</h2>
        <button class="btn btn-primary btn-sm" onclick="addCourse()">+ Курс</button>
      </div>
      ${S.learn.courses.map(c=>{
        const pct = c.total ? Math.min(100, Math.round((c.done||0)/c.total*100)) : 0;
        return `<div class="item-row" style="flex-wrap:wrap">
          <div class="grow" style="flex:1;min-width:60%">
            <div class="item-title">${esc(c.name)} ${pct>=100?'<span class="chip green">завершён 🎉</span>':''}</div>
            <div class="item-meta mono">${c.done||0} из ${c.total} уроков · ${pct}%</div>
            <div class="progress green" style="margin-top:6px"><div style="width:${pct}%"></div></div>
          </div>
          ${pct<100?`<button class="btn btn-ghost btn-sm" onclick="incCourse('${c.id}')">+1 урок</button>`:''}
          <button class="icon-btn" onclick="editCourse('${c.id}')">✎</button>
          <button class="icon-btn btn-danger" onclick="delCourse('${c.id}')">✕</button>
        </div>`;
      }).join('') || emptyBig('🎓','Курсов пока нет','Добавьте курс с числом уроков — прогресс будет расти по кнопке «+1 урок»')}
    </div>
  </div>`;
}
function addBook(title){ S.learn.books.push({id:uid(), title, status:'want'}); save(); render(); }
function setBookStatus(id, st){
  const b = S.learn.books.find(x=>x.id===id); if(!b) return;
  b.status = st; if(st==='done') b.doneAt = todayStr();
  save(); render();
}
function finishBook(id){
  const b = S.learn.books.find(x=>x.id===id); if(!b) return;
  openModal('Книга прочитана! 🎉', `
    <div class="field"><label>Оценка</label><select name="rating">
      <option value="">—</option>${[5,4,3,2,1].map(n=>`<option value="${n}">${'★'.repeat(n)}</option>`).join('')}
    </select></div>
    <div class="field"><label>Главная мысль (необяз.)</label><textarea name="note"></textarea></div>
  `, d=>{
    Object.assign(b,{status:'done', doneAt:todayStr(), rating:+d.rating||null, note:d.note.trim()});
    save(); render(); toast('Полка пополнилась 📚');
  }, 'Готово');
}
function editBook(id){
  const b = S.learn.books.find(x=>x.id===id); if(!b) return;
  openModal('Книга', `
    <div class="field"><label>Название</label><input name="title" required value="${esc(b.title)}"></div>
    <div class="field"><label>Автор</label><input name="author" value="${esc(b.author||'')}"></div>
    <div class="frow">
      <div class="field"><label>Статус</label><select name="status">
        ${Object.entries(BOOK_STATUS).map(([k,[l]])=>`<option value="${k}" ${b.status===k?'selected':''}>${l}</option>`).join('')}
      </select></div>
      <div class="field"><label>Оценка</label><select name="rating">
        <option value="">—</option>${[5,4,3,2,1].map(n=>`<option value="${n}" ${b.rating===n?'selected':''}>${'★'.repeat(n)}</option>`).join('')}
      </select></div>
    </div>
    <div class="field"><label>Заметка</label><textarea name="note">${esc(b.note||'')}</textarea></div>
  `, d=>{
    const wasDone = b.status==='done';
    Object.assign(b,{title:d.title.trim(), author:d.author.trim(), status:d.status, rating:+d.rating||null, note:d.note.trim()});
    if(d.status==='done' && !wasDone) b.doneAt = todayStr();
    save(); render();
  });
}
function delBook(id){ confirmDel('Удалить книгу?',()=>{ S.learn.books = S.learn.books.filter(x=>x.id!==id); }); }
function addCourse(){
  openModal('Новый курс', `
    <div class="field"><label>Название</label><input name="name" required placeholder="Например: курс по управлению"></div>
    <div class="frow">
      <div class="field"><label>Всего уроков</label><input name="total" type="number" min="1" value="10" required></div>
      <div class="field"><label>Пройдено</label><input name="done" type="number" min="0" value="0"></div>
    </div>
  `, d=>{
    if(!d.name.trim()||!+d.total) return false;
    S.learn.courses.push({id:uid(), name:d.name.trim(), total:+d.total, done:+d.done||0});
    save(); render();
  }, 'Добавить');
}
function incCourse(id){
  const c = S.learn.courses.find(x=>x.id===id); if(!c) return;
  c.done = Math.min(c.total, (c.done||0)+1);
  save(); render();
  if(c.done>=c.total) toast('Курс завершён! 🎉');
}
function editCourse(id){
  const c = S.learn.courses.find(x=>x.id===id); if(!c) return;
  openModal('Курс', `
    <div class="field"><label>Название</label><input name="name" required value="${esc(c.name)}"></div>
    <div class="frow">
      <div class="field"><label>Всего уроков</label><input name="total" type="number" min="1" value="${c.total}"></div>
      <div class="field"><label>Пройдено</label><input name="done" type="number" min="0" value="${c.done||0}"></div>
    </div>
  `, d=>{ Object.assign(c,{name:d.name.trim(), total:+d.total||c.total, done:Math.min(+d.done||0, +d.total||c.total)}); save(); render(); });
}
function delCourse(id){ confirmDel('Удалить курс?',()=>{ S.learn.courses = S.learn.courses.filter(x=>x.id!==id); }); }

/* ================= ПУТЕШЕСТВИЯ ================= */
function vTravel(){
  const trips = [...S.travel.trips].sort((a,b)=>String(a.start||'9999').localeCompare(String(b.start||'9999')));
  const upcoming = trips.filter(t=>!t.end || t.end>=todayStr());
  const past = trips.filter(t=>t.end && t.end<todayStr());
  const tripCard = t => {
    const cl = t.checklist||[];
    const done = cl.filter(x=>x.done).length;
    const days = t.start ? daysUntil(t.start) : null;
    return `<div class="card">
      <div style="display:flex;align-items:flex-start;gap:10px">
        <div class="grow" style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:15.5px">🌴 ${esc(t.name)}</div>
          <div class="item-meta" style="margin-top:4px">
            ${t.start?`<span class="chip">${fmtDate(t.start)}${t.end?' – '+fmtDate(t.end):''}</span>`:''}
            ${days!==null && days>0 ? `<span class="chip violet">через ${days} ${plural(days,'день','дня','дней')}</span>` : days!==null && days<=0 && (!t.end||t.end>=todayStr()) ? '<span class="chip green">сейчас! ✈️</span>':''}
            ${t.budget?`<span class="chip mono">💰 ${fmtMoney(t.budget)}</span>`:''}
          </div>
        </div>
        <button class="icon-btn" onclick="editTrip('${t.id}')">✎</button>
        <button class="icon-btn btn-danger" onclick="delTrip('${t.id}')">✕</button>
      </div>
      ${t.budget && !t.budgetLinked ? `<button class="btn btn-ghost btn-sm" style="margin-top:8px" onclick="linkTripBudget('${t.id}')">💰 Учесть в бюджете (разовая операция)</button>`
        : t.budgetLinked ? '<div class="hint" style="margin-top:6px">✓ учтено в прогнозе бюджета</div>' : ''}
      <div style="display:flex;justify-content:space-between;align-items:center;margin:12px 0 4px">
        <div style="font-size:12px;font-weight:700;color:var(--text3)">ЧЕК-ЛИСТ · ${done}/${cl.length}</div>
      </div>
      ${cl.length?`<div class="progress green" style="margin-bottom:8px"><div style="width:${cl.length?Math.round(done/cl.length*100):0}%"></div></div>`:''}
      ${cl.map(x=>`<div class="sub-row ${x.done?'done':''}" style="padding-left:0">
        <button class="checkbox ${x.done?'on':''}" onclick="toggleTripItem('${t.id}','${x.id}')">${x.done?'✓':''}</button>
        <span style="flex:1">${esc(x.t)}</span>
        <button class="icon-btn" style="width:22px;height:22px;font-size:11px" onclick="delTripItem('${t.id}','${x.id}')">✕</button>
      </div>`).join('')}
      <div class="quick-add" style="margin-top:8px">
        <input placeholder="Добавить в чек-лист… (Enter)" onkeydown="if(event.key==='Enter'&&this.value.trim()){addTripItem('${t.id}',this.value.trim());this.value=''}">
      </div>
    </div>`;
  };
  return `
  <div class="page-head">
    <div><h1>Путешествия</h1><div class="sub">Мечты, планы и сборы</div></div>
    <button class="btn btn-primary" onclick="addTrip()">+ Поездка</button>
  </div>
  <div class="grid grid2" style="margin-bottom:16px">
    <div class="card" style="align-self:start">
      <h2>🗺 Хочу посетить</h2>
      <div class="quick-add" style="margin-bottom:8px">
        <input placeholder="Добавить место… (Enter)" onkeydown="if(event.key==='Enter'&&this.value.trim()){addWish(this.value.trim());this.value=''}">
      </div>
      ${S.travel.wishlist.map(w=>`<div class="item-row">
        <span>📍</span><div class="grow"><div class="item-title">${esc(w.place)}</div></div>
        <button class="btn btn-ghost btn-sm" onclick="wishToTrip('${w.id}')">→ в поездку</button>
        <button class="icon-btn btn-danger" onclick="delWish('${w.id}')">✕</button>
      </div>`).join('') || emptyBig('🗺','Куда мечтаете поехать?','Копите список — лучшие идеи превратятся в поездки')}
    </div>
    <div>
      ${upcoming.map(tripCard).join('') || `<div class="card">${emptyBig('✈️','Поездок пока нет','Создайте поездку — чек-лист сборов, дата и бюджет в одном месте')}</div>`}
    </div>
  </div>
  ${past.length?`<h2 style="margin-bottom:12px">🏝 Прошедшие</h2><div class="grid grid2">${past.map(tripCard).join('')}</div>`:''}`;
}
const TRIP_CHECKLIST_DEFAULT = ['Паспорт / документы','Билеты','Жильё','Страховка','Аптечка','Зарядки и техника'];
function tripForm(t){
  t = t||{};
  return `
    <div class="field"><label>Куда / название</label><input name="name" required value="${esc(t.name||'')}" placeholder="Сочи, море"></div>
    <div class="frow">
      <div class="field"><label>Начало</label><input name="start" type="date" value="${t.start||''}"></div>
      <div class="field"><label>Конец</label><input name="end" type="date" value="${t.end||''}"></div>
    </div>
    <div class="field"><label>Бюджет поездки, ₽ (необяз.)</label><input name="budget" type="number" min="0" value="${t.budget||''}"></div>`;
}
function addTrip(prefillName){
  openModal('Новая поездка', tripForm(prefillName?{name:prefillName}:null) + `
    <div class="field" style="display:flex;gap:8px;align-items:center">
      <input type="checkbox" name="defList" checked style="width:auto"><label style="margin:0">Добавить стандартный чек-лист сборов</label>
    </div>
  `, d=>{
    if(!d.name.trim()) return false;
    S.travel.trips.push({id:uid(), name:d.name.trim(), start:d.start||null, end:d.end||null, budget:+d.budget||null,
      budgetLinked:false, checklist: d.defList ? TRIP_CHECKLIST_DEFAULT.map(x=>({id:uid(), t:x, done:false})) : []});
    save(); render();
  }, 'Создать');
}
function editTrip(id){
  const t = S.travel.trips.find(x=>x.id===id); if(!t) return;
  openModal('Поездка', tripForm(t), d=>{
    Object.assign(t,{name:d.name.trim(), start:d.start||null, end:d.end||null, budget:+d.budget||null});
    save(); render();
  });
}
function delTrip(id){ confirmDel('Удалить поездку?',()=>{ S.travel.trips = S.travel.trips.filter(x=>x.id!==id); }); }
function addTripItem(tripId, txt){
  const t = S.travel.trips.find(x=>x.id===tripId); if(!t) return;
  (t.checklist = t.checklist||[]).push({id:uid(), t:txt, done:false});
  save(); render();
}
function toggleTripItem(tripId, itemId){
  const t = S.travel.trips.find(x=>x.id===tripId); const it = t && (t.checklist||[]).find(x=>x.id===itemId);
  if(it){ it.done = !it.done; save(); render(); }
}
function delTripItem(tripId, itemId){
  const t = S.travel.trips.find(x=>x.id===tripId); if(!t) return;
  t.checklist = (t.checklist||[]).filter(x=>x.id!==itemId); save(); render();
}
function linkTripBudget(id){
  const t = S.travel.trips.find(x=>x.id===id); if(!t || !t.budget) return;
  const month = t.start ? t.start.slice(0,7) : curMonth();
  S.budget.planned.push({id:uid(), type:'expense', name:'Поездка: '+t.name, amount:t.budget, month, category:'Развлечения', done:false});
  t.budgetLinked = true;
  save(); render(); toast('Добавлено в план бюджета ✓');
}
function addWish(place){ S.travel.wishlist.push({id:uid(), place}); save(); render(); }
function delWish(id){ confirmDel('Удалить?',()=>{ S.travel.wishlist = S.travel.wishlist.filter(x=>x.id!==id); }); }
function wishToTrip(id){
  const w = S.travel.wishlist.find(x=>x.id===id); if(!w) return;
  S.travel.wishlist = S.travel.wishlist.filter(x=>x.id!==id);
  addTrip(w.place);
}

/* ================= ОКРУЖЕНИЕ ================= */
function weeksSince(dateStr){
  if(!dateStr) return 999;
  return Math.floor((new Date(todayStr()) - new Date(dateStr)) / (7*86400000));
}
function vPeople(){
  const list = [...S.people.contacts].sort((a,b)=>{
    const oa = weeksSince(a.lastContact) - (a.intervalWeeks||4);
    const ob = weeksSince(b.lastContact) - (b.intervalWeeks||4);
    return ob - oa;
  });
  const overdueCnt = list.filter(c=>weeksSince(c.lastContact) >= (c.intervalWeeks||4)).length;
  return `
  <div class="page-head">
    <div><h1>Окружение</h1><div class="sub">Важные люди рядом${overdueCnt?` · <span style="color:var(--red)">давно не общались: ${overdueCnt}</span>`:''}</div></div>
    <button class="btn btn-primary" onclick="addContact()">+ Человек</button>
  </div>
  <div class="card">
    ${list.map(c=>{
      const w = weeksSince(c.lastContact);
      const over = w >= (c.intervalWeeks||4);
      return `<div class="item-row" style="flex-wrap:wrap">
        <span class="member-avatar" style="background:${c.color};width:34px;height:34px;font-size:13px">${initials(c.name)}</span>
        <div class="grow" style="flex:1;min-width:50%">
          <div class="item-title">${esc(c.name)}</div>
          <div class="item-meta">
            ${c.tag?`<span class="chip">${esc(c.tag)}</span>`:''}
            <span class="chip ${over?'red':''}">${c.lastContact ? (w===0?'на этой неделе':w+' нед. назад') : 'ещё не общались'}</span>
            <span style="font-size:11px;color:var(--text3)">цель: раз в ${c.intervalWeeks||4} нед.</span>
          </div>
          ${c.notes?`<div class="notes-line" title="${esc(c.notes)}">${esc(c.notes)}</div>`:''}
        </div>
        <button class="btn ${over?'btn-primary':'btn-ghost'} btn-sm" onclick="touchContact('${c.id}')">✓ пообщались</button>
        <button class="icon-btn" onclick="editContact('${c.id}')">✎</button>
        <button class="icon-btn btn-danger" onclick="delContact('${c.id}')">✕</button>
      </div>`;
    }).join('') || emptyBig('🤝','Добавьте важных людей','Друзья, менторы, родные — трекер напомнит, если давно не общались')}
  </div>`;
}
function contactForm(c){
  c = c||{};
  return `
    <div class="field"><label>Имя</label><input name="name" required value="${esc(c.name||'')}"></div>
    <div class="frow">
      <div class="field"><label>Кто это</label><input name="tag" value="${esc(c.tag||'')}" placeholder="друг, ментор, брат…"></div>
      <div class="field"><label>Общаться раз в</label><select name="intervalWeeks">
        ${[[1,'неделю'],[2,'2 недели'],[4,'месяц'],[8,'2 месяца'],[12,'3 месяца'],[26,'полгода']].map(([v,l])=>`<option value="${v}" ${(c.intervalWeeks||4)===v?'selected':''}>${l}</option>`).join('')}
      </select></div>
    </div>
    <div class="field"><label>Последний контакт</label><input name="lastContact" type="date" value="${c.lastContact||todayStr()}"></div>
    <div class="field"><label>Заметки (дети, увлечения, о чём говорили)</label><textarea name="notes">${esc(c.notes||'')}</textarea></div>`;
}
function addContact(){
  openModal('Важный человек', contactForm(), d=>{
    if(!d.name.trim()) return false;
    S.people.contacts.push({id:uid(), name:d.name.trim(), tag:d.tag.trim(), intervalWeeks:+d.intervalWeeks||4,
      lastContact:d.lastContact||null, notes:d.notes.trim(),
      color:AVATAR_COLORS[(S.people.contacts.length+4) % AVATAR_COLORS.length]});
    save(); render();
  }, 'Добавить');
}
function editContact(id){
  const c = S.people.contacts.find(x=>x.id===id); if(!c) return;
  openModal('Человек', contactForm(c), d=>{
    Object.assign(c,{name:d.name.trim(), tag:d.tag.trim(), intervalWeeks:+d.intervalWeeks||4, lastContact:d.lastContact||null, notes:d.notes.trim()});
    save(); render();
  });
}
function touchContact(id){
  const c = S.people.contacts.find(x=>x.id===id); if(!c) return;
  c.lastContact = todayStr(); save(); render(); toast('Отлично! 🤝');
}
function delContact(id){ confirmDel('Удалить человека из списка?',()=>{ S.people.contacts = S.people.contacts.filter(x=>x.id!==id); }); }

/* ================= WEEKLY REVIEW ================= */
const MOODS = ['😞','😕','😐','🙂','🔥'];
const MOOD_LABELS = ['ужасно','так себе','нормально','хорошо','огонь'];
function setMood(date, score){
  let m = S.mood.find(x=>x.date===date);
  if(m && m.score===score){ S.mood = S.mood.filter(x=>x.date!==date); } // повторный тап — снять
  else if(m){ m.score = score; }
  else S.mood.push({date, score});
  save(); render();
}
function vReview(){
  const ws = weekStart();
  const reviews = [...S.reviews].sort((a,b)=>b.weekStart.localeCompare(a.weekStart));
  const thisWeek = S.reviews.find(r=>r.weekStart===ws);
  const doneCnt = doneThisWeek();
  const wk = modOn('sport') ? weekWorkouts(ws).length : null;
  const overdue = overdueDayTasks().length;
  const focuses = S.work.weekFocuses.filter(f=>f.weekStart===ws);
  const focusDone = focuses.filter(f=>f.done).length;
  const moodScores = S.mood.filter(m=>m.date >= addDays(todayStr(),-30)).sort((a,b)=>a.date.localeCompare(b.date));
  const avgMood = moodScores.length ? (moodScores.reduce((s,m)=>s+m.score,0)/moodScores.length) : null;
  return `
  <div class="page-head">
    <div><h1>Итоги недели</h1><div class="sub">10 минут рефлексии — самый дешёвый способ расти</div></div>
    ${thisWeek?'':`<button class="btn btn-primary" onclick="addReview()">✍️ Подвести итоги недели</button>`}
  </div>

  <div class="grid grid2" style="margin-bottom:16px">
    <div class="card">
      <h2>📈 Эта неделя в цифрах</h2>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:4px">
        <div class="card" style="padding:12px;box-shadow:none">
          <div style="font-size:11px;color:var(--text3)">✅ Задач выполнено</div>
          <div style="font-size:20px;font-weight:700">${doneCnt}</div>
        </div>
        <div class="card" style="padding:12px;box-shadow:none">
          <div style="font-size:11px;color:var(--text3)">🔥 Фокусы недели</div>
          <div style="font-size:20px;font-weight:700">${focusDone}/${focuses.length||0}</div>
        </div>
        ${wk!==null?`<div class="card" style="padding:12px;box-shadow:none">
          <div style="font-size:11px;color:var(--text3)">🏃 Тренировок</div>
          <div style="font-size:20px;font-weight:700">${wk}/${S.sport.weeklyGoal}</div>
        </div>`:''}
        <div class="card" style="padding:12px;box-shadow:none">
          <div style="font-size:11px;color:var(--text3)">⚠ Просрочено</div>
          <div style="font-size:20px;font-weight:700;color:${overdue?'var(--red)':'var(--green)'}">${overdue}</div>
        </div>
      </div>
      <div style="margin-top:14px">
        ${thisWeek
          ? `<div style="display:flex;align-items:center;gap:10px"><span class="chip green">итоги заполнены ✓</span>
             <button class="btn btn-ghost btn-sm" onclick="editReview('${thisWeek.id}')">открыть</button></div>`
          : `<button class="btn btn-primary btn-sm" onclick="addReview()">✍️ Заполнить итоги — сделанное подставится само</button>`}
      </div>
    </div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h2 style="margin:0">🧘 Настроение по дням</h2>
        ${avgMood!==null?`<span class="chip violet">среднее за месяц: ${MOODS[Math.round(avgMood)-1]}</span>`:''}
      </div>
      <div class="mood-strip">
        ${[0,1,2,3,4,5,6].map(i=>{
          const d = addDays(ws,i);
          const m = S.mood.find(x=>x.date===d);
          const future = d > todayStr();
          return `<div class="mood-day ${d===todayStr()?'today':''}">
            <div class="d">${['ПН','ВТ','СР','ЧТ','ПТ','СБ','ВС'][i]}<br>${+d.slice(8)}</div>
            ${future ? '<div class="cur" style="opacity:.15">·</div>'
              : m ? `<div class="cur" title="${MOOD_LABELS[m.score-1]}" style="cursor:pointer" onclick="setMood('${d}',${m.score})">${MOODS[m.score-1]}</div>`
              : `<div class="smileys">${MOODS.map((e,k)=>`<button title="${MOOD_LABELS[k]}" onclick="setMood('${d}',${k+1})">${e}</button>`).join('')}</div>`}
          </div>`;
        }).join('')}
      </div>
      <div class="hint" style="margin-top:10px">Один тап вечером. Повторный тап по смайлику — убрать оценку.</div>
      ${moodScores.length>=5 ? sparkLine(moodScores.map(m=>m.score), 'var(--accent2)') : ''}
    </div>
  </div>

  <h2 style="margin-bottom:12px">📜 История</h2>
  ${reviews.length ? reviews.map(reviewCard).join('')
    : `<div class="card">${emptyBig('📝','Ещё нет ни одного разбора недели','Три вопроса раз в неделю: что получилось, что нет, что дальше. Сделанное за неделю подставится автоматически')}</div>`}`;
}
function reviewCard(r){
  const isCur = r.weekStart===weekStart();
  const winsCnt = (r.wins||'').split('\n').filter(x=>x.trim()).length;
  return `<details class="rev-item" ${isCur?'open':''}>
    <summary>
      <span style="font-size:20px">${MOODS[(r.mood||3)-1]}</span>
      <b style="font-size:14px">${fmtDate(r.weekStart)} – ${fmtDate(addDays(r.weekStart,6))}</b>
      ${isCur?'<span class="chip violet">текущая</span>':''}
      <span class="chip green" style="margin-left:auto">${winsCnt} ${plural(winsCnt,'победа','победы','побед')}</span>
    </summary>
    <div class="body">
      <div class="grid grid3">
        <div><div style="font-size:11px;font-weight:700;color:var(--green);margin-bottom:5px">✅ ПОЛУЧИЛОСЬ</div>
          <div style="font-size:13px;white-space:pre-wrap;color:var(--text2);line-height:1.6">${esc(r.wins)||'—'}</div></div>
        <div><div style="font-size:11px;font-weight:700;color:var(--red);margin-bottom:5px">✕ НЕ ПОЛУЧИЛОСЬ</div>
          <div style="font-size:13px;white-space:pre-wrap;color:var(--text2);line-height:1.6">${esc(r.fails)||'—'}</div></div>
        <div><div style="font-size:11px;font-weight:700;color:var(--blue);margin-bottom:5px">→ ПЛАН НА СЛЕДУЮЩУЮ</div>
          <div style="font-size:13px;white-space:pre-wrap;color:var(--text2);line-height:1.6">${esc(r.plans)||'—'}</div></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:14px">
        <button class="btn btn-ghost btn-sm" onclick="editReview('${r.id}')">✎ Редактировать</button>
        <button class="btn btn-ghost btn-sm btn-danger" onclick="delReview('${r.id}')">Удалить</button>
      </div>
    </div>
  </details>`;
}
function reviewForm(r){
  r = r || {};
  return `
    <div class="field"><label>Неделя (понедельник)</label><input name="weekStart" type="date" value="${r.weekStart||weekStart()}"></div>
    <div class="field"><label>✅ Что получилось</label><textarea name="wins" placeholder="Главные победы недели">${esc(r.wins||'')}</textarea></div>
    <div class="field"><label>❌ Что не получилось</label><textarea name="fails" placeholder="Что пошло не так и почему">${esc(r.fails||'')}</textarea></div>
    <div class="field"><label>➡️ План на следующую неделю</label><textarea name="plans" placeholder="1–3 главных фокуса">${esc(r.plans||'')}</textarea></div>
    <div class="field"><label>Оценка недели</label><select name="mood">
      ${MOODS.map((m,i)=>`<option value="${i+1}" ${(r.mood||3)===i+1?'selected':''}>${m} ${['ужасная','так себе','нормальная','хорошая','огонь'][i]}</option>`).join('')}
    </select></div>`;
}
function addReview(){
  // автозаполнение из сделанного и просроченного за неделю
  const ws = weekStart(), we = addDays(ws,6);
  const wins = [
    ...S.work.dayTasks.filter(x=>x.done && x.date>=ws && x.date<=we).map(x=>'✓ '+x.title),
    ...S.work.teamTasks.filter(x=>x.status==='done' && x.doneAt && x.doneAt>=ws && x.doneAt<=we)
      .map(x=>{ const m=S.work.team.find(y=>y.id===x.memberId); return '✓ '+(m?m.name.split(' ')[0]+': ':'')+x.title; }),
    ...S.personal.tasks.filter(x=>x.done && x.doneAt && x.doneAt>=ws && x.doneAt<=we).map(x=>'✓ '+x.title)
  ].slice(0,10).join('\n');
  const fails = [
    ...overdueDayTasks().map(x=>'✗ '+x.title),
    ...S.work.weekFocuses.filter(f=>f.weekStart===ws && !f.done).map(f=>'✗ фокус: '+f.title),
    ...S.personal.weekFocuses.filter(f=>f.weekStart===ws && !f.done).map(f=>'✗ личный фокус: '+f.title)
  ].slice(0,8).join('\n');
  openModal('Итоги недели', reviewForm({wins, fails}), d=>{
    S.reviews.push({id:uid(), weekStart:weekStart(d.weekStart), wins:d.wins.trim(), fails:d.fails.trim(), plans:d.plans.trim(), mood:+d.mood});
    save(); render();
  });
}
function editReview(id){
  const r = S.reviews.find(x=>x.id===id); if(!r) return;
  openModal('Редактировать итоги недели', reviewForm(r), d=>{
    Object.assign(r,{weekStart:weekStart(d.weekStart), wins:d.wins.trim(), fails:d.fails.trim(), plans:d.plans.trim(), mood:+d.mood});
    save(); render();
  });
}
function delReview(id){ confirmDel('Удалить итоги недели?',()=>{ S.reviews=S.reviews.filter(x=>x.id!==id); }); }

/* ================= DEMO DATA ================= */
function isEmptyState(){
  return !S.work.dayTasks.length && !S.work.yearGoals.length && !S.work.team.length
    && !S.personal.projects.length && !S.budget.transactions.length && !S.budget.plan.length;
}
function fillDemo(){
  if(!isEmptyState() && !confirm('Заменить текущие данные демо-данными? Это перезапишет всё на этом устройстве.')) return;
  const T = todayStr(), WS = weekStart(), YM = curMonth(), yr = curYear();
  const rnd = (a,b)=>Math.round((a+Math.random()*(b-a))/100)*100;
  const st = DEFAULT_STATE();
  st.settings = Object.assign({}, S.settings);
  st.work.yearGoals = [
    {id:'yg1',title:'Выстроить процессы в новой команде',desc:'Спринты, регулярные 1:1, прозрачные статусы',year:yr,progress:0,status:'track'},
    {id:'yg2',title:'Запустить мобильное приложение',desc:'Релиз в сторах, 10 000 установок',year:yr,progress:35,status:'risk'},
    {id:'yg3',title:'Вырасти до директора департамента',desc:'Взять на себя смежное направление',year:yr,progress:20,status:'track'}];
  st.work.quarterGoals = [
    {id:'qg1',title:'Провести аудит текущих процессов',year:yr,quarter:2,done:true,goalId:'yg1'},
    {id:'qg2',title:'Внедрить спринты и планёрки',year:yr,quarter:curQuarter(),done:true,goalId:'yg1'},
    {id:'qg3',title:'Нанять двух аналитиков',year:yr,quarter:curQuarter(),done:false,goalId:'yg1'},
    {id:'qg4',title:'Закрытая бета на 500 пользователей',year:yr,quarter:curQuarter(),done:false,goalId:'yg2'},
    {id:'qg5',title:'Согласовать бюджет Q4 на маркетинг',year:yr,quarter:4,done:false,goalId:'yg2'}];
  st.work.weekFocuses = [
    {id:'wf1',title:'Закрыть найм аналитика',notes:'3 финальных собеседования на этой неделе',weekStart:WS,done:false},
    {id:'wf2',title:'Подготовить стратегию Q4',notes:'',weekStart:WS,done:true},
    {id:'wf3',title:'Согласовать редизайн с руководством',notes:'',weekStart:addDays(WS,-7),done:true}];
  st.work.dayTasks = [
    {id:'dt1',title:'Планёрка с командой',date:T,priority:'mid',done:true,doneAt:T,recId:'rec1'},
    {id:'dt2',title:'Финальное собеседование с кандидатом',date:T,priority:'high',done:false,notes:'Кандидат от HR, опыт 4 года в аналитике'},
    {id:'dt3',title:'Ревью макетов онбординга',date:T,priority:'high',done:false},
    {id:'dt4',title:'1:1 с Анной',date:T,priority:'mid',done:true,doneAt:T},
    {id:'dt5',title:'Ответить партнёрам по интеграции',date:T,priority:'low',done:false},
    {id:'dt6',title:'Подготовить отчёт для CEO',date:addDays(T,-1),priority:'high',done:false,notes:'Цифры за прошлый месяц + план на квартал'},
    {id:'dt7',title:'Согласовать оффер аналитику',date:addDays(T,-2),priority:'mid',done:true,doneAt:addDays(T,-2)},
    {id:'dt8',title:'Проверить макеты лендинга',date:addDays(T,-3),priority:'mid',done:true,doneAt:addDays(T,-3)},
    {id:'dt9',title:'Продумать KPI команды на Q4',date:null,priority:'mid',done:false},
    {id:'dt10',title:'Организовать тимбилдинг',date:null,priority:'low',done:false}];
  st.work.recurring = [
    {id:'rec1',title:'Планёрка с командой',freq:'daily',priority:'mid'},
    {id:'rec2',title:'Отчёт по неделе для CEO',freq:'weekly',weekday:5,priority:'high'},
    {id:'rec3',title:'Ретроспектива месяца',freq:'monthly',monthday:1,priority:'mid'}];
  st.work.team = [
    {id:'tm1',name:'Анна Иванова',role:'Продакт-дизайнер',focus:'Редизайн онбординга',color:'#6366f1',topics:[{id:'tp1',t:'Обсудить повышение до сеньора'},{id:'tp2',t:'Итоги теста нового онбординга'}]},
    {id:'tm2',name:'Иван Петров',role:'Аналитик',focus:'Дашборд ключевых метрик',color:'#a855f7',topics:[{id:'tp3',t:'План развития на полгода'}]},
    {id:'tm3',name:'Мария Сидорова',role:'Маркетолог',focus:'Кампания к запуску',color:'#ec4899',topics:[]}];
  st.work.projects = [
    {id:'wp1',name:'Запуск мобильного приложения',desc:'MVP до конца квартала, релиз в обоих сторах',deadline:addDays(T,45),status:'active',memberIds:['tm1','tm2'],color:'#f59e0b'},
    {id:'wp2',name:'Редизайн сайта',desc:'Новый лендинг + личный кабинет',deadline:addDays(T,17),status:'active',memberIds:['tm1','tm3'],color:'#10b981'},
    {id:'wp3',name:'Миграция аналитики',desc:'Переезд на новую платформу',deadline:null,status:'paused',memberIds:['tm2'],color:'#3b82f6'}];
  st.work.teamTasks = [
    {id:'tt1',memberId:'tm1',projectId:'wp2',title:'Макеты главной страницы',deadline:addDays(T,2),status:'review',notes:'Вторая итерация после правок',subs:[{id:'s1',t:'Десктоп-версия',done:true},{id:'s2',t:'Мобильная версия',done:true},{id:'s3',t:'Тёмная тема',done:false}]},
    {id:'tt2',memberId:'tm1',projectId:'wp1',title:'UI-кит приложения',deadline:addDays(T,9),status:'progress'},
    {id:'tt3',memberId:'tm2',projectId:'wp1',title:'События аналитики для MVP',deadline:addDays(T,-2),status:'progress',notes:'Блокер: ждём доступы от подрядчика'},
    {id:'tt4',memberId:'tm2',projectId:null,title:'Отчёт по воронке',deadline:addDays(T,1),status:'todo'},
    {id:'tt5',memberId:'tm3',projectId:'wp2',title:'Тексты для нового лендинга',deadline:addDays(T,5),status:'progress'},
    {id:'tt6',memberId:'tm3',projectId:null,title:'Медиаплан на следующий месяц',deadline:addDays(T,12),status:'todo'},
    {id:'tt7',memberId:'tm1',projectId:'wp2',title:'Аудит текущего сайта',deadline:null,status:'done',doneAt:addDays(T,-4)},
    {id:'tt8',memberId:'tm2',projectId:'wp1',title:'Исследование конкурентов',deadline:null,status:'done',doneAt:addDays(T,-1)}];
  st.personal.yearGoals = [
    {id:'pg1',title:'Прочитать 30 книг',desc:'Сейчас 16 из 30',year:yr,progress:55,status:'track'},
    {id:'pg2',title:'Пробежать полумарафон',desc:'Забег в сентябре',year:yr,progress:40,status:'risk'},
    {id:'pg3',title:'Собрать подушку в 1 млн',desc:'',year:yr,progress:52,status:'track'}];
  st.personal.projects = [
    {id:'pp1',name:'Книга о менеджменте',desc:'Черновик к концу года',color:'#6366f1',status:'active'},
    {id:'pp2',name:'Личный блог',desc:'2 статьи в месяц',color:'#ec4899',status:'active'},
    {id:'pp3',name:'Ремонт на балконе',desc:'',color:'#f59e0b',status:'paused'}];
  st.personal.tasks = [
    {id:'pt1',projectId:'pp1',title:'Дописать главу про делегирование',deadline:addDays(T,3),priority:'high',done:false,notes:'Осталось ~5 страниц',subs:[{id:'ps1',t:'Собрать примеры',done:true},{id:'ps2',t:'Написать черновик',done:false}]},
    {id:'pt2',projectId:'pp1',title:'Отправить главы редактору',deadline:addDays(T,14),priority:'mid',done:false},
    {id:'pt3',projectId:'pp1',title:'План книги и структура глав',deadline:null,done:true,doneAt:addDays(T,-6)},
    {id:'pt4',projectId:'pp2',title:'Статья «Первые 90 дней на новой работе»',deadline:addDays(T,6),priority:'mid',done:false},
    {id:'pt5',projectId:'pp2',title:'Настроить рассылку',deadline:null,done:true,doneAt:addDays(T,-2)},
    {id:'pt6',projectId:'pp3',title:'Выбрать материалы',deadline:null,done:false}];
  st.personal.weekFocuses = [
    {id:'pf1',title:'Дописать главу книги',notes:'',weekStart:WS,done:false},
    {id:'pf2',title:'3 пробежки по 8 км',notes:'',weekStart:WS,done:false}];
  st.personal.people = [
    {id:'pr1',name:'Дмитрий Соколов',role:'Партнёр по кофейне',color:'#ec4899'},
    {id:'pr2',name:'Олег Смирнов',role:'Разработчик на подряде',color:'#f59e0b'}];
  st.personal.tasks[1].assigneeId = 'pr2';
  st.personal.projects[1].partnerIds = ['pr2'];
  st.personal.ideas = [
    {id:'id1',title:'Телеграм-бот для учёта привычек',notes:'Простой бот: отмечаешь привычки, шлёт напоминания. Проверить, есть ли аналоги.',createdAt:addDays(T,-5)},
    {id:'id2',title:'Курс для тимлидов-новичков',notes:'Упаковать опыт первых 90 дней в мини-курс',createdAt:addDays(T,-12)},
    {id:'id3',title:'Партнёрство с коворкингом',notes:'',createdAt:addDays(T,-1)}];
  st.personal.businesses = [{
    id:'bz1', name:'Кофейня «Утро»', desc:'Точка у метро, работаем с Дмитрием 50/50', status:'active', color:'#14b8a6',
    goals:[
      {id:'bg1',title:'Выйти на 500 000 ₽ выручки/мес',done:false},
      {id:'bg2',title:'Открыть вторую точку до конца года',done:false},
      {id:'bg3',title:'Запустить программу лояльности',done:true}],
    tasks:[
      {id:'bt1',title:'Договориться с поставщиком зерна',deadline:addDays(T,4),assigneeId:'pr1',done:false,notes:'Есть 2 варианта, сравнить цены'},
      {id:'bt2',title:'Настроить онлайн-кассу',deadline:addDays(T,8),assigneeId:null,done:false},
      {id:'bt3',title:'Нанять второго бариста',deadline:null,assigneeId:'pr1',done:false},
      {id:'bt4',title:'Сделать вывеску',deadline:null,assigneeId:null,done:true,doneAt:addDays(T,-10)}],
    finance:[]
  }];
  {
    const revs=[280000,340000,390000,420000,455000];
    for(let k=5;k>=1;k--){
      const rv = revs[5-k];
      st.personal.businesses[0].finance.push({id:uid(),month:monthAdd(YM,-k),revenue:rv,expenses:Math.round(rv*(0.62+Math.random()*0.1)/1000)*1000});
    }
  }
  st.budget.plan = [
    {id:'bp1',type:'income',name:'Зарплата',amount:280000,category:'Зарплата'},
    {id:'bp2',type:'income',name:'Консультации',amount:40000,category:'Фриланс'},
    {id:'bp3',type:'expense',name:'Аренда квартиры',amount:75000,category:'Жильё'},
    {id:'bp4',type:'expense',name:'Продукты',amount:45000,category:'Продукты'},
    {id:'bp5',type:'expense',name:'Кафе и доставка',amount:18000,category:'Кафе и рестораны'},
    {id:'bp6',type:'expense',name:'Транспорт и такси',amount:9000,category:'Транспорт'},
    {id:'bp7',type:'expense',name:'Спортзал и врачи',amount:7000,category:'Здоровье'},
    {id:'bp8',type:'expense',name:'Подписки',amount:3500,category:'Подписки'},
    {id:'bp9',type:'expense',name:'Развлечения',amount:12000,category:'Развлечения'}];
  st.budget.planned = [
    {id:'pl1',type:'expense',name:'Отпуск',amount:120000,month:monthAdd(YM,1),category:'Развлечения',done:false},
    {id:'pl2',type:'expense',name:'Новый ноутбук',amount:95000,month:monthAdd(YM,3),category:'Другое',done:false},
    {id:'pl3',type:'income',name:'Годовая премия',amount:150000,month:yr+'-12',category:'Премия',done:false}];
  for(let k=3;k>=1;k--){
    const m = monthAdd(YM,-k);
    st.budget.transactions.push(
      {id:uid(),type:'income',name:'Зарплата',amount:280000,month:m,category:'Зарплата'},
      {id:uid(),type:'income',name:'Консультации',amount:rnd(20000,55000),month:m,category:'Фриланс'},
      {id:uid(),type:'expense',name:'Аренда квартиры',amount:75000,month:m,category:'Жильё'},
      {id:uid(),type:'expense',name:'Продукты',amount:rnd(38000,52000),month:m,category:'Продукты'},
      {id:uid(),type:'expense',name:'Кафе и доставка',amount:rnd(12000,24000),month:m,category:'Кафе и рестораны'},
      {id:uid(),type:'expense',name:'Такси',amount:rnd(5000,12000),month:m,category:'Транспорт'},
      {id:uid(),type:'expense',name:'Спортзал',amount:7000,month:m,category:'Здоровье'},
      {id:uid(),type:'expense',name:'Подписки',amount:3500,month:m,category:'Подписки'},
      {id:uid(),type:'expense',name:'Кино и бары',amount:rnd(6000,15000),month:m,category:'Развлечения'},
      {id:uid(),type:'expense',name:'Платёж: Ипотека',amount:52000,month:m,category:'Долги'});
  }
  st.budget.transactions.push(
    {id:uid(),type:'income',name:'Зарплата',amount:280000,month:YM,category:'Зарплата'},
    {id:uid(),type:'expense',name:'Аренда квартиры',amount:75000,month:YM,category:'Жильё'},
    {id:uid(),type:'expense',name:'Продукты',amount:16400,month:YM,category:'Продукты'},
    {id:uid(),type:'expense',name:'Кафе и доставка',amount:6800,month:YM,category:'Кафе и рестораны'},
    {id:uid(),type:'expense',name:'Такси',amount:2900,month:YM,category:'Транспорт'},
    {id:uid(),type:'expense',name:'Платёж: Ипотека',amount:52000,month:YM,category:'Долги'},
    {id:uid(),type:'expense',name:'Книги',amount:3200,month:YM,category:'Образование'});
  st.budget.debts = [
    {id:'db1',name:'Ипотека',total:4500000,paid:1350000,monthly:52000},
    {id:'db2',name:'Рассрочка за технику',total:180000,paid:120000,monthly:15000}];
  st.budget.savings = [
    {id:'sv1',name:'Подушка безопасности',current:520000,goal:1000000,targetDate:(yr+1)+'-06-01'},
    {id:'sv2',name:'На новую машину',current:310000,goal:1500000,targetDate:null},
    {id:'sv3',name:'Инвестиции',current:245000,goal:0,targetDate:null}];
  // спорт: тренировки за последние 6 недель
  const sportTypes = [['Бег',45,7],['Силовая',60,null],['Бег',40,6],['Плавание',50,1.5]];
  for(let k=5;k>=0;k--){
    const wstart = addDays(WS,-7*k);
    const n = k===0 ? 2 : 2+Math.floor(Math.random()*3); // текущая неделя частично
    const days = [0,2,4,5,1].slice(0,n);
    days.forEach((off,j)=>{
      const d = addDays(wstart,off);
      if(d>T) return;
      const [tp,min,dist] = sportTypes[(k+j)%sportTypes.length];
      st.sport.workouts.push({id:uid(), date:d, type:tp, minutes:min+Math.floor(Math.random()*3)*5, distance:dist, notes:''});
    });
  }
  st.sport.weeklyGoal = 3;
  st.settings.modules = { work:true, personal:true, budget:true, sport:true, review:true, health:true, learn:true, travel:true, people:true };
  // здоровье
  for(let k=13;k>=0;k--){
    const d = addDays(T,-k);
    st.health.metrics.push({id:uid(), date:d, weight: Math.round((82.6 - (13-k)*0.08)*10)/10,
      sleep: 6.5 + (k%3)*0.5, energy: 3 + ((k+1)%3)});
  }
  st.health.vitamins = [{id:'vt1',name:'Витамин D'},{id:'vt2',name:'Омега-3'}];
  st.health.vitaminLog[T] = ['vt1'];
  st.health.checkups = [
    {id:'ch1', name:'Стоматолог', intervalMonths:6, lastDate:addDays(T,-170)},
    {id:'ch2', name:'Общие анализы', intervalMonths:12, lastDate:addDays(T,-100)}];
  // обучение
  st.learn.books = [
    {id:'bk1', title:'Джедайские техники', author:'Максим Дорофеев', status:'reading'},
    {id:'bk2', title:'Атомные привычки', author:'Джеймс Клир', status:'done', rating:5, doneAt:addDays(T,-20), note:'Система важнее мотивации'},
    {id:'bk3', title:'Принципы', author:'Рэй Далио', status:'want'},
    {id:'bk4', title:'Шантарам', status:'want'}];
  st.learn.courses = [{id:'cr1', name:'Управление командой', total:20, done:12}];
  // путешествия
  st.travel.wishlist = [{id:'wl1',place:'Алтай'},{id:'wl2',place:'Стамбул'},{id:'wl3',place:'Байкал зимой'}];
  st.travel.trips = [{id:'tr1', name:'Сочи, отпуск', start:addDays(T,32), end:addDays(T,41), budget:120000, budgetLinked:true,
    checklist:[{id:uid(),t:'Билеты',done:true},{id:uid(),t:'Отель',done:true},{id:uid(),t:'Страховка',done:false},{id:uid(),t:'Аптечка',done:false}]}];
  // окружение
  st.people.contacts = [
    {id:'pc1', name:'Дима Волков', tag:'лучший друг', intervalWeeks:2, lastContact:addDays(T,-25), notes:'Переехал в Казань, зовёт в гости', color:'#3b82f6'},
    {id:'pc2', name:'Мария Петрова', tag:'ментор', intervalWeeks:4, lastContact:addDays(T,-10), notes:'Обсуждали рост до директора', color:'#a855f7'},
    {id:'pc3', name:'Родители', tag:'семья', intervalWeeks:1, lastContact:addDays(T,-2), notes:'', color:'#10b981'}];
  // настроение
  for(let k=9;k>=0;k--){
    const d = addDays(T,-k);
    st.mood.push({date:d, score: 3 + ((k*7)%3)});
  }
  st.sport.goals = [
    {id:'sg1',title:'50 пробежек за год',kind:'auto',metric:'count',sportType:'Бег',target:50,deadline:yr+'-12-31',current:0,unit:''},
    {id:'sg2',title:'Набегать 300 км',kind:'auto',metric:'distance',sportType:'Бег',target:300,deadline:null,current:0,unit:''},
    {id:'sg3',title:'Жим лёжа 100 кг',kind:'manual',metric:'count',sportType:null,target:100,current:85,unit:'кг',deadline:null},
    {id:'sg4',title:'100 тренировок за год',kind:'auto',metric:'count',sportType:null,target:100,deadline:yr+'-12-31',current:0,unit:''}];
  st.reviews = [
    {id:'rv1',weekStart:addDays(WS,-7),wins:'✓ Провёл стратсессию с командой\n✓ Закрыли аудит сайта\n✓ 2 сильных кандидата в финале',fails:'✗ Не успел с отчётом по воронке\n✗ Мало спал — поздние созвоны',plans:'Закрыть найм аналитика\nСогласовать редизайн\n3 пробежки',mood:4},
    {id:'rv2',weekStart:addDays(WS,-14),wins:'✓ Успешный демо-день приложения\n✓ Дописал план книги',fails:'✗ Сорвался дедлайн по UI-киту — недооценили объём',plans:'Стратсессия\nАудит сайта',mood:3}];
  S = st;
  save(); go('dashboard');
  toast('Демо-данные загружены 🎲');
}

/* ================= SETTINGS & SYNC ================= */
function vSettings(){
  return `
  <div class="page-head"><div><h1>Настройки</h1></div></div>
  <div class="grid grid2">
    <div class="card">
      <h2>👤 Аккаунт</h2>
      ${SESSION ? `
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
          <div class="member-avatar" style="background:var(--accent)">${(SESSION.user.email||'?')[0].toUpperCase()}</div>
          <div><div style="font-weight:600">${esc(SESSION.user.email||'')}</div>
          <div class="sub" style="margin:0"><span class="sync-dot on"></span> данные синхронизируются с облаком</div></div>
        </div>
        <div class="hint" style="margin-bottom:14px">Входите с этим email и паролем на любом устройстве — задачи, бюджет и спорт будут общими. Данные видны только вам.</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" onclick="syncNow(true)">Синхронизировать сейчас</button>
          <button class="btn btn-ghost btn-sm btn-danger" onclick="doLogout()">Выйти</button>
        </div>`
      : authConfigured() ? `
        <div class="hint" style="margin-bottom:14px">Вы работаете <b>без аккаунта</b> — данные хранятся только в этом браузере. Создайте аккаунт, чтобы входить с любого устройства и не потерять данные (текущие данные перенесутся в аккаунт автоматически).</div>
        <button class="btn btn-primary btn-sm" onclick="backToAuth()">Войти или создать аккаунт</button>`
      : `<div class="hint">Аккаунты ещё не настроены для этого сайта.</div>`}
      <div class="field" style="margin-top:18px"><label>Ваше имя (для приветствия)</label>
        <div style="display:flex;gap:8px">
          <input id="userNameInp" value="${esc(S.settings.userName||'')}" placeholder="Например: Сергей">
          <button class="btn btn-ghost" onclick="S.settings.userName=document.getElementById('userNameInp').value.trim();save();render();toast('Сохранено ✓')">OK</button>
        </div>
      </div>
    </div>
    <div class="card">
      <h2>💾 Резервная копия</h2>
      <div class="hint" style="margin-bottom:14px">Экспортируйте данные в файл — это страховка и способ перенести данные вручную.</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" onclick="exportData()">⬇ Экспорт в файл</button>
        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('importFile').click()">⬆ Импорт из файла</button>
        <input type="file" id="importFile" accept=".json" style="display:none" onchange="importData(this)">
      </div>
      <h2 style="margin-top:26px">🧩 Разделы трекера</h2>
      <div class="hint" style="margin-bottom:8px">Включайте только те сферы, которые хотите вести — меню подстроится.</div>
      ${MODULES.map(m=>`<div class="mod-row">
        <span style="font-size:17px">${m.icon}</span>
        <span style="flex:1;font-size:14px">${m.name}</span>
        <label class="switch"><input type="checkbox" ${modOn(m.id)?'checked':''} onchange="toggleModule('${m.id}', this.checked)"><span class="sl"></span></label>
      </div>`).join('')}
      <h2 style="margin-top:26px">🎨 Оформление</h2>
      <div style="display:flex;align-items:center;gap:10px">
        <button class="btn btn-ghost btn-sm" onclick="openThemePicker()">Выбрать оформление</button>
        <span class="hint">сейчас: ${themeLabel()}</span>
      </div>
      <h2 style="margin-top:26px">📱 На телефоне</h2>
      <div class="hint">Откройте сайт в браузере телефона → меню «Поделиться» → <b>«На экран — Домой»</b> (iPhone) или «Добавить на главный экран» (Android). Трекер станет как приложение.</div>
      <h2 style="margin-top:26px">🗄 Локальные копии</h2>
      <div class="hint" style="margin-bottom:8px">Автоматический снимок раз в день, храним последние 7 — на случай, если что-то удалили по ошибке.</div>
      ${listBackups().length ? listBackups().map(k=>`<div class="item-row" style="padding:7px 0">
        <div class="grow"><span style="font-size:13.5px">📀 Копия за ${fmtDate(k.replace('mytracker_bak_',''))}</span></div>
        <button class="btn btn-ghost btn-sm" onclick="restoreBackup('${k}')">Восстановить</button>
      </div>`).join('') : '<div class="hint">Первая копия появится завтра (или после добавления данных)</div>'}
      <h2 style="margin-top:26px">🗑 Данные</h2>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" onclick="fillDemo()">🎲 Заполнить демо-данными</button>
        <button class="btn btn-ghost btn-sm" onclick="localStorage.removeItem('mytracker_tour_done');showTour(0)">🎓 Вводный тур</button>
        <button class="btn btn-ghost btn-sm btn-danger" onclick="resetAll()">Стереть все данные</button>
      </div>
    </div>
  </div>`;
}
function exportData(){
  const blob = new Blob([JSON.stringify(S,null,2)],{type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'my-tracker-'+todayStr()+'.json';
  a.click();
  toast('Файл сохранён');
}
function importData(input){
  const f = input.files[0]; if(!f) return;
  const r = new FileReader();
  r.onload = ()=>{
    try{
      const d = JSON.parse(r.result);
      if(!d.work || !d.budget) throw 0;
      S = migrate(d);
      save(); applyTheme(); render(); toast('Данные импортированы ✓');
    }catch(e){ toast('Не удалось прочитать файл'); }
  };
  r.readAsText(f);
  input.value='';
}
function resetAll(){
  const extra = syncConfigured() ? ' Данные в облаке аккаунта тоже будут перезаписаны пустыми.' : '';
  if(confirm('Точно стереть ВСЕ данные?'+extra) && confirm('Последнее подтверждение — данные будут удалены.')){
    S = DEFAULT_STATE();
    save(); // фиксируем пустое состояние (и в облаке, если вошли)
    applyTheme(); render(); toast('Данные стёрты');
  }
}
/* ================= AUTH (Supabase GoTrue, REST) ================= */
let SESSION = loadSession();
function loadSession(){
  try{ return JSON.parse(localStorage.getItem('mytracker_session')||'null'); }catch(e){ return null; }
}
function saveSession(s){
  SESSION = s;
  if(s) localStorage.setItem('mytracker_session', JSON.stringify(s));
  else localStorage.removeItem('mytracker_session');
}
function sessFromResponse(j){
  return { access_token:j.access_token, refresh_token:j.refresh_token,
    expires_at: Date.now() + (j.expires_in||3600)*1000,
    user:{ id:(j.user||{}).id, email:(j.user||{}).email } };
}
async function authRequest(path, body, _retried){
  let r;
  try{
    r = await fetch(apiBase()+'/auth/v1/'+path, {
      method:'POST',
      headers:{ 'apikey':AUTH_CONFIG.anonKey, 'Content-Type':'application/json' },
      body: JSON.stringify(body)
    });
  }catch(netErr){ // сеть/блокировка — пробуем другой путь к API
    if(!_retried){
      await resolveApiBase(true);
      return authRequest(path, body, true);
    }
    throw new Error('Нет соединения с сервером. Проверьте интернет.');
  }
  const j = await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(j.msg || j.error_description || j.message || ('Ошибка '+r.status));
  return j;
}
let refreshPromise = null;
async function ensureFreshToken(){
  if(!SESSION) return false;
  if(Date.now() < SESSION.expires_at - 300000) return true;
  if(!refreshPromise){
    refreshPromise = authRequest('token?grant_type=refresh_token', {refresh_token: SESSION.refresh_token})
      .then(j=>{ saveSession(sessFromResponse(j)); return true; })
      .catch(()=>{ // refresh-токен умер — сессия истекла
        saveSession(null);
        renderAuth('Сессия истекла — войдите снова', true);
        return false;
      });
    refreshPromise.finally(()=>{ refreshPromise = null; });
  }
  return refreshPromise;
}
async function doSignup(email, password){
  const j = await authRequest('signup', {email, password});
  if(j.access_token){ saveSession(sessFromResponse(j)); return 'ok'; }
  return 'confirm'; // требуется подтверждение почты
}
async function doLogin(email, password){
  const j = await authRequest('token?grant_type=password', {email, password});
  saveSession(sessFromResponse(j));
}
async function doLogout(){
  if(!confirm('Выйти из аккаунта? Данные на этом устройстве будут очищены (в облаке они сохранятся).')) return;
  clearTimeout(pushTimer);
  try{ await pushRemote(); }catch(e){} // дожимаем несохранённое перед выходом
  saveSession(null);
  localStorage.removeItem('mytracker_v1');
  localStorage.removeItem('mytracker_localmode');
  S = DEFAULT_STATE();
  location.reload();
}

/* --- экран входа --- */
function renderAuth(msg, isError){
  document.querySelector('.app').style.display='none';
  document.querySelector('.bottomnav').style.display='none';
  $('#modalRoot').innerHTML = `
  <div style="position:fixed;inset:0;background:var(--bg);z-index:90;display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto">
    <div class="card" style="width:100%;max-width:400px;padding:30px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px">
        <div class="logo-badge" style="width:42px;height:42px;font-size:20px">◆</div>
        <div><div style="font-weight:700;font-size:19px">Мой Трекер</div>
        <div class="sub">Работа · Проекты · Бюджет · Спорт</div></div>
      </div>
      <div class="tabs" style="margin:18px 0 16px">
        <button id="tabLogin" class="active" style="flex:1" onclick="authTab('login')">Вход</button>
        <button id="tabSignup" style="flex:1" onclick="authTab('signup')">Регистрация</button>
      </div>
      <div class="field"><label>Email</label><input id="authEmail" type="email" placeholder="you@example.com" autocomplete="username"></div>
      <div class="field"><label>Пароль</label><input id="authPass" type="password" placeholder="минимум 6 символов" autocomplete="current-password"
        onkeydown="if(event.key==='Enter')authSubmit()"></div>
      <div style="text-align:right;margin:-6px 0 10px">
        <button style="font-size:12.5px;color:var(--text3);text-decoration:underline" onclick="renderReset(1)">Забыли пароль?</button>
      </div>
      <div id="authMsg" style="font-size:13px;min-height:18px;margin-bottom:10px;color:${isError?'var(--red)':'var(--green)'}">${msg||''}</div>
      <button class="btn btn-primary" style="width:100%;justify-content:center;padding:12px" id="authBtn" onclick="authSubmit()">Войти</button>
      <div style="text-align:center;margin-top:16px">
        <button style="font-size:13px;color:var(--text3);text-decoration:underline" onclick="skipAuth()">Продолжить без аккаунта (данные только на этом устройстве)</button>
      </div>
    </div>
  </div>`;
}
let authMode = 'login';
function authTab(m){
  authMode = m;
  document.getElementById('tabLogin').classList.toggle('active', m==='login');
  document.getElementById('tabSignup').classList.toggle('active', m==='signup');
  document.getElementById('authBtn').textContent = m==='login' ? 'Войти' : 'Создать аккаунт';
  document.getElementById('authMsg').textContent = '';
}
async function authSubmit(){
  const email = document.getElementById('authEmail').value.trim();
  const pass = document.getElementById('authPass').value;
  const msg = document.getElementById('authMsg');
  if(!email || pass.length<6){ msg.style.color='var(--red)'; msg.textContent='Введите email и пароль (от 6 символов)'; return; }
  const btn = document.getElementById('authBtn');
  btn.disabled = true; btn.textContent = '…';
  try{
    if(authMode==='signup'){
      const res = await doSignup(email, pass);
      if(res==='confirm'){
        msg.style.color='var(--green)';
        msg.textContent='Письмо с подтверждением отправлено на почту. Подтвердите и войдите.';
        btn.disabled=false; authTab('login');
        return;
      }
    } else {
      await doLogin(email, pass);
    }
    await bootAfterLogin();
  }catch(e){
    msg.style.color='var(--red)';
    msg.textContent = /invalid/i.test(e.message) ? 'Неверный email или пароль' : e.message;
    btn.disabled=false; btn.textContent = authMode==='login'?'Войти':'Создать аккаунт';
  }
}
/* --- восстановление пароля по коду из письма (работает через прокси, без VPN) --- */
let resetEmail = '';
function renderReset(step, msg, isErr){
  document.querySelector('.app').style.display='none';
  document.querySelector('.bottomnav').style.display='none';
  $('#modalRoot').innerHTML = `
  <div style="position:fixed;inset:0;background:var(--bg);z-index:90;display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto">
    <div class="card" style="width:100%;max-width:400px;padding:30px">
      <div style="font-weight:700;font-size:18px;margin-bottom:6px">🔑 Восстановление пароля</div>
      <div class="sub" style="margin-bottom:18px">${step===1?'Пришлём код на вашу почту':'Введите код из письма и новый пароль'}</div>
      ${step===1 ? `
        <div class="field"><label>Email</label><input id="resetEmail" type="email" placeholder="you@example.com" value="${esc(resetEmail)}"
          onkeydown="if(event.key==='Enter')sendResetCode()"></div>`
      : step===3 ? `
        <div class="field"><label>Новый пароль</label><input id="resetPass" type="password" placeholder="минимум 6 символов" autocomplete="new-password"
          onkeydown="if(event.key==='Enter')submitNewPass()"></div>`
      : `
        <div class="hint" style="margin-bottom:12px">Мы отправили письмо. <b>Перейдите по ссылке из письма</b> — откроется форма нового пароля. Если в письме есть код — введите его ниже.</div>
        <div class="field"><label>Код из письма (если есть)</label><input id="resetToken" inputmode="numeric" placeholder="6 цифр" autocomplete="one-time-code"></div>
        <div class="field"><label>Новый пароль</label><input id="resetPass" type="password" placeholder="минимум 6 символов" autocomplete="new-password"
          onkeydown="if(event.key==='Enter')submitReset()"></div>`}
      <div id="resetMsg" style="font-size:13px;min-height:18px;margin-bottom:10px;color:${isErr?'var(--red)':'var(--green)'}">${msg||''}</div>
      <button class="btn btn-primary" style="width:100%;justify-content:center;padding:12px" id="resetBtn"
        onclick="${step===1?'sendResetCode()':step===3?'submitNewPass()':'submitReset()'}">${step===1?'Отправить письмо':'Сменить пароль и войти'}</button>
      <div style="text-align:center;margin-top:14px;display:flex;gap:14px;justify-content:center">
        ${step===2?`<button style="font-size:12.5px;color:var(--text3);text-decoration:underline" onclick="sendResetCode(true)">Отправить код ещё раз</button>`:''}
        <button style="font-size:12.5px;color:var(--text3);text-decoration:underline" onclick="renderAuth()">← Ко входу</button>
      </div>
    </div>
  </div>`;
}
async function sendResetCode(resend){
  const inp = document.getElementById('resetEmail');
  if(inp) resetEmail = inp.value.trim();
  if(!resetEmail){ renderReset(1,'Введите email',true); return; }
  const btn = document.getElementById('resetBtn'); if(btn){ btn.disabled=true; btn.textContent='…'; }
  try{
    await authRequest('recover', {email: resetEmail});
    renderReset(2, 'Письмо отправлено на '+resetEmail+' (проверьте и «Спам»)');
  }catch(e){
    renderReset(resend?2:1, /rate/i.test(e.message)?'Слишком часто — подождите минуту':e.message, true);
  }
}
async function submitReset(){
  const token = (document.getElementById('resetToken')||{}).value.trim();
  const pass = (document.getElementById('resetPass')||{}).value;
  const msg = document.getElementById('resetMsg');
  if(!token || pass.length<6){ msg.style.color='var(--red)'; msg.textContent='Введите код и пароль от 6 символов'; return; }
  const btn = document.getElementById('resetBtn'); btn.disabled=true; btn.textContent='…';
  try{
    const j = await authRequest('verify', {type:'recovery', email: resetEmail, token});
    if(!j.access_token) throw new Error('Неверный код');
    saveSession(sessFromResponse(j));
    const r = await fetch(apiBase()+'/auth/v1/user', {
      method:'PUT',
      headers:{ 'apikey':AUTH_CONFIG.anonKey, 'Authorization':'Bearer '+SESSION.access_token, 'Content-Type':'application/json' },
      body: JSON.stringify({password: pass})
    });
    if(!r.ok){ const je = await r.json().catch(()=>({})); throw new Error(je.msg||'Не удалось сменить пароль'); }
    toast('Пароль обновлён ✓');
    await bootAfterLogin();
  }catch(e){
    btn.disabled=false; btn.textContent='Сменить пароль и войти';
    msg.style.color='var(--red)';
    msg.textContent = /invalid|expired|not found/i.test(e.message)?'Код неверный или устарел — запросите новый':e.message;
  }
}

function handleRecoveryHash(){
  try{
    const p = new URLSearchParams(location.hash.slice(1));
    if(!p.get('access_token')) return false;
    saveSession({
      access_token: p.get('access_token'),
      refresh_token: p.get('refresh_token') || '',
      expires_at: Date.now() + (parseInt(p.get('expires_in')||'3600',10))*1000,
      user: { id:'', email:'' }
    });
    history.replaceState(null, '', location.pathname);
    renderReset(3, 'Ссылка принята — задайте новый пароль');
    return true;
  }catch(e){ return false; }
}
async function submitNewPass(){
  const pass = (document.getElementById('resetPass')||{}).value;
  const msg = document.getElementById('resetMsg');
  if(pass.length<6){ msg.style.color='var(--red)'; msg.textContent='Пароль от 6 символов'; return; }
  const btn = document.getElementById('resetBtn'); btn.disabled=true; btn.textContent='…';
  try{
    const hdrs = { 'apikey':AUTH_CONFIG.anonKey, 'Authorization':'Bearer '+SESSION.access_token, 'Content-Type':'application/json' };
    const r = await fetch(apiBase()+'/auth/v1/user', {method:'PUT', headers:hdrs, body:JSON.stringify({password:pass})});
    if(!r.ok){ const je = await r.json().catch(()=>({})); throw new Error(je.msg||'Ссылка устарела — запросите новую'); }
    const u = await fetch(apiBase()+'/auth/v1/user', {headers:hdrs}).then(x=>x.json());
    SESSION.user = { id:u.id, email:u.email };
    saveSession(SESSION);
    toast('Пароль обновлён ✓');
    await bootAfterLogin();
  }catch(e){
    btn.disabled=false; btn.textContent='Сменить пароль и войти';
    msg.style.color='var(--red)'; msg.textContent = e.message;
  }
}

function skipAuth(){
  localStorage.setItem('mytracker_localmode','1');
  enterApp();
}
function backToAuth(){
  localStorage.removeItem('mytracker_localmode');
  renderAuth();
}
async function bootAfterLogin(){
  localStorage.removeItem('mytracker_localmode');
  try{
    const remote = await pullRemote();
    if(remote && remote.data && (remote.data.updatedAt||0) > (S.updatedAt||0)){
      S = migrate(remote.data);
      localStorage.setItem('mytracker_v1', JSON.stringify(S));
    } else if(!remote && !isEmptyState()){
      await pushRemote(); // переносим локальные данные в новый аккаунт
    } else if(!remote){
      await pushRemote();
    }
  }catch(e){}
  saveBase(S);
  enterApp();
  toast('Вы вошли: '+(SESSION&&SESSION.user.email||''));
}
function enterApp(){
  document.querySelector('.app').style.display='';
  document.querySelector('.bottomnav').style.display='';
  $('#modalRoot').innerHTML='';
  applyTheme(); render();
  maybeTour();
}

/* --- sync (для аккаунта, last-write-wins) --- */
function syncConfigured(){ return authConfigured() && !!SESSION; }
let cloudSafe = false; // push разрешён только после успешного чтения облака (защита от затирания)
function dataHeaders(){
  return {'apikey':AUTH_CONFIG.anonKey, 'Authorization':'Bearer '+SESSION.access_token, 'Content-Type':'application/json'};
}
async function pullRemote(){
  if(!await ensureFreshToken()) throw new Error('token');
  const r = await fetch(apiBase()+'/rest/v1/user_state?select=data,updated_at', {headers:dataHeaders()});
  if(!r.ok) throw new Error('pull '+r.status);
  const rows = await r.json();
  cloudSafe = true;
  return rows[0] || null;
}
async function pushRemote(){
  if(!cloudSafe) throw new Error('not pulled yet');
  if(!await ensureFreshToken()) throw new Error('token');
  const r = await fetch(apiBase()+'/rest/v1/user_state', {
    method:'POST',
    headers:{...dataHeaders(), 'Prefer':'resolution=merge-duplicates'},
    body: JSON.stringify({user_id:SESSION.user.id, data:S, updated_at:new Date().toISOString()})
  });
  if(!r.ok) throw new Error('push '+r.status);
}
let pushTimer;
function schedulePush(){
  if(!syncConfigured() || !cloudSafe) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(()=> pushRemote().catch(()=>{}), 2500);
}
/* --- merge-синхронизация: слияние изменений по элементам через базовый снимок --- */
const SYNC_COLLECTIONS = ['work.yearGoals','work.quarterGoals','work.weekFocuses','work.dayTasks','work.team','work.teamTasks','work.recurring','work.projects',
  'personal.yearGoals','personal.projects','personal.tasks','personal.weekFocuses','personal.people','personal.ideas','personal.businesses',
  'budget.plan','budget.planned','budget.transactions','budget.debts','budget.savings','sport.workouts','sport.goals','templates',
  'health.metrics','health.vitamins','health.checkups','learn.books','learn.courses','travel.wishlist','travel.trips','people.contacts','mood','reviews'];
const SYNC_SCALARS = ['settings','budget.categories','budget.catIcons','sport.types','sport.weeklyGoal','health.vitaminLog'];
function getPath(o,p){ return p.split('.').reduce((a,k)=>a&&a[k], o); }
function setPath(o,p,v){ const ks=p.split('.'); const last=ks.pop(); const t=ks.reduce((a,k)=>a[k], o); t[last]=v; }
function stateSig(s){ const c = Object.assign({}, s); delete c.updatedAt; return JSON.stringify(c); }
function loadBase(){ try{ return JSON.parse(localStorage.getItem('mytracker_base')||'null'); }catch(e){ return null; } }
function saveBase(s){ try{ localStorage.setItem('mytracker_base', JSON.stringify(s)); }catch(e){} }
function mergeStates(base, local, remote){
  const out = JSON.parse(JSON.stringify(remote));
  const localNewer = (local.updatedAt||0) >= (remote.updatedAt||0);
  SYNC_COLLECTIONS.forEach(p=>{
    const b = getPath(base,p)||[], l = getPath(local,p)||[], r = getPath(remote,p)||[];
    const bm = new Map(b.map(x=>[x.id, JSON.stringify(x)]));
    const lm = new Map(l.map(x=>[x.id, x]));
    const rm = new Map(r.map(x=>[x.id, x]));
    const decide = id => {
      const inL = lm.has(id), inR = rm.has(id), bj = bm.get(id);
      if(inL && inR){
        const lj = JSON.stringify(lm.get(id)), rj = JSON.stringify(rm.get(id));
        if(lj===rj) return lm.get(id);
        if(bj===rj) return lm.get(id);       // менялся только локально
        if(bj===lj) return rm.get(id);       // менялся только на другом устройстве
        return localNewer ? lm.get(id) : rm.get(id); // правили оба — берём более свежее состояние
      }
      if(inL){ // нет на сервере
        if(bj===undefined) return lm.get(id);              // новый локальный
        if(bj!==JSON.stringify(lm.get(id))) return lm.get(id); // локально правили, там удалили — сохраняем
        return null;                                        // удалено на другом устройстве
      }
      // есть только на сервере
      if(bj===undefined) return rm.get(id);                 // новый с другого устройства
      if(bj!==JSON.stringify(rm.get(id))) return rm.get(id);// там правили, тут удалили — сохраняем
      return null;                                          // удалено локально
    };
    const merged = []; const seen = new Set();
    l.forEach(x=>{ const k = decide(x.id); seen.add(x.id); if(k) merged.push(k); });
    r.forEach(x=>{ if(seen.has(x.id)) return; const k = decide(x.id); if(k) merged.push(k); });
    setPath(out, p, JSON.parse(JSON.stringify(merged)));
  });
  SYNC_SCALARS.forEach(p=>{
    const bj = JSON.stringify(getPath(base,p));
    const lv = getPath(local,p), rv = getPath(remote,p);
    const lj = JSON.stringify(lv), rj = JSON.stringify(rv);
    let v; if(lj===rj) v = lv; else if(bj===rj) v = lv; else if(bj===lj) v = rv; else v = localNewer ? lv : rv;
    setPath(out, p, JSON.parse(JSON.stringify(v)));
  });
  // имя пользователя не теряем ни при каком исходе слияния
  if(!out.settings.userName){
    out.settings.userName = (local.settings&&local.settings.userName) || (remote.settings&&remote.settings.userName) || '';
  }
  out.updatedAt = Date.now();
  return migrate(out);
}

let syncBusy = false;
async function syncNow(verbose){
  if(!syncConfigured()){ if(verbose) toast('Войдите в аккаунт для синхронизации'); return; }
  if(syncBusy) return;
  if(document.getElementById('modalForm')) return; // не подменяем данные под открытой формой
  syncBusy = true;
  try{
    const remote = await pullRemote();
    if(!remote || !remote.data){
      await pushRemote(); saveBase(S);
      if(verbose) toast('Синхронизировано ✓');
      return;
    }
    const remoteState = migrate(JSON.parse(JSON.stringify(remote.data)));
    if(stateSig(remoteState) === stateSig(S)){ saveBase(S); if(verbose) toast('Всё синхронизировано ✓'); return; }
    const base = loadBase();
    let next;
    if(base){
      next = mergeStates(base, S, remoteState); // умное слияние — правки с обоих устройств сохраняются
    } else {
      next = (remoteState.updatedAt||0) > (S.updatedAt||0) ? remoteState : S; // первый запуск: старое поведение
    }
    const changed = stateSig(next) !== stateSig(S);
    S = next;
    localStorage.setItem('mytracker_v1', JSON.stringify(S));
    await pushRemote();
    saveBase(S);
    if(changed){ applyTheme(); render(); }
    if(verbose) toast(changed ? 'Изменения объединены ✓' : 'Синхронизировано ✓');
  }catch(e){
    resolveApiBase(true).catch(()=>{}); // возможно, провайдер заблокировал текущий путь — ищем другой
    if(verbose) toast('Ошибка синхронизации — проверьте интернет');
  }finally{
    syncBusy = false;
  }
}

/* ================= БЭКАПЫ ================= */
function dailyBackup(){
  try{
    if(isEmptyState()) return;
    const key = 'mytracker_bak_' + todayStr();
    if(!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(S));
    const baks = Object.keys(localStorage).filter(k=>k.startsWith('mytracker_bak_')).sort();
    while(baks.length > 7){ localStorage.removeItem(baks.shift()); }
  }catch(e){}
}
function listBackups(){
  return Object.keys(localStorage).filter(k=>k.startsWith('mytracker_bak_')).sort().reverse();
}
function restoreBackup(key){
  if(!confirm('Восстановить данные из копии за '+fmtDate(key.replace('mytracker_bak_',''))+'? Текущие данные будут заменены (и синхронизированы).')) return;
  try{
    S = migrate(JSON.parse(localStorage.getItem(key)));
    save(); applyTheme(); render(); toast('Восстановлено из копии ✓');
  }catch(e){ toast('Не удалось прочитать копию'); }
}

/* ================= МОНИТОРИНГ ОШИБОК ================= */
let _errLogged = 0;
function logClientError(msg, stack){
  if(_errLogged >= 5 || !authConfigured()) return;
  _errLogged++;
  try{
    fetch(apiBase() + '/rest/v1/client_errors', {
      method:'POST',
      headers:{ 'apikey':AUTH_CONFIG.anonKey, 'Content-Type':'application/json', 'Prefer':'return=minimal' },
      body: JSON.stringify({
        message: String(msg||'').slice(0,500),
        stack: String(stack||'').slice(0,2000),
        url: (typeof location!=='undefined'?location.href:'').slice(0,300),
        ua: (typeof navigator!=='undefined'?navigator.userAgent:'').slice(0,200),
        email: SESSION && SESSION.user ? SESSION.user.email : null
      })
    }).catch(()=>{});
  }catch(e){}
}
if(typeof window!=='undefined' && window.addEventListener){
  window.addEventListener('error', e=>logClientError(e.message, e.error && e.error.stack));
  window.addEventListener('unhandledrejection', e=>logClientError('promise: '+(e.reason && e.reason.message || e.reason), e.reason && e.reason.stack));
  window.addEventListener('online', ()=>{ toast('Снова в сети — синхронизирую…'); syncNow(false); });
  window.addEventListener('offline', ()=>toast('Нет сети — работаем офлайн, изменения сохранятся'));
}
if(typeof navigator!=='undefined' && 'serviceWorker' in navigator){
  try{ navigator.serviceWorker.register('sw.js').catch(()=>{}); }catch(e){}
}

/* ================= INIT ================= */
applyTheme();
dailyBackup();
if(authConfigured()){ resolveApiBase(false).catch(()=>{}); }
if(authConfigured() && typeof location!=='undefined' && /type=recovery/.test(location.hash||'') && handleRecoveryHash()){
  // пользователь пришёл по ссылке восстановления — форма нового пароля уже показана
} else if(authConfigured() && !SESSION && !localStorage.getItem('mytracker_localmode')){
  renderAuth();
  if(location.hash==='#signup'){ // переход с лендинга «Начать бесплатно»
    setTimeout(()=>{ try{ authTab('signup'); }catch(e){} }, 50);
    history.replaceState(null,'',location.pathname);
  }
} else {
  render();
  syncNow(false).finally(()=>maybeTour()); // сначала подтягиваем облако — там может быть имя
}
setInterval(()=>syncNow(false), 120000); // авто-подтяжка каждые 2 мин
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) syncNow(false); });