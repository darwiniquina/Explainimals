// Sample scenario: "Why sleep recharges your brain" (8 slides, about 47 s). Written by the skill to show the
// 0.2.4 backgrounds (home, office, lab, city), eleven of the new props and a music arc (playful, tense, upbeat, calm).
// Not an example shipped with the skill; it lives in samples/ so the dashboard Presentations view can play it.
(window.Pres = window.Pres || {}).scenarios = window.Pres.scenarios || {};
window.Pres.scenarios['sample-sleep-recharges-brain'] = {
  "title": "Why sleep recharges your brain",
  "music": "playful",
  "defaults": {
    "background": "home",
    "skin": "penguin"
  },
  "slides": [
    {
      "id": "title",
      "background": "home",
      "sfx": "appear",
      "duration": 4,
      "title": {
        "text": "Why sleep recharges your brain",
        "subtitle": "a pixel explainer"
      },
      "characters": [
        {
          "skin": "penguin",
          "at": "left",
          "expression": "happy",
          "pose": "wave",
          "enter": "hop"
        }
      ]
    },
    {
      "id": "night",
      "characters": [
        {
          "skin": "penguin",
          "at": "left",
          "expression": "happy",
          "pose": "point_right",
          "gaze": "props",
          "emote": "zzz",
          "exit": "slide",
          "say": "At night, your brain switches to its repair shift."
        }
      ],
      "props": [
        "moon",
        "brain"
      ]
    },
    {
      "id": "office-problem",
      "background": "office",
      "music": "tense",
      "dialogue": {
        "cast": {
          "left": "dog",
          "right": "bear"
        },
        "lines": [
          {
            "who": "left",
            "say": "Every afternoon I hit a wall. My brain feels like a flat battery.",
            "expression": "sad",
            "pose": "shrug",
            "emote": "sweat",
            "gaze": "other",
            "enter": "hop",
            "props": [
              "clock",
              "battery"
            ],
            "sfx": "error",
            "react_emote": "question"
          },
          {
            "who": "right",
            "say": "Sleep is when your brain clears out the day's waste.",
            "expression": "determined",
            "pose": "point_down",
            "emote": "bulb",
            "gaze": "other",
            "props": [
              "arrow-down",
              "bin"
            ],
            "exit": "slide"
          }
        ]
      }
    },
    {
      "id": "lab-fix",
      "background": "lab",
      "music": "upbeat",
      "sfx": "confirm",
      "characters": [
        {
          "skin": "penguin",
          "at": "left",
          "expression": "joy",
          "pose": "cheer",
          "enter": "pop",
          "action": "hop",
          "emote": "sparkle",
          "say": "Good news: a steady bedtime lets you finish full sleep cycles."
        }
      ],
      "props": [
        "calendar",
        "cycle"
      ]
    },
    {
      "id": "lab-memory",
      "characters": [
        {
          "skin": "penguin",
          "at": "left",
          "expression": "happy",
          "pose": "idle",
          "gaze": "other"
        },
        {
          "skin": "bear",
          "at": "right",
          "expression": "determined",
          "pose": "point_up",
          "enter": "slide",
          "emote": "bulb",
          "exit": "slide",
          "say": "Each cycle files new memories away, so you remember more tomorrow."
        }
      ],
      "props": [
        "book",
        "arrow-up"
      ]
    },
    {
      "id": "city-recap",
      "background": "city",
      "music": "calm",
      "characters": [
        {
          "skin": "penguin",
          "at": "left",
          "expression": "happy",
          "pose": "present",
          "say": "Sleep well, and your brain wakes up ready."
        }
      ],
      "duration": 8,
      "panel": {
        "title": "Recap",
        "bullets": [
          "Night is repair time",
          "Sleep clears waste",
          "Cycles file memories"
        ]
      }
    },
    {
      "id": "city-close",
      "duration": 7,
      "characters": [
        {
          "skin": "penguin",
          "at": "left",
          "expression": "joy",
          "pose": "cheer",
          "emote": "sparkle",
          "action": "hop",
          "say": "Good night! Your brain will thank you tomorrow."
        }
      ],
      "props": [
        "trophy"
      ]
    }
  ]
};
