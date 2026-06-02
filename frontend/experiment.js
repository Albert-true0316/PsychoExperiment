// experiment.js

  // ─── 全局状态 ───────────────────────────────────────────────────────────────
  let participantId = 'P_' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2,4).toUpperCase();
  let condition = null;
  let screeningData = {};
  let allResponses = [];
  let distractorStart = null;
  let mathCorrect = 0;
  let baselineScore = 0;
  let listAScore = 0;
  let listBScore = 0;
  let currentMath = null;
  let questionnaireData = {};
  let testStarted = false;
  let viewAccessEnabled = false;
  let inListBLearning = false;
  let blockedViewAttemptsListB = 0;
  let allDualTaskEvents = [];
  localStorage.removeItem('listA_test_started');
  localStorage.removeItem('listA_aux_opened');

  const AUX_BTN_STYLE = [
    'position:fixed', 'top:10px', 'left:10px', 'z-index:9999',
    'background:#fff', 'color:#0071e3',
    'border:2px solid rgba(0,113,227,0.55)', 'border-radius:10px',
    'padding:10px 18px', 'font-size:0.95rem', 'font-weight:600',
    'cursor:pointer', 'box-shadow:0 4px 14px rgba(0,0,0,0.12)'
  ].join(';');

  // ─── 工具函数 ────────────────────────────────────────────────────────────────
  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function generateMathProblem() {
    const ops = ['+', '-', '×'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    let a, b, answer;
    if (op === '+') {
      a = Math.floor(Math.random() * 50) + 10;
      b = Math.floor(Math.random() * 50) + 10;
      answer = a + b;
    } else if (op === '-') {
      a = Math.floor(Math.random() * 50) + 30;
      b = Math.floor(Math.random() * 30) + 5;
      answer = a - b;
    } else {
      a = Math.floor(Math.random() * 9) + 2;
      b = Math.floor(Math.random() * 9) + 2;
      answer = a * b;
    }
    // Generate 3 wrong answers
    const wrongs = new Set();
    while (wrongs.size < 3) {
      const w = answer + (Math.floor(Math.random() * 10) - 5);
      if (w !== answer) wrongs.add(w);
    }
    const options = shuffle([answer, ...wrongs]);
    const correctIndex = options.indexOf(answer);
    return { question: `${a} ${op} ${b} = ?`, options, correctIndex };
  }

  // ─── API 调用 ────────────────────────────────────────────────────────────────
  async function apiRegister() {
    // 开发调试：URL 参数 ?condition=cloud/ai/control 可强制覆盖分组
    const urlCondition = new URLSearchParams(window.location.search).get('condition');
    const forcedCondition = (urlCondition && ['control','cloud','ai'].includes(urlCondition)) ? urlCondition : null;
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participant_id: participantId,
        age: screeningData.age,
        ai_freq: screeningData.ai_freq,
        mem_self: screeningData.mem_self,
        knows_google_effect: screeningData.knows_google_effect,
        forced_condition: forcedCondition
      })
    });
    if (!res.ok) {
      throw new Error('register_failed');
    }
    const data = await res.json();
    if (!data || !['control', 'cloud', 'ai'].includes(data.condition)) {
      throw new Error('invalid_condition');
    }
    condition = data.condition;
  }

  async function apiSubmitOne(response) {
    await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participant_id: participantId,
        responses: [response]
      })
    }).catch(() => {});
  }

  // 防连点锁（300ms）
  let _clickLocked = false;
  function withClickLock(fn) {
    return function(e) {
      if (_clickLocked) { e && e.stopImmediatePropagation(); return; }
      _clickLocked = true;
      setTimeout(() => { _clickLocked = false; }, 300);
      fn && fn(e);
    };
  }

  async function apiSubmit() {
    await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participant_id: participantId,
        responses: allResponses
      })
    });
  }

  async function apiQuestionnaire(qData) {
    await fetch('/api/questionnaire', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participant_id: participantId,
        ...qData
      })
    });
  }

  async function apiDualTask(events) {
    if (!events.length) return;
    await fetch('/api/dual_task', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        participant_id: participantId,
        events
      })
    }).catch(() => {});
  }

  function recordDualTaskEvent(record) {
    allDualTaskEvents.push(record);
  }

  function submitDualTaskPhase(phase) {
    const events = allDualTaskEvents.filter(e => e.phase === phase);
    if (!events.length) return Promise.resolve();
    return apiDualTask(events);
  }

  function updateAuxViewButtonState() {
    const btn = document.getElementById('cloud-view-btn') || document.getElementById('ai-view-btn');
    if (!btn) return;
    if (viewAccessEnabled) {
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
      btn.style.borderColor = 'rgba(0,113,227,0.55)';
    } else {
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
      btn.style.borderColor = 'rgba(0,113,227,0.22)';
    }
  }

  function openAuxView(url, blockedMsg) {
    if (!viewAccessEnabled) {
      if (inListBLearning) blockedViewAttemptsListB += 1;
      showHintToast(blockedMsg);
      return;
    }
    if (testStarted) {
      alert(condition === 'cloud' ? '文件已损毁，无法查看。' : 'AI 助手已断开连接，无法访问。');
    } else {
      window.open(url, '_blank');
    }
  }

  function createAuxViewButton(kind) {
    const btnId = kind === 'cloud' ? 'cloud-view-btn' : 'ai-view-btn';
    const existing = document.getElementById(btnId);
    if (existing) existing.remove();

    const btn = document.createElement('button');
    btn.id = btnId;
    btn.style.cssText = AUX_BTN_STYLE;
    if (kind === 'cloud') {
      btn.textContent = '云端 · List A';
      btn.addEventListener('click', function() {
        openAuxView(
          'listA_cloud.html',
          '当前阶段该功能不可用。List B 学习期间请专注阅读，稍后可再次使用。'
        );
      });
    } else {
      btn.textContent = 'AI 学习助手';
      btn.addEventListener('click', function() {
        openAuxView(
          'ai_chat.html',
          '当前阶段该功能不可用。List B 学习期间请专注阅读，稍后可再次使用。'
        );
      });
    }
    document.body.appendChild(btn);
    viewAccessEnabled = true;
    updateAuxViewButtonState();
  }

  function buildAuxFamiliarizationTrial() {
    return {
      type: jsPsychHtmlButtonResponse,
      stimulus: function() {
        const toolLabel = condition === 'cloud' ? '「云端 · List A」' : '「AI 学习助手」';
        const actionHint = condition === 'cloud'
          ? '打开后浏览一下已保存的内容即可'
          : '打开后随便问一个问题或浏览对话界面即可';
        return `
          <div class="card">
            <h2>熟悉外部工具</h2>
            <p style="line-height:1.8;margin-bottom:16px">
              List A 的内容已${condition === 'cloud' ? '保存至云端' : '提供给 AI 助手'}。这是本次界面体验的一部分，<strong>请在需要时像日常使用软件一样使用它</strong>，无需刻意回避。
            </p>
            <p style="line-height:1.8;margin-bottom:16px">
              请先点击屏幕左上角的 ${toolLabel} 按钮，${actionHint}。
            </p>
            <p style="color:#86868b;font-size:0.9rem">
              确认已成功打开后，再点击下方按钮继续。后续内容问答阶段需独立作答，届时工具将不可用。
            </p>
          </div>`;
      },
      choices: ['我已打开，继续'],
      on_load: function() {
        let pollTimer = null;
        const continueBtn = document.querySelector('#jspsych-content .jspsych-btn');
        const host = document.getElementById('jspsych-content');

        function syncContinueState() {
          const opened = localStorage.getItem('listA_aux_opened') === '1';
          if (continueBtn) {
            continueBtn.disabled = !opened;
            continueBtn.style.opacity = opened ? '1' : '0.5';
            continueBtn.style.cursor = opened ? 'pointer' : 'not-allowed';
          }
        }

        syncContinueState();
        pollTimer = setInterval(syncContinueState, 400);
        if (host) host._auxFamPoll = pollTimer;

        if (continueBtn) {
          continueBtn.addEventListener('click', function(e) {
            if (localStorage.getItem('listA_aux_opened') !== '1') {
              e.stopImmediatePropagation();
              showHintToast('请先点击左上角按钮，成功打开页面后再继续。');
            }
          }, true);
        }
      },
      on_finish: function() {
        const host = document.getElementById('jspsych-content');
        if (host && host._auxFamPoll) {
          clearInterval(host._auxFamPoll);
          delete host._auxFamPoll;
        }
      }
    };
  }

  function showHintToast(message) {
    const oldToast = document.getElementById('exp-hint-toast');
    if (oldToast) oldToast.remove();
    const toast = document.createElement('div');
    toast.id = 'exp-hint-toast';
    toast.textContent = message;
    toast.style.cssText = [
      'position:fixed',
      'left:50%',
      'bottom:28px',
      'transform:translateX(-50%)',
      'z-index:10000',
      'max-width:80vw',
      'padding:10px 14px',
      'border-radius:10px',
      'background:rgba(29,29,31,0.92)',
      'color:#fff',
      'font-size:0.86rem',
      'line-height:1.5',
      'box-shadow:0 6px 16px rgba(0,0,0,0.18)',
      'opacity:0',
      'transition:opacity 0.18s ease'
    ].join(';');
    document.body.appendChild(toast);
    requestAnimationFrame(() => { toast.style.opacity = '1'; });
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 220);
    }, 2300);
  }

  // ─── jsPsych 初始化 ──────────────────────────────────────────────────────────
  const jsPsych = initJsPsych({
    display_element: 'jspsych-content'
  });

  // ─── 加载刺激材料后构建实验 ───────────────────────────────────────────────────
  Promise.all([
    fetch('stimuli/listA.json').then(r => r.json()),
    fetch('stimuli/listB.json').then(r => r.json()),
    fetch('stimuli/baseline.json').then(r => r.json())
  ]).then(([listA, listB, baseline]) => {
    runExperiment(listA, listB, baseline);
  }).catch(err => {
    document.getElementById('jspsych-content').innerHTML =
      '<div class="card" style="text-align:center"><p style="color:#ff3b30">刺激材料加载失败，请刷新页面重试。</p><p style="color:#86868b;font-size:0.85rem">' + err + '</p></div>';
  });

  function runExperiment(listA, listB, baseline) {
    const timeline = [];

    // ── 1. 知情同意 ─────────────────────────────────────────────────────────
    timeline.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: `
        <div class="card">
          <h2 >知情同意书</h2>
          <p style="line-height:1.8;margin-bottom:16px">
            您好！感谢您参与本研究。本研究由心理学系课题组开展，旨在评估<strong>不同数字界面的用户体验与使用感受</strong>（每一被试随机分配界面）。
          </p>
          <p style="line-height:1.8;margin-bottom:16px">
            实验约需 <strong>45 分钟</strong>，您将在这一设计下完成学习任务，并填写相关体验问卷。全程数据匿名收集，仅用于学术研究，不会泄露给任何第三方。
          </p>
          <p style="line-height:1.8;margin-bottom:16px">
            您可以在任何时候退出实验，不会受到任何惩罚。若您同意参与，请点击下方按钮继续。
          </p>
          <p style="font-size:0.85rem;color:#86868b">本研究已通过伦理委员会审查。</p>
        </div>`,
      choices: ['我已阅读并同意参与本研究'],
      button_html: '<button class="jspsych-btn" style="margin-top:24px">%choice%</button>'
    });

    // ── 2. 筛查问卷 ──────────────────────────────────────────────────────────
    // Use custom HTML form
    timeline.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: `
        <div class="card">
          <h2 >基本信息</h2>
          <div style="margin-bottom:20px">
            <label style="display:block;margin-bottom:8px">1. 您的年龄：</label>
            <input type="number" id="age-input" min="16" max="60" placeholder="请输入年龄"
              style="background:#fff;border:1px solid rgba(0,0,0,0.12);border-radius:8px;padding:8px 14px;color:#1d1d1f;font-size:1rem;width:160px">
          </div>
          <div style="margin-bottom:20px">
            <label style="display:block;margin-bottom:8px">2. 您平均每天使用 AI 工具（如 ChatGPT、文心一言等）的频率：</label>
            <div class="likert-row">
              <span class="scale-label">从不</span>
              ${[1,2,3,4,5,6,7].map(v => `<label><input type="radio" name="ai_freq" value="${v}"> ${v}</label>`).join('')}
              <span class="scale-label">每天多次</span>
            </div>
          </div>
          <div style="margin-bottom:20px">
            <label style="display:block;margin-bottom:8px">3. 您对自己记忆能力的自我评价：</label>
            <div class="likert-row">
              <span class="scale-label">很差</span>
              ${[1,2,3,4,5,6,7].map(v => `<label><input type="radio" name="mem_self" value="${v}"> ${v}</label>`).join('')}
              <span class="scale-label">很好</span>
            </div>
          </div>
          <div style="margin-bottom:20px">
            <label style="display:block;margin-bottom:8px">4. 您是否读过或了解关于互联网、数字工具如何影响人类记忆的相关研究？</label>
            <label style="margin-right:20px"><input type="radio" name="knows" value="no"> 没有</label>
            <label><input type="radio" name="knows" value="yes"> 有过相关了解</label>
          </div>
          <p id="form-error" style="color:#ff3b30;display:none;margin-top:8px">请填写所有选项后继续。</p>
        </div>`,
      choices: ['继续'],
      button_html: '<button class="jspsych-btn" style="margin-top:20px">%choice%</button>',
      on_load: function() {
        // Validate before allowing submission
        const btn = document.querySelector('.jspsych-btn');
        btn.addEventListener('click', function(e) {
          const age = parseInt(document.getElementById('age-input').value);
          const ai_freq = document.querySelector('input[name="ai_freq"]:checked');
          const mem_self = document.querySelector('input[name="mem_self"]:checked');
          const knows = document.querySelector('input[name="knows"]:checked');
          if (!age || age < 16 || age > 60 || !ai_freq || !mem_self || !knows) {
            e.stopImmediatePropagation();
            document.getElementById('form-error').style.display = 'block';
          } else {
            screeningData = {
              age,
              ai_freq: parseInt(ai_freq.value),
              mem_self: parseInt(mem_self.value),
              knows_google_effect: knows.value === 'yes'
            };
          }
        }, true);
      },
      on_finish: function() {
        // knows_google_effect 作为协变量传给服务器，不中断实验
        jsPsych.pauseExperiment();
        apiRegister()
          .then(() => jsPsych.resumeExperiment())
          .catch(() => {
            document.getElementById('jspsych-content').innerHTML =
              '<div class="card" style="text-align:center"><p style="color:#ff3b30">实验初始化失败（分组注册失败）。</p><p style="color:#86868b">请关闭页面并重新进入实验链接。</p></div>';
            jsPsych.endExperiment('register_failed');
          });
      }
    });

    // knows_google_effect 保留在 screeningData 中，由服务器标记为协变量，不中断实验

    // ── 3. 基线学习阶段说明 ─────────────────────────────────────────────────
    timeline.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: `
        <div class="card">
          <h2 >第一阶段：记忆热身</h2>
          <p style="line-height:1.8;margin-bottom:16px">
            接下来您将看到 <strong>10 条知识性陈述</strong>，每条显示 <strong>5 秒</strong>。<br>
            请认真阅读并尽量记住每条信息的具体细节。
          </p>
          <p style="line-height:1.8;margin-bottom:16px">
            阅读结束后将进行一次小测验，每题有四个选项。
          </p>
          <p style="color:#86868b;font-size:0.9rem">按"开始"后将自动翻页，请做好准备。</p>
        </div>`,
      choices: ['开始热身']
    });

    // ── 4. 基线学习（5000ms/题）─────────────────────────────────────────────
    baseline.forEach((item, idx) => {
      timeline.push({
        type: jsPsychHtmlKeyboardResponse,
        stimulus: `
          <div style="text-align:center;margin-bottom:12px;color:#86868b;font-size:0.85rem">热身 ${idx+1} / ${baseline.length}</div>
          <div class="stimulus-box">${item.statement}</div>`,
        choices: 'NO_KEYS',
        trial_duration: 5000
      });
      // 500ms blank between items
      timeline.push({
        type: jsPsychHtmlKeyboardResponse,
        stimulus: '<div style="height:180px"></div>',
        choices: 'NO_KEYS',
        trial_duration: 500
      });
    });

    // ── 5. 基线测试说明 ──────────────────────────────────────────────────────
    timeline.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: `
        <div class="card" style="text-align:center">
          <h2 >热身测验</h2>
          <p style="line-height:1.8">现在请根据刚才读到的内容回答以下问题。<br>每题从四个选项中选择一个正确答案。</p>
        </div>`,
      choices: ['开始测验']
    });

    // ── 6. 基线测试（4选1）──────────────────────────────────────────────────
    baseline.forEach((item, idx) => {
      // Shuffle options with correct tracking
      const optionOrder = shuffle([0,1,2,3]);
      const shuffledOptions = optionOrder.map(i => item.options[i]);
      const shuffledCorrect = optionOrder.indexOf(item.correct);

      timeline.push({
        type: jsPsychHtmlButtonResponse,
        stimulus: `
          <div style="text-align:center;margin-bottom:12px;color:#86868b;font-size:0.85rem">热身测验 ${idx+1} / ${baseline.length}</div>
          <div class="stimulus-box" style="font-size:1.2rem;margin-bottom:8px">${item.test_question}</div>`,
        choices: shuffledOptions,
        button_html: '<button class="jspsych-btn">%choice%</button>',
        on_finish: function(data) {
          const isCorrect = data.response === shuffledCorrect;
          if (isCorrect) baselineScore += 1;
          allResponses.push({
            list_type: 'baseline',
            item_index: item.index ?? idx,
            question: item.test_question,
            correct_answer: item.options[item.correct],
            participant_ans: shuffledOptions[data.response],
            is_correct: isCorrect ? 1 : 0,
            rt_ms: data.rt
          });
        }
      });
    });

    // ── 7. 双任务练习（List A 之前）────────────────────────────────────────
    timeline.push(DualTask.buildDualTaskPracticeBlock());

    // ── 8. List A 学习阶段说明 ──────────────────────────────────────────────
    timeline.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: function() {
        let hint = '请认真阅读并尽量记住每条信息的具体细节。';
        if (condition === 'cloud') {
          hint = '本阶段材料将自动保存至云端，后续阶段可点击左上角按钮查看。请认真阅读并尽量记住每条信息的具体细节。';
        } else if (condition === 'ai') {
          hint = '本阶段材料将提供给 AI 助手，后续阶段可点击左上角按钮向助手查询。请认真阅读并尽量记住每条信息的具体细节。';
        }
        return `
        <div class="card">
          <h2 >第二阶段：学习 List A</h2>
          <p style="line-height:1.8;margin-bottom:16px">
            接下来您将看到 <strong>20 条知识性陈述</strong>，每条显示 <strong>5 秒</strong>。<br>
            ${hint}
          </p>
          <p style="line-height:1.8;margin-bottom:16px">
            ${DualTask.DUAL_TASK_INSTRUCTION}
          </p>
          <p style="line-height:1.8;margin-bottom:16px;color:#86868b;font-size:0.9rem">
            请佩戴耳机、固定音量，并在安静环境中完成。
          </p>
          <p style="color:#86868b;font-size:0.9rem">按"开始"后将自动翻页。</p>
        </div>`;
      },
      choices: ['开始学习']
    });


    // ── 9. List A 学习（5000ms/题 + 双任务）──────────────────────────────────
    DualTask.appendDualTaskLearningTrials(timeline, listA, 'A', 'List A', recordDualTaskEvent);

    timeline.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus: '',
      choices: 'NO_KEYS',
      trial_duration: 1,
      on_finish: function() {
        jsPsych.pauseExperiment();
        submitDualTaskPhase('A').finally(() => jsPsych.resumeExperiment());
      }
    });


    // ── 10. 实验操纵（按组别呈现）───────────────────────────────────────────
    timeline.push({
      timeline: [{
        type: jsPsychHtmlButtonResponse,
        stimulus: `
          <div class="card" style="text-align:center">
            <h2 >阶段结束</h2>
            <p style="line-height:1.8">您可以进入下一阶段。</p>
          </div>`,
        choices: ['继续']
      }],
      conditional_function: function() { return condition === 'control'; }
    });

    timeline.push({
      timeline: [{
        type: jsPsychHtmlButtonResponse,
        stimulus: `
          <div class="card" style="text-align:center">
            <h2 >正在保存到云端</h2>
            <div style="background:rgba(0,0,0,0.06);border-radius:99px;height:8px;overflow:hidden;margin:18px 0">
              <div id="cloud-progress-fill" style="width:0%;height:100%;background:#0071e3;transition:width 1.8s ease"></div>
            </div>
            <p id="cloud-progress-text" style="color:#86868b">正在上传中，请稍候...</p>
          </div>`,
        choices: ['继续'],
        on_load: function() {
          const btn = document.querySelector('.jspsych-btn');
          const fill = document.getElementById('cloud-progress-fill');
          const text = document.getElementById('cloud-progress-text');
          if (btn) {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.cursor = 'not-allowed';
          }
          // Trigger transition after paint
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              if (fill) fill.style.width = '100%';
            });
          });
          setTimeout(() => {
            if (text) text.textContent = '保存完成。接下来请先熟悉一下左上角的查看功能。';
            if (btn) {
              btn.disabled = false;
              btn.style.opacity = '1';
              btn.style.cursor = 'pointer';
            }
          }, 1850);
        },
        on_finish: function() {
          if (condition === 'cloud') createAuxViewButton('cloud');
        }
      }],
      conditional_function: function() { return condition === 'cloud'; }
    });

    timeline.push({
      timeline: [{
        type: jsPsychHtmlButtonResponse,
        stimulus: `
          <div class="card">
            <h2 >AI 助手确认</h2>
            <div style="background:rgba(0,113,227,0.06);border:1px solid rgba(0,113,227,0.15);border-radius:12px;padding:14px;margin-bottom:12px">
              <div >AI：</div>
              <div>我已收到并保存您的学习内容，之后可随时调用。</div>
            </div>
            <p style="color:#86868b">接下来请先熟悉一下左上角的 AI 助手功能。</p>
          </div>`,
        choices: ['继续'],
        on_finish: function() {
          if (condition === 'ai') createAuxViewButton('ai');
        }
      }],
      conditional_function: function() { return condition === 'ai'; }
    });

    timeline.push({
      timeline: [buildAuxFamiliarizationTrial()],
      conditional_function: function() { return condition === 'cloud' || condition === 'ai'; }
    });

    // ── 11. List B 学习阶段说明 ─────────────────────────────────────────────
    timeline.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: function() {
        let hint = '请认真阅读并尽量记住每条信息的具体细节。';
        if (condition === 'cloud') {
          hint = '本阶段材料不会被云端保存，且不会以任何形式再次呈现。请仅依赖自己的记忆完成学习。';
        } else if (condition === 'ai') {
          hint = '本阶段材料不会提供给 AI 助手，且不会以任何形式再次呈现。请仅依赖自己的记忆完成学习。';
        }
        return `
        <div class="card">
          <h2 >第三阶段：学习 List B</h2>
          <p style="line-height:1.8;margin-bottom:16px">
            接下来您将看到 <strong>20 条新的知识性陈述</strong>，每条显示 <strong>5 秒</strong>。<br>
            ${hint}
          </p>
          <p style="line-height:1.8;margin-bottom:16px">
            ${DualTask.DUAL_TASK_INSTRUCTION}
          </p>
          <p style="line-height:1.8;margin-bottom:16px;color:#86868b;font-size:0.9rem">
            请佩戴耳机、固定音量，并在安静环境中完成。
          </p>
          <p style="color:#86868b;font-size:0.9rem">按"开始"后将自动翻页。</p>
        </div>`;
      },
      choices: ['开始学习'],
      on_finish: function() {
        // List B 开始后禁用外部查看入口，避免占用学习时间
        inListBLearning = true;
        viewAccessEnabled = false;
        updateAuxViewButtonState();
      }
    });

    // ── 11. List B 学习（5000ms/题 + 双任务）─────────────────────────────────
    DualTask.appendDualTaskLearningTrials(timeline, listB, 'B', 'List B', recordDualTaskEvent);

    timeline.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus: '',
      choices: 'NO_KEYS',
      trial_duration: 1,
      on_finish: function() {
        jsPsych.pauseExperiment();
        submitDualTaskPhase('B').finally(() => jsPsych.resumeExperiment());
      }
    });

    // ── 12. 干扰任务说明 ────────────────────────────────────────────────────
    timeline.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: function() {
        let auxHint = '';
        if (condition === 'cloud') {
          auxHint = '<p style="line-height:1.8;margin-bottom:12px;color:#86868b;font-size:0.9rem">在等待期间，如需回顾 List A，可点击左上角「云端 · List A」。</p>';
        } else if (condition === 'ai') {
          auxHint = '<p style="line-height:1.8;margin-bottom:12px;color:#86868b;font-size:0.9rem">在等待期间，如需回顾 List A，可点击左上角「AI 学习助手」。</p>';
        }
        return `
        <div class="card">
          <h2 >计算界面体验</h2>
          <p style="line-height:1.8;margin-bottom:16px">
            接下来将进行 <strong>2 分钟</strong>的数学选择题，请尽量快速准确作答。
          </p>
          ${auxHint}
          <p style="color:#86868b;font-size:0.9rem">点击开始后计时开始。</p>
        </div>`;
      },
      choices: ['开始'],
      on_finish: function() {
        // List B 学习结束后，在计算题阶段恢复可查看
        inListBLearning = false;
        viewAccessEnabled = true;
        updateAuxViewButtonState();
        distractorStart = performance.now();
        mathCorrect = 0;
      }
    });

    // ── 13. 干扰任务（2分钟数学题）─────────────────────────────────────────
    const distractorLoop = {
      timeline: [{
        type: jsPsychHtmlButtonResponse,
        stimulus: function() {
          currentMath = generateMathProblem();
          return `
            <div class="card" style="text-align:center">
              <div style="color:#86868b;margin-bottom:8px">数学选择题</div>
              <div class="stimulus-box" style="font-size:1.4rem">${currentMath.question}</div>
            </div>`;
        },
        choices: function() {
          return currentMath.options.map(String);
        },
        button_html: '<button class="jspsych-btn">%choice%</button>',
        on_load: function() {
          document.querySelectorAll('.jspsych-btn').forEach(btn => {
            btn.addEventListener('click', function() {
              document.querySelectorAll('.jspsych-btn').forEach(b => { b.disabled = true; b.style.opacity = '0.5'; });
            });
          });
        },
        on_finish: function(data) {
          if (data.response === currentMath.correctIndex) {
            mathCorrect += 1;
          }
        }
      }],
      loop_function: function() {
        return performance.now() - distractorStart < 2 * 60 * 1000;
      }
    };
    timeline.push(distractorLoop);

    // ── 14. 内容问答说明 ────────────────────────────────────────────────────
    timeline.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: function() {
        const toolNote = (condition === 'cloud' || condition === 'ai')
          ? '<p style="color:#86868b;font-size:0.9rem;margin-top:12px">请独立完成，不要使用外部工具或页面上的辅助按钮。</p>'
          : '<p style="color:#86868b;font-size:0.9rem;margin-top:12px">请独立完成作答。</p>';
        return `
        <div class="card" style="text-align:center">
          <h2 >内容问答</h2>
          <p style="line-height:1.8">接下来请根据<strong>您自己记住的内容</strong>独立作答，每题从四个选项中选择一项。</p>
          ${toolNote}
        </div>`;
      },
      choices: ['开始答题'],
      on_finish: function() { testStarted = true; localStorage.setItem('listA_test_started', '1'); }
    });

    function pushTest(list, listType, label) {
      const testList = shuffle(list);
      testList.forEach((item, idx) => {
        const optionOrder = shuffle([0,1,2,3]);
        const shuffledOptions = optionOrder.map(i => item.options[i]);
        const shuffledCorrect = optionOrder.indexOf(item.correct);

        timeline.push({
          type: jsPsychHtmlButtonResponse,
          stimulus: `
            <div style="text-align:center;margin-bottom:12px;color:#86868b;font-size:0.85rem">${label} 问答 ${idx+1} / ${testList.length}</div>
            <div class="stimulus-box" style="font-size:1.2rem;margin-bottom:8px">${item.test_question}</div>`,
          choices: shuffledOptions,
          button_html: '<button class="jspsych-btn">%choice%</button>',
          on_load: function() {
            document.querySelectorAll('.jspsych-btn').forEach(btn => {
              btn.addEventListener('click', function() {
                document.querySelectorAll('.jspsych-btn').forEach(b => { b.disabled = true; b.style.opacity = '0.5'; });
              });
            });
          },
          on_finish: function(data) {
            const isCorrect = data.response === shuffledCorrect;
            if (listType === 'A' && isCorrect) listAScore += 1;
            if (listType === 'B' && isCorrect) listBScore += 1;
            allResponses.push({
              list_type: listType,
              item_index: item.index ?? idx,
              question: item.test_question,
              correct_answer: item.options[item.correct],
              participant_ans: shuffledOptions[data.response],
              is_correct: isCorrect ? 1 : 0,
              rt_ms: data.rt
            });
            apiSubmitOne(allResponses[allResponses.length - 1]);
          }
        });
      });
    }

    // ── 15. List A + List B 问答 ────────────────────────────────────────────
    pushTest(listA, 'A', 'List A');
    pushTest(listB, 'B', 'List B');

    // ── 15.5 UI体验填充问卷（掩护故事） ────────────────────────────────────────
    timeline.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: `
        <div class="card">
          <h2 >界面体验评价</h2>
          <p style="line-height:1.8;margin-bottom:20px;color:#86868b;font-size:0.9rem">请根据您刚才的使用体验作答。</p>
          <div style="margin-bottom:18px">
            <label style="display:block;margin-bottom:8px">1. 您觉得本实验的界面设计整体美观度如何？</label>
            <div class="likert-row">
              <span class="scale-label">很差</span>
              ${[1,2,3,4,5,6,7].map(v => `<label><input type="radio" name="ui_beauty" value="${v}"> ${v}</label>`).join('')}
              <span class="scale-label">很好</span>
            </div>
          </div>
          <div style="margin-bottom:18px">
            <label style="display:block;margin-bottom:8px">2. 操作流程是否清晰易懂？</label>
            <div class="likert-row">
              <span class="scale-label">很难懂</span>
              ${[1,2,3,4,5,6,7].map(v => `<label><input type="radio" name="ui_clarity" value="${v}"> ${v}</label>`).join('')}
              <span class="scale-label">很清晰</span>
            </div>
          </div>
          <div style="margin-bottom:18px">
            <label style="display:block;margin-bottom:8px">3. 界面风格是否符合您的使用习惯？</label>
            <div class="likert-row">
              <span class="scale-label">完全不符合</span>
              ${[1,2,3,4,5,6,7].map(v => `<label><input type="radio" name="ui_habit" value="${v}"> ${v}</label>`).join('')}
              <span class="scale-label">完全符合</span>
            </div>
          </div>
          <p id="ui-error" style="color:#ff3b30;display:none;margin-top:8px">请完成所有题目后继续。</p>
        </div>`,
      choices: ['继续'],
      button_html: '<button class="jspsych-btn" style="margin-top:8px">%choice%</button>',
      on_load: function() {
        const btn = document.querySelector('.jspsych-btn');
        btn.addEventListener('click', function(e) {
          const beauty = document.querySelector('input[name="ui_beauty"]:checked');
          const clarity = document.querySelector('input[name="ui_clarity"]:checked');
          const habit = document.querySelector('input[name="ui_habit"]:checked');
          if (!beauty || !clarity || !habit) {
            e.stopImmediatePropagation();
            document.getElementById('ui-error').style.display = 'block';
          }
        }, true);
      }
    });

    // ── 16. 操纵核实问卷 ────────────────────────────────────────────────────
    timeline.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: `
        <div class="card">
          <h2 >使用体验反馈</h2>
          <div style="margin-bottom:18px">
            <label style="display:block;margin-bottom:8px">1. 在学习 List A 时，您是否相信这些材料之后可以再次查看或调用？</label>
            <label style="margin-right:20px"><input type="radio" name="manip_a_represent" value="1"> 可以</label>
            <label><input type="radio" name="manip_a_represent" value="0"> 不可以</label>
          </div>
          <div style="margin-bottom:18px">
            <label style="display:block;margin-bottom:8px">2. 在学习 List B 时，您认为这些材料之后会再次呈现吗？</label>
            <label style="margin-right:20px"><input type="radio" name="manip_b_represent" value="1"> 会</label>
            <label><input type="radio" name="manip_b_represent" value="0"> 不会</label>
          </div>
          <div style="margin-bottom:18px">
            <label style="display:block;margin-bottom:8px">3. 您对实验中“是否可再次呈现”提示语的可信度评价：</label>
            <div class="likert-row">
              <span class="scale-label">很低</span>
              ${[1,2,3,4,5,6,7].map(v => `<label><input type="radio" name="manip_instruction_trust" value="${v}"> ${v}</label>`).join('')}
              <span class="scale-label">很高</span>
            </div>
          </div>
          <p id="manip-error" style="color:#ff3b30;display:none;margin-top:8px">请完成所有题目后继续。</p>
        </div>`,
      choices: ['继续'],
      button_html: '<button class="jspsych-btn" style="margin-top:8px">%choice%</button>',
      on_load: function() {
        const btn = document.querySelector('.jspsych-btn');
        btn.addEventListener('click', function(e) {
          const listARepresent = document.querySelector('input[name="manip_a_represent"]:checked');
          const listBRepresent = document.querySelector('input[name="manip_b_represent"]:checked');
          const instructionTrust = document.querySelector('input[name="manip_instruction_trust"]:checked');
          if (!listARepresent || !listBRepresent || !instructionTrust) {
            e.stopImmediatePropagation();
            document.getElementById('manip-error').style.display = 'block';
            return;
          }
          questionnaireData.manip_a_represent = parseInt(listARepresent.value);
          questionnaireData.manip_b_represent = parseInt(listBRepresent.value);
          questionnaireData.manip_instruction_trust = parseInt(instructionTrust.value);
        }, true);
      }
    });

    // ── 17. 元认知问卷 ──────────────────────────────────────────────────────
    timeline.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: `
        <div class="card">
          <h2 >学习效果评估</h2>
          <div style="margin-bottom:18px">
            <label style="display:block;margin-bottom:8px">1. 您认为自己在 List A 中答对了几题？（0-20）</label>
            <input type="number" id="pred-a" min="0" max="20" placeholder="0-20"
              style="background:#fff;border:1px solid rgba(0,0,0,0.12);border-radius:8px;padding:8px 14px;color:#1d1d1f;font-size:1rem;width:120px">
          </div>
          <div style="margin-bottom:18px">
            <label style="display:block;margin-bottom:8px">2. 您认为自己在 List B 中答对了几题？（0-20）</label>
            <input type="number" id="pred-b" min="0" max="20" placeholder="0-20"
              style="background:#fff;border:1px solid rgba(0,0,0,0.12);border-radius:8px;padding:8px 14px;color:#1d1d1f;font-size:1rem;width:120px">
          </div>
          <div style="margin-bottom:18px">
            <label style="display:block;margin-bottom:8px">3. 在本次学习任务中，您对所使用工具的辅助功能满意程度：</label>
            <div class="likert-row">
              <span class="scale-label">很低</span>
              ${[1,2,3,4,5,6,7].map(v => `<label><input type="radio" name="cognitive_dep" value="${v}"> ${v}</label>`).join('')}
              <span class="scale-label">很高</span>
            </div>
          </div>
          <div style="margin-bottom:18px">
            <label style="display:block;margin-bottom:8px">4. 您对本实验实际目的的猜测与知情同意书中的说明是否一致？</label>
            <div class="likert-row">
              <span class="scale-label">完全不一致</span>
              ${[1,2,3,4,5,6,7].map(v => `<label><input type="radio" name="suspect" value="${v}"> ${v}</label>`).join('')}
              <span class="scale-label">完全一致</span>
            </div>
          </div>
          <p id="meta-error" style="color:#ff3b30;display:none;margin-top:8px">请完成所有题目后继续。</p>
        </div>`,
      choices: ['提交'],
      button_html: '<button class="jspsych-btn" style="margin-top:8px">%choice%</button>',
      on_load: function() {
        const btn = document.querySelector('.jspsych-btn');
        btn.addEventListener('click', function(e) {
          const predA = document.getElementById('pred-a').value;
          const predB = document.getElementById('pred-b').value;
          const dep = document.querySelector('input[name="cognitive_dep"]:checked');
          const suspect = document.querySelector('input[name="suspect"]:checked');
          if (predA === '' || predB === '' || !dep || !suspect) {
            e.stopImmediatePropagation();
            document.getElementById('meta-error').style.display = 'block';
            return;
          }
          questionnaireData.metacog_pred_a = parseInt(predA);
          questionnaireData.metacog_pred_b = parseInt(predB);
          questionnaireData.cognitive_dep = parseInt(dep.value);
          questionnaireData.suspected_deception = parseInt(suspect.value);
          questionnaireData.blocked_view_attempts_listb = blockedViewAttemptsListB;
        }, true);
      },
      on_finish: function() {
        // 等待问卷写入，避免被试快速结束导致问卷丢失
        jsPsych.pauseExperiment();
        apiQuestionnaire(questionnaireData)
          .catch(() => {})
          .finally(() => jsPsych.resumeExperiment());
      }
    });

    // ── 18. 事后知情 ────────────────────────────────────────────────────────
    timeline.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: `
        <div class="card" style="text-align:center">
          <h2 >实验结束</h2>
          <p style="line-height:1.8;margin-bottom:16px">
            感谢您的参与！若您对实验内容有任何疑问，可联系研究负责人。
          </p>
          <p style="color:#86868b;font-size:0.9rem">点击完成后可关闭页面。</p>
        </div>`,
      choices: ['完成'],
      on_finish: function() {
        apiSubmit();
      }
    });

    jsPsych.run(timeline);
  }
