// dual_task.js — Exp2 听音按键双任务模块

(function () {
  'use strict';

  const TONE_PROB = 0.7;
  const ONSET_MIN_MS = 800;
  const ONSET_MAX_MS = 4200;
  const RESPONSE_WINDOW_MS = 1500;
  const TRIAL_DURATION_MS = 5000;
  const HIGH_HZ = 880;
  const LOW_HZ = 440;
  const PRACTICE_COUNT = 15;
  const PRACTICE_ACC_THRESHOLD = 0.7;

  const PRACTICE_STATEMENTS = [
    '练习陈述一：地球是太阳系中第三颗行星。',
    '练习陈述二：水的化学式是 H₂O。',
    '练习陈述三：光合作用发生在植物叶绿体中。',
    '练习陈述四：声音在空气中的传播需要介质。',
    '练习陈述五：一年通常有 365 天。',
    '练习陈述六：金属具有良好的导电性。',
    '练习陈述七：人类大脑负责处理感知与思维。',
    '练习陈述八：冰在零摄氏度开始融化。',
    '练习陈述九：彩虹由七种颜色组成。',
    '练习陈述十：月球围绕地球运转。',
    '练习陈述十一：氧气支持燃烧反应。',
    '练习陈述十二：长城位于中国北方。',
    '练习陈述十三：蜜蜂通过舞蹈传递信息。',
    '练习陈述十四：重力使物体向下落。',
    '练习陈述十五：图书馆是存放书籍的场所。'
  ];

  let audioCtx = null;

  function ensureAudioContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function playTone(hz, durationSec) {
    durationSec = durationSec || 0.15;
    const ctx = ensureAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = hz;
    gain.gain.value = 0.25;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    osc.start(now);
    osc.stop(now + durationSec);
  }

  function planDualTaskTrial() {
    const hadTone = Math.random() < TONE_PROB ? 1 : 0;
    let toneType = null;
    let correctKey = null;
    let onsetMs = null;

    if (hadTone) {
      toneType = Math.random() < 0.5 ? 'high' : 'low';
      correctKey = toneType === 'high' ? 'J' : 'F';
      onsetMs = ONSET_MIN_MS + Math.floor(Math.random() * (ONSET_MAX_MS - ONSET_MIN_MS + 1));
    }

    return { hadTone, toneType, correctKey, onsetMs };
  }

  function buildDualTaskRecord(phase, itemIndex, plan, keyPressed, rtMs) {
    let isCorrect = 0;
    if (plan.hadTone) {
      isCorrect = (keyPressed === plan.correctKey && rtMs !== null && rtMs <= RESPONSE_WINDOW_MS) ? 1 : 0;
    } else {
      isCorrect = keyPressed === null ? 1 : 0;
    }

    return {
      phase,
      item_index: itemIndex,
      tone_type: plan.toneType,
      correct_key: plan.correctKey,
      key_pressed: keyPressed,
      rt_ms: rtMs,
      is_correct: isCorrect,
      onset_ms: plan.onsetMs,
      had_tone: plan.hadTone
    };
  }

  function createDualTaskLearningTrial({ phase, statement, idx, total, listLabel, onRecord }) {
    const plan = planDualTaskTrial();
    const trialStart = { value: 0 };

    return {
      type: jsPsychHtmlKeyboardResponse,
      stimulus: `
        <div style="text-align:center;margin-bottom:12px;color:#86868b;font-size:0.85rem">${listLabel} ${idx + 1} / ${total}</div>
        <div class="stimulus-box">${statement}</div>
        <div style="text-align:center;margin-top:14px;color:#86868b;font-size:0.78rem;line-height:1.6">
          本句固定 ${TRIAL_DURATION_MS / 1000} 秒 · 按键<strong>不会</strong>跳题 · 无音调请勿按键
        </div>`,
      choices: 'NO_KEYS',
      trial_duration: TRIAL_DURATION_MS,
      on_load: function () {
        trialStart.value = performance.now();
        ensureAudioContext();

        let keyPressed = null;
        let rtMs = null;
        let responded = false;
        let responseDeadline = null;
        let toneTimeout = null;
        let responseTimeout = null;

        function cleanup() {
          window.removeEventListener('keydown', onKeyDown, true);
          if (toneTimeout) clearTimeout(toneTimeout);
          if (responseTimeout) clearTimeout(responseTimeout);
        }

        function onKeyDown(e) {
          const key = e.key.toLowerCase();
          if (key !== 'f' && key !== 'j') return;
          e.preventDefault();

          const upper = key.toUpperCase();
          const now = performance.now();

          if (!plan.hadTone) {
            if (!responded) {
              responded = true;
              keyPressed = upper;
              rtMs = Math.round(now - trialStart.value);
            }
            return;
          }

          if (responded || responseDeadline === null || now > responseDeadline) return;
          responded = true;
          keyPressed = upper;
          rtMs = Math.round(now - (trialStart.value + plan.onsetMs));
        }

        window.addEventListener('keydown', onKeyDown, true);

        if (plan.hadTone) {
          toneTimeout = setTimeout(function () {
            playTone(plan.toneType === 'high' ? HIGH_HZ : LOW_HZ, 0.15);
            responseDeadline = performance.now() + RESPONSE_WINDOW_MS;
            responseTimeout = setTimeout(function () {
              responseDeadline = null;
            }, RESPONSE_WINDOW_MS);
          }, plan.onsetMs);
        }

        const trialEl = document.getElementById('jspsych-content');
        if (trialEl) {
          trialEl._dualTaskCleanup = cleanup;
          trialEl._dualTaskFinalize = function () {
            cleanup();
            const record = buildDualTaskRecord(phase, idx, plan, keyPressed, rtMs);
            if (onRecord) onRecord(record);
            return record;
          };
        }
      },
      on_finish: function (data) {
        const trialEl = document.getElementById('jspsych-content');
        let record;
        if (trialEl && trialEl._dualTaskFinalize) {
          record = trialEl._dualTaskFinalize();
          delete trialEl._dualTaskCleanup;
          delete trialEl._dualTaskFinalize;
        } else {
          record = buildDualTaskRecord(phase, idx, plan, null, null);
          if (onRecord) onRecord(record);
        }
        Object.assign(data, record);
      }
    };
  }

  function appendBlankTrial(timeline) {
    timeline.push({
      type: jsPsychHtmlKeyboardResponse,
      stimulus: '<div style="height:180px"></div>',
      choices: 'NO_KEYS',
      trial_duration: 500
    });
  }

  function appendDualTaskLearningTrials(timeline, items, phase, listLabel, onRecord) {
    items.forEach(function (item, idx) {
      timeline.push(createDualTaskLearningTrial({
        phase,
        statement: item.statement || item,
        idx,
        total: items.length,
        listLabel,
        onRecord
      }));
      appendBlankTrial(timeline);
    });
  }

  function calcPracticeAccuracy(records) {
    if (!records.length) return 0;
    const correct = records.filter(function (r) { return r.is_correct === 1; }).length;
    return correct / records.length;
  }

  function buildToneCalibrationTrial() {
    return {
      type: jsPsychHtmlButtonResponse,
      stimulus: `
        <div class="card">
          <h2>先熟悉高音与低音</h2>
          <p style="line-height:1.8;margin-bottom:16px">
            正式任务中，您需要在阅读时辨别音调。请先点击下方按钮，<strong>各试听一次</strong>高音与低音，记住各自对应的按键。
          </p>
          <div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin:20px 0">
            <button type="button" id="demo-high-btn" class="demo-tone-btn" style="min-width:160px;padding:10px 18px;border-radius:8px;border:1px solid rgba(0,113,227,0.4);background:#fff;color:#0071e3;cursor:pointer;font-size:0.95rem">试听高音 → 按 J</button>
            <button type="button" id="demo-low-btn" class="demo-tone-btn" style="min-width:160px;padding:10px 18px;border-radius:8px;border:1px solid rgba(0,113,227,0.4);background:#fff;color:#0071e3;cursor:pointer;font-size:0.95rem">试听低音 → 按 F</button>
          </div>
          <p id="demo-tone-status" style="color:#86868b;font-size:0.9rem;text-align:center">
            请先试听高音和低音各一次，再开始练习
          </p>
        </div>`,
      choices: ['开始练习'],
      on_load: function () {
        ensureAudioContext();
        let heardHigh = false;
        let heardLow = false;

        const continueBtn = document.querySelector('#jspsych-content .jspsych-content-wrapper .jspsych-btn')
          || document.querySelector('#jspsych-content .jspsych-btn');
        const statusEl = document.getElementById('demo-tone-status');

        function updateContinue() {
          const ready = heardHigh && heardLow;
          if (continueBtn) {
            continueBtn.disabled = !ready;
            continueBtn.style.opacity = ready ? '1' : '0.5';
            continueBtn.style.cursor = ready ? 'pointer' : 'not-allowed';
          }
          if (statusEl) {
            if (ready) {
              statusEl.textContent = '已试听两种音调，可以开始练习。';
            } else if (heardHigh) {
              statusEl.textContent = '已试听高音，请再试听低音。';
            } else if (heardLow) {
              statusEl.textContent = '已试听低音，请再试听高音。';
            }
          }
        }

        document.getElementById('demo-high-btn').addEventListener('click', function () {
          playTone(HIGH_HZ, 0.45);
          heardHigh = true;
          updateContinue();
        });
        document.getElementById('demo-low-btn').addEventListener('click', function () {
          playTone(LOW_HZ, 0.45);
          heardLow = true;
          updateContinue();
        });

        if (continueBtn) {
          continueBtn.addEventListener('click', function (e) {
            if (!heardHigh || !heardLow) {
              e.stopImmediatePropagation();
              if (statusEl) statusEl.style.color = '#ff3b30';
            }
          }, true);
        }

        updateContinue();
      }
    };
  }

  function buildDualTaskPracticeBlock() {
    const practiceRecords = [];

    const innerTimeline = [
      {
        type: jsPsychHtmlButtonResponse,
        stimulus: `
          <div class="card">
            <h2>双任务练习</h2>
            <p style="line-height:1.8;margin-bottom:16px">
              接下来进行 <strong>${PRACTICE_COUNT} 次</strong>练习。每条陈述会<strong>固定显示 5 秒</strong>，时间到后<strong>自动</strong>进入下一条。
            </p>
            <ul style="line-height:1.9;margin-bottom:16px;padding-left:1.2rem">
              <li><strong>按 F 或 J 不会跳题</strong>——即使已按键，也请继续阅读直到本句结束</li>
              <li>约 <strong>70%</strong> 的陈述会播放一次音调：高音按 <strong>J</strong>，低音按 <strong>F</strong></li>
              <li>约 <strong>30%</strong> 的陈述<strong>故意不播放</strong>任何音调，此时<strong>请不要按键</strong>（这是实验设计，不是故障）</li>
              <li>音调出现时间随机，请持续注意听，不要只在开头等待</li>
            </ul>
            <p style="line-height:1.8;margin-bottom:16px;color:#86868b;font-size:0.9rem">
              请佩戴耳机、固定音量，并在安静环境中完成。练习准确率需达到 70% 方可进入正式学习。
            </p>
          </div>`,
        choices: ['下一步：试听音调'],
        on_finish: function () {
          ensureAudioContext();
        }
      },
      buildToneCalibrationTrial()
    ];

    PRACTICE_STATEMENTS.slice(0, PRACTICE_COUNT).forEach(function (text, idx) {
      innerTimeline.push(createDualTaskLearningTrial({
        phase: 'practice',
        statement: text,
        idx,
        total: PRACTICE_COUNT,
        listLabel: '练习',
        onRecord: function (record) {
          practiceRecords.push(record);
        }
      }));
      appendBlankTrial(innerTimeline);
    });

    innerTimeline.push({
      type: jsPsychHtmlButtonResponse,
      stimulus: function () {
        const acc = calcPracticeAccuracy(practiceRecords);
        const pct = Math.round(acc * 100);
        if (acc >= PRACTICE_ACC_THRESHOLD) {
          return `
            <div class="card" style="text-align:center">
              <h2>练习完成</h2>
              <p style="line-height:1.8">您的练习准确率为 <strong>${pct}%</strong>，可以进入正式学习阶段。</p>
            </div>`;
        }
        return `
          <div class="card" style="text-align:center">
            <h2>请重新练习</h2>
            <p style="line-height:1.8;margin-bottom:12px">您的练习准确率为 <strong>${pct}%</strong>，未达到 70% 的要求。</p>
            <p style="color:#86868b;font-size:0.9rem">请再次熟悉规则后重试。</p>
          </div>`;
      },
      choices: function () {
        const acc = calcPracticeAccuracy(practiceRecords);
        return acc >= PRACTICE_ACC_THRESHOLD ? ['继续'] : ['重新练习'];
      }
    });

    return {
      timeline: innerTimeline,
      loop_function: function () {
        const acc = calcPracticeAccuracy(practiceRecords);
        if (acc >= PRACTICE_ACC_THRESHOLD) return false;
        practiceRecords.length = 0;
        return true;
      }
    };
  }

  const DUAL_TASK_INSTRUCTION =
    '每条陈述固定显示 <strong>5 秒</strong>后自动翻页，<strong>按 F/J 不会跳题</strong>，请继续阅读。约 70% 会播放音调（高音 J、低音 F）；约 30% <strong>无音调</strong>，此时请勿按键。请尽量同时完成阅读与听音。';

  window.DualTask = {
    TONE_PROB,
    ONSET_MIN_MS,
    ONSET_MAX_MS,
    RESPONSE_WINDOW_MS,
    TRIAL_DURATION_MS,
    PRACTICE_ACC_THRESHOLD,
    DUAL_TASK_INSTRUCTION,
    createDualTaskLearningTrial,
    appendDualTaskLearningTrials,
    buildDualTaskPracticeBlock,
    ensureAudioContext
  };
})();
