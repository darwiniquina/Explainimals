// Scenario: "Why is the sky blue?" (gentle science explainer, 7 slides, about 49 s).
// Whisker (the cat, left) asks, Frog (right) answers.
(window.Pres = window.Pres || {}).scenarios = window.Pres.scenarios || {};
window.Pres.scenarios['sky-blue'] = {
  title: 'Why is the sky blue?',
  music: 'calm',
  defaults: { background: 'sunset', skin: 'whisker', fps: 12 },
  slides: [
    {
      id: 'question',
      sfx: 'appear',
      duration: 6,
      transition: 'cut',
      characters: [
        { skin: 'whisker', at: 'left', expression: 'curious', pose: 'think',
          say: 'Why is the sky blue, Frog?' },
        { skin: 'frog', at: 'right', expression: 'happy', pose: 'idle', look: { x: -1, y: 0 }, talking: false },
      ],
      props: [{ id: 'question', at: [100, 84] }],
    },
    {
      id: 'sunlight',
      sfx: { id: 'pop', at: 1.0 },
      duration: 7,
      transition: 'dissolve',
      characters: [
        { skin: 'whisker', at: 'left', expression: 'curious', pose: 'idle', look: { x: 1, y: 0 }, talking: false },
        { skin: 'frog', at: 'right', expression: 'happy', pose: 'present',
          say: 'Sunlight looks white, but it holds every colour.' },
      ],
      props: [{ id: 'star', label: 'Sunlight', at: [100, 84], enter: 'pop', delay: 1.0 }],
    },
    {
      id: 'bounce',
      duration: 8,
      transition: 'wipe',
      characters: [
        { skin: 'whisker', at: 'left', expression: 'happy', pose: 'idle', look: { x: 1, y: 0 }, talking: false },
      ],
      props: [
        { id: 'cloud', label: 'Air', at: [72, 92], enter: 'drop', delay: 0.5 },
        { id: 'arrow', at: [112, 100], enter: 'pop', delay: 1.2 },
        { id: 'star', label: 'Blue light', at: [146, 90], enter: 'pop', delay: 1.8 },
      ],
      panel: {
        title: 'Why blue wins',
        bullets: ['Air bumps light', 'Blue bounces most', 'Blue reaches eyes'],
      },
    },
    {
      id: 'whisker-reacts',
      duration: 6,
      transition: 'dissolve',
      characters: [
        { skin: 'whisker', at: 'left', expression: 'surprised', pose: 'point_up',
          say: 'So blue light bounces all over the sky!' },
        { skin: 'frog', at: 'right', expression: 'joy', pose: 'cheer', talking: false },
      ],
    },
    {
      id: 'sunset',
      duration: 7,
      background: 'night-sky',
      transition: 'dissolve',
      characters: [
        { skin: 'whisker', at: 'left', expression: 'curious', pose: 'idle', look: { x: 1, y: 0 }, talking: false },
        { skin: 'frog', at: 'right', expression: 'determined', pose: 'point_left',
          say: 'At sunset, light crosses more air, so blue bounces away.' },
      ],
      props: [{ id: 'star', label: 'Low sun', at: [100, 84], enter: 'pop', delay: 1.0 }],
    },
    {
      id: 'night',
      duration: 7,
      transition: 'cut',
      characters: [
        { skin: 'whisker', at: 'left', expression: 'sleepy', pose: 'idle', talking: false },
        { skin: 'frog', at: 'right', expression: 'happy', pose: 'idle',
          say: 'At night the sun is gone, so no light bounces.' },
      ],
      props: [{ id: 'star', label: 'Stars', at: [100, 84], enter: 'pop', delay: 1.0 }],
    },
    {
      id: 'recap',
      sfx: 'confirm',
      duration: 8,
      background: 'sunset',
      transition: 'wipe',
      characters: [
        { skin: 'whisker', at: 'left', expression: 'joy', pose: 'cheer',
          say: 'So the sky is blue because blue bounces the most!' },
        { skin: 'frog', at: 'right', expression: 'joy', pose: 'hands_on_hips', talking: false },
      ],
      props: [
        { id: 'check', at: [100, 86], enter: 'pop', delay: 1.4 },
        { id: 'lightbulb', at: [126, 84], enter: 'pop', delay: 1.8 },
      ],
    },
  ],
};
