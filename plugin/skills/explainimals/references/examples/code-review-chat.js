// Scenario: "The code review" (a playful dev conversation, about 90 s, 20 slides).
// Three dialogue blocks, all six characters: penguin and rabbit (classroom), frog and dog (circuit),
// whisker (the cat) and bear (sunset). Each block expands into one slide per line (engine.js expandDialogue).
(window.Pres = window.Pres || {}).scenarios = window.Pres.scenarios || {};
window.Pres.scenarios['code-review-chat'] = {
  title: 'The code review',
  music: 'playful',
  defaults: { background: 'classroom', skin: 'penguin', fps: 12 },
  slides: [
    {
      id: 'title',
      sfx: 'appear',
      duration: 4,
      background: 'classroom',
      transition: 'cut',
      title: { text: 'The code review', subtitle: 'a short dev comedy' },
    },
    {
      id: 'pull-request',
      background: 'classroom',
      transition: 'dissolve',
      dialogue: {
        cast: { left: 'penguin', right: 'rabbit' },
        lines: [
          { who: 'left', say: 'I opened a pull request with 3 files.', expression: 'happy', pose: 'present', sfx: 'pop' },
          { who: 'right', say: 'Hi! I reviewed it. I left two tiny comments, nothing scary.', expression: 'joy', pose: 'wave', react: 'happy' },
          { who: 'left', say: 'Two comments? Oh no, is my code that bad?', expression: 'confused', pose: 'shrug' },
          { who: 'right', say: 'Not bad at all. One comment is about naming, one is a typo.', expression: 'neutral', pose: 'point_up' },
          { who: 'left', say: 'A typo? I thought you would find a real bug!', expression: 'surprised', pose: 'idle' },
          { who: 'right', say: 'No real bugs, so I approved it. Great work, penguin!', expression: 'joy', pose: 'cheer', react: 'happy' },
        ],
      },
    },
    {
      id: 'tests',
      background: 'circuit',
      transition: 'wipe',
      dialogue: {
        cast: { left: 'frog', right: 'dog' },
        lines: [
          { who: 'left', say: 'All tests are green! Time to celebrate.', expression: 'joy', pose: 'cheer', sfx: 'confirm' },
          { who: 'right', say: 'Did you run them twice? Flaky tests are sneaky.', expression: 'curious', pose: 'think', sfx: 'error' },
          { who: 'left', say: 'Twice? They passed the first time, I promise!', expression: 'determined', pose: 'hands_on_hips' },
          { who: 'right', say: 'Yes. A flaky test passes once, then fails on the next run.', expression: 'thinking', pose: 'point_up' },
          { who: 'left', say: 'Oh no, my green checkmarks might be lying to me.', expression: 'sad', pose: 'idle', react: 'sad' },
          { who: 'right', say: 'Run them twice, fix the flaky ones, and then trust the green.', expression: 'happy', pose: 'idle' },
        ],
      },
    },
    {
      id: 'shipping',
      background: 'sunset',
      transition: 'dissolve',
      dialogue: {
        cast: { left: 'whisker', right: 'bear' },
        lines: [
          { who: 'left', say: 'Ready to ship? The tests passed and the review is done.', expression: 'curious', pose: 'idle' },
          { who: 'right', say: 'Almost. I want to read the changes one more time, slowly.', expression: 'thinking', pose: 'think' },
          { who: 'left', say: 'Take your time. The sunset is lovely from here.', expression: 'happy', pose: 'idle' },
          { who: 'right', say: 'Done! Every file is clean and the change is small.', expression: 'joy', pose: 'present', react: 'happy' },
          { who: 'left', say: "Then let's merge it and press the release button.", expression: 'determined', pose: 'point_up' },
          { who: 'right', say: 'Ship it. Then we nap.', expression: 'sleepy', pose: 'idle' },
        ],
      },
    },
    {
      id: 'recap',
      sfx: 'coin',
      duration: 8,
      transition: 'wipe',
      panel: { title: 'Good habits', bullets: ['Small PRs', 'Run the tests', 'Ship it'] },
    },
  ],
};
