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
  localStorage.removeItem('listA_test_started');

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
    const data = await res.json();
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
            您好！感谢您参与本研究。本研究由心理学系课题组开展，旨在评估<strong>不同数字界面的用户体验与使用感受</strong>。
          </p>
          <p style="line-height:1.8;margin-bottom:16px">
            实验约需 <strong>45 分钟</strong>，您将使用若干数字工具完成学习任务，并填写相关体验问卷。全程数据匿名收集，仅用于学术研究，不会泄露给任何第三方。
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
        apiRegister().then(() => jsPsych.resumeExperiment()).catch(() => jsPsych.resumeExperiment());
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

    // ── 7. List A 学习阶段说明 ──────────────────────────────────────────────
    timeline.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: `
        <div class="card">
          <h2 >第二阶段：学习 List A</h2>
          <p style="line-height:1.8;margin-bottom:16px">
            接下来您将看到 <strong>20 条知识性陈述</strong>，每条显示 <strong>5 秒</strong>。<br>
            请认真阅读并尽量记住每条信息的具体细节。
          </p>
          <p style="color:#86868b;font-size:0.9rem">按"开始"后将自动翻页。</p>
        </div>`,
      choices: ['开始学习']
    });

    // ── 8. List A 学习（5000ms/题）──────────────────────────────────────────
    listA.forEach((item, idx) => {
      timeline.push({
        type: jsPsychHtmlKeyboardResponse,
        stimulus: `
          <div style="text-align:center;margin-bottom:12px;color:#86868b;font-size:0.85rem">List A ${idx+1} / ${listA.length}</div>
          <div class="stimulus-box">${item.statement}</div>`,
        choices: 'NO_KEYS',
        trial_duration: 5000
      });
      timeline.push({
        type: jsPsychHtmlKeyboardResponse,
        stimulus: '<div style="height:180px"></div>',
        choices: 'NO_KEYS',
        trial_duration: 500
      });
    });

    // ── 9. 实验操纵（按组别呈现）───────────────────────────────────────────
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
              <div style="width:100%;height:100%;background:#0071e3"></div>
            </div>
            <p style="color:#86868b">保存完成。您可以随时点击左上角的按钮查看已保存的内容。</p>
          </div>`,
        choices: ['继续'],
        on_finish: function() {
          if (condition === 'cloud') {
            const btn = document.createElement('button');
            btn.id = 'cloud-view-btn';
            btn.textContent = 'listA';
            btn.style.cssText = 'position:fixed;top:14px;left:14px;z-index:9999;background:#fff;color:#0071e3;border:1px solid rgba(0,113,227,0.4);border-radius:8px;padding:6px 14px;font-size:0.85rem;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.1)';
            btn.addEventListener('click', function() {
              if (testStarted) {
                alert('文件已损毁，无法查看。');
              } else {
                window.open('listA_cloud.html', '_blank');
              }
            });
            document.body.appendChild(btn);
          }
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
            <p style="color:#86868b">点击继续进入下一阶段。您可以随时点击左上角的按钮访问 AI 助手。</p>
          </div>`,
        choices: ['继续'],
        on_finish: function() {
          if (condition === 'ai') {
            const btn = document.createElement('button');
            btn.id = 'ai-view-btn';
            btn.textContent = 'AI 助手';
            btn.style.cssText = 'position:fixed;top:14px;left:14px;z-index:9999;background:#fff;color:#0071e3;border:1px solid rgba(0,113,227,0.4);border-radius:8px;padding:6px 14px;font-size:0.85rem;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.1)';
            btn.addEventListener('click', function() {
              if (testStarted) {
                alert('AI 助手已断开连接，无法访问。');
              } else {
                window.open('ai_chat.html', '_blank');
              }
            });
            document.body.appendChild(btn);
          }
        }
      }],
      conditional_function: function() { return condition === 'ai'; }
    });

    // ── 10. List B 学习阶段说明 ─────────────────────────────────────────────
    timeline.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: `
        <div class="card">
          <h2 >第三阶段：学习 List B</h2>
          <p style="line-height:1.8;margin-bottom:16px">
            接下来您将看到 <strong>20 条新的知识性陈述</strong>，每条显示 <strong>5 秒</strong>。<br>
            请认真阅读并尽量记住每条信息的具体细节。
          </p>
          <p style="color:#86868b;font-size:0.9rem">按"开始"后将自动翻页。</p>
        </div>`,
      choices: ['开始学习']
    });

    // ── 11. List B 学习（5000ms/题）─────────────────────────────────────────
    listB.forEach((item, idx) => {
      timeline.push({
        type: jsPsychHtmlKeyboardResponse,
        stimulus: `
          <div style="text-align:center;margin-bottom:12px;color:#86868b;font-size:0.85rem">List B ${idx+1} / ${listB.length}</div>
          <div class="stimulus-box">${item.statement}</div>`,
        choices: 'NO_KEYS',
        trial_duration: 5000
      });
      timeline.push({
        type: jsPsychHtmlKeyboardResponse,
        stimulus: '<div style="height:180px"></div>',
        choices: 'NO_KEYS',
        trial_duration: 500
      });
    });

    // ── 12. 干扰任务说明 ────────────────────────────────────────────────────
    timeline.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: `
        <div class="card">
          <h2 >短暂休息任务</h2>
          <p style="line-height:1.8;margin-bottom:16px">
            接下来将进行 <strong>2 分钟</strong>的数学选择题，请尽量快速准确作答。
          </p>
          <p style="color:#86868b;font-size:0.9rem">点击开始后计时开始。</p>
        </div>`,
      choices: ['开始'],
      on_finish: function() {
        distractorStart = performance.now();
        mathCorrect = 0;
      }
    });

    // ── 13. 干扰任务（5分钟数学题）─────────────────────────────────────────
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

    // ── 14. 突击测试说明 ────────────────────────────────────────────────────
    timeline.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: `
        <div class="card" style="text-align:center">
          <h2 >突击测试</h2>
          <p style="line-height:1.8">接下来将对刚才学习的内容进行测验，每题四个选项。</p>
        </div>`,
      choices: ['开始测试'],
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
            <div style="text-align:center;margin-bottom:12px;color:#86868b;font-size:0.85rem">${label} 测验 ${idx+1} / ${testList.length}</div>
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

    // ── 15. List A + List B 测验 ────────────────────────────────────────────
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
      timeline: [{
        type: jsPsychHtmlButtonResponse,
        stimulus: `
        <div class="card">
          <h2 >使用体验反馈</h2>
          <div style="margin-bottom:18px">
            <label style="display:block;margin-bottom:8px">1. 您是否相信刚才的学习内容已被成功保存？</label>
            <label style="margin-right:20px"><input type="radio" name="manip_check" value="1"> 相信</label>
            <label><input type="radio" name="manip_check" value="0"> 不相信</label>
          </div>
          <div style="margin-bottom:18px">
            <label style="display:block;margin-bottom:8px">2. 您对这一保存过程的信任程度：</label>
            <div class="likert-row">
              <span class="scale-label">很低</span>
              ${[1,2,3,4,5,6,7].map(v => `<label><input type="radio" name="manip_trust" value="${v}"> ${v}</label>`).join('')}
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
          const check = document.querySelector('input[name="manip_check"]:checked');
          const trust = document.querySelector('input[name="manip_trust"]:checked');
          if (!check || !trust) {
            e.stopImmediatePropagation();
            document.getElementById('manip-error').style.display = 'block';
            return;
          }
          questionnaireData.manip_check_bool = parseInt(check.value);
          questionnaireData.manip_trust = parseInt(trust.value);
        }, true);
      }
    }],
      conditional_function: function() { return condition === 'cloud' || condition === 'ai'; }
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
            <label style="margin-right:20px"><input type="radio" name="suspect" value="1"> 怀疑过</label>
            <label><input type="radio" name="suspect" value="0"> 没有</label>
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
          apiQuestionnaire(questionnaireData);
        }, true);
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
