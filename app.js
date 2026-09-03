const lessons=[
{t:"몽골족의 성장",icon:"📖",c:"요가 멸망하고 금과 송이 대립하고 있을 때 북방에서는 몽골족이 성장하였다. 13세기 초 테무친은 몽골 부족을 통일한 후 칭기즈 칸으로 추대되어 몽골 제국을 세웠다(1206).",q:"칭기즈 칸으로 추대된 해는?",a:["1206년","1271년","1279년"],ok:0},
{t:"칭기즈 칸",icon:"👤",c:"칭기즈 칸의 본명은 테무친이다. 몽골의 여러 부족을 통합하고 세력을 확대하여 1206년 부족장 회의인 쿠릴타이에서 칭기즈 칸으로 추대되었다.",q:"칭기즈 칸의 본명은?",a:["테무친","쿠빌라이","훌라구"],ok:0},
{t:"몽골 제국의 영역",icon:"🗺️",c:"칭기즈 칸이 죽은 뒤에도 칸들은 영토를 계속 확장하였다. 몽골 제국은 금을 멸망시키고 유럽까지 공격하였으며 서아시아의 아바스 왕조를 정복하였다. 그 뒤 여러 울루스가 분할 통치하였다.",q:"울루스는 무엇을 가리키는 말인가?",a:["몽골의 부족 집단","수도의 이름","군량"],ok:0},
{t:"쿠빌라이 칸과 원",icon:"🏯",c:"쿠빌라이 칸은 수도를 대도(베이징)로 옮기고 나라 이름을 원으로 바꾸었다(1271). 이어 남송을 멸망시키고 중국 전역을 지배하였다.",q:"원이 건국된 해는?",a:["1206년","1271년","1279년"],ok:1},
{t:"몽골군의 강점",icon:"🏹",c:"몽골군은 여러 마리의 말을 갈아타며 장거리를 이동했고 보르츠로 군량의 무게를 줄였다. 가볍고 단단한 갑옷을 입고 활·휘어진 칼·투석기 등을 사용했으며, 이슬람 상인의 교역로를 보장하는 대가로 군사와 지리 정보를 얻었다.",q:"이슬람 상인에게서 얻은 것은?",a:["군사와 지리 정보","왕위 계승권","군량"],ok:0}
];

const cfg=window.STUDYLOOP_CONFIG||{};
let sb=null,user=null,profile=null,current=0,answered=false,currentRoom=null;
const $=id=>document.getElementById(id);

async function init(){
  if(!cfg.SUPABASE_URL||!cfg.SUPABASE_PUBLISHABLE_KEY){
    $("setupMsg").textContent="Supabase 연결값이 아직 설정되지 않았어.";
    return;
  }

  sb=supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_PUBLISHABLE_KEY);

  const {data:{session}}=await sb.auth.getSession();

  if(session){
    user=session.user;
    const {data}=await sb.from("profiles").select("*").eq("id",user.id).maybeSingle();
    if(data){
      profile=data;
      showApp();
      await getCurrentRoom();
      renderRoomState();
  renderRoomBanner();
      renderRoomBanner();
      await render();
      return;
    }
  }

  $("setup").classList.remove("hidden");
  $("app").classList.add("hidden");
}




function normalizeId(raw){
  return raw.trim().toLowerCase().replace(/[^a-z0-9._-]/g,"");
}

function idToEmail(id){
  return `${id}@studyloop.local`;
}

$("showSignupBtn").onclick=()=>{
  $("authTitle").textContent="회원가입";
  $("loginFields").classList.add("hidden");
  $("signupFields").classList.remove("hidden");
  $("setupMsg").textContent="";
};

$("showLoginBtn").onclick=()=>{
  $("authTitle").textContent="로그인";
  $("signupFields").classList.add("hidden");
  $("loginFields").classList.remove("hidden");
  $("setupMsg").textContent="";
};

$("signupBtn").onclick=async()=>{
  const id=normalizeId($("signupId").value);
  const pw=$("signupPw").value;
  const name=$("signupName").value.trim();
  const goal=Number($("signupGoal").value);

  if(id.length<3){
    $("setupMsg").textContent="아이디는 영문/숫자로 3자 이상 입력해.";
    return;
  }
  if(pw.length<6){
    $("setupMsg").textContent="비밀번호는 6자 이상이어야 해.";
    return;
  }
  if(!name){
    $("setupMsg").textContent="이름을 입력해.";
    return;
  }
  if(goal<0||goal>100){
    $("setupMsg").textContent="목표 점수는 0~100 사이로 입력해.";
    return;
  }

  $("setupMsg").textContent="계정 만드는 중...";

  const {data,error}=await sb.auth.signUp({
    email:idToEmail(id),
    password:pw
  });

  if(error){
    $("setupMsg").textContent="회원가입 실패: "+error.message;
    return;
  }

  if(!data.session){
    $("setupMsg").textContent="Supabase에서 Confirm email을 꺼야 아이디 방식 로그인이 가능해.";
    return;
  }

  user=data.user;

  const {data:p,error:profileError}=await sb
    .from("profiles")
    .upsert({
      id:user.id,
      name,
      target_score:goal,
      xp:0
    })
    .select()
    .single();

  if(profileError){
    $("setupMsg").textContent="프로필 생성 실패: "+profileError.message;
    return;
  }

  profile=p;
  currentRoom=null;
  showApp();
  await render();
};

$("loginBtn").onclick=async()=>{
  const id=normalizeId($("loginId").value);
  const pw=$("loginPw").value;

  if(!id||!pw){
    $("setupMsg").textContent="아이디와 비밀번호를 입력해.";
    return;
  }

  $("setupMsg").textContent="로그인 중...";

  const {data,error}=await sb.auth.signInWithPassword({
    email:idToEmail(id),
    password:pw
  });

  if(error){
    $("setupMsg").textContent="로그인 실패: 아이디 또는 비밀번호를 확인해.";
    return;
  }

  user=data.user;

  const {data:p,error:profileError}=await sb
    .from("profiles")
    .select("*")
    .eq("id",user.id)
    .maybeSingle();

  if(profileError||!p){
    $("setupMsg").textContent="프로필을 불러오지 못했어.";
    return;
  }

  profile=p;
  await getCurrentRoom();
  showApp();
  renderRoomState();
  renderRoomBanner();
  renderRoomBanner();
  await render();
};

function showApp(){
  $("setup").classList.add("hidden");
  $("app").classList.remove("hidden");
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
 $("newNameInput").placeholder="현재 이름: "+profile.name;
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


async function getCurrentRoom(){
  const {data:members,error:memberError}=await sb
    .from("room_members")
    .select("room_id,joined_at")
    .eq("user_id",user.id)
    .order("joined_at",{ascending:true})
    .limit(1);

  if(memberError){
    console.error(memberError);
    return null;
  }

  if(!members || !members.length){
    currentRoom=null;
    return null;
  }

  const {data:room,error:roomError}=await sb
    .from("rooms")
    .select("*")
    .eq("id",members[0].room_id)
    .maybeSingle();

  if(roomError){
    console.error(roomError);
    return null;
  }

  currentRoom=room||null;
  return currentRoom;
}

function renderRoomState(){
  const box=$("currentRoomBox");
  const createBtn=$("createRoom");
  const joinBtn=$("joinRoom");
  const roomName=$("roomName");
  const roomCode=$("roomCode");

  if(currentRoom){
    box.classList.remove("hidden");
    $("currentRoomName").textContent=currentRoom.name;
    $("currentRoomCode").textContent=currentRoom.code;

    createBtn.disabled=true;
    joinBtn.disabled=true;
    roomName.disabled=true;
    roomCode.disabled=true;

    createBtn.textContent="이미 방 있음";
    joinBtn.textContent="참가 중";
  }else{
    box.classList.add("hidden");

    createBtn.disabled=false;
    joinBtn.disabled=false;
    roomName.disabled=false;
    roomCode.disabled=false;

    createBtn.textContent="방 만들기";
    joinBtn.textContent="참가";
  }
}


function renderRoomBanner(){
  const banner=$("roomBanner");

  if(currentRoom){
    banner.classList.remove("hidden");
    $("roomBannerName").textContent=currentRoom.name;
    $("roomBannerCode").textContent=currentRoom.code;
  }else{
    banner.classList.add("hidden");
  }
}

$("createRoom").onclick=async()=>{
  const existing=await getCurrentRoom();

  if(existing){
    $("roomInfo").textContent=`이미 '${existing.name}' 방에 참가 중이야. 방 코드: ${existing.code}`;
    renderRoomState();
  renderRoomBanner();
    await loadRanking(existing.id);
    return;
  }

  const name=$("roomName").value.trim()||"공부방";
  const c=code();

  const {data,error}=await sb
    .from("rooms")
    .insert({code:c,name,owner_id:user.id})
    .select()
    .single();

  if(error){
    $("roomInfo").textContent=error.message;
    return;
  }

  const joined=await sb
    .from("room_members")
    .insert({room_id:data.id,user_id:user.id});

  if(joined.error){
    $("roomInfo").textContent=joined.error.message;
    return;
  }

  currentRoom=data;
  $("roomInfo").textContent=`${name} 방 생성 완료 · 코드: ${c}`;
  renderRoomState();
  renderRoomBanner();
  await loadRanking(data.id);
};

$("joinRoom").onclick=async()=>{
  const existing=await getCurrentRoom();

  if(existing){
    $("roomInfo").textContent=`이미 '${existing.name}' 방에 참가 중이야.`;
    renderRoomState();
  renderRoomBanner();
    await loadRanking(existing.id);
    return;
  }

  const c=$("roomCode").value.trim().toUpperCase();

  const {data:r,error}=await sb
    .from("rooms")
    .select("*")
    .eq("code",c)
    .maybeSingle();

  if(error||!r){
    $("roomInfo").textContent="방을 찾지 못했어.";
    return;
  }

  const x=await sb
    .from("room_members")
    .insert({room_id:r.id,user_id:user.id});

  if(x.error){
    $("roomInfo").textContent=x.error.message;
    return;
  }

  currentRoom=r;
  $("roomInfo").textContent=`${r.name} 참가 완료 · ${r.code}`;
  renderRoomState();
  renderRoomBanner();
  await loadRanking(r.id);
};

async function loadRanking(roomId=null){
  if(!roomId){
    const room=await getCurrentRoom();
    roomId=room?room.id:null;
  }

  renderRoomState();
  renderRoomBanner();

  if(!roomId){
    $("ranking").innerHTML="<p>방을 만들거나 코드로 참가해.</p>";
    return;
  }

  // 현재 방 정보 보장
  if(!currentRoom || currentRoom.id!==roomId){
    const {data:r}=await sb
      .from("rooms")
      .select("*")
      .eq("id",roomId)
      .maybeSingle();
    currentRoom=r||null;
  }

  const {data:members,error:membersError}=await sb
    .from("room_members")
    .select("user_id")
    .eq("room_id",roomId);

  if(membersError){
    console.error(membersError);
    $("ranking").innerHTML="<p>랭킹을 불러오지 못했어.</p>";
    return;
  }

  const ids=(members||[]).map(x=>x.user_id);

  if(!ids.length){
    $("ranking").innerHTML="";
    return;
  }

  const {data:ps,error:profilesError}=await sb
    .from("profiles")
    .select("id,name,xp")
    .in("id",ids);

  if(profilesError){
    console.error(profilesError);
    $("ranking").innerHTML="<p>사용자 정보를 불러오지 못했어.</p>";
    return;
  }

  const sorted=(ps||[]).sort((a,b)=>b.xp-a.xp);
  const amOwner=currentRoom && currentRoom.owner_id===user.id;

  $("ranking").innerHTML=sorted.map((p,i)=>{
    const isOwner=currentRoom && p.id===currentRoom.owner_id;
    const canKick=amOwner && p.id!==user.id;

    return `
      <div class="rankrow" style="grid-template-columns:35px 1fr auto ${canKick?'auto':''};gap:8px;align-items:center;">
        <b>${i+1}</b>
        <span>
          ${p.name}${p.id===user.id?" (나)":""}
          ${isOwner?' 👑':''}
        </span>
        <b>${p.xp} XP</b>
        ${canKick?`<button class="kickBtn" data-user="${p.id}" data-name="${p.name}" style="background:#ff5b5b;color:white;font-weight:900;border-radius:10px;padding:8px 10px;">강퇴</button>`:""}
      </div>
    `;
  }).join("");

  document.querySelectorAll(".kickBtn").forEach(btn=>{
    btn.onclick=()=>kickMember(btn.dataset.user,btn.dataset.name);
  });
}


$("changeNameBtn").onclick=async()=>{
  const newName=$("newNameInput").value.trim();

  if(!newName){
    $("nameMsg").textContent="새 이름을 입력해.";
    return;
  }

  if(newName.length>20){
    $("nameMsg").textContent="이름은 20자 이내로 입력해.";
    return;
  }

  $("nameMsg").textContent="변경 중...";

  const {error}=await sb
    .from("profiles")
    .update({name:newName})
    .eq("id",user.id);

  if(error){
    console.error(error);
    $("nameMsg").textContent="이름 변경 실패: "+error.message;
    return;
  }

  profile.name=newName;
  $("newNameInput").value="";
  $("nameMsg").textContent="이름을 변경했어.";
  await render();
};

$("resetProgressBtn").onclick=async()=>{
  const ok=confirm("정말 진도와 XP를 전부 초기화할까? 이 작업은 되돌릴 수 없어.");
  if(!ok)return;

  $("resetMsg").textContent="초기화 중...";

  // 1) XP = 0
  const {error:xpError}=await sb
    .from("profiles")
    .update({xp:0})
    .eq("id",user.id);

  if(xpError){
    console.error(xpError);
    $("resetMsg").textContent="XP 초기화 실패: "+xpError.message;
    return;
  }

  // 2) 5개 레슨 모두 미완료/0점으로 강제 저장.
  // 기존 행이 없어도 insert, 있으면 update가 된다.
  const now=new Date().toISOString();
  const resetRows=lessons.map((_,idx)=>({
    user_id:user.id,
    lesson_id:String(idx),
    completed:false,
    best_score:0,
    updated_at:now
  }));

  const {error:progressError}=await sb
    .from("lesson_progress")
    .upsert(resetRows);

  if(progressError){
    console.error(progressError);
    $("resetMsg").textContent="진도 초기화 실패: "+progressError.message;
    return;
  }

  profile.xp=0;
  $("resetMsg").textContent="진도와 XP를 모두 초기화했어.";
  await render();
};


$("logoutBtn").onclick=async()=>{
  await sb.auth.signOut();
  user=null;
  profile=null;
  currentRoom=null;
  $("app").classList.add("hidden");
  $("setup").classList.remove("hidden");
  $("authTitle").textContent="로그인";
  $("signupFields").classList.add("hidden");
  $("loginFields").classList.remove("hidden");
  $("setupMsg").textContent="로그아웃했어.";
};


async function kickMember(memberId,memberName){
  if(!currentRoom || currentRoom.owner_id!==user.id){
    alert("방장만 강퇴할 수 있어.");
    return;
  }

  if(memberId===user.id){
    alert("자기 자신은 강퇴할 수 없어.");
    return;
  }

  const ok=confirm(`${memberName}님을 방에서 강퇴할까?`);
  if(!ok)return;

  const {error}=await sb
    .from("room_members")
    .delete()
    .eq("room_id",currentRoom.id)
    .eq("user_id",memberId);

  if(error){
    console.error(error);
    alert("강퇴 실패: "+error.message);
    return;
  }

  $("roomInfo").textContent=`${memberName}님을 강퇴했어.`;
  await loadRanking(currentRoom.id);
}


// ---------- 방 채팅 ----------
let chatChannel=null;

async function loadChat(){
  if(!currentRoom){
    $("chatList").innerHTML="<p class='msg'>방에 들어가면 채팅을 사용할 수 있어.</p>";
    return;
  }

  const {data,error}=await sb
    .from("room_messages")
    .select("id,user_id,message,created_at,profiles(name)")
    .eq("room_id",currentRoom.id)
    .order("created_at",{ascending:true})
    .limit(100);

  if(error){
    console.error(error);
    $("chatMsg").textContent="채팅을 불러오지 못했어.";
    return;
  }

  $("chatList").innerHTML=(data||[]).map(m=>`
    <div style="padding:8px 4px;border-bottom:1px solid #edf1f2;">
      <b>${m.profiles?.name||"사용자"}</b>
      <span style="color:#7b8c91;font-size:12px;margin-left:6px">${new Date(m.created_at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}</span>
      <div style="margin-top:4px;line-height:1.45">${escapeHtml(m.message)}</div>
    </div>
  `).join("") || "<p class='msg'>아직 메시지가 없어.</p>";

  $("chatList").scrollTop=$("chatList").scrollHeight;
}

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

$("sendChat").onclick=async()=>{
  if(!currentRoom){
    $("chatMsg").textContent="먼저 방에 참가해.";
    return;
  }

  const message=$("chatInput").value.trim();
  if(!message)return;

  const {error}=await sb
    .from("room_messages")
    .insert({
      room_id:currentRoom.id,
      user_id:user.id,
      message
    });

  if(error){
    console.error(error);
    $("chatMsg").textContent="메시지 전송 실패: "+error.message;
    return;
  }

  $("chatInput").value="";
  $("chatMsg").textContent="";
  await loadChat();
}

async function subscribeChat(){
  if(chatChannel){
    await sb.removeChannel(chatChannel);
    chatChannel=null;
  }
  if(!currentRoom)return;

  chatChannel=sb.channel("room-chat-"+currentRoom.id)
    .on(
      "postgres_changes",
      {
        event:"INSERT",
        schema:"public",
        table:"room_messages",
        filter:`room_id=eq.${currentRoom.id}`
      },
      async()=>{ await loadChat(); }
    )
    .subscribe();
}

// ---------- 개인 PDF 커리큘럼 ----------
async function loadMyCurricula(){
  const {data,error}=await sb
    .from("curricula")
    .select("*")
    .eq("owner_id",user.id)
    .order("created_at",{ascending:false});

  if(error){
    console.error(error);
    $("curriculumMsg").textContent="내 커리큘럼을 불러오지 못했어.";
    return;
  }

  $("myCurricula").innerHTML=(data||[]).map(c=>`
    <div class="curr" style="margin-top:10px">
      <b>${escapeHtml(c.title)}</b><br>
      <small>${profile.name}의 커리큘럼</small><br>
      <button class="openCurriculumBtn" data-path="${c.pdf_path}" style="margin-top:8px;padding:8px 10px;border-radius:9px;background:#22afe8;color:white;font-weight:900;">PDF 열기</button>
      ${currentRoom?`<button class="shareCurriculumBtn" data-id="${c.id}" style="margin-top:8px;padding:8px 10px;border-radius:9px;background:#58cc42;color:white;font-weight:900;">현재 방에 공유</button>`:""}
    </div>
  `).join("") || "<p class='msg'>아직 만든 커리큘럼이 없어.</p>";

  document.querySelectorAll(".openCurriculumBtn").forEach(btn=>{
    btn.onclick=()=>openPdf(btn.dataset.path);
  });

  document.querySelectorAll(".shareCurriculumBtn").forEach(btn=>{
    btn.onclick=()=>shareCurriculum(btn.dataset.id);
  });
}

$("uploadCurriculum").onclick=async()=>{
  const title=$("curriculumTitle").value.trim();
  const file=$("curriculumPdf").files[0];

  if(!title){
    $("curriculumMsg").textContent="커리큘럼 이름을 입력해.";
    return;
  }

  if(!file){
    $("curriculumMsg").textContent="PDF 파일을 선택해.";
    return;
  }

  if(file.type!=="application/pdf"){
    $("curriculumMsg").textContent="PDF 파일만 업로드할 수 있어.";
    return;
  }

  $("curriculumMsg").textContent="업로드 중...";

  const safeName=file.name.replace(/[^a-zA-Z0-9._-]/g,"_");
  const path=`${user.id}/${Date.now()}_${safeName}`;

  const {error:uploadError}=await sb.storage
    .from("curriculum-pdfs")
    .upload(path,file,{
      contentType:"application/pdf",
      upsert:false
    });

  if(uploadError){
    console.error(uploadError);
    $("curriculumMsg").textContent="PDF 업로드 실패: "+uploadError.message;
    return;
  }

  const {error:dbError}=await sb
    .from("curricula")
    .insert({
      owner_id:user.id,
      title,
      pdf_path:path
    });

  if(dbError){
    console.error(dbError);
    $("curriculumMsg").textContent="커리큘럼 저장 실패: "+dbError.message;
    return;
  }

  $("curriculumTitle").value="";
  $("curriculumPdf").value="";
  $("curriculumMsg").textContent="커리큘럼을 만들었어.";
  await loadMyCurricula();
}

async function openPdf(path){
  const {data,error}=await sb.storage
    .from("curriculum-pdfs")
    .createSignedUrl(path,60*10);

  if(error){
    alert("PDF를 열지 못했어: "+error.message);
    return;
  }

  window.open(data.signedUrl,"_blank");
}

async function shareCurriculum(curriculumId){
  if(!currentRoom){
    alert("먼저 방에 참가해.");
    return;
  }

  const {error}=await sb
    .from("room_curricula")
    .upsert({
      room_id:currentRoom.id,
      curriculum_id:curriculumId,
      shared_by:user.id
    });

  if(error){
    alert("공유 실패: "+error.message);
    return;
  }

  $("curriculumMsg").textContent="현재 방에 공유했어.";
  await loadRoomCurricula();
}

async function loadRoomCurricula(){
  if(!currentRoom){
    $("roomCurricula").innerHTML="<p class='msg'>방에 참가하면 공유 커리큘럼을 볼 수 있어.</p>";
    return;
  }

  const {data,error}=await sb
    .from("room_curricula")
    .select(`
      id,
      curriculum_id,
      curricula(
        id,
        title,
        pdf_path,
        owner_id,
        profiles(name)
      )
    `)
    .eq("room_id",currentRoom.id)
    .order("shared_at",{ascending:false});

  if(error){
    console.error(error);
    $("roomCurricula").innerHTML="<p class='msg'>커리큘럼을 불러오지 못했어.</p>";
    return;
  }

  $("roomCurricula").innerHTML=(data||[]).map(x=>{
    const c=x.curricula;
    const owner=c?.profiles?.name||"사용자";
    return `
      <div class="curr" style="margin-top:10px">
        <b>${escapeHtml(owner)}의 커리큘럼</b><br>
        <small>${escapeHtml(c?.title||"커리큘럼")}</small><br>
        <button class="roomPdfBtn" data-path="${c?.pdf_path||""}" style="margin-top:8px;padding:8px 10px;border-radius:9px;background:#22afe8;color:white;font-weight:900;">PDF 열기</button>
      </div>
    `;
  }).join("") || "<p class='msg'>아직 공유된 커리큘럼이 없어.</p>";

  document.querySelectorAll(".roomPdfBtn").forEach(btn=>{
    btn.onclick=()=>openPdf(btn.dataset.path);
  });
}

// render() 뒤에 부가 데이터도 갱신
const originalRender=render;
render=async function(){
  await originalRender();
  await getCurrentRoom();
  renderRoomState();
  renderRoomBanner();
  await loadMyCurricula();
  await loadRoomCurricula();
  await loadChat();
  await subscribeChat();
};

init();
