const cfg=window.STUDYLOOP_CONFIG||{};
const $=id=>document.getElementById(id);

let sb=null;
let user=null;
let profile=null;
let currentRoom=null;
let currentCurriculum=null;
let currentLessons=[];
let currentLessonIndex=0;
let answered=false;
let chatChannel=null;
let mockState=null;

const esc=s=>String(s??'')
  .replaceAll('&','&amp;')
  .replaceAll('<','&lt;')
  .replaceAll('>','&gt;')
  .replaceAll('"','&quot;')
  .replaceAll("'",'&#039;');

const idToEmail=id=>
  `${String(id||'').trim().toLowerCase().replace(/[^a-z0-9._-]/g,'')}@studyloop.local`;

const setText=(id,t)=>{
  if($(id)) $(id).textContent=t;
};

const daysUntil=d=>{
  if(!d)return null;
  const a=new Date();
  a.setHours(0,0,0,0);
  const b=new Date(d+'T00:00:00');
  return Math.ceil((b-a)/86400000);
};

const normalizeChoices=v=>{
  if(Array.isArray(v))return v;
  if(typeof v==='string'){
    try{
      const x=JSON.parse(v);
      return Array.isArray(x)?x:[];
    }catch{
      return [];
    }
  }
  return [];
};

async function init(){
  if(!cfg.SUPABASE_URL||!cfg.SUPABASE_PUBLISHABLE_KEY){
    setText('setupMsg','Supabase 연결값이 없어. config.js를 확인해.');
    return;
  }

  sb=supabase.createClient(
    cfg.SUPABASE_URL,
    cfg.SUPABASE_PUBLISHABLE_KEY
  );

  bindStaticEvents();

  const {data:{session}}=await sb.auth.getSession();

  if(!session){
    showAuth();
    return;
  }

  user=session.user;

  const {data:p}=await sb
    .from('profiles')
    .select('*')
    .eq('id',user.id)
    .maybeSingle();

  if(!p){
    showAuth();
    return;
  }

  profile=p;
  await enterApp();
}

function showAuth(){
  $('setup').classList.remove('hidden');
  $('app').classList.add('hidden');
}

async function enterApp(){
  $('setup').classList.add('hidden');
  $('app').classList.remove('hidden');

  await getCurrentRoom();

  renderProfile();
  renderRoomState();

  await refreshAll();
}

function renderProfile(){
  setText('xp',profile.xp||0);
  setText('goalTop',profile.target_score||90);
  setText('profileName',profile.name);
  setText(
    'profileGoal',
    `기본 목표 ${profile.target_score||90}점`
  );
  setText(
    'profileXp',
    `${profile.xp||0} XP`
  );

  if($('newNameInput')){
    $('newNameInput').placeholder=
      `현재 이름: ${profile.name}`;
  }
}

function bindStaticEvents(){
  $('showSignupBtn').onclick=()=>{
    $('loginFields').classList.add('hidden');
    $('signupFields').classList.remove('hidden');
    setText('authTitle','회원가입');
    setText('setupMsg','');
  };

  $('showLoginBtn').onclick=()=>{
    $('signupFields').classList.add('hidden');
    $('loginFields').classList.remove('hidden');
    setText('authTitle','로그인');
    setText('setupMsg','');
  };

  $('signupBtn').onclick=signup;
  $('loginBtn').onclick=login;
  $('uploadCurriculum').onclick=createCurriculum;

  $('createRoom').onclick=createRoom;
  $('joinRoom').onclick=joinRoom;
  $('sendChat').onclick=sendChat;

  $('changeNameBtn').onclick=changeName;
  $('resetProgressBtn').onclick=resetProgress;
  $('logoutBtn').onclick=logout;

  $('close').onclick=()=>{
    $('lesson').classList.add('hidden');
  };

  $('next').onclick=nextLesson;

  $('activeCurriculum').onchange=()=>{
    selectCurriculum(
      $('activeCurriculum').value
    );
  };

  $('mockEasy').onclick=()=>startMock('easy');
  $('mockNormal').onclick=()=>startMock('normal');
  $('mockHard').onclick=()=>startMock('hard');

  document
    .querySelectorAll('nav button')
    .forEach(b=>{
      b.onclick=()=>{
        document
          .querySelectorAll('nav button')
          .forEach(x=>x.classList.remove('active'));

        document
          .querySelectorAll('.page')
          .forEach(x=>x.classList.remove('active'));

        b.classList.add('active');
        $(b.dataset.page)?.classList.add('active');
      };
    });
}

async function signup(){
  const id=$('signupId').value.trim();
  const pw=$('signupPw').value;
  const name=$('signupName').value.trim();
  const goal=Number($('signupGoal').value);

  if(
    id.length<3||
    pw.length<6||
    !name||
    goal<0||
    goal>100
  ){
    setText(
      'setupMsg',
      '아이디 3자 이상, 비밀번호 6자 이상, 이름과 목표 점수를 확인해.'
    );
    return;
  }

  setText('setupMsg','계정 만드는 중...');

  const {data,error}=await sb.auth.signUp({
    email:idToEmail(id),
    password:pw
  });

  if(error){
    setText(
      'setupMsg',
      '회원가입 실패: '+error.message
    );
    return;
  }

  if(!data.session){
    setText(
      'setupMsg',
      'Supabase에서 Confirm email을 꺼야 해.'
    );
    return;
  }

  user=data.user;

  const r=await sb
    .from('profiles')
    .upsert({
      id:user.id,
      name,
      target_score:goal,
      xp:0
    })
    .select()
    .single();

  if(r.error){
    setText(
      'setupMsg',
      '프로필 생성 실패: '+r.error.message
    );
    return;
  }

  profile=r.data;
  await enterApp();
}

async function login(){
  const id=$('loginId').value.trim();
  const pw=$('loginPw').value;

  if(!id||!pw){
    setText(
      'setupMsg',
      '아이디와 비밀번호를 입력해.'
    );
    return;
  }

  setText('setupMsg','로그인 중...');

  const {data,error}=
    await sb.auth.signInWithPassword({
      email:idToEmail(id),
      password:pw
    });

  if(error){
    setText(
      'setupMsg',
      '로그인 실패: 아이디 또는 비밀번호를 확인해.'
    );
    return;
  }

  user=data.user;

  const r=await sb
    .from('profiles')
    .select('*')
    .eq('id',user.id)
    .maybeSingle();

  if(!r.data){
    setText(
      'setupMsg',
      '프로필을 불러오지 못했어.'
    );
    return;
  }

  profile=r.data;
  await enterApp();
}

async function refreshAll(){
  await loadCurriculumSelect();
  await loadMyCurricula();
  await loadRoomCurricula();
  await loadRanking();
  await loadChat();
  await subscribeChat();

  const saved=
    localStorage.getItem(
      'studyloop_active_curriculum'
    );

  const all=await getAccessibleCurricula();

  if(all.length){
    const c=
      all.find(x=>x.id===saved)||
      all[0];

    await selectCurriculum(c.id);
  }else{
    clearCurriculum();
  }
}

async function getAccessibleCurricula(){
  const mine=await sb
    .from('curricula')
    .select('*')
    .eq('owner_id',user.id)
    .order('created_at',{
      ascending:false
    });

  let shared=[];

  if(currentRoom){
    const s=await sb
      .from('room_curricula')
      .select('curriculum_id')
      .eq('room_id',currentRoom.id);

    const ids=(s.data||[])
      .map(x=>x.curriculum_id);

    if(ids.length){
      const r=await sb
        .from('curricula')
        .select('*')
        .in('id',ids);

      shared=r.data||[];
    }
  }

  const m=new Map();

  [
    ...(mine.data||[]),
    ...shared
  ].forEach(c=>m.set(c.id,c));

  return [...m.values()];
}

async function loadCurriculumSelect(){
  const all=
    await getAccessibleCurricula();

  $('activeCurriculum').innerHTML=
    '<option value="">선택</option>'+
    all.map(c=>
      `<option value="${c.id}">${esc(c.title)}</option>`
    ).join('');
}

function clearCurriculum(){
  currentCurriculum=null;
  currentLessons=[];

  $('path').innerHTML='';
  $('emptyLessons').classList.remove('hidden');

  setText(
    'homeTitle',
    '커리큘럼을 선택해'
  );

  setText('activeInfo','');

  renderDaily();
}

async function selectCurriculum(id){
  if(!id){
    clearCurriculum();
    return;
  }

  const all=
    await getAccessibleCurricula();

  const c=all.find(
    x=>String(x.id)===String(id)
  );

  if(!c){
    clearCurriculum();
    return;
  }

  currentCurriculum=c;

  localStorage.setItem(
    'studyloop_active_curriculum',
    c.id
  );

  $('activeCurriculum').value=c.id;

  setText('homeTitle',c.title);

  setText(
    'hello',
    `${profile.name} · ${
      c.owner_id===user.id
        ?'내 커리큘럼'
        :'공유 커리큘럼'
    }`
  );

  const d=daysUntil(c.exam_date);

  setText(
    'activeInfo',
    `목표 ${
      c.target_score??profile.target_score
    }점${
      d===0
        ?' · 오늘 시험'
        :d>0
          ?` · D-${d}`
          :''
    }`
  );

  await loadCurrentLessons();
  await renderPath();
  await renderDaily();
  await loadMyCurricula();
}

async function loadCurrentLessons(){
  const r=await sb
    .from('curriculum_lessons')
    .select('*')
    .eq(
      'curriculum_id',
      currentCurriculum.id
    )
    .order(
      'lesson_order',
      {ascending:true}
    );

  currentLessons=r.data||[];
}

async function getProgress(){
  if(!currentLessons.length){
    return [];
  }

  const ids=
    currentLessons.map(x=>x.id);

  const r=await sb
    .from('curriculum_lesson_progress')
    .select('*')
    .eq('user_id',user.id)
    .in('lesson_id',ids);

  return r.data||[];
}

async function renderPath(){
  if(!currentLessons.length){
    $('path').innerHTML='';
    $('emptyLessons')
      .classList.remove('hidden');

    $('emptyLessons').textContent=
      '이 커리큘럼에는 아직 레슨이 없어. 내 커리큘럼이면 “레슨 생성 재시도”를 눌러봐.';

    return;
  }

  $('emptyLessons')
    .classList.add('hidden');

  const p=await getProgress();

  const pm=new Map(
    p.map(x=>[
      String(x.lesson_id),
      x
    ])
  );

  $('path').innerHTML=
    currentLessons.map((l,i)=>{
      const x=
        pm.get(String(l.id));

      const rc=x?.review_count||0;

      return `
        <button
          class="lessonNode ${
            x?.completed
              ?(
                rc>=2
                  ?'review2'
                  :rc===1
                    ?'review1'
                    :'done'
              )
              :''
          }"
          data-li="${i}"
        >
          ${
            x?.completed
              ?(rc>=2?'★':'✓')
              :'📖'
          }
          ${
            x?.completed&&rc<2
              ?'<span class="badge">복습</span>'
              :''
          }
        </button>
      `;
    }).join('');

  document
    .querySelectorAll('[data-li]')
    .forEach(b=>{
      b.onclick=()=>{
        openLesson(
          Number(b.dataset.li)
        );
      };
    });
}

function lessonFields(l){
  return {
    content:
      l.content??
      l.concept??
      '',

    choices:
      normalizeChoices(
        l.choices??
        l.answers
      ),

    answer:
      Number(
        l.answer??
        l.correct_answer
      )
  };
}

function openLesson(i){
  const l=currentLessons[i];

  if(!l)return;

  currentLessonIndex=i;
  answered=false;

  const f=lessonFields(l);

  setText(
    'ltitle',
    l.title||`레슨 ${i+1}`
  );

  setText(
    'concept',
    f.content
  );

  setText(
    'question',
    l.question||'학습 완료'
  );

  $('bar').style.width=
    `${((i+1)/currentLessons.length)*100}%`;

  $('answers').innerHTML=
    f.choices.length
      ?f.choices.map((x,j)=>`
        <button
          class="ans"
          data-ai="${j}"
        >
          ${j+1}. ${esc(x)}
        </button>
      `).join('')
      :`
        <button
          class="ans"
          id="readingDone"
        >
          학습 완료
        </button>
      `;

  document
    .querySelectorAll('[data-ai]')
    .forEach(b=>{
      b.onclick=()=>{
        answerLesson(
          Number(b.dataset.ai)
        );
      };
    });

  if($('readingDone')){
    $('readingDone').onclick=()=>{
      completeLesson();
    };
  }

  setText('feedback','');

  $('next')
    .classList.add('hidden');

  $('lesson')
    .classList.remove('hidden');
}

async function answerLesson(i){
  if(answered)return;

  const l=
    currentLessons[
      currentLessonIndex
    ];

  const f=lessonFields(l);

  const buttons=[
    ...document.querySelectorAll(
      '[data-ai]'
    )
  ];

  answered=true;

  if(buttons[f.answer]){
    buttons[f.answer]
      .classList.add('good');
  }

  if(i!==f.answer){
    buttons[i]?.classList.add('bad');

    setText(
      'feedback',
      '오답이야. 정답을 확인하고 다음에 다시 복습해.'
    );

    $('next')
      .classList.remove('hidden');

    return;
  }

  await completeLesson();
}

async function completeLesson(){
  if(
    !currentLessons[
      currentLessonIndex
    ]
  )return;

  const l=
    currentLessons[
      currentLessonIndex
    ];

  const now=
    new Date().toISOString();

  const r=await sb
    .from(
      'curriculum_lesson_progress'
    )
    .select('*')
    .eq('user_id',user.id)
    .eq('lesson_id',l.id)
    .maybeSingle();

  const old=r.data;

  if(!old?.completed){
    const u=await sb
      .from(
        'curriculum_lesson_progress'
      )
      .upsert({
        user_id:user.id,
        lesson_id:l.id,
        completed:true,
        best_score:100,
        review_count:0,
        first_completed_at:
          old?.first_completed_at||
          now,
        updated_at:now
      });

    if(u.error){
      setText(
        'feedback',
        '진도 저장 실패: '+
        u.error.message
      );
      return;
    }

    const nx=
      (profile.xp||0)+20;

    const xpR=await sb
      .from('profiles')
      .update({xp:nx})
      .eq('id',user.id);

    if(!xpR.error){
      profile.xp=nx;
      renderProfile();
    }

    setText(
      'feedback',
      '정답! +20 XP · 레슨 완료!'
    );
  }else{
    const rc=Math.min(
      (old.review_count||0)+1,
      2
    );

    const u=await sb
      .from(
        'curriculum_lesson_progress'
      )
      .update({
        review_count:rc,
        last_reviewed_at:now,
        updated_at:now
      })
      .eq('user_id',user.id)
      .eq('lesson_id',l.id);

    if(!u.error){
      setText(
        'feedback',
        rc===1
          ?'복습 완료! 노란색 단계'
          :'복습 완료! 검은색 단계'
      );
    }
  }

  answered=true;

  $('next')
    .classList.remove('hidden');

  await renderPath();
  await renderDaily();
  await loadRanking();
}

function nextLesson(){
  if(
    currentLessonIndex<
    currentLessons.length-1
  ){
    openLesson(
      currentLessonIndex+1
    );
  }else{
    $('lesson')
      .classList.add('hidden');
  }
}

async function renderDaily(){
  if(!currentCurriculum){
    $('dailyBox').innerHTML=
      '<b>📅 오늘 할 분량</b><p class="msg">커리큘럼을 선택해.</p>';
    return;
  }

  const p=await getProgress();

  const pm=new Map(
    p.map(x=>[
      String(x.lesson_id),
      x
    ])
  );

  const undone=
    currentLessons.filter(
      l=>!pm.get(
        String(l.id)
      )?.completed
    ).length;

  const rev=
    currentLessons.filter(l=>{
      const x=
        pm.get(String(l.id));

      return (
        x?.completed&&
        (x.review_count||0)<2
      );
    }).length;

  const d=
    daysUntil(
      currentCurriculum.exam_date
    );

  const days=
    d!=null&&d>=0
      ?Math.max(1,d)
      :7;

  const n=Math.min(
    undone,
    undone
      ?Math.max(
        1,
        Math.ceil(
          undone/days
        )
      )
      :0
  );

  const rv=Math.min(
    rev,
    rev
      ?Math.max(
        1,
        Math.ceil(
          rev/days
        )
      )
      :0
  );

  $('dailyBox').innerHTML=`
    <b>📅 오늘 할 분량</b>
    <p class="msg">
      ${
        d===0
          ?'오늘 시험'
          :d>0
            ?`시험까지 D-${d}`
            :'시험 날짜 미설정'
      }
    </p>

    <div class="daily">
      <div>
        <b>${n}</b>
        <small>새 레슨</small>
      </div>

      <div>
        <b>${rv}</b>
        <small>복습</small>
      </div>

      <div>
        <b>${
          d!=null&&d<=7?1:0
        }</b>
        <small>모의시험</small>
      </div>
    </div>
  `;
}

async function createCurriculum(){
  const title=
    $('curriculumTitle')
      .value.trim();

  const files=[
    ...$('curriculumPdf').files
  ];

  const target=
    Number(
      $('curriculumTargetScore')
        .value
    );

  const difficulty=
    $('curriculumDifficulty')
      .value;

  const exam=
    $('curriculumExamDate')
      .value||null;

  if(!title||!files.length){
    setText(
      'curriculumMsg',
      '이름과 PDF/사진을 선택해.'
    );
    return;
  }

  if(files.length>30){
    setText(
      'curriculumMsg',
      '한 번에 최대 30개까지 가능해.'
    );
    return;
  }

  $('uploadCurriculum').disabled=true;

  const uploaded=[];
  let curriculum=null;

  try{
    for(
      let i=0;
      i<files.length;
      i++
    ){
      const f=files[i];

      if(
        f.size>
        25*1024*1024
      ){
        throw new Error(
          `${f.name}이 25MB를 넘어.`
        );
      }

      setText(
        'curriculumMsg',
        `자료 업로드 중... ${i+1}/${files.length}`
      );

      const safe=
        f.name.replace(
          /[^a-zA-Z0-9._-]/g,
          '_'
        );

      const path=
        `${user.id}/${Date.now()}_${i}_${safe}`;

      const u=await sb.storage
        .from('curriculum-pdfs')
        .upload(
          path,
          f,
          {
            contentType:
              f.type||
              'application/octet-stream'
          }
        );

      if(u.error){
        throw new Error(
          '업로드 실패: '+
          u.error.message
        );
      }

      uploaded.push({
        storage_path:path,
        original_name:f.name,
        file_type:
          f.type.startsWith(
            'image/'
          )
            ?'image'
            :'pdf',
        mime_type:
          f.type||null,
        sort_order:i
      });
    }

    setText(
      'curriculumMsg',
      '커리큘럼 저장 중...'
    );

    const c=await sb
      .from('curricula')
      .insert({
        owner_id:user.id,
        title,
        pdf_path:
          uploaded[0].storage_path,
        target_score:target,
        difficulty,
        exam_date:exam
      })
      .select()
      .single();

    if(c.error){
      throw new Error(
        '커리큘럼 저장 실패: '+
        c.error.message
      );
    }

    curriculum=c.data;

    const rows=
      uploaded.map(x=>({
        ...x,
        curriculum_id:
          curriculum.id,
        owner_id:user.id
      }));

    const fr=await sb
      .from('curriculum_files')
      .insert(rows);

    if(fr.error){
      throw new Error(
        '첨부파일 목록 저장 실패: '+
        fr.error.message
      );
    }

    await generateLessons(
      curriculum,
      uploaded
    );

    $('curriculumTitle').value='';
    $('curriculumPdf').value='';

    setText(
      'curriculumMsg',
      '커리큘럼과 레슨을 만들었어.'
    );

    await loadCurriculumSelect();
    await loadMyCurricula();
    await selectCurriculum(
      curriculum.id
    );
  }catch(e){
    console.error(e);

    setText(
      'curriculumMsg',
      e.message||
      '오류가 발생했어.'
    );
  }finally{
    $('uploadCurriculum').disabled=false;
  }
}

async function generateLessons(
  curriculum,
  filesOverride=null
){
  setText(
    'curriculumMsg',
    'AI가 자료를 분석해서 레슨 만드는 중...'
  );

  let files=filesOverride;

  if(!files){
    const r=await sb
      .from('curriculum_files')
      .select('*')
      .eq(
        'curriculum_id',
        curriculum.id
      )
      .order('sort_order');

    files=r.data||[];
  }

  const signed=[];

  for(const f of files){
    const s=await sb.storage
      .from('curriculum-pdfs')
      .createSignedUrl(
        f.storage_path,
        900
      );

    if(s.error){
      throw new Error(
        '자료 URL 생성 실패: '+
        s.error.message
      );
    }

    signed.push({
      url:s.data.signedUrl,
      type:
        f.mime_type||
        (
          f.file_type==='image'
            ?'image/jpeg'
            :'application/pdf'
        ),
      name:
        f.original_name||
        'material'
    });
  }

  const inv=await sb.functions.invoke(
    'bright-handler',
    {
      body:{
        title:
          curriculum.title,
        targetScore:
          curriculum.target_score||
          90,
        difficulty:
          curriculum.difficulty||
          'normal',
        files:signed
      }
    }
  );

  if(inv.error){
    throw new Error(
      'AI 함수 호출 실패: '+
      inv.error.message
    );
  }

  if(!inv.data?.success){
    throw new Error(
      inv.data?.error||
      'AI가 레슨을 만들지 못했어.'
    );
  }

  const lessons=
    inv.data.curriculum.lessons||
    [];

  await sb
    .from('curriculum_lessons')
    .delete()
    .eq(
      'curriculum_id',
      curriculum.id
    );

  const rows=
    lessons.map((l,i)=>({
      curriculum_id:
        curriculum.id,
      lesson_order:i,
      title:String(
        l.title||
        `레슨 ${i+1}`
      ),
      content:String(
        l.content||''
      ),
      question:String(
        l.question||''
      ),
      choices:
        l.choices||[],
      answer:
        Number(l.answer||0)
    }));

  const ins=await sb
    .from('curriculum_lessons')
    .insert(rows);

  if(ins.error){
    throw new Error(
      '레슨 저장 실패: '+
      ins.error.message
    );
  }

  return rows.length;
}

async function loadMyCurricula(){
  const r=await sb
    .from('curricula')
    .select('*')
    .eq('owner_id',user.id)
    .order(
      'created_at',
      {ascending:false}
    );

  const list=r.data||[];

  $('myCurricula').innerHTML=
    list.map(c=>`
      <div
        class="currCard ${
          currentCurriculum?.id===c.id
            ?'active'
            :''
        }"
      >
        <b>${esc(c.title)}</b>
        <br>

        <small>
          목표 ${c.target_score??90}점
          ${
            c.exam_date
              ?` · ${c.exam_date}`
              :''
          }
        </small>

        <div class="buttonRow">
          <button
            class="secondary studyMine"
            data-id="${c.id}"
          >
            학습
          </button>

          <button
            class="smallBtn retryAi"
            data-id="${c.id}"
          >
            레슨 생성 재시도
          </button>

          ${
            currentRoom
              ?`
                <button
                  class="primary shareCurr"
                  data-id="${c.id}"
                >
                  방에 공유
                </button>
              `
              :''
          }

          <button
            class="danger deleteCurr"
            data-id="${c.id}"
          >
            삭제
          </button>
        </div>
      </div>
    `).join('')||
    '<p class="msg">아직 만든 커리큘럼이 없어.</p>';

  document
    .querySelectorAll('.studyMine')
    .forEach(b=>{
      b.onclick=()=>{
        selectCurriculum(
          b.dataset.id
        );
      };
    });

  document
    .querySelectorAll('.retryAi')
    .forEach(b=>{
      b.onclick=async()=>{
        const c=list.find(
          x=>
            String(x.id)===
            b.dataset.id
        );

        try{
          await generateLessons(c);

          setText(
            'curriculumMsg',
            '레슨 재생성 완료.'
          );

          await selectCurriculum(
            c.id
          );
        }catch(e){
          setText(
            'curriculumMsg',
            e.message
          );
        }
      };
    });

  document
    .querySelectorAll('.shareCurr')
    .forEach(b=>{
      b.onclick=()=>{
        shareCurriculum(
          b.dataset.id
        );
      };
    });

  document
    .querySelectorAll('.deleteCurr')
    .forEach(b=>{
      b.onclick=()=>{
        deleteCurriculum(
          b.dataset.id
        );
      };
    });
}

async function shareCurriculum(id){
  if(!currentRoom){
    alert(
      '먼저 방에 들어가.'
    );
    return;
  }

  const r=await sb
    .from('room_curricula')
    .upsert({
      room_id:
        currentRoom.id,
      curriculum_id:id,
      shared_by:user.id
    },{
      onConflict:
        'room_id,curriculum_id'
    });

  if(r.error){
    alert(
      '공유 실패: '+
      r.error.message
    );
    return;
  }

  setText(
    'curriculumMsg',
    '현재 방에 공유했어.'
  );

  await loadRoomCurricula();
  await loadCurriculumSelect();
}

async function loadRoomCurricula(){
  if(!currentRoom){
    $('roomCurricula').innerHTML=
      '<p class="msg">방에 들어가면 공유 커리큘럼을 볼 수 있어.</p>';
    return;
  }

  const s=await sb
    .from('room_curricula')
    .select('curriculum_id')
    .eq(
      'room_id',
      currentRoom.id
    )
    .order(
      'shared_at',
      {ascending:false}
    );

  const ids=
    (s.data||[])
      .map(x=>x.curriculum_id);

  if(!ids.length){
    $('roomCurricula').innerHTML=
      '<p class="msg">아직 공유된 커리큘럼이 없어.</p>';
    return;
  }

  const c=await sb
    .from('curricula')
    .select('*')
    .in('id',ids);

  const ownerIds=[
    ...new Set(
      (c.data||[])
        .map(x=>x.owner_id)
    )
  ];

  let names={};

  if(ownerIds.length){
    const p=await sb
      .from('profiles')
      .select('id,name')
      .in('id',ownerIds);

    (p.data||[])
      .forEach(x=>{
        names[x.id]=x.name;
      });
  }

  $('roomCurricula').innerHTML=
    (c.data||[]).map(x=>`
      <div class="currCard">
        <b>
          ${esc(names[x.owner_id]||'사용자')}의
          ${esc(x.title)}
        </b>
        <br>

        <small>
          목표 ${x.target_score??90}점
        </small>

        <br>

        <button
          class="secondary studyShared"
          data-id="${x.id}"
        >
          이 커리큘럼 학습
        </button>
      </div>
    `).join('');

  document
    .querySelectorAll('.studyShared')
    .forEach(b=>{
      b.onclick=()=>{
        selectCurriculum(
          b.dataset.id
        );
      };
    });
}

async function deleteCurriculum(id){
  if(
    !confirm(
      '이 커리큘럼과 레슨을 삭제할까?'
    )
  ){
    return;
  }

  const f=await sb
    .from('curriculum_files')
    .select('storage_path')
    .eq('curriculum_id',id);

  const paths=
    (f.data||[])
      .map(x=>x.storage_path);

  if(paths.length){
    const sr=await sb.storage
      .from('curriculum-pdfs')
      .remove(paths);

    if(sr.error){
      console.warn(
        'storage remove',
        sr.error
      );
    }
  }

  const d=await sb
    .from('curricula')
    .delete()
    .eq('id',id)
    .eq('owner_id',user.id);

  if(d.error){
    alert(
      '삭제 실패: '+
      d.error.message
    );
    return;
  }

  if(
    String(currentCurriculum?.id)===
    String(id)
  ){
    clearCurriculum();
  }

  setText(
    'curriculumMsg',
    '삭제했어.'
  );

  await loadCurriculumSelect();
  await loadMyCurricula();
  await loadRoomCurricula();
}

async function getCurrentRoom(){
  const m=await sb
    .from('room_members')
    .select('room_id,joined_at')
    .eq('user_id',user.id)
    .order(
      'joined_at',
      {ascending:true}
    )
    .limit(1);

  if(!m.data?.length){
    currentRoom=null;
    return null;
  }

  const r=await sb
    .from('rooms')
    .select('*')
    .eq(
      'id',
      m.data[0].room_id
    )
    .maybeSingle();

  currentRoom=r.data||null;

  return currentRoom;
}

function renderRoomState(){
  if(currentRoom){
    $('currentRoomBox')
      .classList.remove('hidden');

    $('roomBanner')
      .classList.remove('hidden');

    setText(
      'currentRoomName',
      currentRoom.name
    );

    setText(
      'currentRoomCode',
      currentRoom.code
    );

    setText(
      'roomBannerName',
      currentRoom.name
    );

    setText(
      'roomBannerCode',
      currentRoom.code
    );

    $('createRoom').disabled=true;
    $('joinRoom').disabled=true;
    $('roomName').disabled=true;
    $('roomCode').disabled=true;
  }else{
    $('currentRoomBox')
      .classList.add('hidden');

    $('roomBanner')
      .classList.add('hidden');

    $('createRoom').disabled=false;
    $('joinRoom').disabled=false;
    $('roomName').disabled=false;
    $('roomCode').disabled=false;
  }
}

const roomCode=()=>
  Math.random()
    .toString(36)
    .slice(2,8)
    .toUpperCase();

async function createRoom(){
  if(await getCurrentRoom()){
    renderRoomState();
    return;
  }

  const name=
    $('roomName').value.trim()||
    '공부방';

  const r=await sb
    .from('rooms')
    .insert({
      code:roomCode(),
      name,
      owner_id:user.id
    })
    .select()
    .single();

  if(r.error){
    setText(
      'roomInfo',
      '방 생성 실패: '+
      r.error.message
    );
    return;
  }

  const j=await sb
    .from('room_members')
    .insert({
      room_id:r.data.id,
      user_id:user.id
    });

  if(j.error){
    setText(
      'roomInfo',
      '방 참가 실패: '+
      j.error.message
    );
    return;
  }

  currentRoom=r.data;

  renderRoomState();

  setText(
    'roomInfo',
    `방 생성 완료 · ${currentRoom.code}`
  );

  await refreshAll();
}

async function joinRoom(){
  if(await getCurrentRoom()){
    renderRoomState();
    return;
  }

  const code=
    $('roomCode')
      .value
      .trim()
      .toUpperCase();

  const r=await sb
    .from('rooms')
    .select('*')
    .eq('code',code)
    .maybeSingle();

  if(!r.data){
    setText(
      'roomInfo',
      '방을 찾지 못했어.'
    );
    return;
  }

  const j=await sb
    .from('room_members')
    .insert({
      room_id:r.data.id,
      user_id:user.id
    });

  if(j.error){
    setText(
      'roomInfo',
      '참가 실패: '+
      j.error.message
    );
    return;
  }

  currentRoom=r.data;

  renderRoomState();

  setText(
    'roomInfo',
    `${currentRoom.name} 참가 완료`
  );

  await refreshAll();
}

async function loadRanking(){
  if(!currentRoom){
    $('ranking').innerHTML=
      '<p class="msg">방을 만들거나 참가해.</p>';
    return;
  }

  const m=await sb
    .from('room_members')
    .select('user_id')
    .eq(
      'room_id',
      currentRoom.id
    );

  const ids=
    (m.data||[])
      .map(x=>x.user_id);

  if(!ids.length){
    $('ranking').innerHTML='';
    return;
  }

  const p=await sb
    .from('profiles')
    .select('id,name,xp')
    .in('id',ids);

  const arr=
    (p.data||[])
      .sort(
        (a,b)=>
          (b.xp||0)-
          (a.xp||0)
      );

  const owner=
    currentRoom.owner_id===
    user.id;

  $('ranking').innerHTML=
    arr.map((x,i)=>`
      <div class="currCard">
        <b>
          ${i+1}. ${esc(x.name)}
          ${
            x.id===user.id
              ?' (나)'
              :''
          }
          ${
            x.id===currentRoom.owner_id
              ?' 👑'
              :''
          }
        </b>

        · ${x.xp||0} XP

        ${
          owner&&x.id!==user.id
            ?`
              <button
                class="danger kick"
                data-id="${x.id}"
                data-name="${esc(x.name)}"
              >
                강퇴
              </button>
            `
            :''
        }
      </div>
    `).join('');

  document
    .querySelectorAll('.kick')
    .forEach(b=>{
      b.onclick=()=>{
        kickMember(
          b.dataset.id,
          b.dataset.name
        );
      };
    });
}

async function kickMember(
  id,
  name
){
  if(
    !confirm(
      `${name}님을 강퇴할까?`
    )
  )return;

  const d=await sb
    .from('room_members')
    .delete()
    .eq(
      'room_id',
      currentRoom.id
    )
    .eq('user_id',id);

  if(d.error){
    alert(
      '강퇴 실패: '+
      d.error.message
    );
    return;
  }

  await loadRanking();
}

async function loadChat(){
  if(!currentRoom){
    $('chatList').innerHTML=
      '<p class="msg">방에 들어가면 채팅 가능.</p>';
    return;
  }

  const m=await sb
    .from('room_messages')
    .select('*')
    .eq(
      'room_id',
      currentRoom.id
    )
    .order(
      'created_at',
      {ascending:true}
    )
    .limit(100);

  const ids=[
    ...new Set(
      (m.data||[])
        .map(x=>x.user_id)
    )
  ];

  let names={};

  if(ids.length){
    const p=await sb
      .from('profiles')
      .select('id,name')
      .in('id',ids);

    (p.data||[])
      .forEach(x=>{
        names[x.id]=x.name;
      });
  }

  $('chatList').innerHTML=
    (m.data||[])
      .map(x=>`
        <div>
          <b>
            ${esc(names[x.user_id]||'사용자')}
          </b>
          ${esc(x.message)}
        </div>
      `)
      .join('')||
      '<p class="msg">아직 메시지가 없어.</p>';

  $('chatList').scrollTop=
    $('chatList').scrollHeight;
}

async function sendChat(){
  if(!currentRoom){
    setText(
      'chatMsg',
      '먼저 방에 들어가.'
    );
    return;
  }

  const msg=
    $('chatInput').value.trim();

  if(!msg)return;

  const r=await sb
    .from('room_messages')
    .insert({
      room_id:
        currentRoom.id,
      user_id:user.id,
      message:msg
    });

  if(r.error){
    setText(
      'chatMsg',
      '전송 실패: '+
      r.error.message
    );
    return;
  }

  $('chatInput').value='';

  await loadChat();
}

async function subscribeChat(){
  if(chatChannel){
    await sb.removeChannel(
      chatChannel
    );
    chatChannel=null;
  }

  if(!currentRoom)return;

  chatChannel=sb
    .channel(
      'chat-'+currentRoom.id
    )
    .on(
      'postgres_changes',
      {
        event:'INSERT',
        schema:'public',
        table:'room_messages',
        filter:
          `room_id=eq.${currentRoom.id}`
      },
      ()=>loadChat()
    )
    .subscribe();
}

async function startMock(level){
  if(!currentLessons.length){
    setText(
      'mockResult',
      '먼저 레슨이 있는 커리큘럼을 선택해.'
    );
    return;
  }

  const usable=
    currentLessons.filter(
      l=>
        lessonFields(l)
          .choices.length>=2
    );

  if(!usable.length){
    setText(
      'mockResult',
      '문제가 있는 레슨이 없어.'
    );
    return;
  }

  const count=Math.min(
    level==='hard'
      ?15
      :level==='normal'
        ?10
        :5,
    usable.length
  );

  const qs=[
    ...usable
  ]
    .sort(()=>Math.random()-.5)
    .slice(0,count);

  mockState={
    level,
    qs,
    ans:Array(count).fill(null)
  };

  renderMock();
}

function renderMock(){
  const box=$('mockQuestions');

  box.innerHTML=
    mockState.qs.map((l,qi)=>{
      const f=lessonFields(l);

      return `
        <div class="currCard">
          <b>
            ${qi+1}. ${esc(l.question)}
          </b>

          ${
            f.choices.map((c,ci)=>`
              <button
                class="ans mockAns ${
                  mockState.ans[qi]===ci
                    ?'good'
                    :''
                }"
                data-q="${qi}"
                data-c="${ci}"
              >
                ${ci+1}. ${esc(c)}
              </button>
            `).join('')
          }
        </div>
      `;
    }).join('')+
    `
      <button
        id="gradeMock"
        class="primary"
        style="width:100%"
      >
        채점
      </button>
    `;

  document
    .querySelectorAll('.mockAns')
    .forEach(b=>{
      b.onclick=()=>{
        mockState.ans[
          Number(b.dataset.q)
        ]=
          Number(b.dataset.c);

        renderMock();
      };
    });

  $('gradeMock').onclick=
    gradeMock;
}

async function gradeMock(){
  if(
    mockState.ans.some(
      x=>x===null
    )
  ){
    setText(
      'mockResult',
      '아직 안 푼 문제가 있어.'
    );
    return;
  }

  let ok=0;

  mockState.qs.forEach(
    (l,i)=>{
      if(
        mockState.ans[i]===
        lessonFields(l).answer
      ){
        ok++;
      }
    }
  );

  const score=
    Math.round(
      ok/
      mockState.qs.length*
      100
    );

  setText(
    'mockResult',
    `결과 ${ok}/${mockState.qs.length} · ${score}점`
  );

  if(currentCurriculum){
    await sb
      .from('mock_exam_results')
      .insert({
        user_id:user.id,
        curriculum_id:
          currentCurriculum.id,
        difficulty:
          mockState.level,
        score,
        correct_count:ok,
        total_count:
          mockState.qs.length
      });
  }
}

async function changeName(){
  const name=
    $('newNameInput')
      .value.trim();

  if(!name)return;

  const r=await sb
    .from('profiles')
    .update({name})
    .eq('id',user.id);

  if(r.error){
    setText(
      'nameMsg',
      '변경 실패: '+
      r.error.message
    );
    return;
  }

  profile.name=name;
  renderProfile();

  setText(
    'nameMsg',
    '변경했어.'
  );

  await loadRanking();
}

async function resetProgress(){
  if(
    !confirm(
      '진도와 XP를 전부 초기화할까?'
    )
  )return;

  const p=await sb
    .from(
      'curriculum_lesson_progress'
    )
    .delete()
    .eq('user_id',user.id);

  if(p.error){
    setText(
      'resetMsg',
      '진도 초기화 실패: '+
      p.error.message
    );
    return;
  }

  await sb
    .from('lesson_progress')
    .delete()
    .eq('user_id',user.id);

  const x=await sb
    .from('profiles')
    .update({xp:0})
    .eq('id',user.id);

  if(x.error){
    setText(
      'resetMsg',
      'XP 초기화 실패: '+
      x.error.message
    );
    return;
  }

  profile.xp=0;

  renderProfile();

  setText(
    'resetMsg',
    '진도와 XP 초기화 완료.'
  );

  await renderPath();
  await loadRanking();
}

async function logout(){
  if(chatChannel){
    await sb.removeChannel(
      chatChannel
    );
  }

  await sb.auth.signOut();

  user=null;
  profile=null;
  currentRoom=null;
  currentCurriculum=null;
  currentLessons=[];

  localStorage.removeItem(
    'studyloop_active_curriculum'
  );

  showAuth();

  setText(
    'setupMsg',
    '로그아웃했어.'
  );
}

init();
