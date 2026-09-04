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
  await render();
};

function showApp(){
  $("setup").classList.add("hidden");
  $("app").classList.remove("hidden");
}

function plan(goal){
  if(goal>=95)return [
    ["완전 암기","개념·연표·용어 정밀 학습"],
    ["자료 분석","지도·인물·사료 집중"],
    ["고난도","복합 선지 반복"],
    ["오답 압축","취약 개념 재학습"],
    ["실전","95% 이상 정답률 목표"]
  ];

  if(goal>=85)return [
    ["핵심 개념","개념 1~2회독"],
    ["기본 문제","객관식·연표"],
    ["자료 문제","지도·인물"],
    ["오답 복습","틀린 개념 반복"],
    ["실전","85% 이상 정답률 목표"]
  ];

  return [
    ["필수 개념","핵심어 우선"],
    ["기본 문제","쉬운 문제부터"],
    ["반복","같은 개념 재확인"],
    ["취약점","오답 집중"],
    ["점검",goal+"점 목표 마무리"]
  ];
}

async function getProgress(){
  const {data,error}=await sb
    .from("lesson_progress")
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

  $("curriculum").innerHTML=plan(profile.target_score)
    .map(x=>`
      <div class="curr">
        <b>${x[0]}</b><br>
        <small>${x[1]}</small>
      </div>
    `)
    .join("");

  const prog=await getProgress();

  const unitCompleted=lessons.every((_,i)=>{
    const p=prog.find(x=>x.lesson_id===String(i));
    return p && p.completed===true;
  });

  $("path").innerHTML=lessons.map((l,i)=>`
    <div class="nodeRow">
      <button class="node ${unitCompleted?'done':''}" data-i="${i}">
        ${unitCompleted?'✓':l.icon}
      </button>
    </div>
  `).join("");

  document.querySelectorAll(".node").forEach(b=>{
    b.onclick=()=>openLesson(+b.dataset.i);
  });

  await loadRanking();
}

function openLesson(i){
  current=i;
  answered=false;

  const l=lessons[i];

  $("ltitle").textContent=l.t;
  $("concept").textContent=l.c;
  $("question").textContent=l.q;
  $("bar").style.width=((i+1)/lessons.length*100)+"%";

  $("answers").innerHTML=l.a
    .map((x,j)=>`
      <button class="ans" data-i="${j}">
        ${j+1}. ${x}
      </button>
    `)
    .join("");

  $("feedback").textContent="";
  $("next").classList.add("hidden");

  document.querySelectorAll(".ans").forEach(b=>{
    b.onclick=()=>answer(b);
  });

  $("lesson").classList.remove("hidden");
}

async function answer(b){
  if(answered)return;

  answered=true;

  const l=lessons[current];
  const i=+b.dataset.i;
  const all=[...document.querySelectorAll(".ans")];

  all[l.ok].classList.add("good");

  if(i!==l.ok){
    b.classList.add("bad");
    $("feedback").textContent="오답. 정답을 확인하고 다시 복습해.";
    $("next").classList.remove("hidden");
    return;
  }

  let prog=await getProgress();
  let existing=prog.find(x=>x.lesson_id===String(current));
  let firstCorrect=!existing||existing.best_score<100;

  if(firstCorrect){
    profile.xp+=20;

    const {error:xpError}=await sb
      .from("profiles")
      .update({xp:profile.xp})
      .eq("id",user.id);

    if(xpError){
      console.error(xpError);
      profile.xp-=20;
    }
  }

  const {error:progressError}=await sb
    .from("lesson_progress")
    .upsert({
      user_id:user.id,
      lesson_id:String(current),
      completed:false,
      best_score:100,
      updated_at:new Date().toISOString()
    });

  if(progressError){
    console.error(progressError);
  }

  prog=await getProgress();

  const allCorrect=lessons.every((_,idx)=>{
    const p=prog.find(x=>x.lesson_id===String(idx));
    return p&&p.best_score>=100;
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

    const {error}=await sb
      .from("lesson_progress")
      .upsert(rows);

    if(error){
      console.error(error);
    }

    $("feedback").textContent=
      (firstCorrect?"정답! +20 XP":"정답!")+" · 레슨 완료!";
  }else{
    $("feedback").textContent=
      firstCorrect
        ?"정답! +20 XP"
        :"정답! 이 문제의 XP는 이미 받았어.";
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
  $("lesson").classList.add("hidden");
};

document.querySelectorAll("nav button").forEach(b=>{
  b.onclick=()=>{
    document.querySelectorAll("nav button").forEach(x=>{
      x.classList.remove("active");
    });

    b.classList.add("active");

    document.querySelectorAll(".page").forEach(x=>{
      x.classList.remove("active");
    });

    $(b.dataset.page).classList.add("active");
  };
});

function code(){
  return Math.random()
    .toString(36)
    .slice(2,8)
    .toUpperCase();
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

  if(!members||!members.length){
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
    $("roomInfo").textContent=
      `이미 '${existing.name}' 방에 참가 중이야. 방 코드: ${existing.code}`;

    renderRoomState();
    renderRoomBanner();
    await loadRanking(existing.id);
    return;
  }

  const name=$("roomName").value.trim()||"공부방";
  const c=code();

  const {data,error}=await sb
    .from("rooms")
    .insert({
      code:c,
      name,
      owner_id:user.id
    })
    .select()
    .single();

  if(error){
    $("roomInfo").textContent=error.message;
    return;
  }

  const joined=await sb
    .from("room_members")
    .insert({
      room_id:data.id,
      user_id:user.id
    });

  if(joined.error){
    $("roomInfo").textContent=joined.error.message;
    return;
  }

  currentRoom=data;

  $("roomInfo").textContent=
    `${name} 방 생성 완료 · 코드: ${c}`;

  renderRoomState();
  renderRoomBanner();

  await loadRanking(data.id);
};

$("joinRoom").onclick=async()=>{
  const existing=await getCurrentRoom();

  if(existing){
    $("roomInfo").textContent=
      `이미 '${existing.name}' 방에 참가 중이야.`;

    renderRoomState();
    renderRoomBanner();

    await loadRanking(existing.id);
    return;
  }

  const c=$("roomCode").value
    .trim()
    .toUpperCase();

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
    .insert({
      room_id:r.id,
      user_id:user.id
    });

  if(x.error){
    $("roomInfo").textContent=x.error.message;
    return;
  }

  currentRoom=r;

  $("roomInfo").textContent=
    `${r.name} 참가 완료 · ${r.code}`;

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
    if(!currentRoom||currentRoom.id!==roomId){
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
  const amOwner=currentRoom&&currentRoom.owner_id===user.id;

  $("ranking").innerHTML=sorted.map((p,i)=>{
    const isOwner=currentRoom&&p.id===currentRoom.owner_id;
    const canKick=amOwner&&p.id!==user.id;

    return `
      <div class="rankrow"
        style="grid-template-columns:35px 1fr auto ${canKick?'auto':''};gap:8px;align-items:center;">
        <b>${i+1}</b>

        <span>
          ${escapeHtml(p.name)}
          ${p.id===user.id?" (나)":""}
          ${isOwner?' 👑':''}
        </span>

        <b>${p.xp} XP</b>

        ${canKick?`
          <button
            class="kickBtn"
            data-user="${p.id}"
            data-name="${escapeHtml(p.name)}"
            style="background:#ff5b5b;color:white;font-weight:900;border-radius:10px;padding:8px 10px;">
            강퇴
          </button>
        `:""}
      </div>
    `;
  }).join("");

  document.querySelectorAll(".kickBtn").forEach(btn=>{
    btn.onclick=()=>{
      kickMember(
        btn.dataset.user,
        btn.dataset.name
      );
    };
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
    $("nameMsg").textContent=
      "이름 변경 실패: "+error.message;
    return;
  }

  profile.name=newName;

  $("newNameInput").value="";
  $("nameMsg").textContent="이름을 변경했어.";

  await render();
};

$("resetProgressBtn").onclick=async()=>{
  const ok=confirm(
    "정말 진도와 XP를 전부 초기화할까? 이 작업은 되돌릴 수 없어."
  );

  if(!ok)return;

  $("resetMsg").textContent="초기화 중...";

  const {error:xpError}=await sb
    .from("profiles")
    .update({xp:0})
    .eq("id",user.id);

  if(xpError){
    console.error(xpError);
    $("resetMsg").textContent=
      "XP 초기화 실패: "+xpError.message;
    return;
  }

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
    $("resetMsg").textContent=
      "진도 초기화 실패: "+progressError.message;
    return;
  }

  profile.xp=0;

  $("resetMsg").textContent=
    "진도와 XP를 모두 초기화했어.";

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
  if(!currentRoom||currentRoom.owner_id!==user.id){
    alert("방장만 강퇴할 수 있어.");
    return;
  }

  if(memberId===user.id){
    alert("자기 자신은 강퇴할 수 없어.");
    return;
  }

  const ok=confirm(
    `${memberName}님을 방에서 강퇴할까?`
  );

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

  $("roomInfo").textContent=
    `${memberName}님을 강퇴했어.`;

  await loadRanking(currentRoom.id);
}


// ========================================
// 방 채팅
// ========================================

let chatChannel=null;

async function loadChat(){
  if(!currentRoom){
    $("chatList").innerHTML=
      "<p class='msg'>방에 들어가면 채팅을 사용할 수 있어.</p>";
    return;
  }

  const {data,error}=await sb
    .from("room_messages")
    .select(
      "id,user_id,message,created_at,profiles(name)"
    )
    .eq("room_id",currentRoom.id)
    .order("created_at",{ascending:true})
    .limit(100);

  if(error){
    console.error(error);
    $("chatMsg").textContent=
      "채팅을 불러오지 못했어.";
    return;
  }

  $("chatList").innerHTML=(data||[]).map(m=>`
    <div style="
      padding:8px 4px;
      border-bottom:1px solid #edf1f2;
    ">
      <b>${escapeHtml(m.profiles?.name||"사용자")}</b>

      <span style="
        color:#7b8c91;
        font-size:12px;
        margin-left:6px;
      ">
        ${new Date(m.created_at).toLocaleTimeString(
          [],
          {hour:"2-digit",minute:"2-digit"}
        )}
      </span>

      <div style="
        margin-top:4px;
        line-height:1.45;
      ">
        ${escapeHtml(m.message)}
      </div>
    </div>
  `).join("")||
  "<p class='msg'>아직 메시지가 없어.</p>";

  $("chatList").scrollTop=
    $("chatList").scrollHeight;
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
    $("chatMsg").textContent=
      "먼저 방에 참가해.";
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
    $("chatMsg").textContent=
      "메시지 전송 실패: "+error.message;
    return;
  }

  $("chatInput").value="";
  $("chatMsg").textContent="";

  await loadChat();
};

async function subscribeChat(){
  if(chatChannel){
    await sb.removeChannel(chatChannel);
    chatChannel=null;
  }

  if(!currentRoom)return;

  chatChannel=sb
    .channel("room-chat-"+currentRoom.id)
    .on(
      "postgres_changes",
      {
        event:"INSERT",
        schema:"public",
        table:"room_messages",
        filter:`room_id=eq.${currentRoom.id}`
      },
      async()=>{
        await loadChat();
      }
    )
    .subscribe();
}


// ========================================
// 개인 커리큘럼
// PDF + 사진 여러 장
// ========================================

function setupCurriculumFileInput(){
  const input=$("curriculumPdf");

  if(!input)return;

  input.setAttribute(
    "accept",
    "application/pdf,image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.avif,.tif,.tiff"
  );

  input.multiple=true;
}

function isAllowedCurriculumFile(file){
  const name=file.name.toLowerCase();

  if(file.type==="application/pdf"){
    return true;
  }

  if(file.type&&file.type.startsWith("image/")){
    return true;
  }

  return /\.(pdf|jpg|jpeg|png|webp|gif|bmp|heic|heif|avif|tif|tiff)$/i
    .test(name);
}

function getCurriculumFileType(file){
  if(
    file.type.startsWith("image/")||
    /\.(jpg|jpeg|png|webp|gif|bmp|heic|heif|avif|tif|tiff)$/i
      .test(file.name)
  ){
    return "image";
  }

  return "pdf";
}

async function getCurriculumFiles(curriculumIds){
  if(!curriculumIds||!curriculumIds.length){
    return [];
  }

  const {data,error}=await sb
    .from("curriculum_files")
    .select("*")
    .in("curriculum_id",curriculumIds)
    .order("sort_order",{ascending:true});

  if(error){
    console.error(error);
    return [];
  }

  return data||[];
}

async function loadMyCurricula(){
  const {data,error}=await sb
    .from("curricula")
    .select("*")
    .eq("owner_id",user.id)
    .order("created_at",{ascending:false});

  if(error){
    console.error(error);

    $("curriculumMsg").textContent=
      "내 커리큘럼을 불러오지 못했어: "+
      error.message;

    return;
  }

  const curricula=data||[];

  const fileRows=await getCurriculumFiles(
    curricula.map(c=>c.id)
  );

  const filesByCurriculum={};

  fileRows.forEach(f=>{
    if(!filesByCurriculum[f.curriculum_id]){
      filesByCurriculum[f.curriculum_id]=[];
    }

    filesByCurriculum[f.curriculum_id].push(f);
  });

  $("myCurricula").innerHTML=curricula.map(c=>{
    let files=filesByCurriculum[c.id]||[];

    // 예전 단일 PDF 커리큘럼도 계속 사용 가능
    if(!files.length&&c.pdf_path){
      files=[
        {
          storage_path:c.pdf_path,
          original_name:"기존 자료",
          file_type:"pdf"
        }
      ];
    }

    return `
      <div class="curr" style="margin-top:10px">

        <b>${escapeHtml(c.title)}</b><br>

        <small>
          ${escapeHtml(profile.name)}의 커리큘럼
          · 자료 ${files.length}개
        </small>

        <div style="margin-top:4px;">
          ${files.map((f,i)=>`
            <button
              class="openCurriculumFileBtn"
              data-path="${f.storage_path}"
              style="
                margin-top:8px;
                margin-right:5px;
                padding:8px 10px;
                border-radius:9px;
                background:#22afe8;
                color:white;
                font-weight:900;
              ">
              ${f.file_type==="image"?"🖼️":"📄"}
              자료 ${i+1}
            </button>
          `).join("")}
        </div>

        ${currentRoom?`
          <button
            class="shareCurriculumBtn"
            data-id="${c.id}"
            style="
              margin-top:8px;
              padding:8px 10px;
              border-radius:9px;
              background:#58cc42;
              color:white;
              font-weight:900;
            ">
            현재 방에 공유
          </button>
        `:""}

      </div>
    `;
  }).join("")||
  "<p class='msg'>아직 만든 커리큘럼이 없어.</p>";

  document
    .querySelectorAll(".openCurriculumFileBtn")
    .forEach(btn=>{
      btn.onclick=()=>{
        openCurriculumFile(btn.dataset.path);
      };
    });

  document
    .querySelectorAll(".shareCurriculumBtn")
    .forEach(btn=>{
      btn.onclick=()=>{
        shareCurriculum(btn.dataset.id);
      };
    });
}

$("uploadCurriculum").onclick=async()=>{
  const title=$("curriculumTitle").value.trim();
  const input=$("curriculumPdf");
  const files=input?[...input.files]:[];

  if(!title){
    $("curriculumMsg").textContent=
      "커리큘럼 이름을 입력해.";
    return;
  }

  if(!files.length){
    $("curriculumMsg").textContent=
      "PDF 또는 사진을 한 개 이상 선택해.";
    return;
  }

  if(files.length>30){
    $("curriculumMsg").textContent=
      "한 번에 최대 30개의 자료를 올릴 수 있어.";
    return;
  }

  const invalidFile=files.find(
    file=>!isAllowedCurriculumFile(file)
  );

  if(invalidFile){
    $("curriculumMsg").textContent=
      `지원하지 않는 파일이야: ${invalidFile.name}`;
    return;
  }

  const tooLarge=files.find(
    file=>file.size>25*1024*1024
  );

  if(tooLarge){
    $("curriculumMsg").textContent=
      `${tooLarge.name}의 크기가 25MB를 넘어.`;
    return;
  }

  const uploadBtn=$("uploadCurriculum");

  uploadBtn.disabled=true;

  try{
    // 커리큘럼을 먼저 생성
    $("curriculumMsg").textContent=
      "커리큘럼 만드는 중...";

    const {data:curriculum,error:curriculumError}=
      await sb
        .from("curricula")
        .insert({
          owner_id:user.id,
          title,
          pdf_path:null
        })
        .select()
        .single();

    if(curriculumError){
      throw new Error(
        "커리큘럼 생성 실패: "+
        curriculumError.message
      );
    }

    const uploadedRows=[];

    for(let i=0;i<files.length;i++){
      const file=files[i];

      $("curriculumMsg").textContent=
        `자료 업로드 중... ${i+1}/${files.length}`;

      const safeName=file.name
        .replace(/[^a-zA-Z0-9._-]/g,"_");

      const path=
        `${user.id}/${curriculum.id}/`+
        `${Date.now()}_${i}_${safeName}`;

      const {error:uploadError}=await sb.storage
        .from("curriculum-pdfs")
        .upload(
          path,
          file,
          {
            contentType:
              file.type||"application/octet-stream",
            upsert:false
          }
        );

      if(uploadError){
        throw new Error(
          `${file.name} 업로드 실패: `+
          uploadError.message
        );
      }

      uploadedRows.push({
        curriculum_id:curriculum.id,
        owner_id:user.id,
        storage_path:path,
        original_name:file.name,
        file_type:getCurriculumFileType(file),
        mime_type:file.type||null,
        sort_order:i
      });
    }

    $("curriculumMsg").textContent=
      "자료 목록 저장 중...";

    const {error:fileError}=await sb
      .from("curriculum_files")
      .insert(uploadedRows);

    if(fileError){
      throw new Error(
        "자료 목록 저장 실패: "+
        fileError.message
      );
    }

    // 첫 자료를 기존 pdf_path에도 기록.
    // 예전 코드와의 호환성을 유지하기 위한 값.
    if(uploadedRows.length){
      const {error:pathError}=await sb
        .from("curricula")
        .update({
          pdf_path:uploadedRows[0].storage_path
        })
        .eq("id",curriculum.id);

      if(pathError){
        console.error(pathError);
      }
    }

    $("curriculumTitle").value="";
    input.value="";

    $("curriculumMsg").textContent=
      `커리큘럼 생성 완료! 자료 ${files.length}개를 저장했어.`;

    await loadMyCurricula();

    if(currentRoom){
      await loadRoomCurricula();
    }

  }catch(err){
    console.error(err);

    $("curriculumMsg").textContent=
      err.message||
      "커리큘럼 생성 중 오류가 발생했어.";

  }finally{
    uploadBtn.disabled=false;
  }
};

async function openCurriculumFile(path){
  if(!path){
    alert("자료 경로가 없어.");
    return;
  }

  const {data,error}=await sb.storage
    .from("curriculum-pdfs")
    .createSignedUrl(
      path,
      60*10
    );

  if(error){
    console.error(error);

    alert(
      "자료를 열지 못했어: "+
      error.message
    );

    return;
  }

  window.open(
    data.signedUrl,
    "_blank"
  );
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
    console.error(error);

    alert(
      "공유 실패: "+
      error.message
    );

    return;
  }

  $("curriculumMsg").textContent=
    "현재 방에 공유했어.";

  await loadRoomCurricula();
}
async function loadRoomCurricula(){
  if(!$("roomCurricula"))return;

  if(!currentRoom){
    $("roomCurricula").innerHTML=
      "<p class='msg'>방에 참가하면 공유 커리큘럼을 볼 수 있어.</p>";
    return;
  }

  const {data:shares,error:shareError}=await sb
    .from("room_curricula")
    .select("curriculum_id")
    .eq("room_id",currentRoom.id)
    .order("shared_at",{ascending:false});

  if(shareError){
    console.error(shareError);
    $("roomCurricula").innerHTML=
      "<p class='msg'>공유 커리큘럼을 불러오지 못했어.</p>";
    return;
  }

  const ids=(shares||[])
    .map(x=>x.curriculum_id);

  if(!ids.length){
    $("roomCurricula").innerHTML=
      "<p class='msg'>아직 공유된 커리큘럼이 없어.</p>";
    return;
  }

  const {data:currs,error:currError}=await sb
    .from("curricula")
    .select("id,title,owner_id,pdf_path,target_score,exam_date,profiles(name)")
    .in("id",ids);

  if(currError){
    console.error(currError);

    // 예전 DB 구조와 호환
    const fallback=await sb
      .from("curricula")
      .select("id,title,owner_id,pdf_path,profiles(name)")
      .in("id",ids);

    if(fallback.error){
      $("roomCurricula").innerHTML=
        "<p class='msg'>공유 커리큘럼 정보를 불러오지 못했어.</p>";
      return;
    }

    renderSharedCurricula(
      fallback.data||[],
      ids
    );

    return;
  }

  await renderSharedCurricula(
    currs||[],
    ids
  );
}

async function renderSharedCurricula(currs,ids){
  const fileRows=
    await getCurriculumFiles(ids);

  const filesByCurriculum={};

  fileRows.forEach(f=>{
    if(!filesByCurriculum[f.curriculum_id]){
      filesByCurriculum[f.curriculum_id]=[];
    }

    filesByCurriculum[f.curriculum_id]
      .push(f);
  });

  $("roomCurricula").innerHTML=
    currs.map(c=>{
      let files=
        filesByCurriculum[c.id]||[];

      if(!files.length&&c.pdf_path){
        files=[
          {
            storage_path:c.pdf_path,
            file_type:"pdf",
            original_name:"기존 자료"
          }
        ];
      }

      const owner=
        c.profiles?.name||"사용자";

      const target=
        c.target_score??"미설정";

      let examText="";

      if(c.exam_date){
        const d=daysUntil(c.exam_date);

        if(d===0){
          examText=" · 오늘 시험";
        }else if(d>0){
          examText=` · D-${d}`;
        }else{
          examText=" · 시험 종료";
        }
      }

      return `
        <div class="curr"
          style="margin-top:10px;">

          <b>
            ${escapeHtml(owner)}의 커리큘럼
          </b><br>

          <small>
            ${escapeHtml(c.title)}
            ${target!=="미설정"
              ?` · 목표 ${target}점`
              :""
            }
            ${examText}
            · 자료 ${files.length}개
          </small>

          <div>
            ${files.map((f,i)=>`
              <button
                class="roomCurriculumFileBtn"
                data-path="${f.storage_path}"
                style="
                  margin-top:8px;
                  margin-right:5px;
                  padding:8px 10px;
                  border-radius:9px;
                  background:#22afe8;
                  color:white;
                  font-weight:900;
                ">
                ${f.file_type==="image"
                  ?"🖼️"
                  :"📄"
                }
                자료 ${i+1}
              </button>
            `).join("")}
          </div>

        </div>
      `;
    }).join("")||
    "<p class='msg'>아직 공유된 커리큘럼이 없어.</p>";

  document
    .querySelectorAll(".roomCurriculumFileBtn")
    .forEach(btn=>{
      btn.onclick=()=>{
        openCurriculumFile(
          btn.dataset.path
        );
      };
    });
}


// ========================================
// 시험 날짜 / 목표 점수
// ========================================

function daysUntil(dateString){
  if(!dateString){
    return null;
  }

  const today=new Date();
  today.setHours(0,0,0,0);

  const target=
    new Date(dateString+"T00:00:00");

  return Math.ceil(
    (target-today)/86400000
  );
}

function getStudySettings(goal){
  if(goal>=95){
    return {
      lessonMultiplier:1.6,
      reviewEvery:1,
      reviewGoal:2,
      mockEvery:2
    };
  }

  if(goal>=85){
    return {
      lessonMultiplier:1.3,
      reviewEvery:2,
      reviewGoal:2,
      mockEvery:3
    };
  }

  if(goal>=70){
    return {
      lessonMultiplier:1,
      reviewEvery:2,
      reviewGoal:1,
      mockEvery:4
    };
  }

  return {
    lessonMultiplier:0.8,
    reviewEvery:3,
    reviewGoal:1,
    mockEvery:5
  };
}


// ========================================
// 다중 업로드 최종 버전
// 목표 점수 + 시험 날짜도 같이 저장
// ========================================

$("uploadCurriculum").onclick=async()=>{
  const title=
    $("curriculumTitle")
      ?.value
      .trim()||"";

  const fileInput=
    $("curriculumPdf")||
    $("curriculumFile");

  const files=
    fileInput
      ?[...fileInput.files]
      :[];

  const targetInput=
    $("curriculumTargetScore");

  const examInput=
    $("curriculumExamDate");

  const targetScore=
    targetInput
      ?Number(targetInput.value)
      :profile.target_score;

  const examDate=
    examInput?.value||null;

  if(!title){
    $("curriculumMsg").textContent=
      "커리큘럼 이름을 입력해.";
    return;
  }

  if(
    !Number.isFinite(targetScore)||
    targetScore<0||
    targetScore>100
  ){
    $("curriculumMsg").textContent=
      "목표 점수는 0~100 사이로 입력해.";
    return;
  }

  if(examInput&&!examDate){
    $("curriculumMsg").textContent=
      "시험 날짜를 정해줘.";
    return;
  }

  if(!files.length){
    $("curriculumMsg").textContent=
      "PDF 또는 사진을 한 개 이상 선택해.";
    return;
  }

  if(files.length>30){
    $("curriculumMsg").textContent=
      "한 커리큘럼에는 최대 30개까지 올릴 수 있어.";
    return;
  }

  const invalid=
    files.find(
      f=>!isAllowedCurriculumFile(f)
    );

  if(invalid){
    $("curriculumMsg").textContent=
      `지원하지 않는 파일 형식: ${invalid.name}`;
    return;
  }

  const tooLarge=
    files.find(
      f=>f.size>25*1024*1024
    );

  if(tooLarge){
    $("curriculumMsg").textContent=
      `${tooLarge.name} 파일은 25MB를 넘어서 올릴 수 없어.`;
    return;
  }

  const btn=
    $("uploadCurriculum");

  btn.disabled=true;

  const uploaded=[];

  try{
    // 먼저 Storage 업로드
    for(
      let i=0;
      i<files.length;
      i++
    ){
      const file=files[i];

      $("curriculumMsg").textContent=
        `자료 업로드 중... ${i+1}/${files.length}`;

      const safeName=
        file.name.replace(
          /[^a-zA-Z0-9._-]/g,
          "_"
        );

      const path=
        `${user.id}/`+
        `${Date.now()}_${i}_${safeName}`;

      const {error:uploadError}=
        await sb.storage
          .from("curriculum-pdfs")
          .upload(
            path,
            file,
            {
              contentType:
                file.type||
                "application/octet-stream",
              upsert:false
            }
          );

      if(uploadError){
        throw new Error(
          `${file.name} 업로드 실패: `+
          uploadError.message
        );
      }

      uploaded.push({
        storage_path:path,
        original_name:file.name,
        file_type:
          getCurriculumFileType(file),
        mime_type:file.type||null,
        sort_order:i
      });
    }

    $("curriculumMsg").textContent=
      "커리큘럼 저장 중...";

    const firstPath=
      uploaded[0].storage_path;

    let curriculum=null;

    // 최신 DB 구조로 먼저 시도
    let createResult=
      await sb
        .from("curricula")
        .insert({
          owner_id:user.id,
          title,
          pdf_path:firstPath,
          target_score:targetScore,
          exam_date:examDate
        })
        .select()
        .single();

    // 컬럼이 아직 없는 경우 예전 구조로 재시도
    if(createResult.error){
      console.warn(
        "최신 curriculum insert 실패. 호환 모드 재시도:",
        createResult.error
      );

      createResult=
        await sb
          .from("curricula")
          .insert({
            owner_id:user.id,
            title,
            pdf_path:firstPath
          })
          .select()
          .single();
    }

    if(createResult.error){
      throw new Error(
        "커리큘럼 저장 실패: "+
        createResult.error.message
      );
    }

    curriculum=
      createResult.data;

    const rows=
      uploaded.map(f=>({
        curriculum_id:
          curriculum.id,
        owner_id:user.id,
        storage_path:
          f.storage_path,
        original_name:
          f.original_name,
        file_type:
          f.file_type,
        mime_type:
          f.mime_type,
        sort_order:
          f.sort_order
      }));

    const {error:fileRowError}=
      await sb
        .from("curriculum_files")
        .insert(rows);

    if(fileRowError){
      throw new Error(
        "첨부 자료 저장 실패: "+
        fileRowError.message
      );
    }

    $("curriculumTitle").value="";

    if(targetInput){
      targetInput.value=
        profile.target_score;
    }

    if(examInput){
      examInput.value="";
    }

    fileInput.value="";

    $("curriculumMsg").textContent=
      `커리큘럼 생성 완료! 자료 ${files.length}개`;

    await loadMyCurricula();

    if(currentRoom){
      await loadRoomCurricula();
    }

    await updateDailyStudyQuota();

  }catch(error){
    console.error(error);

    $("curriculumMsg").textContent=
      error.message||
      "커리큘럼 생성 중 오류가 발생했어.";

  }finally{
    btn.disabled=false;
  }
};


// ========================================
// 복습 알고리즘
// 초록 → 노랑 → 검정
// ========================================

async function getProgressMap(){
  const progress=
    await getProgress();

  const map={};

  progress.forEach(p=>{
    map[String(p.lesson_id)]=p;
  });

  return map;
}

function getLessonReviewClass(progress){
  if(
    !progress||
    !progress.completed
  ){
    return "";
  }

  const count=
    progress.review_count||0;

  if(count===0){
    return "review-green";
  }

  if(count===1){
    return "review-yellow";
  }

  return "review-black";
}

function injectReviewStyles(){
  if(
    document.getElementById(
      "studyLoopReviewStyles"
    )
  ){
    return;
  }

  const style=
    document.createElement("style");

  style.id=
    "studyLoopReviewStyles";

  style.textContent=`
    .node.review-green{
      background:#58cc42!important;
      box-shadow:0 8px 0 #3da52f!important;
      color:white!important;
    }

    .node.review-yellow{
      background:#f3c94b!important;
      box-shadow:0 8px 0 #b68d13!important;
      color:#222!important;
    }

    .node.review-black{
      background:#111!important;
      box-shadow:0 8px 0 #000!important;
      color:white!important;
    }

    .reviewBadge{
      position:absolute;
      top:-10px;
      right:-16px;
      background:#ff735a;
      color:white;
      font-size:10px;
      font-weight:900;
      padding:4px 7px;
      border-radius:999px;
    }

    .dailyStudyBox{
      margin:0 18px 16px;
      padding:15px;
      background:#fff;
      color:#203037;
      border-radius:16px;
    }

    .dailyNumbers{
      display:grid;
      grid-template-columns:
        repeat(3,1fr);
      gap:8px;
      margin-top:10px;
    }

    .dailyNumbers div{
      text-align:center;
      background:#eef6f8;
      border-radius:11px;
      padding:10px 4px;
    }

    .dailyNumbers b{
      display:block;
      font-size:20px;
    }
  `;

  document.head.appendChild(style);
}

async function renderReviewPath(){
  if(!$("path"))return;

  const map=
    await getProgressMap();

  const settings=
    getStudySettings(
      profile.target_score
    );

  const completedCount=
    lessons.filter(
      (_,i)=>
        map[String(i)]?.completed
    ).length;

  $("path").innerHTML=
    lessons.map((l,i)=>{
      const p=
        map[String(i)];

      const color=
        getLessonReviewClass(p);

      const reviews=
        p?.review_count||0;

      let reviewDue=false;

      if(
        p?.completed&&
        reviews<
          settings.reviewGoal
      ){
        const distance=
          completedCount-(i+1);

        if(
          distance>0&&
          distance%
            settings.reviewEvery===0
        ){
          reviewDue=true;
        }
      }

      return `
        <div class="nodeRow">

          <button
            class="node ${color}"
            data-i="${i}"
            style="position:absolute;">

            ${
              p?.completed
                ?reviews>=2
                  ?"★"
                  :"✓"
                :l.icon
            }

            ${
              reviewDue
                ?'<span class="reviewBadge">복습</span>'
                :""
            }

          </button>

        </div>
      `;
    }).join("");

  document
    .querySelectorAll(".node")
    .forEach(b=>{
      b.onclick=()=>{
        openLesson(
          +b.dataset.i
        );
      };
    });
}


// ========================================
// 오늘 공부할 분량
// ========================================

async function updateDailyStudyQuota(){
  injectReviewStyles();

  let box=
    document.getElementById(
      "dailyStudyBox"
    );

  if(!box){
    box=
      document.createElement("div");

    box.id=
      "dailyStudyBox";

    box.className=
      "dailyStudyBox";

    const home=
      document.getElementById(
        "home"
      );

    if(home){
      const unit=
        home.querySelector(".unit");

      if(unit){
        unit.insertAdjacentElement(
          "afterend",
          box
        );
      }else{
        home.prepend(box);
      }
    }
  }

  if(!box)return;

  let result=
    await sb
      .from("curricula")
      .select(
        "id,title,target_score,exam_date"
      )
      .eq(
        "owner_id",
        user.id
      );

  if(result.error){
    // 구 DB에서도 앱 전체가 멈추지 않게
    box.innerHTML=`
      <b>📅 오늘 할 분량</b>
      <p class="msg">
        커리큘럼에 시험 날짜를 설정하면
        일일 학습량을 계산할 수 있어.
      </p>
    `;
    return;
  }

  const currs=
    result.data||[];

  const active=
    currs.filter(
      c=>
        c.exam_date&&
        daysUntil(c.exam_date)>=0
    );

  if(!active.length){
    box.innerHTML=`
      <b>📅 오늘 할 분량</b>
      <p class="msg">
        시험 날짜가 설정된 커리큘럼을 만들면
        오늘 공부할 분량을 계산해줄게.
      </p>
    `;
    return;
  }

  let newCount=0;
  let reviewCount=0;
  let mockCount=0;

  let closest=null;

  active.forEach(c=>{
    const days=
      Math.max(
        1,
        daysUntil(c.exam_date)
      );

    const goal=
      c.target_score??
      profile.target_score;

    const settings=
      getStudySettings(goal);

    const targetLessonCount=
      Math.max(
        lessons.length,
        Math.ceil(
          lessons.length*
          settings.lessonMultiplier
        )
      );

    newCount+=
      Math.max(
        1,
        Math.ceil(
          targetLessonCount/
          days
        )
      );

    reviewCount+=
      Math.max(
        1,
        Math.ceil(
          (
            targetLessonCount*
            settings.reviewGoal
          )/
          days
        )
      );

    if(
      days<=7||
      days%
        settings.mockEvery===0
    ){
      mockCount++;
    }

    if(
      !closest||
      days<closest.days
    ){
      closest={
        title:c.title,
        days
      };
    }
  });

  box.innerHTML=`
    <b>📅 오늘 할 분량</b>

    <p class="msg">
      ${escapeHtml(closest.title)}
      시험까지 D-${closest.days}
    </p>

    <div class="dailyNumbers">

      <div>
        <b>${newCount}</b>
        <small>새 레슨</small>
      </div>

      <div>
        <b>${reviewCount}</b>
        <small>복습</small>
      </div>

      <div>
        <b>${mockCount}</b>
        <small>모의시험</small>
      </div>

    </div>
  `;
}


// ========================================
// 모의시험
// ========================================

const mockQuestionBank={
  easy:[
    {
      q:"칭기즈 칸의 본명은?",
      a:[
        "테무친",
        "쿠빌라이",
        "훌라구"
      ],
      ok:0
    },
    {
      q:"몽골 제국이 세워진 해는?",
      a:[
        "1206년",
        "1271년",
        "1279년"
      ],
      ok:0
    },
    {
      q:"원이 건국된 해는?",
      a:[
        "1206년",
        "1271년",
        "1279년"
      ],
      ok:1
    }
  ],

  normal:[
    {
      q:"쿠빌라이 칸의 활동으로 옳은 것은?",
      a:[
        "대도로 천도하고 원을 세웠다.",
        "1206년에 칭기즈 칸이 되었다.",
        "아바스 왕조를 세웠다."
      ],
      ok:0
    },
    {
      q:"몽골군의 특징으로 옳은 것은?",
      a:[
        "여러 마리의 말을 갈아탔다.",
        "기병을 사용하지 않았다.",
        "무거운 군량만 사용하였다."
      ],
      ok:0
    },
    {
      q:"몽골이 이슬람 상인에게서 얻은 것은?",
      a:[
        "군사와 지리 정보",
        "왕위 계승권",
        "농민의 세금"
      ],
      ok:0
    }
  ],

  hard:[
    {
      q:"다음 사건의 순서로 옳은 것은?",
      a:[
        "몽골 제국 성립 → 원 건국 → 남송 멸망",
        "원 건국 → 몽골 제국 성립 → 남송 멸망",
        "남송 멸망 → 원 건국 → 몽골 제국 성립"
      ],
      ok:0
    },
    {
      q:"몽골군의 기동력과 가장 관련이 적은 것은?",
      a:[
        "여러 마리의 말",
        "보르츠",
        "기병을 사용하지 않음"
      ],
      ok:2
    },
    {
      q:"몽골 제국의 팽창에 관한 설명으로 옳은 것은?",
      a:[
        "아바스 왕조를 정복하였다.",
        "유럽 지역을 공격하지 않았다.",
        "중국 지역에는 진출하지 않았다."
      ],
      ok:0
    }
  ]
};

let currentMock=null;

function ensureMockExamUI(){
  let area=
    document.getElementById(
      "mockExamContainer"
    );

  if(area)return area;

  const planPage=
    document.getElementById(
      "plan"
    );

  if(!planPage)return null;

  const panel=
    planPage.querySelector(
      ".panel"
    )||planPage;

  area=
    document.createElement("div");

  area.id=
    "mockExamContainer";

  area.innerHTML=`
    <hr style="
      margin:26px 0;
      border:0;
      border-top:1px solid #dfe7ea;
    ">

    <h2>📝 모의시험</h2>

    <p class="msg">
      난이도를 선택해.
    </p>

    <div style="
      display:grid;
      grid-template-columns:repeat(3,1fr);
      gap:8px;
    ">

      <button
        id="mockEasy"
        style="
          padding:11px;
          border-radius:11px;
          background:#58cc42;
          color:#fff;
          font-weight:900;
        ">
        쉬움
      </button>

      <button
        id="mockNormal"
        style="
          padding:11px;
          border-radius:11px;
          background:#22afe8;
          color:#fff;
          font-weight:900;
        ">
        보통
      </button>

      <button
        id="mockHard"
        style="
          padding:11px;
          border-radius:11px;
          background:#222;
          color:#fff;
          font-weight:900;
        ">
        어려움
      </button>

    </div>

    <p
      id="mockResult"
      class="msg">
    </p>

    <div id="mockQuestions"></div>
  `;

  panel.appendChild(area);

  $("mockEasy").onclick=
    ()=>startMockExam("easy");

  $("mockNormal").onclick=
    ()=>startMockExam("normal");

  $("mockHard").onclick=
    ()=>startMockExam("hard");

  return area;
}

function startMockExam(level){
  ensureMockExamUI();

  const base=
    mockQuestionBank[level];

  const questionCount=
    level==="easy"
      ?5
      :level==="normal"
        ?7
        :10;

  const questions=[];

  while(
    questions.length<
    questionCount
  ){
    const shuffled=
      [...base]
        .sort(
          ()=>Math.random()-0.5
        );

    questions.push(...shuffled);
  }

  currentMock={
    level,
    questions:
      questions.slice(
        0,
        questionCount
      ),
    answers:
      Array(questionCount)
        .fill(null)
  };

  renderMockExam();
}

function renderMockExam(){
  if(!currentMock)return;

  const box=
    $("mockQuestions");

  box.innerHTML=
    currentMock.questions
      .map((q,qi)=>`
        <div
          style="
            background:#fff;
            border:1px solid #dfe7ea;
            border-radius:13px;
            padding:13px;
            margin-top:12px;
          ">

          <b>
            ${qi+1}.
            ${escapeHtml(q.q)}
          </b>

          ${q.a.map((choice,ci)=>`
            <button
              class="mockChoice"
              data-q="${qi}"
              data-c="${ci}"
              style="
                display:block;
                width:100%;
                text-align:left;
                margin-top:8px;
                padding:10px;
                border-radius:10px;
                border:
                  ${currentMock.answers[qi]===ci
                    ?"2px solid #22afe8"
                    :"2px solid #dce5e8"
                  };
                background:
                  ${currentMock.answers[qi]===ci
                    ?"#eef9fd"
                    :"white"
                  };
              ">
              ${ci+1}.
              ${escapeHtml(choice)}
            </button>
          `).join("")}

        </div>
      `)
      .join("")+

      `
      <button
        id="gradeMock"
        style="
          width:100%;
          margin-top:14px;
          padding:14px;
          border-radius:12px;
          background:#58cc42;
          color:#fff;
          font-weight:900;
        ">
        채점하기
      </button>
      `;

  document
    .querySelectorAll(
      ".mockChoice"
    )
    .forEach(btn=>{
      btn.onclick=()=>{
        currentMock.answers[
          +btn.dataset.q
        ]=
          +btn.dataset.c;

        renderMockExam();
      };
    });

  $("gradeMock").onclick=
    gradeMockExam;
}

function gradeMockExam(){
  if(
    currentMock.answers
      .some(x=>x===null)
  ){
    $("mockResult").textContent=
      "아직 풀지 않은 문제가 있어.";
    return;
  }

  let correct=0;

  currentMock.questions
    .forEach((q,i)=>{
      if(
        currentMock.answers[i]===
        q.ok
      ){
        correct++;
      }
    });

  const score=
    Math.round(
      correct/
      currentMock.questions.length*
      100
    );

  $("mockResult").textContent=
    `모의시험 결과: ${correct}/${currentMock.questions.length} · ${score}점`;
}


// ========================================
// 기존 render 확장
// ========================================

const baseRender=render;

render=async function(){
  await baseRender();

  setupCurriculumFileInput();

  injectReviewStyles();

  await renderReviewPath();

  await getCurrentRoom();

  renderRoomState();
  renderRoomBanner();

  await loadMyCurricula();

  if(currentRoom){
    await loadRoomCurricula();
    await loadChat();
    await subscribeChat();
  }

  await updateDailyStudyQuota();

  ensureMockExamUI();
};


// ========================================
// 복습 횟수 기록
// 기존 answer 함수를 감싸서 처리
// ========================================

const baseAnswer=answer;

answer=async function(button){
  if(answered)return;

  const lessonIndex=current;

  const beforeMap=
    await getProgressMap();

  const before=
    beforeMap[
      String(lessonIndex)
    ];

  const wasCompleted=
    !!before?.completed;

  const previousReviews=
    before?.review_count||0;

  const selected=
    +button.dataset.i;

  const correct=
    lessons[lessonIndex].ok;

  await baseAnswer(button);

  if(selected!==correct){
    return;
  }

  const afterMap=
    await getProgressMap();

  const now=
    new Date().toISOString();

  // 처음 완전히 끝낸 뒤 다시 풀었으면 복습 횟수 증가
  if(wasCompleted){
    const nextReview=
      previousReviews+1;

    const updateData={
      completed:true,
      best_score:100,
      updated_at:now,
      review_count:
        nextReview,
      last_reviewed_at:
        now
    };

    const {error}=await sb
      .from("lesson_progress")
      .update(updateData)
      .eq("user_id",user.id)
      .eq(
        "lesson_id",
        String(lessonIndex)
      );

    if(error){
      console.warn(
        "복습 컬럼 업데이트 실패:",
        error
      );
    }else{
      $("feedback").textContent=
        nextReview===1
          ?"복습 완료! 노란색 단계가 되었어."
          :"복습 완료! 검은색 단계가 되었어.";
    }

  }else{
    const p=
      afterMap[
        String(lessonIndex)
      ];

    if(p?.completed){
      const {error}=await sb
        .from("lesson_progress")
        .update({
          review_count:0,
          first_completed_at:
            now
        })
        .eq("user_id",user.id)
        .eq(
          "lesson_id",
          String(lessonIndex)
        );

      if(error){
        console.warn(
          "첫 완료 시간 기록 실패:",
          error
        );
      }
    }
  }

  await render();
};


// ========================================
// 초기 실행
// ========================================

setupCurriculumFileInput();

init();
