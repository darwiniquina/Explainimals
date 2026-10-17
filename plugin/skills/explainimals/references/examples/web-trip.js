// Scenario: "How a website loads" (beginner explainer, 8 slides, about 56 s).
(window.Pres = window.Pres || {}).scenarios = window.Pres.scenarios || {};
window.Pres.scenarios['web-trip'] = {
  title: 'How a website loads',
  music: 'upbeat',
  defaults: { background: 'meadow', skin: 'penguin', fps: 12 },
  slides: [
    {
      id: 'intro',
      sfx: 'appear',
      duration: 5,
      transition: 'cut',
      title: { text: 'How a website loads', subtitle: 'a pixel explainer' },
      characters: [
        { skin: 'penguin', at: 'left', expression: 'happy', pose: 'wave', talking: false },
      ],
    },
    {
      id: 'type',
      duration: 8,
      transition: 'dissolve',
      characters: [
        { skin: 'penguin', at: 'left', expression: 'happy', pose: 'point_right',
          say: "Hi! Let's follow one page. First, you type an address and press Enter." },
      ],
      props: [{ id: 'laptop', label: 'Browser', enter: 'drop', delay: 1.0 }],
    },
    {
      id: 'dns',
      duration: 9,
      transition: 'wipe',
      characters: [
        { skin: 'penguin', at: 'left', expression: 'thinking', pose: 'think', talking: false },
      ],
      props: [
        { id: 'laptop', label: 'Browser', enter: 'slide-left', delay: 0.5 },
        { id: 'arrow', enter: 'pop', delay: 1.2 },
        { id: 'globe', label: 'Internet', enter: 'pop', delay: 1.8 },
      ],
      panel: {
        title: 'DNS, the phone book',
        bullets: ['Name in', 'Address out', 'Finds the server'],
      },
    },
    {
      id: 'server-found',
      duration: 7,
      background: 'circuit',
      transition: 'dissolve',
      characters: [
        { skin: 'penguin', at: 'left', expression: 'joy', pose: 'point_right',
          say: "Found it! This server stores the page's files." },
      ],
      props: [
        { id: 'server', label: 'Server', enter: 'drop', delay: 0.8 },
        { id: 'arrow', enter: 'pop', delay: 1.2 },
        { id: 'database', label: 'Files', enter: 'dissolve', delay: 1.5 },
      ],
    },
    {
      id: 'pack',
      duration: 7,
      transition: 'cut',
      characters: [
        { skin: 'penguin', at: 'left', expression: 'determined', pose: 'present',
          say: 'The server packs the whole page into a folder.' },
      ],
      props: [
        { id: 'server', label: 'Server', enter: 'none' },
        { id: 'arrow', enter: 'pop', delay: 1.0 },
        { id: 'folder', label: 'The page', enter: 'slide-right', delay: 1.4 },
      ],
    },
    {
      id: 'travel-back',
      sfx: { id: 'pop', at: 0.8 },
      duration: 6,
      transition: 'dissolve',
      characters: [
        { skin: 'penguin', at: 'left', expression: 'happy', pose: 'point_right',
          say: 'The page zooms back to you over Wi-Fi.' },
      ],
      // the trip runs right to left, so the arrow is flipped
      props: [
        { id: 'envelope', label: 'The page', enter: 'pop', delay: 0.8 },
        { id: 'arrow', flip: true, enter: 'slide-right', delay: 1.3 },
        { id: 'wifi', label: 'Wi-Fi', enter: 'dissolve', delay: 1.8 },
      ],
    },
    {
      id: 'draw',
      duration: 7,
      background: 'meadow',
      transition: 'wipe',
      characters: [
        { skin: 'penguin', at: 'left', expression: 'joy', pose: 'point_right',
          say: 'Your browser draws text, pictures and buttons.' },
      ],
      props: [
        { id: 'laptop', label: 'Browser', enter: 'drop', delay: 0.8 },
        { id: 'arrow', enter: 'pop', delay: 1.2 },
        { id: 'check', enter: 'pop', delay: 1.6 },
      ],
    },
    {
      id: 'recap',
      sfx: 'confirm',
      duration: 7,
      transition: 'dissolve',
      characters: [
        { skin: 'penguin', at: 'left', expression: 'joy', pose: 'cheer' },
      ],
      panel: {
        title: 'Recap',
        bullets: ['DNS finds it', 'Server packs it', 'Browser draws it'],
      },
    },
  ],
};
