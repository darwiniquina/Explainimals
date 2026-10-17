/*
 * "How Claude works (cinematic)" - a 73 s pixel explainer with four characters:
 *   Penguin narrates, Rabbit asks, Bear explains, Dog gets fooled by a made-up answer.
 * Uses the cinematic features from presentation/SCENARIO.md (camera, transitions, character
 * enter/exit/walkTo/gaze/action/emote, new poses). Every name comes from Pres.catalog().
 */
(window.Pres = window.Pres || {}).scenarios = window.Pres.scenarios || {};
window.Pres.scenarios['how-claude-works-cinematic'] = {
  title: 'How Claude works (cinematic)',
  music: 'playful',
  defaults: { background: 'night-sky', skin: 'penguin' },
  slides: [
    {
      // Opening: slow reveal from a close-up of the penguin's face, letterboxed.
      id: 'opening',
      duration: 5.3,
      transition: 'iris',
      camera: { focus: 'face', zoom: 3, move: 'reveal', letterbox: true },
      characters: [
        { skin: 'penguin', at: 'center', expression: 'curious', pose: 'wave',
          say: 'Ever wonder how Claude turns your words into an answer?' },
      ],
    },
    {
      id: 'title',
      sfx: 'appear',
      duration: 3.5,
      transition: 'checker',
      title: { text: 'How Claude works', subtitle: 'a cinematic explainer' },
      characters: [{ skin: 'penguin', at: 'left', expression: 'happy', pose: 'stretch', enter: 'walk' }],
    },
    {
      // Dialogue: the rabbit asks, the penguin answers and the camera pans to the token star.
      background: 'classroom',
      transition: 'dissolve',
      dialogue: {
        cast: { left: 'rabbit', right: 'penguin' },
        lines: [
          { who: 'left', say: 'You type a message. What happens to it first?', duration: 4.6, expression: 'curious', pose: 'think',
            emote: 'question', gaze: 'other', react: 'curious', react_gaze: 'other' },
          { who: 'right', say: 'Your words are cut into tokens, small chunks of text.', duration: 5.2, expression: 'happy', pose: 'point_down',
            gaze: 'other', react: 'happy', react_action: 'nod',
            camera: { focus: 'prop:star', from: 'speaker', zoom: 2, move: 'pan' },
            props: [
              { id: 'laptop', label: 'Your message', delay: 1.0 },
              { id: 'arrow', delay: 1.8 },
              { id: 'star', label: 'Tokens', enter: 'pop', delay: 2.6 },
            ],
            sfx: { id: 'pop', at: 2.6 } },
        ],
      },
    },
    {
      // Camera-less beat: the rabbit follows up, so the push-in below does not come straight after a zoom.
      id: 'follow-up',
      duration: 3.6,
      background: 'classroom',
      transition: 'dissolve',
      characters: [
        { skin: 'rabbit', at: 'left', expression: 'curious', pose: 'point_up', emote: 'question',
          say: 'So what does it do with those tokens?' },
      ],
    },
    {
      // Prediction: a slow push-in on the thinking bear, with a bulb emote.
      id: 'predict',
      duration: 4.8,
      background: 'circuit',
      transition: 'dissolve',
      camera: { focus: 'speaker', zoom: 2, move: 'push-in' },
      characters: [
        { skin: 'bear', at: 'left', expression: 'thinking', pose: 'think',
          emote: { id: 'bulb', at: 1.0, duration: 2 },
          say: 'Then it guesses the next token, again and again.' },
      ],
      props: [
        { id: 'database', at: [66, 30], label: 'Patterns', delay: 1.0 },
        { id: 'chip', at: [92, 30], label: 'Next', delay: 1.8 },
      ],
    },
    {
      id: 'training',
      duration: 5.4,
      transition: 'dissolve',
      characters: [
        { skin: 'penguin', at: 'left', expression: 'joy', pose: 'present',
          say: 'It learned from huge amounts of text, then with feedback.' },
      ],
      props: [
        { id: 'folder', label: 'Text', delay: 1.2 },
        { id: 'check', label: 'Feedback', enter: 'pop', delay: 2.4 },
      ],
    },
    {
      // Context window: a panel with the penguin pointing at it and a short line, no props (a panel and props crowd).
      id: 'context',
      duration: 5.0,
      transition: 'wipe-down',
      characters: [
        { skin: 'penguin', at: 'left', expression: 'happy', pose: 'point_up',
          say: 'It is my working memory.' },
      ],
      panel: { title: 'Working memory', bullets: ['Everything in chat', 'Has a size limit', 'Old text can fall out'] },
    },
    {
      // Tools: the dog hops in, the penguin looks at the props, a wipe into the slide.
      id: 'tools',
      duration: 5.5,
      transition: 'wipe',
      characters: [
        { skin: 'penguin', at: 'left', expression: 'happy', pose: 'point_right', gaze: 'props',
          say: 'Tools let me search, run code, or read your files.' },
        { skin: 'dog', at: 'right', expression: 'joy', pose: 'cheer', enter: 'hop' },
      ],
      props: [
        { id: 'magnifier', label: 'Search', delay: 1.2 },
        { id: 'terminal', label: 'Run code', delay: 1.8 },
      ],
    },
    {
      // Hallucination: the surprise. Punch-in with shake, recoil, an exclamation and a flash.
      id: 'hallucination',
      sfx: 'error',
      duration: 5.4,
      background: 'arcade',
      transition: 'flash',
      camera: { focus: 'speaker', zoom: 2, move: 'punch-in', shake: true },
      characters: [
        { skin: 'dog', at: 'center', expression: 'surprised', pose: 'facepalm', action: 'recoil', emote: 'exclamation',
          say: 'Wait, that book does not exist! Claude made the title up.' },
      ],
      props: [
        { id: 'question', at: [62, 36], label: 'Real?', delay: 0.8 },
        { id: 'globe', at: [158, 36], label: 'Sources?', delay: 1.2 },
      ],
    },
    {
      // Checking answers: the rabbit asks, the bear shakes its head, then nods, and leaves with a hop.
      background: 'sunset',
      transition: 'dissolve',
      dialogue: {
        cast: { left: 'rabbit', right: 'bear' },
        lines: [
          { who: 'left', say: 'So every answer it gives is true, right?', duration: 4.3, expression: 'curious', pose: 'shy',
            emote: 'sweat', gaze: 'other', react: 'neutral', react_action: 'shake', react_gaze: 'other' },
          { who: 'right', say: 'No. Check important answers, especially facts and dates.', duration: 5.3, expression: 'determined', pose: 'point_up',
            gaze: 'other', react: 'happy', react_action: 'nod', exit: 'hop' },
        ],
      },
    },
    {
      // Guardrails: the bear walks in, folds its arms, then walks to the centre.
      id: 'safety',
      duration: 5.0,
      transition: 'fade-black',
      characters: [
        { skin: 'bear', at: 'left', expression: 'determined', pose: 'arms_crossed', enter: 'walk', walkTo: 'center', walkAt: 1.0,
          say: 'Training also teaches it to be helpful and careful.' },
      ],
      props: [
        { id: 'lock', label: 'Guardrails', delay: 1.4 },
        { id: 'check', label: 'Honest', enter: 'pop', delay: 2.2 },
      ],
    },
    {
      id: 'recap',
      duration: 5.0,
      background: 'meadow',
      transition: 'wipe-down',
      characters: [{ skin: 'penguin', at: 'left', expression: 'joy', pose: 'clap', say: 'Here is the big picture.' }],
      panel: { title: 'Recap', bullets: ['Splits text to tokens', 'Predicts the next one', 'Context is its memory', 'Double-check facts'] },
    },
    {
      // Happy ending: hearts and sparkles, a new music mood.
      id: 'ending',
      sfx: 'confirm',
      music: 'upbeat',
      duration: 5.0,
      transition: 'dissolve',
      characters: [
        { skin: 'penguin', at: 'left', expression: 'happy', pose: 'bow',
          emote: { id: 'heart', at: 0.6, duration: 2.5 },
          say: 'Thanks for watching! Ask away, but double-check.' },
        { skin: 'rabbit', at: 'right', expression: 'joy', pose: 'thumbs_up', enter: 'slide',
          emote: { id: 'sparkle', at: 1.0, duration: 2.5 } },
      ],
      props: [
        { id: 'star', label: 'Thanks', delay: 1.2 },
        { id: 'check', label: 'Done', delay: 1.8 },
      ],
    },
  ],
};
