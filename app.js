// ================================
// StudyLoop FINAL - 1/3
// 기본 역사 레슨 없음
// 커리큘럼별 레슨을 Supabase에서 불러오는 구조
// ================================

const cfg=window.STUDYLOOP_CONFIG||{};

let sb=null;
let user=null;
let profile=null;
let currentRoom=null;

let currentCurriculum=null;
let currentLessons=[];
let currentLessonIndex=0;
let answered=false;

const $=id=>document.getElementById(id);

function safeText(id,text){
  const el=$(id);
  if(el)el.textContent=text;
}

function escapeHtml(value){
  return String(value??"")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function normalizeId(raw){
  return String(raw||"")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g,"");
}

function idToEmail(id){
  return `${id}@studyloop.local`;
}

function daysUntil(dateString){
  if(!dateString)return null;

  const today=new Date();
  today.setHours(0,0,0,0);

  const target=new Date(
    dateString+"T00:00:00"
  );

  return Math.ceil(
    (target-today)/86400000
  );
}

function getStudySettings(goal){
  goal=Number(goal)||0;

  if(goal>=95){
    return{
      lessonMultiplier:1.6,
      reviewEvery:1,
      reviewGoal:2,
      mockEvery:2
    };
  }

  if(goal>=85){
    return{
      lessonMultiplier:1.3,
      reviewEvery:2,
      reviewGoal:2,
      mockEvery:3
    };
  }

  if(goal>=70){
    return{
      lessonMultiplier:1,
      reviewEvery:2,
      reviewGoal:1,
      mockEvery:4
    };
  }

  return{
    lessonMultiplier:0.8,
    reviewEvery:3,
    reviewGoal:1,
    mockEvery:5
  };
}


// ================================
// 시작
// ================================

async function init(){
  if(
    !cfg.SUPABASE_URL||
    !cfg.SUPABASE_PUBLISHABLE_KEY
  ){
    safeText(
      "setupMsg",
      "Supabase 연결값이 아직 설정되지 않았어."
    );
    return;
  }

  sb=supabase.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_PUBLISHABLE_KEY
  );

  setupDynamicUI();
  setupFileInput();

  const {
    data:{session}
  }=await sb.auth.getSession();

  if(!session){
    showLoginScreen();
    return;
  }

  user=session.user;

  const {
    data:p,
    error
  }=await sb
    .from("profiles")
    .select("*")
    .eq("id",user.id)
    .maybeSingle();

  if(error||!p){
    console.error(error);
    showLoginScreen();
    return;
  }

  profile=p;

  await afterLogin();
}

async function afterLogin(){
  if(!user||!profile)return;

  if($("setup")){
    $("setup")
      .classList
      .add("hidden");
  }

  if($("app")){
    $("app")
      .classList
      .remove("hidden");
  }

  await getCurrentRoom();

  renderProfile();
  renderRoomState();
  renderRoomBanner();

  await loadCurriculumChooser();
  await loadMyCurricula();
  await loadRoomCurricula();
  await loadRanking();
  await loadChat();
  await subscribeChat();

  await selectInitialCurriculum();
}


// ================================
// 로그인 / 회원가입
// ================================

function showLoginScreen(){
  if($("setup")){
    $("setup")
      .classList
      .remove("hidden");
  }

  if($("app")){
    $("app")
      .classList
      .add("hidden");
  }

  if($("loginFields")){
    $("loginFields")
      .classList
      .remove("hidden");
  }

  if($("signupFields")){
    $("signupFields")
      .classList
      .add("hidden");
  }

  safeText(
    "authTitle",
    "로그인"
  );
}

if($("showSignupBtn")){
  $("showSignupBtn").onclick=()=>{
    safeText(
      "authTitle",
      "회원가입"
    );

    $("loginFields")
      ?.classList
      .add("hidden");

    $("signupFields")
      ?.classList
      .remove("hidden");

    safeText(
      "setupMsg",
      ""
    );
  };
}

if($("showLoginBtn")){
  $("showLoginBtn").onclick=()=>{
    showLoginScreen();

    safeText(
      "setupMsg",
      ""
    );
  };
}

if($("signupBtn")){
  $("signupBtn").onclick=async()=>{
    const id=
      normalizeId(
        $("signupId")?.value
      );

    const pw=
      $("signupPw")?.value||"";

    const name=
      $("signupName")?.value
        ?.trim()||"";

    const goal=
      Number(
        $("signupGoal")?.value
      );

    if(id.length<3){
      safeText(
        "setupMsg",
        "아이디는 영문/숫자로 3자 이상 입력해."
      );
      return;
    }

    if(pw.length<6){
      safeText(
        "setupMsg",
        "비밀번호는 6자 이상이어야 해."
      );
      return;
    }

    if(!name){
      safeText(
        "setupMsg",
        "이름을 입력해."
      );
      return;
    }

    if(
      !Number.isFinite(goal)||
      goal<0||
      goal>100
    ){
      safeText(
        "setupMsg",
        "목표 점수는 0~100 사이로 입력해."
      );
      return;
    }

    safeText(
      "setupMsg",
      "계정 만드는 중..."
    );

    const {
      data,
      error
    }=await sb.auth.signUp({
      email:idToEmail(id),
      password:pw
    });

    if(error){
      console.error(error);

      safeText(
        "setupMsg",
        "회원가입에 실패했어: "+
        error.message
      );
      return;
    }

    if(!data.session){
      safeText(
        "setupMsg",
        "Supabase에서 Confirm email을 꺼야 해."
      );
      return;
    }

    user=data.user;

    const {
      data:p,
      error:profileError
    }=await sb
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
      console.error(profileError);

      safeText(
        "setupMsg",
        "프로필 생성 실패: "+
        profileError.message
      );
      return;
    }

    profile=p;
    currentRoom=null;

    await afterLogin();
  };
}

if($("loginBtn")){
  $("loginBtn").onclick=async()=>{
    const id=
      normalizeId(
        $("loginId")?.value
      );

    const pw=
      $("loginPw")?.value||"";

    if(!id||!pw){
      safeText(
        "setupMsg",
        "아이디와 비밀번호를 입력해."
      );
      return;
    }

    safeText(
      "setupMsg",
      "로그인 중..."
    );

    const {
      data,
      error
    }=await sb.auth
      .signInWithPassword({
        email:idToEmail(id),
        password:pw
      });

    if(error){
      console.error(error);

      safeText(
        "setupMsg",
        "로그인 실패: 아이디 또는 비밀번호를 확인해."
      );
      return;
    }

    user=data.user;

    const {
      data:p,
      error:profileError
    }=await sb
      .from("profiles")
      .select("*")
      .eq("id",user.id)
      .maybeSingle();

    if(profileError||!p){
      console.error(profileError);

      safeText(
        "setupMsg",
        "프로필을 불러오지 못했어."
      );
      return;
    }

    profile=p;

    await afterLogin();
  };
}


// ================================
// 프로필 표시
// ================================

function renderProfile(){
  if(!profile)return;

  safeText(
    "xp",
    profile.xp??0
  );

  safeText(
    "goalTop",
    profile.target_score??0
  );

  safeText(
    "profileName",
    profile.name
  );

  safeText(
    "profileGoal",
    `기본 목표 ${profile.target_score}점`
  );

  safeText(
    "profileXp",
    `${profile.xp??0} XP`
  );

  if($("newNameInput")){
    $("newNameInput").placeholder=
      "현재 이름: "+
      profile.name;
  }
}


// ================================
// 동적 UI 생성
// ================================

function setupDynamicUI(){
  injectStudyStyles();
  ensureCurriculumChooser();
  ensureEmptyLessonMessage();
  ensureDailyStudyBox();
  ensureMockExamUI();
}

function injectStudyStyles(){
  if(
    document.getElementById(
      "studyloopDynamicStyles"
    )
  ){
    return;
  }

  const style=
    document.createElement(
      "style"
    );

  style.id=
    "studyloopDynamicStyles";

  style.textContent=`

    .curriculum-select-box{
      margin:0 18px 16px;
      padding:15px;
      background:#ffffff;
      color:#203037;
      border-radius:16px;
    }

    .curriculum-select-box select{
      width:100%;
      margin-top:8px;
      padding:12px;
      border-radius:12px;
      border:2px solid #dce6e9;
      font-weight:800;
      background:#fff;
    }

    .study-empty{
      margin:20px 18px;
      padding:22px;
      border-radius:18px;
      background:#ffffff;
      color:#52646a;
      text-align:center;
      font-weight:800;
    }

    .node.review-green{
      background:#58cc42!important;
      box-shadow:0 8px 0 #3da52f!important;
      color:#fff!important;
    }

    .node.review-yellow{
      background:#f3c94b!important;
      box-shadow:0 8px 0 #b68d13!important;
      color:#222!important;
    }

    .node.review-black{
      background:#111!important;
      box-shadow:0 8px 0 #000!important;
      color:#fff!important;
    }

    .lessonReviewBadge{
      position:absolute;
      right:-14px;
      top:-10px;
      background:#ff735a;
      color:white;
      border-radius:999px;
      padding:4px 7px;
      font-size:10px;
      font-weight:900;
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

    .dailyNumbers > div{
      text-align:center;
      background:#eef6f8;
      border-radius:11px;
      padding:10px 4px;
    }

    .dailyNumbers b{
      display:block;
      font-size:20px;
    }

    .curriculum-card{
      margin-top:10px;
      padding:14px;
      border-radius:14px;
      background:#fff;
      border:1px solid #dce6e9;
    }

    .curriculum-card.active{
      border:3px solid #58cc42;
    }

    .curriculum-card button{
      margin-top:8px;
      margin-right:5px;
      padding:8px 10px;
      border-radius:9px;
      color:#fff;
      font-weight:900;
    }

    .resource-btn{
      background:#22afe8;
    }

    .share-btn{
      background:#58cc42;
    }

    .study-btn{
      background:#8c63e6;
    }

    .mock-question-card{
      margin-top:12px;
      background:#fff;
      border:1px solid #dce6e9;
      border-radius:14px;
      padding:14px;
    }

    .mock-answer{
      width:100%;
      display:block;
      margin-top:8px;
      padding:11px;
      border-radius:11px;
      border:2px solid #dce6e9;
      background:#fff;
      text-align:left;
      font-weight:800;
    }

    .mock-answer.selected{
      border-color:#22afe8;
      background:#eef9fd;
    }

  `;

  document.head.appendChild(
    style
  );
}

function ensureCurriculumChooser(){
  if(
    document.getElementById(
      "curriculumChooserBox"
    )
  ){
    return;
  }

  const home=$("home");

  if(!home)return;

  const box=
    document.createElement(
      "div"
    );

  box.id=
    "curriculumChooserBox";

  box.className=
    "curriculum-select-box";

  box.innerHTML=`
    <b>📚 현재 커리큘럼</b>

    <select id="activeCurriculumSelect">
      <option value="">
        커리큘럼 선택
      </option>
    </select>

    <p
      id="activeCurriculumInfo"
      class="msg"
      style="margin-bottom:0;">
    </p>
  `;

  const unit=
    home.querySelector(
      ".unit"
    );

  if(unit){
    unit.insertAdjacentElement(
      "beforebegin",
      box
    );
  }else{
    home.prepend(box);
  }

  $("activeCurriculumSelect")
    .onchange=async()=>{
      const id=
        $("activeCurriculumSelect")
          .value;

      if(!id){
        clearCurrentCurriculum();
        return;
      }

      await selectCurriculum(id);
    };
}

function ensureEmptyLessonMessage(){
  if(
    document.getElementById(
      "noLessonsMessage"
    )
  ){
    return;
  }

  const path=$("path");

  if(!path)return;

  const msg=
    document.createElement(
      "div"
    );

  msg.id=
    "noLessonsMessage";

  msg.className=
    "study-empty hidden";

  msg.innerHTML=`
    아직 학습할 레슨이 없어.<br>
    PDF 또는 사진으로 커리큘럼을 만들고
    레슨을 추가해줘.
  `;

  path.insertAdjacentElement(
    "beforebegin",
    msg
  );
}

function ensureDailyStudyBox(){
  if(
    document.getElementById(
      "dailyStudyBox"
    )
  ){
    return;
  }

  const home=$("home");

  if(!home)return;

  const box=
    document.createElement(
      "div"
    );

  box.id=
    "dailyStudyBox";

  box.className=
    "dailyStudyBox";

  box.innerHTML=`
    <b>📅 오늘 할 분량</b>

    <p class="msg">
      커리큘럼을 선택하면 계산해줄게.
    </p>
  `;

  const chooser=
    document.getElementById(
      "curriculumChooserBox"
    );

  if(chooser){
    chooser.insertAdjacentElement(
      "afterend",
      box
    );
  }else{
    home.prepend(box);
  }
}


// ================================
// 커리큘럼 접근 목록
// 내 것 + 방에서 공유받은 것
// ================================

async function getAccessibleCurricula(){
  if(!user)return[];

  const {
    data:mine,
    error:mineError
  }=await sb
    .from("curricula")
    .select("*")
    .eq("owner_id",user.id)
    .order(
      "created_at",
      {ascending:false}
    );

  if(mineError){
    console.error(mineError);
  }

  let shared=[];

  if(currentRoom){
    const {
      data:shares,
      error:shareError
    }=await sb
      .from("room_curricula")
      .select("curriculum_id")
      .eq(
        "room_id",
        currentRoom.id
      );

    if(!shareError&&shares?.length){
      const ids=
        shares.map(
          x=>x.curriculum_id
        );

      const {
        data:sharedRows,
        error:sharedError
      }=await sb
        .from("curricula")
        .select("*")
        .in("id",ids);

      if(!sharedError){
        shared=
          sharedRows||[];
      }
    }
  }

  const all=[
    ...(mine||[]),
    ...shared
  ];

  const map=new Map();

  all.forEach(c=>{
    map.set(c.id,c);
  });

  return[
    ...map.values()
  ];
}

async function loadCurriculumChooser(){
  const select=
    $("activeCurriculumSelect");

  if(!select)return;

  const curricula=
    await getAccessibleCurricula();

  const previous=
    currentCurriculum?.id||"";

  select.innerHTML=`
    <option value="">
      커리큘럼 선택
    </option>
    ${
      curricula.map(c=>`
        <option
          value="${c.id}">
          ${escapeHtml(c.title)}
        </option>
      `).join("")
    }
  `;

  if(
    previous&&
    curricula.some(
      c=>c.id===previous
    )
  ){
    select.value=previous;
  }
}

async function selectInitialCurriculum(){
  const curricula=
    await getAccessibleCurricula();

  if(!curricula.length){
    clearCurrentCurriculum();
    return;
  }

  const savedId=
    localStorage.getItem(
      "studyloop_active_curriculum"
    );

  let chosen=
    curricula.find(
      c=>c.id===savedId
    );

  if(!chosen){
    chosen=curricula[0];
  }

  await selectCurriculum(
    chosen.id
  );
}

function clearCurrentCurriculum(){
  currentCurriculum=null;
  currentLessons=[];

  localStorage.removeItem(
    "studyloop_active_curriculum"
  );

  safeText(
    "activeCurriculumInfo",
    "커리큘럼을 선택해."
  );

  if($("hello")){
    $("hello").textContent=
      `${profile?.name||""} · 커리큘럼 없음`;
  }

  if($("path")){
    $("path").innerHTML="";
  }

  $("noLessonsMessage")
    ?.classList
    .remove("hidden");

  renderDailyStudyQuota();
}

async function selectCurriculum(id){
  const curricula=
    await getAccessibleCurricula();

  const curriculum=
    curricula.find(
      c=>c.id===id
    );

  if(!curriculum){
    clearCurrentCurriculum();
    return;
  }

  currentCurriculum=
    curriculum;

  localStorage.setItem(
    "studyloop_active_curriculum",
    curriculum.id
  );

  if($("activeCurriculumSelect")){
    $("activeCurriculumSelect")
      .value=
      curriculum.id;
  }

  await loadCurrentLessons();

  renderActiveCurriculumInfo();
  await renderLearningPath();
  await renderDailyStudyQuota();
  ensureMockExamUI();
}

function renderActiveCurriculumInfo(){
  if(!currentCurriculum)return;

  const goal=
    currentCurriculum
      .target_score??
    profile.target_score;

  const days=
    daysUntil(
      currentCurriculum
        .exam_date
    );

  let dateText="";

  if(days===0){
    dateText=" · 오늘 시험";
  }else if(
    typeof days==="number"&&
    days>0
  ){
    dateText=
      ` · D-${days}`;
  }

  safeText(
    "activeCurriculumInfo",
    `목표 ${goal}점${dateText}`
  );

  if($("hello")){
    $("hello").textContent=
      `${profile.name} · ${currentCurriculum.title}`;
  }
}


// ================================
// 선택된 커리큘럼의 레슨
// ================================

async function loadCurrentLessons(){
  if(!currentCurriculum){
    currentLessons=[];
    return;
  }

  const {
    data,
    error
  }=await sb
    .from("curriculum_lessons")
    .select("*")
    .eq(
      "curriculum_id",
      currentCurriculum.id
    )
    .order(
      "lesson_order",
      {ascending:true}
    );

  if(error){
    console.error(error);
    currentLessons=[];
    return;
  }

  currentLessons=data||[];
}

async function getCurrentProgress(){
  if(
    !user||
    !currentLessons.length
  ){
    return[];
  }

  const ids=
    currentLessons.map(
      l=>l.id
    );

  const {
    data,
    error
  }=await sb
    .from(
      "curriculum_lesson_progress"
    )
    .select("*")
    .eq("user_id",user.id)
    .in("lesson_id",ids);

  if(error){
    console.error(error);
    return[];
  }

  return data||[];
}

function progressClass(p){
  if(
    !p||
    !p.completed
  ){
    return"";
  }

  const reviews=
    p.review_count||0;

  if(reviews===0){
    return"review-green";
  }

  if(reviews===1){
    return"review-yellow";
  }

  return"review-black";
}

async function renderLearningPath(){
  const path=$("path");

  if(!path)return;

  if(
    !currentCurriculum||
    !currentLessons.length
  ){
    path.innerHTML="";

    $("noLessonsMessage")
      ?.classList
      .remove("hidden");

    return;
  }

  $("noLessonsMessage")
    ?.classList
    .add("hidden");

  const progress=
    await getCurrentProgress();

  const progressMap=
    new Map(
      progress.map(
        p=>[p.lesson_id,p]
      )
    );

  const settings=
    getStudySettings(
      currentCurriculum
        .target_score??
      profile.target_score
    );

  const completedCount=
    currentLessons.filter(
      l=>
        progressMap
          .get(l.id)
          ?.completed
    ).length;

  path.innerHTML=
    currentLessons.map(
      (lesson,index)=>{
        const p=
          progressMap.get(
            lesson.id
          );

        const reviewCount=
          p?.review_count||0;

        let reviewDue=false;

        if(
          p?.completed&&
          reviewCount<
            settings.reviewGoal
        ){
          const distance=
            completedCount-
            (index+1);

          if(
            distance>0&&
            distance%
              settings.reviewEvery===0
          ){
            reviewDue=true;
          }
        }

        const icon=
          p?.completed
            ?reviewCount>=2
              ?"★"
              :"✓"
            :lesson.icon||"📖";

        return`
          <div class="nodeRow">

            <button
              class="node ${progressClass(p)}"
              data-lesson-index="${index}"
              style="position:relative;">

              ${icon}

              ${
                reviewDue
                  ?`
                    <span
                      class="lessonReviewBadge">
                      복습
                    </span>
                  `
                  :""
              }

            </button>

          </div>
        `;
      }
    ).join("");

  document
    .querySelectorAll(
      "[data-lesson-index]"
    )
    .forEach(btn=>{
      btn.onclick=()=>{
        openLesson(
          Number(
            btn.dataset
              .lessonIndex
          )
        );
      };
    });
}
// ================================
// 레슨 열기 / 정답 처리 / XP / 복습
// ================================

function normalizeAnswers(value){
  if(Array.isArray(value))return value;

  if(typeof value==="string"){
    try{
      const parsed=JSON.parse(value);
      return Array.isArray(parsed)?parsed:[];
    }catch{
      return[];
    }
  }

  return[];
}

function openLesson(index){
  const lesson=currentLessons[index];

  if(!lesson)return;

  currentLessonIndex=index;
  answered=false;

  const answers=
    normalizeAnswers(
      lesson.answers
    );

  safeText(
    "ltitle",
    lesson.title||`레슨 ${index+1}`
  );

  safeText(
    "concept",
    lesson.concept||
    "학습 내용을 확인해."
  );

  safeText(
    "question",
    lesson.question||
    "내용을 충분히 읽었으면 완료해."
  );

  if($("bar")){
    $("bar").style.width=
      `${((index+1)/currentLessons.length)*100}%`;
  }

  if($("answers")){
    if(
      lesson.question&&
      answers.length
    ){
      $("answers").innerHTML=
        answers.map(
          (answer,i)=>`
            <button
              class="ans"
              data-answer-index="${i}">
              ${i+1}. ${escapeHtml(answer)}
            </button>
          `
        ).join("");

      document
        .querySelectorAll(
          "[data-answer-index]"
        )
        .forEach(btn=>{
          btn.onclick=()=>{
            answerLesson(
              Number(
                btn.dataset.answerIndex
              )
            );
          };
        });
    }else{
      $("answers").innerHTML=`
        <button
          id="completeReadingLesson"
          class="ans">
          학습 완료
        </button>
      `;

      $("completeReadingLesson")
        .onclick=()=>{
          completeReadingLesson();
        };
    }
  }

  safeText(
    "feedback",
    ""
  );

  $("next")
    ?.classList
    .add("hidden");

  $("lesson")
    ?.classList
    .remove("hidden");
}

async function getOneProgress(
  lessonId
){
  const {
    data,
    error
  }=await sb
    .from(
      "curriculum_lesson_progress"
    )
    .select("*")
    .eq(
      "user_id",
      user.id
    )
    .eq(
      "lesson_id",
      lessonId
    )
    .maybeSingle();

  if(error){
    console.error(error);
    return null;
  }

  return data||null;
}

async function awardXp(amount){
  const oldXp=
    Number(profile.xp)||0;

  const newXp=
    oldXp+amount;

  const {error}=
    await sb
      .from("profiles")
      .update({
        xp:newXp
      })
      .eq("id",user.id);

  if(error){
    console.error(error);
    return false;
  }

  profile.xp=newXp;

  renderProfile();

  return true;
}

async function markLessonCorrect(
  lesson
){
  const existing=
    await getOneProgress(
      lesson.id
    );

  const now=
    new Date().toISOString();

  // 처음 완료
  if(
    !existing||
    !existing.completed
  ){
    const {error}=
      await sb
        .from(
          "curriculum_lesson_progress"
        )
        .upsert({
          user_id:user.id,
          lesson_id:lesson.id,
          completed:true,
          best_score:100,
          review_count:0,
          first_completed_at:
            existing
              ?.first_completed_at||
            now,
          updated_at:now
        });

    if(error){
      console.error(error);

      safeText(
        "feedback",
        "진도 저장에 실패했어: "+
        error.message
      );

      return;
    }

    const gotXp=
      await awardXp(20);

    safeText(
      "feedback",
      gotXp
        ?"정답! +20 XP · 레슨 완료!"
        :"정답! 레슨을 완료했어."
    );

    return;
  }

  // 이미 완료한 레슨을 다시 맞힘 = 복습
  const newReviewCount=
    Math.min(
      (existing.review_count||0)+1,
      2
    );

  const {error}=
    await sb
      .from(
        "curriculum_lesson_progress"
      )
      .update({
        completed:true,
        best_score:100,
        review_count:
          newReviewCount,
        last_reviewed_at:now,
        updated_at:now
      })
      .eq(
        "user_id",
        user.id
      )
      .eq(
        "lesson_id",
        lesson.id
      );

  if(error){
    console.error(error);

    safeText(
      "feedback",
      "복습 기록 저장에 실패했어."
    );

    return;
  }

  if(newReviewCount===1){
    safeText(
      "feedback",
      "복습 완료! 이 레슨은 노란색이 되었어."
    );
  }else{
    safeText(
      "feedback",
      "복습 완료! 이 레슨은 검은색이 되었어."
    );
  }
}

async function answerLesson(
  selectedIndex
){
  if(answered)return;

  const lesson=
    currentLessons[
      currentLessonIndex
    ];

  if(!lesson)return;

  answered=true;

  const correctIndex=
    Number(
      lesson.correct_answer
    );

  const buttons=[
    ...document.querySelectorAll(
      "[data-answer-index]"
    )
  ];

  if(
    Number.isInteger(
      correctIndex
    )&&
    buttons[correctIndex]
  ){
    buttons[
      correctIndex
    ].classList.add(
      "good"
    );
  }

  if(
    selectedIndex!==
    correctIndex
  ){
    buttons[
      selectedIndex
    ]?.classList.add(
      "bad"
    );

    safeText(
      "feedback",
      "오답이야. 정답을 확인하고 다시 복습해."
    );

    $("next")
      ?.classList
      .remove("hidden");

    return;
  }

  await markLessonCorrect(
    lesson
  );

  $("next")
    ?.classList
    .remove("hidden");

  await renderLearningPath();
  await renderDailyStudyQuota();
}

async function completeReadingLesson(){
  if(answered)return;

  const lesson=
    currentLessons[
      currentLessonIndex
    ];

  if(!lesson)return;

  answered=true;

  await markLessonCorrect(
    lesson
  );

  $("next")
    ?.classList
    .remove("hidden");

  await renderLearningPath();
  await renderDailyStudyQuota();
}

if($("next")){
  $("next").onclick=()=>{
    if(
      currentLessonIndex<
      currentLessons.length-1
    ){
      openLesson(
        currentLessonIndex+1
      );
    }else{
      $("lesson")
        ?.classList
        .add("hidden");
    }
  };
}

if($("close")){
  $("close").onclick=()=>{
    $("lesson")
      ?.classList
      .add("hidden");
  };
}


// ================================
// 오늘 학습량
// ================================

async function renderDailyStudyQuota(){
  const box=$("dailyStudyBox");

  if(!box)return;

  if(!currentCurriculum){
    box.innerHTML=`
      <b>📅 오늘 할 분량</b>
      <p class="msg">
        커리큘럼을 선택하면
        오늘 공부할 분량을 계산해줄게.
      </p>
    `;
    return;
  }

  if(!currentLessons.length){
    box.innerHTML=`
      <b>📅 오늘 할 분량</b>
      <p class="msg">
        이 커리큘럼에는 아직 레슨이 없어.
      </p>
    `;
    return;
  }

  const progress=
    await getCurrentProgress();

  const map=
    new Map(
      progress.map(
        p=>[p.lesson_id,p]
      )
    );

  const unfinished=
    currentLessons.filter(
      lesson=>
        !map.get(
          lesson.id
        )?.completed
    );

  const reviewNeeded=
    currentLessons.filter(
      lesson=>{
        const p=
          map.get(lesson.id);

        return(
          p?.completed&&
          (p.review_count||0)<2
        );
      }
    );

  const goal=
    currentCurriculum
      .target_score??
    profile.target_score;

  const settings=
    getStudySettings(goal);

  const rawDays=
    daysUntil(
      currentCurriculum
        .exam_date
    );

  const days=
    typeof rawDays==="number"&&
    rawDays>=0
      ?Math.max(1,rawDays)
      :null;

  let newToday=0;
  let reviewToday=0;
  let mockToday=0;

  if(days){
    newToday=
      Math.min(
        unfinished.length,
        Math.max(
          unfinished.length?1:0,
          Math.ceil(
            unfinished.length/
            days*
            settings.lessonMultiplier
          )
        )
      );

    reviewToday=
      Math.min(
        reviewNeeded.length,
        Math.max(
          reviewNeeded.length?1:0,
          Math.ceil(
            reviewNeeded.length/
            days
          )
        )
      );

    if(
      days<=7||
      days%
        settings.mockEvery===0
    ){
      mockToday=1;
    }
  }else{
    newToday=
      Math.min(
        unfinished.length,
        Math.max(
          unfinished.length?1:0,
          Math.ceil(
            settings.lessonMultiplier
          )
        )
      );

    reviewToday=
      Math.min(
        reviewNeeded.length,
        reviewNeeded.length?1:0
      );
  }

  let dateText="시험 날짜 미설정";

  if(rawDays===0){
    dateText="오늘 시험";
  }else if(
    typeof rawDays==="number"&&
    rawDays>0
  ){
    dateText=`시험까지 D-${rawDays}`;
  }else if(
    typeof rawDays==="number"&&
    rawDays<0
  ){
    dateText="시험 날짜 지남";
  }

  box.innerHTML=`
    <b>📅 오늘 할 분량</b>

    <p class="msg">
      ${escapeHtml(
        currentCurriculum.title
      )}
      · ${dateText}
      · 목표 ${goal}점
    </p>

    <div class="dailyNumbers">

      <div>
        <b>${newToday}</b>
        <small>새 레슨</small>
      </div>

      <div>
        <b>${reviewToday}</b>
        <small>복습</small>
      </div>

      <div>
        <b>${mockToday}</b>
        <small>모의시험</small>
      </div>

    </div>
  `;
}


// ================================
// 방
// ================================

function makeRoomCode(){
  return Math.random()
    .toString(36)
    .slice(2,8)
    .toUpperCase();
}

async function getCurrentRoom(){
  if(!user){
    currentRoom=null;
    return null;
  }

  const {
    data:members,
    error
  }=await sb
    .from("room_members")
    .select(
      "room_id,joined_at"
    )
    .eq(
      "user_id",
      user.id
    )
    .order(
      "joined_at",
      {ascending:true}
    )
    .limit(1);

  if(error){
    console.error(error);
    currentRoom=null;
    return null;
  }

  if(!members?.length){
    currentRoom=null;
    return null;
  }

  const {
    data:room,
    error:roomError
  }=await sb
    .from("rooms")
    .select("*")
    .eq(
      "id",
      members[0].room_id
    )
    .maybeSingle();

  if(roomError){
    console.error(roomError);
    currentRoom=null;
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
    box?.classList.remove(
      "hidden"
    );

    safeText(
      "currentRoomName",
      currentRoom.name
    );

    safeText(
      "currentRoomCode",
      currentRoom.code
    );

    if(createBtn){
      createBtn.disabled=true;
      createBtn.textContent=
        "이미 방 있음";
    }

    if(joinBtn){
      joinBtn.disabled=true;
      joinBtn.textContent=
        "참가 중";
    }

    if(roomName){
      roomName.disabled=true;
    }

    if(roomCode){
      roomCode.disabled=true;
    }

    return;
  }

  box?.classList.add(
    "hidden"
  );

  if(createBtn){
    createBtn.disabled=false;
    createBtn.textContent=
      "방 만들기";
  }

  if(joinBtn){
    joinBtn.disabled=false;
    joinBtn.textContent=
      "참가";
  }

  if(roomName){
    roomName.disabled=false;
  }

  if(roomCode){
    roomCode.disabled=false;
  }
}

function renderRoomBanner(){
  const banner=$("roomBanner");

  if(!banner)return;

  if(!currentRoom){
    banner.classList.add(
      "hidden"
    );
    return;
  }

  banner.classList.remove(
    "hidden"
  );

  safeText(
    "roomBannerName",
    currentRoom.name
  );

  safeText(
    "roomBannerCode",
    currentRoom.code
  );
}

if($("createRoom")){
  $("createRoom").onclick=async()=>{
    const existing=
      await getCurrentRoom();

    if(existing){
      safeText(
        "roomInfo",
        `이미 '${existing.name}' 방에 참가 중이야. 방 코드: ${existing.code}`
      );

      renderRoomState();
      renderRoomBanner();
      return;
    }

    const name=
      $("roomName")
        ?.value
        ?.trim()||
      "공부방";

    let room=null;

    for(let attempt=0;
        attempt<5;
        attempt++
    ){
      const code=
        makeRoomCode();

      const {
        data,
        error
      }=await sb
        .from("rooms")
        .insert({
          code,
          name,
          owner_id:user.id
        })
        .select()
        .single();

      if(!error){
        room=data;
        break;
      }

      console.warn(error);
    }

    if(!room){
      safeText(
        "roomInfo",
        "방 생성에 실패했어."
      );
      return;
    }

    const {
      error:joinError
    }=await sb
      .from("room_members")
      .insert({
        room_id:room.id,
        user_id:user.id
      });

    if(joinError){
      console.error(joinError);

      safeText(
        "roomInfo",
        "방 참가 처리 실패: "+
        joinError.message
      );
      return;
    }

    currentRoom=room;

    safeText(
      "roomInfo",
      `${room.name} 방 생성 완료 · 코드: ${room.code}`
    );

    renderRoomState();
    renderRoomBanner();

    await loadRanking();
    await loadCurriculumChooser();
    await loadRoomCurricula();
    await subscribeChat();
  };
}

if($("joinRoom")){
  $("joinRoom").onclick=async()=>{
    const existing=
      await getCurrentRoom();

    if(existing){
      safeText(
        "roomInfo",
        `이미 '${existing.name}' 방에 참가 중이야.`
      );
      return;
    }

    const code=
      $("roomCode")
        ?.value
        ?.trim()
        .toUpperCase();

    if(!code){
      safeText(
        "roomInfo",
        "방 코드를 입력해."
      );
      return;
    }

    const {
      data:room,
      error
    }=await sb
      .from("rooms")
      .select("*")
      .eq("code",code)
      .maybeSingle();

    if(error||!room){
      console.error(error);

      safeText(
        "roomInfo",
        "방을 찾지 못했어."
      );
      return;
    }

    const {
      error:joinError
    }=await sb
      .from("room_members")
      .insert({
        room_id:room.id,
        user_id:user.id
      });

    if(joinError){
      console.error(joinError);

      safeText(
        "roomInfo",
        "방 참가 실패: "+
        joinError.message
      );
      return;
    }

    currentRoom=room;

    safeText(
      "roomInfo",
      `${room.name} 참가 완료 · ${room.code}`
    );

    renderRoomState();
    renderRoomBanner();

    await loadRanking();
    await loadRoomCurricula();
    await loadCurriculumChooser();
    await loadChat();
    await subscribeChat();
  };
}


// ================================
// 랭킹 / 강퇴
// ================================

async function loadRanking(){
  if(!$("ranking"))return;

  if(!currentRoom){
    $("ranking").innerHTML=
      "<p>방을 만들거나 코드로 참가해.</p>";
    return;
  }

  const {
    data:members,
    error
  }=await sb
    .from("room_members")
    .select("user_id")
    .eq(
      "room_id",
      currentRoom.id
    );

  if(error){
    console.error(error);
    return;
  }

  const ids=
    (members||[])
      .map(x=>x.user_id);

  if(!ids.length){
    $("ranking").innerHTML="";
    return;
  }

  const {
    data:profiles,
    error:profileError
  }=await sb
    .from("profiles")
    .select("id,name,xp")
    .in("id",ids);

  if(profileError){
    console.error(
      profileError
    );
    return;
  }

  const sorted=
    (profiles||[])
      .sort(
        (a,b)=>
          (b.xp||0)-
          (a.xp||0)
      );

  const amOwner=
    currentRoom.owner_id===
    user.id;

  $("ranking").innerHTML=
    sorted.map((p,index)=>{
      const isOwner=
        p.id===
        currentRoom.owner_id;

      const canKick=
        amOwner&&
        p.id!==user.id;

      return`
        <div
          class="rankrow"
          style="
            grid-template-columns:
            35px 1fr auto auto;
            gap:8px;
            align-items:center;
          ">

          <b>${index+1}</b>

          <span>
            ${escapeHtml(p.name)}
            ${p.id===user.id
              ?" (나)"
              :""
            }
            ${isOwner
              ?" 👑"
              :""
            }
          </span>

          <b>
            ${p.xp||0} XP
          </b>

          ${
            canKick
              ?`
                <button
                  class="kickBtn"
                  data-user="${p.id}"
                  data-name="${escapeHtml(p.name)}">
                  강퇴
                </button>
              `
              :""
          }

        </div>
      `;
    }).join("");

  document
    .querySelectorAll(
      ".kickBtn"
    )
    .forEach(btn=>{
      btn.onclick=()=>{
        kickMember(
          btn.dataset.user,
          btn.dataset.name
        );
      };
    });
}

async function kickMember(
  memberId,
  memberName
){
  if(
    !currentRoom||
    currentRoom.owner_id!==
    user.id
  ){
    alert(
      "방장만 강퇴할 수 있어."
    );
    return;
  }

  if(memberId===user.id){
    return;
  }

  if(
    !confirm(
      `${memberName}님을 방에서 강퇴할까?`
    )
  ){
    return;
  }

  const {error}=
    await sb
      .from("room_members")
      .delete()
      .eq(
        "room_id",
        currentRoom.id
      )
      .eq(
        "user_id",
        memberId
      );

  if(error){
    console.error(error);

    alert(
      "강퇴 실패: "+
      error.message
    );
    return;
  }

  safeText(
    "roomInfo",
    `${memberName}님을 강퇴했어.`
  );

  await loadRanking();
}


// ================================
// 채팅
// ================================

let chatChannel=null;

async function loadChat(){
  if(!$("chatList"))return;

  if(!currentRoom){
    $("chatList").innerHTML=
      "<p class='msg'>방에 들어가면 채팅을 사용할 수 있어.</p>";
    return;
  }

  const {
    data:messages,
    error
  }=await sb
    .from("room_messages")
    .select(
      "id,user_id,message,created_at"
    )
    .eq(
      "room_id",
      currentRoom.id
    )
    .order(
      "created_at",
      {ascending:true}
    )
    .limit(100);

  if(error){
    console.error(error);

    safeText(
      "chatMsg",
      "채팅을 불러오지 못했어."
    );
    return;
  }

  const ids=[
    ...new Set(
      (messages||[])
        .map(m=>m.user_id)
    )
  ];

  let names={};

  if(ids.length){
    const {data:ps}=
      await sb
        .from("profiles")
        .select("id,name")
        .in("id",ids);

    (ps||[]).forEach(p=>{
      names[p.id]=p.name;
    });
  }

  $("chatList").innerHTML=
    (messages||[])
      .map(m=>`
        <div
          style="
            padding:8px 4px;
            border-bottom:
              1px solid #edf1f2;
          ">

          <b>
            ${escapeHtml(
              names[m.user_id]||
              "사용자"
            )}
          </b>

          <span
            style="
              color:#7b8c91;
              font-size:12px;
              margin-left:6px;
            ">
            ${
              new Date(
                m.created_at
              ).toLocaleTimeString(
                [],
                {
                  hour:"2-digit",
                  minute:"2-digit"
                }
              )
            }
          </span>

          <div
            style="
              margin-top:4px;
              line-height:1.45;
            ">
            ${escapeHtml(
              m.message
            )}
          </div>

        </div>
      `).join("")||
      "<p class='msg'>아직 메시지가 없어.</p>";

  $("chatList").scrollTop=
    $("chatList")
      .scrollHeight;
}

if($("sendChat")){
  $("sendChat").onclick=async()=>{
    if(!currentRoom){
      safeText(
        "chatMsg",
        "먼저 방에 참가해."
      );
      return;
    }

    const message=
      $("chatInput")
        ?.value
        ?.trim();

    if(!message)return;

    const {error}=
      await sb
        .from("room_messages")
        .insert({
          room_id:
            currentRoom.id,
          user_id:user.id,
          message
        });

    if(error){
      console.error(error);

      safeText(
        "chatMsg",
        "메시지 전송 실패: "+
        error.message
      );
      return;
    }

    $("chatInput").value="";

    safeText(
      "chatMsg",
      ""
    );

    await loadChat();
  };
}

async function subscribeChat(){
  if(!sb)return;

  if(chatChannel){
    await sb.removeChannel(
      chatChannel
    );
    chatChannel=null;
  }

  if(!currentRoom)return;

  chatChannel=
    sb.channel(
      "studyloop-chat-"+
      currentRoom.id
    )
    .on(
      "postgres_changes",
      {
        event:"INSERT",
        schema:"public",
        table:"room_messages",
        filter:
          `room_id=eq.${currentRoom.id}`
      },
      async()=>{
        await loadChat();
      }
    )
    .subscribe();
}
// ================================
// 파일 업로드
// ================================

function setupFileInput(){
  const input=
    $("curriculumPdf")||
    $("curriculumFile");

  if(!input)return;

  input.multiple=true;

  input.setAttribute(
    "accept",
    "application/pdf,image/*,.jpg,.jpeg,.png,.webp,.gif,.bmp,.heic,.heif,.avif,.tif,.tiff"
  );
}

function isAllowedFile(file){
  if(
    file.type===
    "application/pdf"
  ){
    return true;
  }

  if(
    file.type?.startsWith(
      "image/"
    )
  ){
    return true;
  }

  return /\.(pdf|jpg|jpeg|png|webp|gif|bmp|heic|heif|avif|tif|tiff)$/i
    .test(file.name);
}

function fileType(file){
  return(
    file.type?.startsWith(
      "image/"
    )||
    /\.(jpg|jpeg|png|webp|gif|bmp|heic|heif|avif|tif|tiff)$/i
      .test(file.name)
  )
    ?"image"
    :"pdf";
}

async function getCurriculumFiles(
  curriculumIds
){
  if(!curriculumIds?.length){
    return[];
  }

  const {
    data,
    error
  }=await sb
    .from("curriculum_files")
    .select("*")
    .in(
      "curriculum_id",
      curriculumIds
    )
    .order(
      "sort_order",
      {ascending:true}
    );

  if(error){
    console.error(error);
    return[];
  }

  return data||[];
}

async function openCurriculumFile(
  path
){
  if(!path)return;

  const {
    data,
    error
  }=await sb.storage
    .from("curriculum-pdfs")
    .createSignedUrl(
      path,
      600
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


// ================================
// 내 커리큘럼
// ================================

async function loadMyCurricula(){
  if(!$("myCurricula"))return;

  const {
    data:curricula,
    error
  }=await sb
    .from("curricula")
    .select("*")
    .eq(
      "owner_id",
      user.id
    )
    .order(
      "created_at",
      {ascending:false}
    );

  if(error){
    console.error(error);

    safeText(
      "curriculumMsg",
      "내 커리큘럼을 불러오지 못했어."
    );
    return;
  }

  const list=
    curricula||[];

  const files=
    await getCurriculumFiles(
      list.map(c=>c.id)
    );

  const fileMap={};

  files.forEach(f=>{
    if(
      !fileMap[
        f.curriculum_id
      ]
    ){
      fileMap[
        f.curriculum_id
      ]=[];
    }

    fileMap[
      f.curriculum_id
    ].push(f);
  });

  $("myCurricula").innerHTML=
    list.map(c=>{
      let resources=
        fileMap[c.id]||[];

      if(
        !resources.length&&
        c.pdf_path
      ){
        resources=[{
          storage_path:
            c.pdf_path,
          file_type:"pdf"
        }];
      }

      const days=
        daysUntil(
          c.exam_date
        );

      let exam="";

      if(days===0){
        exam=" · 오늘 시험";
      }else if(days>0){
        exam=` · D-${days}`;
      }

      const active=
        currentCurriculum?.id===
        c.id;

      return`
        <div
          class="
            curriculum-card
            ${active?"active":""}
          ">

          <b>
            ${escapeHtml(c.title)}
          </b>

          <br>

          <small>
            ${escapeHtml(
              profile.name
            )}의 커리큘럼
            · 목표 ${
              c.target_score??
              profile.target_score
            }점
            ${exam}
            · 자료 ${resources.length}개
          </small>

          <div>
            ${resources.map(
              (f,i)=>`
                <button
                  class="resource-btn myResourceBtn"
                  data-path="${f.storage_path}">
                  ${
                    f.file_type===
                    "image"
                      ?"🖼️"
                      :"📄"
                  }
                  자료 ${i+1}
                </button>
              `
            ).join("")}
          </div>

          <button
            class="study-btn selectMyCurriculum"
            data-id="${c.id}">
            학습하기
          </button>

          ${
            currentRoom
              ?`
                <button
                  class="share-btn shareCurriculum"
                  data-id="${c.id}">
                  현재 방에 공유
                </button>
              `
              :""
          }

        </div>
      `;
    }).join("")||
    "<p class='msg'>아직 만든 커리큘럼이 없어.</p>";

  document
    .querySelectorAll(
      ".myResourceBtn"
    )
    .forEach(btn=>{
      btn.onclick=()=>{
        openCurriculumFile(
          btn.dataset.path
        );
      };
    });

  document
    .querySelectorAll(
      ".selectMyCurriculum"
    )
    .forEach(btn=>{
      btn.onclick=async()=>{
        await selectCurriculum(
          btn.dataset.id
        );
      };
    });

  document
    .querySelectorAll(
      ".shareCurriculum"
    )
    .forEach(btn=>{
      btn.onclick=async()=>{
        await shareCurriculum(
          btn.dataset.id
        );
      };
    });
}


// ================================
// 커리큘럼 생성
// ================================

if($("uploadCurriculum")){
  $("uploadCurriculum").onclick=
  async()=>{
    const title=
      $("curriculumTitle")
        ?.value
        ?.trim()||"";

    const input=
      $("curriculumPdf")||
      $("curriculumFile");

    const files=
      input
        ?[...input.files]
        :[];

    const targetElement=
      $("curriculumTargetScore");

    const examElement=
      $("curriculumExamDate");

    const targetScore=
      targetElement
        ?Number(
            targetElement.value
          )
        :Number(
            profile.target_score
          );

    const examDate=
      examElement?.value||
      null;

    if(!title){
      safeText(
        "curriculumMsg",
        "커리큘럼 이름을 입력해."
      );
      return;
    }

    if(
      !Number.isFinite(
        targetScore
      )||
      targetScore<0||
      targetScore>100
    ){
      safeText(
        "curriculumMsg",
        "목표 점수는 0~100 사이로 입력해."
      );
      return;
    }

    if(!files.length){
      safeText(
        "curriculumMsg",
        "PDF 또는 사진을 선택해."
      );
      return;
    }

    if(files.length>30){
      safeText(
        "curriculumMsg",
        "한 번에 최대 30개까지 올릴 수 있어."
      );
      return;
    }

    const invalid=
      files.find(
        f=>!isAllowedFile(f)
      );

    if(invalid){
      safeText(
        "curriculumMsg",
        `지원하지 않는 파일이야: ${invalid.name}`
      );
      return;
    }

    const tooLarge=
      files.find(
        f=>
          f.size>
          25*1024*1024
      );

    if(tooLarge){
      safeText(
        "curriculumMsg",
        `${tooLarge.name} 파일이 25MB를 넘어.`
      );
      return;
    }

    const button=
      $("uploadCurriculum");

    button.disabled=true;

    const uploaded=[];

    try{
      for(
        let i=0;
        i<files.length;
        i++
      ){
        const file=
          files[i];

        safeText(
          "curriculumMsg",
          `자료 업로드 중... ${i+1}/${files.length}`
        );

        const safeName=
          file.name.replace(
            /[^a-zA-Z0-9._-]/g,
            "_"
          );

        const path=
          `${user.id}/`+
          `${Date.now()}_${i}_`+
          safeName;

        const {
          error:uploadError
        }=await sb.storage
          .from(
            "curriculum-pdfs"
          )
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
            file.name+
            " 업로드 실패: "+
            uploadError.message
          );
        }

        uploaded.push({
          storage_path:path,
          original_name:
            file.name,
          file_type:
            fileType(file),
          mime_type:
            file.type||null,
          sort_order:i
        });
      }

      safeText(
        "curriculumMsg",
        "커리큘럼 저장 중..."
      );

      const {
        data:curriculum,
        error:createError
      }=await sb
        .from("curricula")
        .insert({
          owner_id:user.id,
          title,
          pdf_path:
            uploaded[0]
              .storage_path,
          target_score:
            targetScore,
          exam_date:
            examDate
        })
        .select()
        .single();

      if(createError){
        throw new Error(
          "커리큘럼 저장 실패: "+
          createError.message
        );
      }

      const fileRows=
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

      const {
        error:fileError
      }=await sb
        .from(
          "curriculum_files"
        )
        .insert(fileRows);

      if(fileError){
        throw new Error(
          "첨부 자료 저장 실패: "+
          fileError.message
        );
      }

      /*
        중요:
        여기서는 업로드된 PDF/사진을
        임의의 역사 레슨으로 바꾸지 않는다.

        실제 자료 내용을 읽어 AI 레슨을
        만드는 기능은 Edge Function을
        연결한 뒤 여기에서 호출한다.
      */

      if($("curriculumTitle")){
        $("curriculumTitle")
          .value="";
      }

      if(input){
        input.value="";
      }

      if(examElement){
        examElement.value="";
      }

      safeText(
        "curriculumMsg",
        "커리큘럼을 만들었어. 자료 분석 기능을 연결하면 여기에서 자동 레슨이 생성돼."
      );

      await loadMyCurricula();
      await loadCurriculumChooser();

      await selectCurriculum(
        curriculum.id
      );

    }catch(error){
      console.error(error);

      safeText(
        "curriculumMsg",
        error.message||
        "커리큘럼 생성 중 오류가 발생했어."
      );

    }finally{
      button.disabled=false;
    }
  };
}


// ================================
// 방에 커리큘럼 공유
// ================================

async function shareCurriculum(
  curriculumId
){
  if(!currentRoom){
    alert(
      "먼저 방에 참가해."
    );
    return;
  }

  const {
    data:owned,
    error:ownerError
  }=await sb
    .from("curricula")
    .select("id")
    .eq("id",curriculumId)
    .eq(
      "owner_id",
      user.id
    )
    .maybeSingle();

  if(
    ownerError||
    !owned
  ){
    console.error(
      ownerError
    );

    alert(
      "자신이 만든 커리큘럼만 공유할 수 있어."
    );
    return;
  }

  const {
    data:existing,
    error:checkError
  }=await sb
    .from("room_curricula")
    .select("id")
    .eq(
      "room_id",
      currentRoom.id
    )
    .eq(
      "curriculum_id",
      curriculumId
    )
    .maybeSingle();

  if(checkError){
    console.error(
      checkError
    );

    alert(
      "공유 상태 확인 실패: "+
      checkError.message
    );
    return;
  }

  if(existing){
    safeText(
      "curriculumMsg",
      "이미 현재 방에 공유된 커리큘럼이야."
    );

    await loadRoomCurricula();
    return;
  }

  const {
    error
  }=await sb
    .from("room_curricula")
    .insert({
      room_id:
        currentRoom.id,
      curriculum_id:
        curriculumId,
      shared_by:
        user.id
    });

  if(error){
    console.error(error);

    alert(
      "공유 실패: "+
      error.message
    );
    return;
  }

  safeText(
    "curriculumMsg",
    "현재 방에 커리큘럼을 공유했어."
  );

  await loadRoomCurricula();
  await loadCurriculumChooser();
}


// ================================
// 방 공유 커리큘럼 표시
// ================================

async function loadRoomCurricula(){
  if(!$("roomCurricula"))return;

  if(!currentRoom){
    $("roomCurricula").innerHTML=
      "<p class='msg'>방에 참가하면 공유 커리큘럼을 볼 수 있어.</p>";
    return;
  }

  const {
    data:shares,
    error
  }=await sb
    .from("room_curricula")
    .select(
      "id,curriculum_id,shared_by,shared_at"
    )
    .eq(
      "room_id",
      currentRoom.id
    )
    .order(
      "shared_at",
      {ascending:false}
    );

  if(error){
    console.error(error);

    $("roomCurricula").innerHTML=
      "<p class='msg'>공유 커리큘럼을 불러오지 못했어.</p>";
    return;
  }

  if(!shares?.length){
    $("roomCurricula").innerHTML=
      "<p class='msg'>아직 공유된 커리큘럼이 없어.</p>";
    return;
  }

  const ids=[
    ...new Set(
      shares.map(
        x=>x.curriculum_id
      )
    )
  ];

  const {
    data:curricula,
    error:currError
  }=await sb
    .from("curricula")
    .select("*")
    .in("id",ids);

  if(currError){
    console.error(
      currError
    );

    $("roomCurricula").innerHTML=
      "<p class='msg'>커리큘럼 정보를 읽지 못했어.</p>";
    return;
  }

  const ownerIds=[
    ...new Set(
      (curricula||[])
        .map(c=>c.owner_id)
    )
  ];

  let ownerNames={};

  if(ownerIds.length){
    const {
      data:owners
    }=await sb
      .from("profiles")
      .select("id,name")
      .in("id",ownerIds);

    (owners||[])
      .forEach(p=>{
        ownerNames[p.id]=
          p.name;
      });
  }

  const files=
    await getCurriculumFiles(
      ids
    );

  const fileMap={};

  files.forEach(f=>{
    if(
      !fileMap[
        f.curriculum_id
      ]
    ){
      fileMap[
        f.curriculum_id
      ]=[];
    }

    fileMap[
      f.curriculum_id
    ].push(f);
  });

  $("roomCurricula").innerHTML=
    (curricula||[])
      .map(c=>{
        let resources=
          fileMap[c.id]||[];

        if(
          !resources.length&&
          c.pdf_path
        ){
          resources=[{
            storage_path:
              c.pdf_path,
            file_type:"pdf"
          }];
        }

        const owner=
          ownerNames[
            c.owner_id
          ]||
          "사용자";

        return`
          <div
            class="curriculum-card">

            <b>
              ${escapeHtml(owner)}의
              ${escapeHtml(c.title)}
            </b>

            <br>

            <small>
              목표 ${
                c.target_score??
                "미설정"
              }점
              · 자료 ${resources.length}개
            </small>

            <div>
              ${resources.map(
                (f,i)=>`
                  <button
                    class="resource-btn sharedResourceBtn"
                    data-path="${f.storage_path}">
                    ${
                      f.file_type===
                      "image"
                        ?"🖼️"
                        :"📄"
                    }
                    자료 ${i+1}
                  </button>
                `
              ).join("")}
            </div>

            <button
              class="study-btn sharedStudyBtn"
              data-id="${c.id}">
              이 커리큘럼 학습
            </button>

          </div>
        `;
      }).join("");

  document
    .querySelectorAll(
      ".sharedResourceBtn"
    )
    .forEach(btn=>{
      btn.onclick=()=>{
        openCurriculumFile(
          btn.dataset.path
        );
      };
    });

  document
    .querySelectorAll(
      ".sharedStudyBtn"
    )
    .forEach(btn=>{
      btn.onclick=async()=>{
        await selectCurriculum(
          btn.dataset.id
        );
      };
    });
}


// ================================
// 모의시험
// 현재 커리큘럼 레슨 문제로 생성
// ================================

let mockState=null;

function ensureMockExamUI(){
  if(
    document.getElementById(
      "mockExamContainer"
    )
  ){
    return;
  }

  const planPage=$("plan");

  if(!planPage)return;

  const container=
    document.createElement(
      "div"
    );

  container.id=
    "mockExamContainer";

  container.innerHTML=`
    <hr
      style="
        margin:25px 0;
        border:0;
        border-top:
          1px solid #dce6e9;
      ">

    <h2>📝 모의시험</h2>

    <p class="msg">
      현재 선택한 커리큘럼의 문제로
      모의시험을 볼 수 있어.
    </p>

    <div
      style="
        display:grid;
        grid-template-columns:
          repeat(3,1fr);
        gap:8px;
      ">

      <button id="mockEasy">
        쉬움
      </button>

      <button id="mockNormal">
        보통
      </button>

      <button id="mockHard">
        어려움
      </button>

    </div>

    <p
      id="mockResult"
      class="msg">
    </p>

    <div
      id="mockQuestions">
    </div>
  `;

  planPage.appendChild(
    container
  );

  $("mockEasy").onclick=
    ()=>startMockExam(
      "easy"
    );

  $("mockNormal").onclick=
    ()=>startMockExam(
      "normal"
    );

  $("mockHard").onclick=
    ()=>startMockExam(
      "hard"
    );
}

function shuffled(array){
  return[...array]
    .sort(
      ()=>Math.random()-0.5
    );
}

function startMockExam(
  difficulty
){
  if(!currentCurriculum){
    safeText(
      "mockResult",
      "먼저 커리큘럼을 선택해."
    );
    return;
  }

  const usable=
    currentLessons.filter(
      lesson=>
        lesson.question&&
        normalizeAnswers(
          lesson.answers
        ).length>=2&&
        Number.isInteger(
          Number(
            lesson.correct_answer
          )
        )
    );

  if(!usable.length){
    safeText(
      "mockResult",
      "이 커리큘럼에는 아직 시험 문제로 사용할 레슨이 없어."
    );
    return;
  }

  let count=5;

  if(
    difficulty==="normal"
  ){
    count=10;
  }

  if(
    difficulty==="hard"
  ){
    count=15;
  }

  count=Math.min(
    count,
    usable.length
  );

  mockState={
    difficulty,
    questions:
      shuffled(
        usable
      ).slice(0,count),
    answers:
      Array(count)
        .fill(null)
  };

  safeText(
    "mockResult",
    ""
  );

  renderMockQuestions();
}

function renderMockQuestions(){
  if(!mockState)return;

  const box=$("mockQuestions");

  if(!box)return;

  box.innerHTML=
    mockState.questions
      .map(
        (lesson,qi)=>{
          const answers=
            normalizeAnswers(
              lesson.answers
            );

          return`
            <div
              class="mock-question-card">

              <b>
                ${qi+1}.
                ${escapeHtml(
                  lesson.question
                )}
              </b>

              ${answers.map(
                (choice,ci)=>`
                  <button
                    class="
                      mock-answer
                      ${
                        mockState
                          .answers[qi]===
                        ci
                          ?"selected"
                          :""
                      }
                    "
                    data-mock-q="${qi}"
                    data-mock-c="${ci}">
                    ${ci+1}.
                    ${escapeHtml(
                      choice
                    )}
                  </button>
                `
              ).join("")}

            </div>
          `;
        }
      ).join("")+

      `
        <button
          id="gradeMock"
          style="
            width:100%;
            margin-top:14px;
            padding:14px;
            border-radius:12px;
            background:#58cc42;
            color:white;
            font-weight:900;
          ">
          채점하기
        </button>
      `;

  document
    .querySelectorAll(
      "[data-mock-q]"
    )
    .forEach(btn=>{
      btn.onclick=()=>{
        mockState.answers[
          Number(
            btn.dataset.mockQ
          )
        ]=
          Number(
            btn.dataset.mockC
          );

        renderMockQuestions();
      };
    });

  $("gradeMock").onclick=
    gradeMockExam;
}

async function gradeMockExam(){
  if(!mockState)return;

  if(
    mockState.answers
      .some(
        answer=>
          answer===null
      )
  ){
    safeText(
      "mockResult",
      "아직 풀지 않은 문제가 있어."
    );
    return;
  }

  let correct=0;

  mockState.questions
    .forEach(
      (lesson,index)=>{
        if(
          mockState
            .answers[index]===
          Number(
            lesson.correct_answer
          )
        ){
          correct++;
        }
      }
    );

  const total=
    mockState
      .questions
      .length;

  const score=
    Math.round(
      correct/
      total*
      100
    );

  safeText(
    "mockResult",
    `결과: ${correct}/${total} · ${score}점`
  );

  const {error}=
    await sb
      .from(
        "mock_exam_results"
      )
      .insert({
        user_id:user.id,
        curriculum_id:
          currentCurriculum.id,
        difficulty:
          mockState.difficulty,
        score,
        correct_count:
          correct,
        total_count:
          total
      });

  if(error){
    console.error(error);
  }
}


// ================================
// 이름 변경
// ================================

if($("changeNameBtn")){
  $("changeNameBtn").onclick=
  async()=>{
    const name=
      $("newNameInput")
        ?.value
        ?.trim();

    if(!name){
      safeText(
        "nameMsg",
        "새 이름을 입력해."
      );
      return;
    }

    if(name.length>20){
      safeText(
        "nameMsg",
        "이름은 20자 이내로 입력해."
      );
      return;
    }

    const {error}=
      await sb
        .from("profiles")
        .update({name})
        .eq("id",user.id);

    if(error){
      console.error(error);

      safeText(
        "nameMsg",
        "이름 변경 실패: "+
        error.message
      );
      return;
    }

    profile.name=name;

    $("newNameInput")
      .value="";

    safeText(
      "nameMsg",
      "이름을 변경했어."
    );

    renderProfile();

    await loadMyCurricula();
    await loadRoomCurricula();
    await loadRanking();
  };
}


// ================================
// 진도 + XP 초기화
// 현재 사용자의 모든 커리큘럼 진도
// ================================

if($("resetProgressBtn")){
  $("resetProgressBtn").onclick=
  async()=>{
    if(
      !confirm(
        "정말 진도와 XP를 전부 초기화할까? 이 작업은 되돌릴 수 없어."
      )
    ){
      return;
    }

    safeText(
      "resetMsg",
      "초기화 중..."
    );

    const {
      error:progressError
    }=await sb
      .from(
        "curriculum_lesson_progress"
      )
      .delete()
      .eq(
        "user_id",
        user.id
      );

    if(progressError){
      console.error(
        progressError
      );

      safeText(
        "resetMsg",
        "진도 초기화 실패: "+
        progressError.message
      );
      return;
    }

    // 예전 테스트 진도도 제거
    const {
      error:oldProgressError
    }=await sb
      .from(
        "lesson_progress"
      )
      .delete()
      .eq(
        "user_id",
        user.id
      );

    if(oldProgressError){
      console.warn(
        oldProgressError
      );
    }

    const {
      error:xpError
    }=await sb
      .from("profiles")
      .update({xp:0})
      .eq("id",user.id);

    if(xpError){
      console.error(xpError);

      safeText(
        "resetMsg",
        "XP 초기화 실패: "+
        xpError.message
      );
      return;
    }

    profile.xp=0;

    safeText(
      "resetMsg",
      "진도와 XP를 모두 초기화했어."
    );

    renderProfile();
    await renderLearningPath();
    await renderDailyStudyQuota();
    await loadRanking();
  };
}


// ================================
// 로그아웃
// ================================

if($("logoutBtn")){
  $("logoutBtn").onclick=
  async()=>{
    if(chatChannel){
      await sb.removeChannel(
        chatChannel
      );
      chatChannel=null;
    }

    await sb.auth.signOut();

    user=null;
    profile=null;
    currentRoom=null;
    currentCurriculum=null;
    currentLessons=[];

    localStorage.removeItem(
      "studyloop_active_curriculum"
    );

    showLoginScreen();

    safeText(
      "setupMsg",
      "로그아웃했어."
    );
  };
}


// ================================
// 하단 메뉴
// ================================

document
  .querySelectorAll(
    "nav button"
  )
  .forEach(button=>{
    button.onclick=()=>{
      document
        .querySelectorAll(
          "nav button"
        )
        .forEach(b=>{
          b.classList.remove(
            "active"
          );
        });

      button.classList.add(
        "active"
      );

      document
        .querySelectorAll(
          ".page"
        )
        .forEach(page=>{
          page.classList.remove(
            "active"
          );
        });

      const page=
        $(button.dataset.page);

      page?.classList.add(
        "active"
      );
    };
  });


// ================================
// 실행
// ================================

init();
