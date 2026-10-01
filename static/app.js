let currentTab="overview", currentLocation=null;

function showTab(id){
  currentTab=id;
  document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x.id===id));
  document.querySelectorAll(".nav").forEach(x=>x.classList.toggle("active",x.dataset.tab===id));
  const names={overview:"Good to have you here.",route:"Plan a safer route.",sos:"Emergency support center.",report:"Report a safety incident.",commute:"Monitor a commute.",health:"Emergency health profile."};
  document.getElementById("pageTitle").textContent=names[id]||"SafeLife 360";
  if(id==="report") loadReports();
  if(id==="commute") loadCommutes();
}
document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>showTab(b.dataset.tab));

function useLocation(){
 navigator.geolocation?.getCurrentPosition(p=>{
   currentLocation={lat:p.coords.latitude,lon:p.coords.longitude};
   document.getElementById("locState")?.replaceChildren(document.createTextNode("Location attached"));
 },e=>alert("Location permission was not available: "+e.message),{enableHighAccuracy:true,timeout:10000});
}

async function findRoute(){
 const msg=document.getElementById("routeMsg"); msg.textContent="Looking up places and calculating a real road route…";
 try{
  const r=await fetch("/api/route",{method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({start:start.value,destination:destination.value})});
  const d=await r.json(); if(!r.ok) throw Error(d.error);
  routeDistance.textContent=d.distance_km+" km";
  routeTime.textContent="Estimated road time: "+d.duration_min+" minutes • "+d.start+" → "+d.destination;
  msg.textContent="Route calculated from live OpenStreetMap/OSRM services.";
 }catch(e){msg.textContent=e.message}
}

async function submitReport(){
 const msg=document.getElementById("reportMsg");
 try{
  const r=await fetch("/api/incidents",{method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({category:category.value,description:description.value,lat:currentLocation?.lat,lon:currentLocation?.lon})});
  const d=await r.json(); if(!r.ok) throw Error(d.error);
  msg.textContent="Report stored successfully in this deployment.";
  description.value=""; loadReports(); refreshStats();
 }catch(e){msg.textContent=e.message}
}

async function loadReports(){
 const r=await fetch("/api/incidents"), data=await r.json(), box=document.getElementById("reports");
 box.innerHTML=data.length?data.slice(0,8).map(x=>`<div class="item"><b>${escapeHtml(x.category)}</b><span>${escapeHtml(x.description)}${x.lat!=null?" • location attached":""}</span></div>`).join(""):"<p>No reports have been submitted yet.</p>";
}
async function startCommute(){
 const msg=document.getElementById("commuteMsg");
 try{
  const r=await fetch("/api/commute",{method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({start:cstart.value,destination:cdest.value,vehicle:vehicle.value,contact:contact.value})});
  const d=await r.json(); if(!r.ok) throw Error(d.error);
  msg.textContent="Commute monitoring record created. Status: "+d.status; loadCommutes(); refreshStats();
 }catch(e){msg.textContent=e.message}
}
async function loadCommutes(){
 const r=await fetch("/api/commutes"),data=await r.json(),box=document.getElementById("commutes");
 box.innerHTML=data.length?data.map(x=>`<div class="item"><b>${escapeHtml(x.start)} → ${escapeHtml(x.destination)}</b><span>${escapeHtml(x.vehicle||"Vehicle not provided")} • ${escapeHtml(x.status)}</span></div>`).join(""):"<p>No commute sessions yet.</p>";
}
async function saveHealth(){
 const r=await fetch("/api/health",{method:"POST",headers:{"Content-Type":"application/json"},
 body:JSON.stringify({name:hname.value,blood_group:blood.value,allergies:allergies.value,conditions:conditions.value,emergency_contact:emergency.value})});
 healthMsg.textContent=r.ok?"Emergency profile saved in this deployment.":"Could not save profile.";
 refreshStats();
}
async function loadHealth(){
 const r=await fetch("/api/health"),d=await r.json();
 if(d.name){hname.value=d.name;blood.value=d.blood_group||"";allergies.value=d.allergies||"";conditions.value=d.conditions||"";emergency.value=d.emergency_contact||""}
}
async function refreshStats(){
 const r=await fetch("/api/stats"),d=await r.json();
 incidentCount.textContent=d.incidents;commuteCount.textContent=d.commutes;
 const h=await fetch("/api/health").then(x=>x.json());healthState.textContent=h.name?"Configured":"Not set";
}
function prepareSOS(){
 sosMsg.textContent="SOS workflow prepared. Current location can be captured with “Use my location”. No emergency service is contacted by this web demo unless a real provider is configured.";
 useLocation();
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
loadHealth();refreshStats();loadReports();

// ---------- SOS enhancements ----------
let voiceRecognition=null, voiceRunning=false, shakeEnabled=false, lastShake=0;

function getEmergencyContact(){
  return (document.getElementById('emergency')?.value || '').trim();
}
function sosText(){
  const loc=currentLocation ? `Location: https://maps.google.com/?q=${currentLocation.lat},${currentLocation.lon}` : 'Location: not captured';
  return `SafeLife 360 SOS: I may need help. ${loc}`;
}
function callEmergencyContact(){
  const c=getEmergencyContact();
  if(!c){ alert('First save an emergency contact in Health Profile.'); showTab('health'); return; }
  window.location.href='tel:'+c.replace(/[^+\d]/g,'');
}
function sendSOSSMS(){
  const c=getEmergencyContact();
  if(!c){ alert('First save an emergency contact in Health Profile.'); showTab('health'); return; }
  const body=encodeURIComponent(sosText());
  window.location.href=`sms:${c.replace(/[^+\d]/g,'')}?body=${body}`;
}
function shareSOSWhatsApp(){
  const body=encodeURIComponent(sosText());
  window.open(`https://wa.me/?text=${body}`,'_blank','noopener');
}
function updateSOSLocation(){
  const el=document.getElementById('sosLocation');
  if(el) el.textContent=currentLocation ? `Captured: ${currentLocation.lat.toFixed(6)}, ${currentLocation.lon.toFixed(6)}` : 'Location not captured';
}

// Wrap the existing location callback by reusing currentLocation after every call.
const _originalUseLocation=useLocation;
useLocation=function(){
  navigator.geolocation?.getCurrentPosition(p=>{
    currentLocation={lat:p.coords.latitude,lon:p.coords.longitude};
    document.getElementById('locState')?.replaceChildren(document.createTextNode('Location attached'));
    updateSOSLocation();
  },e=>alert('Location permission was not available: '+e.message),{enableHighAccuracy:true,timeout:10000});
};

function toggleVoiceSOS(){
  const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  const state=document.getElementById('voiceState'), btn=document.getElementById('voiceBtn');
  if(!SpeechRecognition){ state.textContent='Voice recognition is not supported by this browser.'; return; }
  if(voiceRunning){ voiceRecognition?.stop(); voiceRunning=false; btn.textContent='Start voice trigger'; state.textContent='Voice trigger stopped.'; return; }
  voiceRecognition=new SpeechRecognition();
  voiceRecognition.continuous=true; voiceRecognition.interimResults=false; voiceRecognition.lang='en-IN';
  voiceRecognition.onresult=(e)=>{
    for(let i=e.resultIndex;i<e.results.length;i++){
      const text=e.results[i][0].transcript.toLowerCase();
      if(text.includes('safelife sos') || text.includes('safe life sos') || text.includes('sos')){
        prepareSOS(); state.textContent='SOS phrase detected. Emergency actions are ready.'; break;
      }
    }
  };
  voiceRecognition.onerror=(e)=>state.textContent='Voice error: '+e.error;
  voiceRecognition.onend=()=>{ if(voiceRunning){ try{voiceRecognition.start()}catch(_){} } };
  try{ voiceRecognition.start(); voiceRunning=true; btn.textContent='Stop voice trigger'; state.textContent='Listening for “SafeLife SOS”…'; }
  catch(e){ state.textContent='Could not start microphone: '+e.message; }
}

async function enableShakeSOS(){
  const state=document.getElementById('shakeState'), btn=document.getElementById('shakeBtn');
  if(!('DeviceMotionEvent' in window)){ state.textContent='Motion detection is not supported by this browser.'; return; }
  try{
    if(typeof DeviceMotionEvent.requestPermission==='function'){
      const permission=await DeviceMotionEvent.requestPermission();
      if(permission!=='granted'){ state.textContent='Motion permission was denied.'; return; }
    }
    if(!shakeEnabled){
      window.addEventListener('devicemotion',handleShake,{passive:true}); shakeEnabled=true; btn.textContent='Disable shake trigger'; state.textContent='Shake trigger enabled while this page is open.';
    }else{
      window.removeEventListener('devicemotion',handleShake); shakeEnabled=false; btn.textContent='Enable shake trigger'; state.textContent='Shake trigger disabled.';
    }
  }catch(e){ state.textContent='Could not enable motion detection: '+e.message; }
}
function handleShake(e){
  const a=e.accelerationIncludingGravity||e.acceleration; if(!a) return;
  const magnitude=Math.sqrt((a.x||0)**2+(a.y||0)**2+(a.z||0)**2);
  const now=Date.now();
  if(magnitude>25 && now-lastShake>2500){ lastShake=now; prepareSOS(); document.getElementById('shakeState').textContent='Strong shake detected. SOS workflow prepared.'; }
}

async function loadSOSProfile(){
  try{
    const d=await fetch('/api/health').then(r=>r.json());
    const el=document.getElementById('sosProfile');
    if(el) el.textContent=d.emergency_contact ? `Emergency contact configured: ${d.emergency_contact}` : 'Configure an emergency contact in Health Profile to enable contact call/SMS actions.';
  }catch(_){ }
}
const _oldShowTab=showTab;
showTab=function(id){ _oldShowTab(id); if(id==='sos') loadSOSProfile(); };
loadSOSProfile();
