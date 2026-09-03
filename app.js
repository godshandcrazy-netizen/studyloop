const lessons=[
{t:"몽골족의 성장",icon:"📖",c:"요가 멸망하고 금과 송이 대립하고 있을 때 북방에서는 몽골족이 성장하였다. 13세기 초 테무친은 몽골 부족을 통일한 후 칭기즈 칸으로 추대되어 몽골 제국을 세웠다(1206).",q:"칭기즈 칸으로 추대된 해는?",a:["1206년","1271년","1279년"],ok:0},
{t:"칭기즈 칸",icon:"👤",c:"칭기즈 칸의 본명은 테무친이다. 몽골의 여러 부족을 통합하고 세력을 확대하여 1206년 부족장 회의인 쿠릴타이에서 칭기즈 칸으로 추대되었다.",q:"칭기즈 칸의 본명은?",a:["테무친","쿠빌라이","훌라구"],ok:0},
{t:"몽골 제국의 영역",icon:"🗺️",c:"칭기즈 칸이 죽은 뒤에도 칸들은 영토를 계속 확장하였다. 몽골 제국은 금을 멸망시키고 유럽까지 공격하였으며 서아시아의 아바스 왕조를 정복하였다. 그 뒤 여러 울루스가 분할 통치하였다.",q:"울루스는 무엇을 가리키는 말인가?",a:["몽골의 부족 집단","수도의 이름","군량"],ok:0},
{t:"쿠빌라이 칸과 원",icon:"🏯",c:"쿠빌라이 칸은 수도를 대도(베이징)로 옮기고 나라 이름을 원으로 바꾸었다(1271). 이어 남송을 멸망시키고 중국 전역을 지배하였다.",q:"원이 건국된 해는?",a:["1206년","1271년","1279년"],ok:1},
{t:"몽골군의 강점",icon:"🏹",c:"몽골군은 여러 마리의 말을 갈아타며 장거리를 이동했고 보르츠로 군량의 무게를 줄였다. 가볍고 단단한 갑옷을 입고 활·휘어진 칼·투석기 등을 사용했으며, 이슬람 상인의 교역로를 보장하는 대가로 군사와 지리 정보를 얻었다.",q:"이슬람 상인에게서 얻은 것은?",a:["군사와 지리 정보","왕위 계승권","군량"],ok:0}
];

const cfg=window.STUDYLOOP_CONFIG||{};
let sb=null,user=null,profile=null,current=0,answered=false;
const $=id=>document.getElementById(id);

async function init(){
 if(!cfg.SUPABASE_URL||!cfg.SUPABASE_PUBLISHABLE_KEY){
   $("setupMsg").textContent="Supabase 연결값이 아직 설정되지 않았어.";
   return;
 }
 sb=supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY);
 let {data:{session}}=await sb.auth.getSession();
 if(!session){
   const r=await sb.auth.signInAnonymously();
   if(r.error){$("setupMsg").textContent=r.error.message;return;}
   session=r.data.session;
 }
 user=session.user;
 const {data}=await sb.from("profiles").select("*").eq("id",user.id).maybeSingle();
 if(data){profile=data;showApp();}
}

$("begin").onclick=async()=>{
 if(!sb){$("setupMsg").textContent="Supabase 연결 설정이 필요해.";return}
 const name=$("name").value.trim(),goal=Number($("goal").value);
 if(!name||goal<0||goal>100){$("setupMsg").textContent="이름과 0~100 사이 목표 점수를 입력해.";return}
 const row={id:user.id,name,target_score:goal,xp:0};
 const {data,error}=await sb.from("profiles").upsert(row).select().single();
 if(error){$("setupMsg").textContent=error.message;return}
 profile=data;
 showApp();
};

function showApp(){
 $("setup").classList.add("hidden");
 $("app").classList.remove("hidden");
 render();
}

function plan(goal){
 if(goal>=95)return [["완전 암기","개념·연표·용어 정밀 학습"],["자료 분석","지도·인물·사료 집중"],["고난도","복합 선지 반복"],["오답 압축","취약 개념 재학습"],["실전","95% 이상 정답률 목표"]];
 if(goal>=85)return [["핵심 개념","개념 1~2회독"],["기본 문제","객관식·연표"],["자료 문제","지도·인물"],["오답 복습","틀린 개념 반복"],["실전","85% 이상 정답률 목표"]];
 return [["필수 개념","핵심어 우선"],["기본 문제","쉬운 문제부터"],["반복","같은 개념 재확인"],["취약점","오답 집중"],["점검",goal+"점 목표 마무리"]];
}

async function getProgress(){
 const {data,error}=await sb.from("lesson_progress")
   .select("*")
   .eq("user_id",user.id);
 if(error){
   console.error(error);
   return [];
 }
 return data||[];
}

async function render(){
 $("xp").textContent=profile.xp;
 $("goalTop").textContent=profile.target_score;
 $("hello").textContent=profile.name+" · 목표 "+profile.target_score+"점";
 $("profileName").textContent=profile.name;
 $("profileGoal").textContent="목표 "+profile.target_score+"점";
 $("profileXp").textContent=profile.xp+" XP";
 $("curriculum").innerHTML=plan(profile.target_score).map(x=>`<div class="curr"><b>${x[0]}</b><br><small>${x[1]}</small></div>`).join("");

 const prog=await getProgress();
 const unitCompleted=lessons.every((_,i)=>{
   const p=prog.find(x=>x.lesson_id===String(i));
   return p && p.completed===true;
 });

 // 이 단원은 모든 단계를 끝냈을 때만 완료 체크가 보인다.
 $("path").innerHTML=lessons.map((l,i)=>`
   <div class="nodeRow">
     <button class="node ${unitCompleted?'done':''}" data-i="${i}">
       ${unitCompleted?'✓':l.icon}
     </button>
   </div>
 `).join("");

 document.querySelectorAll(".node").forEach(b=>b.onclick=()=>openLesson(+b.dataset.i));
 await loadRanking();
}

function openLesson(i){
 current=i;
 answered=false;
 let l=lessons[i];
 $("ltitle").textContent=l.t;
 $("concept").textContent=l.c;
 $("question").textContent=l.q;
 $("bar").style.width=((i+1)/lessons.length*100)+"%";
 $("answers").innerHTML=l.a.map((x,j)=>`<button class="ans" data-i="${j}">${j+1}. ${x}</button>`).join("");
 $("feedback").textContent="";
 $("next").classList.add("hidden");
 document.querySelectorAll(".ans").forEach(b=>b.onclick=()=>answer(b));
 $("lesson").classList.remove("hidden");
}

async function answer(b){
 if(answered)return;
 answered=true;

 let l=lessons[current],
     i=+b.dataset.i,
     all=[...document.querySelectorAll(".ans")];

 all[l.ok].classList.add("good");

 if(i!==l.ok){
   b.classList.add("bad");
   $("feedback").textContent="오답. 정답을 확인하고 다시 복습해.";
   $("next").classList.remove("hidden");
   return;
 }

 // 이미 이 단계에서 XP를 받은 적이 있는지 확인한다.
 let prog=await getProgress();
 let existing=prog.find(x=>x.lesson_id===String(current));
 let firstCorrect=!existing || existing.best_score<100;

 if(firstCorrect){
   profile.xp+=20;
   const {error:xpError}=await sb.from("profiles")
     .update({xp:profile.xp})
     .eq("id",user.id);

   if(xpError){
     console.error(xpError);
     profile.xp-=20;
   }
 }

 // 정답은 기록하지만 아직 레슨 완료(completed)는 아니다.
 const {error:progressError}=await sb.from("lesson_progress").upsert({
   user_id:user.id,
   lesson_id:String(current),
   completed:false,
   best_score:100,
   updated_at:new Date().toISOString()
 });

 if(progressError)console.error(progressError);

 // 다시 읽어서 5단계를 전부 정답 처리했는지 확인한다.
 prog=await getProgress();
 const allCorrect=lessons.every((_,idx)=>{
   const p=prog.find(x=>x.lesson_id===String(idx));
   return p && p.best_score>=100;
 });

 if(allCorrect){
   const now=new Date().toISOString();
   const rows=lessons.map((_,idx)=>({
     user_id:user.id,
     lesson_id:String(idx),
     completed:true,
     best_score:100,
     updated_at:now
   }));
   const {error}=await sb.from("lesson_progress").upsert(rows);
   if(error)console.error(error);
   $("feedback").textContent=(firstCorrect?"정답! +20 XP":"정답!")+" · 레슨 완료!";
 }else{
   $("feedback").textContent=firstCorrect?"정답! +20 XP":"정답! 이 문제의 XP는 이미 받았어.";
 }

 $("next").classList.remove("hidden");
 await render();
}

$("next").onclick=()=>{
 if(current<lessons.length-1){
   openLesson(current+1);
 }else{
   $("lesson").classList.add("hidden");
 }
};

$("close").onclick=()=>{
 // 중간에 나가도 레슨 완료로 처리되지 않는다.
 $("lesson").classList.add("hidden");
};

document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>{
 document.querySelectorAll("nav button").forEach(x=>x.classList.remove("active"));
 b.classList.add("active");
 document.querySelectorAll(".page").forEach(x=>x.classList.remove("active"));
 $(b.dataset.page).classList.add("active");
});

function code(){
 return Math.random().toString(36).slice(2,8).toUpperCase();
}

$("createRoom").onclick=async()=>{
 let name=$("roomName").value.trim()||"공부방",c=code();
 let {data,error}=await sb.from("rooms").insert({code:c,name,owner_id:user.id}).select().single();
 if(error){$("roomInfo").textContent=error.message;return}
 await sb.from("room_members").insert({room_id:data.id,user_id:user.id});
 $("roomInfo").textContent=`${name} 방 코드: ${c}`;
 loadRanking(data.id);
};

$("joinRoom").onclick=async()=>{
 let c=$("roomCode").value.trim().toUpperCase();
 let {data:r,error}=await sb.from("rooms").select("*").eq("code",c).maybeSingle();
 if(error||!r){$("roomInfo").textContent="방을 찾지 못했어.";return}
 let x=await sb.from("room_members").upsert({room_id:r.id,user_id:user.id});
 if(x.error){$("roomInfo").textContent=x.error.message;return}
 $("roomInfo").textContent=`${r.name} 참가 완료 · ${r.code}`;
 loadRanking(r.id);
};

async function loadRanking(roomId=null){
 if(!roomId){
   let {data:m}=await sb.from("room_members").select("room_id").eq("user_id",user.id).limit(1);
   roomId=m&&m[0]?m[0].room_id:null;
 }
 if(!roomId){
   $("ranking").innerHTML="<p>방을 만들거나 코드로 참가해.</p>";
   return;
 }
 let {data:members}=await sb.from("room_members").select("user_id").eq("room_id",roomId);
 let ids=(members||[]).map(x=>x.user_id);
 if(!ids.length)return;

 let {data:ps}=await sb.from("profiles").select("id,name,xp").in("id",ids);
 ps=(ps||[]).sort((a,b)=>b.xp-a.xp);
 $("ranking").innerHTML=ps.map((p,i)=>`<div class="rankrow"><b>${i+1}</b><span>${p.name}${p.id===user.id?" (나)":""}</span><b>${p.xp} XP</b></div>`).join("");
}

init();
