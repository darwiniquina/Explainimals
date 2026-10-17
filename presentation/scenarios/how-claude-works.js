/*
 * "How Claude works" - a short (about 45 s) pixel explainer with four characters:
 *   Penguin narrates, Rabbit asks, Bear and Dog explain.
 * Written against presentation/SCENARIO.md; every name comes from Pres.catalog().
 */
(window.Pres = window.Pres || {}).scenarios = window.Pres.scenarios || {};
window.Pres.scenarios['how-claude-works'] = {
  title: 'How Claude works',
  music: 'playful',
  defaults: { background: 'classroom', skin: 'penguin' },
  slides: [
    {
      id: 'intro',
      sfx: 'appear',
      duration: 4,
      title: { text: 'How Claude works', subtitle: 'four friends explain' },
      characters: [{ skin: 'penguin', at: 'left', expression: 'happy', pose: 'wave' }],
    },
    {
      id: 'question',
      duration: 6,
      transition: 'dissolve',
      characters: [
        { skin: 'rabbit', at: 'left', expression: 'curious', pose: 'think', say: 'I asked Claude a question. How does it answer?' },
        { skin: 'penguin', at: 'right', expression: 'happy', pose: 'point_left' },
      ],
      props: [{ id: 'question', enter: 'drop', delay: 0.8 }],
    },
    {
      id: 'tokens',
      sfx: { id: 'pop', at: 2.6 },
      duration: 7,
      transition: 'wipe',
      characters: [
        { skin: 'penguin', at: 'left', expression: 'happy', pose: 'present', say: 'Claude reads your message and chops it into small pieces called tokens.' },
      ],
      props: [
        { id: 'laptop', label: 'Your message', delay: 1.0 },
        { id: 'arrow', delay: 1.8 },
        { id: 'star', label: 'Tokens', enter: 'pop', delay: 2.6 },
      ],
    },
    {
      id: 'predict',
      duration: 7,
      background: 'circuit',
      transition: 'dissolve',
      characters: [
        { skin: 'bear', at: 'left', expression: 'thinking', pose: 'think', say: 'Then it guesses the next piece, again and again, using patterns it learned.' },
        { skin: 'dog', at: 'right', expression: 'surprised', pose: 'shrug' },
      ],
      props: [
        { id: 'database', label: 'Patterns', delay: 1.2 },
        { id: 'lightbulb', label: 'Guess', delay: 2.2 },
      ],
    },
    {
      id: 'training',
      duration: 7,
      background: 'classroom',
      transition: 'dissolve',
      characters: [
        { skin: 'rabbit', at: 'left', expression: 'curious', pose: 'idle' },
        { skin: 'penguin', at: 'right', expression: 'joy', pose: 'present', say: 'It learned by reading huge amounts of text, then practising with feedback.' },
      ],
      props: [
        { id: 'folder', label: 'Text', delay: 1.2 },
        { id: 'check', label: 'Feedback', enter: 'pop', delay: 2.4 },
      ],
    },
    {
      id: 'tools',
      duration: 7,
      background: 'circuit',
      transition: 'wipe',
      characters: [
        { skin: 'rabbit', at: 'left', expression: 'joy', pose: 'cheer' },
        { skin: 'penguin', at: 'right', expression: 'happy', pose: 'point_left', say: 'Yes! With tools like web search, it can look things up too.' },
      ],
      props: [
        { id: 'magnifier', label: 'Search', delay: 1.2 },
        { id: 'globe', label: 'The web', delay: 2.2 },
      ],
    },
    {
      id: 'recap',
      sfx: 'confirm',
      duration: 8,
      background: 'sunset',
      transition: 'dissolve',
      characters: [{ skin: 'bear', at: 'left', expression: 'joy', pose: 'cheer' }],
      panel: {
        title: 'Recap',
        bullets: ['Reads your words', 'Guesses next pieces', 'Learned from text', 'Can be wrong: check!'],
      },
    },
  ],
};
