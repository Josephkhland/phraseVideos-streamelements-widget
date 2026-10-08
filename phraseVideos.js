/*
 * 'Phrase Videos' widget: plays video clips when configured phrases are found
 * anywhere in a chat message. Based on AFoeee's 'Video On Command' widget:
 * https://github.com/AFoeee/video-on-command-se-widget
 */


/* Prefixes defined in 'Fields' are only taken into account if they are also
 * specified in the list below. When two slots share a phrase, the slot listed
 * first wins. */
const videoSlotCount = 50;
const videoPrefixes = Array.from(
    { length: videoSlotCount }, (_, i) => `video${i + 1}`);

let initialized = false;
const phraseMatchers = [];          // Holds { regex, clip } objects.
const playQueue = [];               // Clips waiting to be played, in order.
let isPlaying = false;
let playbackId = 0;                 // Identifies the current playback.

let isUsableByEveryone;             // If true, everyone can trigger the widget.
let isUsableByMods;
let isUsableByVips;
let isUsableByTier1;
let isUsableByTier2;
let isUsableByTier3;
let otherUsers;                     // Those users can trigger the widget, too.
let blockedUsers;                   // Those users are ignored by the widget.

let animationIn;
let animationOut;
let timeIn;
let timeOut;

const videoElmt = document.getElementById("video");


/* Triggers CSS animations by adding animate.css classes. Their effect is
 * sustained as long as they're attached to the element. Therefore, they are
 * only removed to immediately replace them with other animate.css classes. */
function animateCss(node, animationName, duration = 1, prefix = 'animate__') {
  // animate.css classes do have a prefix (since version 4.0).
  const envCls = `${prefix}animated`;
  const animationCls = `${prefix}${animationName}`;

  // Remove all applied animate.css classes.
  node.className = node.className
      .split(" ")
      .filter((cls) => !cls.startsWith(prefix))
      .join(" ");

  // Promise resolves when animation has ended.
  return new Promise((resolve, reject) => {
    node.addEventListener('animationend', (event) => {
      event.stopPropagation();
      resolve('Animation ended');
    }, {once: true});

    node.style.setProperty('--animate-duration', `${duration}s`);
    node.classList.add(envCls, animationCls);       // Starts CSS animation.
  });
}


/* Prepares a string to be used in a RegExp by escaping problematic characters.
 * (Found in Mozilla's RegExp guide.) */
function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}


// Uses the input of a media field to test whether media was added to it.
function isMediaFieldPopulated(input) {
  return (input && (Array.isArray(input) ? (input.length > 0) : true));
}


/* Builds a case-insensitive RegExp that finds the phrase anywhere in a message,
 * but only as whole words (so 'hi' doesn't match inside 'this'). Any whitespace
 * inside the phrase matches any amount of whitespace in the message. */
function buildPhraseRegex(phrase) {
  const body = phrase
      .split(/\s+/)
      .map(escapeRegExp)
      .join("\\s+");

  const reLookbehind = "(?<![\\p{L}\\p{N}_])";
  const reLookahead = "(?![\\p{L}\\p{N}_])";

  return new RegExp(reLookbehind + body + reLookahead, 'giu');
}


/* A video with its own cooldown. Each time it's accepted for playback, the
 * cooldown starts; invocations during the cooldown are dropped. */
class VideoClip {
  cooldownMillis;
  cooldownEndEpoch = 0;

  name;
  #url;
  normalizedVolume;

  constructor(name, url, volumePct, cooldownSec) {
    this.name = name;
    this.#url = url;
    this.normalizedVolume = volumePct / 100;
    this.cooldownMillis = cooldownSec * 1000;
  }

  isOnCooldown() {
    return (Date.now() < this.cooldownEndEpoch);
  }

  activateCooldown() {
    this.cooldownEndEpoch = Date.now() + this.cooldownMillis;
  }

  /* If an array of media is provided, a random element is picked. (That's the
   * case when the field's "multiple" parameter is true.) */
  get url() {
    if (Array.isArray(this.#url)) {
      const randomIndex = Math.floor(Math.random() * this.#url.length);
      return this.#url[randomIndex];
    }
    return this.#url;
  }
}


/* Returns the clips invoked by a message, in the order their phrases appear.
 * Overlapping matches are resolved in favour of the earlier, then the longer
 * one (so 'good morning' wins over 'morning' when both are configured). */
function findInvokedClips(text) {
  const matches = [];

  phraseMatchers.forEach(({ regex, clip }, priority) => {
    for (const match of text.matchAll(regex)) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        priority,
        clip
      });
    }
  });

  matches.sort((a, b) =>
      (a.start - b.start) ||
      ((b.end - b.start) - (a.end - a.start)) ||
      (a.priority - b.priority));

  const clips = [];
  let lastEnd = -1;

  for (const match of matches) {
    if (match.start < lastEnd) {
      continue;
    }
    lastEnd = match.end;
    clips.push(match.clip);
  }

  return clips;
}


function hideVideoElmt() {
  return animateCss(videoElmt, animationOut, 0);
}


// Plays the next queued clip, or marks the widget idle if the queue is empty.
function playNext() {
  const clip = playQueue.shift();

  if (!clip) {
    isPlaying = false;
    return;
  }

  isPlaying = true;
  const id = ++playbackId;

  videoElmt.pause();
  videoElmt.src = clip.url;
  videoElmt.volume = clip.normalizedVolume;

  // 'load() will reset the element and rescan the available sources ...'
  videoElmt.load();

  videoElmt.play().catch((err) => {
    console.error(`Could not play '${clip.name}':`, err);
    finishPlayback(id, false);
  });
}


/* Ends the playback with the given id and moves on to the next clip. Calls for
 * an outdated id are ignored, so a failure reported twice (error event and
 * rejected play() promise) only advances the queue once. */
async function finishPlayback(id, animate) {
  if (id !== playbackId) {
    return;
  }
  playbackId++;

  try {
    if (animate) {
      await animateCss(videoElmt, animationOut, timeOut);
    } else {
      /* Otherwise the next in-animation would be skipped. Not awaited: if the
       * out-animation class is already applied, 'animationend' never fires. */
      hideVideoElmt();
    }
  } finally {
    playNext();
  }
}


function enqueue(clip) {
  playQueue.push(clip);

  if (!isPlaying) {
    playNext();
  }
}


function hasPermission(msg) {
  const subTier = msg.getTierBadge();     // 0 = non-sub.

  return (isUsableByEveryone ||
      (isUsableByTier1 && (subTier === 1)) ||
      (isUsableByTier2 && (subTier === 2)) ||
      (isUsableByTier3 && (subTier === 3)) ||
      (isUsableByVips && msg.isVIP()) ||
      (isUsableByMods && msg.isModerator()) ||
      msg.isBroadcaster() ||
      msg.usernameOnList(otherUsers));
}


function onWidgetLoad(obj) {
  const fieldData = obj.detail.fieldData;

  // Makes it easier for the user to look up the widget version.
  console.log(`Initialize ${fieldData.widgetName} (v${fieldData.widgetVersion}).`);

  otherUsers = fieldData.otherUsers
      .toLowerCase()
      .replace(/\s/g, '')
      .split(",");

  blockedUsers = fieldData.blockedUsers
      .toLowerCase()
      .replace(/\s/g, '')
      .split(",");

  isUsableByEveryone = (fieldData.permissionsMode === "unrestricted");
  isUsableByMods = fieldData.permissionLvl_mods;
  isUsableByVips = fieldData.permissionLvl_vips;
  isUsableByTier1 = fieldData.permissionLvl_subs1;
  isUsableByTier2 = fieldData.permissionLvl_subs2;
  isUsableByTier3 = fieldData.permissionLvl_subs3;

  animationIn = fieldData.animationIn;
  animationOut = fieldData.animationOut;
  timeIn = fieldData.timeIn;
  timeOut = fieldData.timeOut;

  // Ensures a defined initial state.
  hideVideoElmt();

  // When a video playback starts, trigger the in-animation.
  videoElmt.onplay = () => animateCss(videoElmt, animationIn, timeIn);

  // When a video ends, play the out-animation and then the next queued clip.
  videoElmt.onended = () => finishPlayback(playbackId, true);

  // When an error occurs, skip to the next queued clip.
  videoElmt.onerror = () => {
    console.error("Video error:", videoElmt.error);
    finishPlayback(playbackId, false);
  };

  // Initialize clips and ignore any slot without video or phrases.
  videoPrefixes.forEach((prefix) => {
    const url = fieldData[`${prefix}_url`];
    // Phrases are separated by '|'; empty entries are ignored.
    const phrases = (fieldData[`${prefix}_phrases`] || "")
        .split("|")
        .map((phrase) => phrase.trim())
        .filter((phrase) => phrase.length > 0);

    if (!isMediaFieldPopulated(url) || (phrases.length === 0)) {
      return;
    }

    const clip = new VideoClip(
        prefix,
        url,
        fieldData[`${prefix}_volume`],
        fieldData[`${prefix}_cooldown`]);

    phrases.forEach((phrase) => {
      phraseMatchers.push({ regex: buildPhraseRegex(phrase), clip });
    });
  });

  initialized = true;
}


function onMessage(msg) {
  if (!initialized) {
    return;
  }

  // Blocked users are rejected.
  if (msg.usernameOnList(blockedUsers)) {
    return;
  }

  if (!hasPermission(msg)) {
    return;
  }

  /* The cooldown starts as soon as a clip is accepted into the queue. This
   * also means a clip invoked twice in one message only plays once (unless its
   * cooldown is 0). */
  findInvokedClips(msg.text).forEach((clip) => {
    if (clip.isOnCooldown()) {
      return;
    }
    clip.activateCooldown();
    enqueue(clip);
  });
}
