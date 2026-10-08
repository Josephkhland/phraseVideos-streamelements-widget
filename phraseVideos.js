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
let queueBlocked = false;           // True until the newest playback lets the next clip start.
let overlapSec;                     // The next clip may start this long before the current one ends.

const containerElmt = document.querySelector(".main-container");

// The <video> elements defined in the HTML, in order (plus any added later).
const frames = Array.from(document.querySelectorAll(".frame"));
const playbackOfFrame = new Map();  // Frames in use (incl. out-animation) -> their playback.
let lastFrame = null;               // Prevents picking the same fixed frame twice in a row.
let topZIndex = 0;                  // Raised for each frame used, so the newest clip is drawn on top.
let playedCount = 0;                // Clips played so far (for 'every Nth video').

let frameLayout;                    // 'random' (spots picked by the code), 'full' (whole widget,
                                    // extra frames at random spots) or 'fixed' (HTML frames).
let framesAtOnce;                   // How many frames show a clip that shows in several.
let frameSizeMin;                   // Size range of random frames, in % of the widget.
let frameSizeMax;
let displayMode;                    // 'random' (one frame) or 'all' (several frames).
let allFramesChance;                // 0-1, chance that a clip shows in several frames anyway.
let allFramesEveryNth;              // Every Nth clip shows in several frames. 0 = off.

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


/* Frames are hidden with 'visibility' as well, so a frame can't stay on screen
 * if the animation CSS fails (e.g. animate.css didn't load). */
function setFrameVisible(frame, visible) {
  frame.style.visibility = visible ? "visible" : "hidden";
}


function hideFrame(frame) {
  setFrameVisible(frame, false);
  return animateCss(frame, animationOut, 0);
}


/* Plays the out-animation. Resolves at the latest shortly after the animation
 * should have ended, so a missing 'animationend' can't stall the queue. */
function animateOut(frame) {
  return Promise.race([
    animateCss(frame, animationOut, timeOut),
    new Promise((resolve) => setTimeout(resolve, timeOut * 1000 + 500))
  ]);
}


// A frame is shown once its in-animation was applied (i.e. it started playing).
function isShown(frame) {
  return frame.classList.contains(`animate__${animationIn}`);
}


// Adds a frame to the widget (used for random positions).
function addFrame() {
  const frame = document.createElement("video");
  frame.className = "frame";
  frame.playsInline = true;
  containerElmt.appendChild(frame);
  frames.push(frame);
  setUpFrame(frame);
  return frame;
}


/* Gives a frame a random size and a random spot fully inside the widget. The
 * frame keeps the widget's proportions; the video is fitted into it. */
function placeRandomly(frame) {
  const size = frameSizeMin + Math.random() * (frameSizeMax - frameSizeMin);
  frame.style.width = `${size}%`;
  frame.style.height = `${size}%`;
  frame.style.left = `${Math.random() * (100 - size)}%`;
  frame.style.top = `${Math.random() * (100 - size)}%`;
}


/* Picks 'count' of the free HTML frames at random (or all free ones, if
 * there aren't enough). A single frame is never the same one twice in a row,
 * unless it's the only free one. */
function pickFixedFrames(free, count) {
  if ((count === 1) && (free.length > 1)) {
    const options = free.filter((frame) => frame !== lastFrame);
    lastFrame = options[Math.floor(Math.random() * options.length)];
    return [lastFrame];
  }

  // Fisher-Yates shuffle, then take the first ones.
  const shuffled = free.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const chosen = shuffled.slice(0, count);
  lastFrame = chosen[0];
  return chosen;
}


/* Picks the frames for the next clip: one frame, or several of them if the
 * mode, the chance or the every-Nth counter says so. Only frames that aren't
 * used by another playback are picked. Returns no frames if all fixed frames
 * are in use. */
function chooseFrames() {
  const free = frames.filter((frame) => !playbackOfFrame.has(frame));

  if ((frameLayout === "fixed") && (free.length === 0)) {
    return [];
  }

  playedCount++;

  const showInSeveral = (displayMode === "all") ||
      ((allFramesEveryNth > 0) && (playedCount % allFramesEveryNth === 0)) ||
      (Math.random() < allFramesChance);

  const count = showInSeveral ? framesAtOnce : 1;

  if (frameLayout === "fixed") {
    return pickFixedFrames(free, count);
  }

  // Random positions or whole widget: add frames if too few are free.
  while (free.length < count) {
    free.push(addFrame());
  }
  const chosen = free.slice(0, count);
  chosen.forEach(placeRandomly);

  // The first frame (with the audio) covers the whole widget; any others are extra random spots.
  if (frameLayout === "full") {
    placeOverWholeWidget(chosen[0]);
  }
  return chosen;
}


function placeOverWholeWidget(frame) {
  frame.style.left = "0%";
  frame.style.top = "0%";
  frame.style.width = "100%";
  frame.style.height = "100%";
}


/* Resolves once the frame can start playing, failed to load, or a few seconds
 * have passed (play() then simply waits for the rest). */
function whenPlayable(frame) {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      frame.removeEventListener('canplay', done);
      frame.removeEventListener('error', done);
      resolve();
    };
    const timer = setTimeout(done, 3000);
    frame.addEventListener('canplay', done);
    frame.addEventListener('error', done);
  });
}


// Stops a frame and makes it available to other playbacks.
function freeFrame(frame) {
  frame.pause();
  playbackOfFrame.delete(frame);
}


// Hides a frame that failed while the other frames keep playing the clip.
function dropFrame(playback, frame) {
  playback.frames = playback.frames.filter((f) => f !== frame);
  hideFrame(frame);
  freeFrame(frame);
}


// A failing audio frame ends the playback; any other frame is just hidden.
function frameFailed(playback, frame) {
  if (frame === playback.audioFrame) {
    finishPlayback(playback, false);
  } else {
    dropFrame(playback, frame);
  }
}


/* Starts the next queued clip, unless the newest playback still holds the
 * queue or no frame is free (only possible with fixed frames). */
function startNext() {
  if (queueBlocked || (playQueue.length === 0)) {
    return;
  }

  const chosenFrames = chooseFrames();
  if (chosenFrames.length === 0) {
    return;               // Retried when a playback frees its frames.
  }

  const clip = playQueue.shift();
  const url = clip.url;   // Picked once, so all frames show the same video.

  /* The first frame carries the audio and decides when the clip ends. A
   * playback is 'released' once the next clip may start. */
  const playback = {
    clip,
    frames: chosenFrames,
    audioFrame: chosenFrames[0],
    released: false,
    finished: false
  };
  queueBlocked = true;

  chosenFrames.forEach((frame, i) => {
    playbackOfFrame.set(frame, playback);
    /* Over any clip that's still playing. Within a clip, the first frame is
     * at the bottom, so extra spots show over a whole-widget frame. */
    frame.style.zIndex = ++topZIndex;
    frame.pause();
    frame.src = url;
    frame.volume = clip.normalizedVolume;
    frame.muted = (i > 0);  // The audio only plays once.

    // 'load() will reset the element and rescan the available sources ...'
    frame.load();
  });

  startFrames(playback);
}


/* Starts all frames of a playback at the same time, once they're ready, so
 * they stay in sync. */
async function startFrames(playback) {
  await Promise.all(playback.frames.map(whenPlayable));

  // The playback may have been aborted in the meantime (e.g. by an error).
  if (playback.finished) {
    return;
  }

  playback.frames.forEach((frame) => {
    frame.play().catch((err) => {
      if (playback.finished || !playback.frames.includes(frame)) {
        return;
      }
      console.error(`Could not play '${playback.clip.name}':`, err);
      frameFailed(playback, frame);
    });
  });
}


// Lets the next queued clip start. Only the first call per playback counts.
function releaseQueue(playback) {
  if (playback.released) {
    return;
  }
  playback.released = true;
  queueBlocked = false;
  startNext();
}


/* Ends a playback: animates its frames out, frees them, and lets the next clip
 * start if that hasn't happened yet. Only the first call per playback counts,
 * so a failure reported twice (error event and rejected play() promise) only
 * ends it once. */
async function finishPlayback(playback, animate) {
  if (playback.finished) {
    return;
  }
  playback.finished = true;

  try {
    if (animate) {
      /* Only frames that were shown are animated: on an already hidden frame,
       * 'animationend' would never fire. */
      await Promise.all(playback.frames.filter(isShown).map(animateOut));
    }
    /* Makes sure the frames are hidden, also after a failed playback (where
     * the next in-animation would otherwise be skipped). Not awaited: if the
     * out-animation class is already applied, 'animationend' never fires. */
    playback.frames.forEach(hideFrame);
  } finally {
    // Muted frames may run slightly longer than the audio frame.
    playback.frames.forEach(freeFrame);
    releaseQueue(playback);
    startNext();          // A clip may have been waiting for free frames.
  }
}


function enqueue(clip) {
  playQueue.push(clip);
  startNext();
}


// Hides a frame and connects its events to the playback using it.
function setUpFrame(frame) {
  // Ensures a defined initial state.
  hideFrame(frame);

  // When a frame starts playing, trigger its in-animation.
  frame.onplay = () => {
    setFrameVisible(frame, true);
    animateCss(frame, animationIn, timeIn);
  };

  // When the audio frame gets close enough to its end, start the next clip.
  frame.ontimeupdate = () => {
    const playback = playbackOfFrame.get(frame);
    if (playback && (frame === playback.audioFrame) && (overlapSec > 0) &&
        (frame.duration - frame.currentTime <= overlapSec)) {
      releaseQueue(playback);
    }
  };

  // When the audio frame ends, animate the playback's frames out.
  frame.onended = () => {
    const playback = playbackOfFrame.get(frame);
    if (playback && (frame === playback.audioFrame)) {
      finishPlayback(playback, true);
    }
  };

  frame.onerror = () => {
    const playback = playbackOfFrame.get(frame);
    if (!playback || playback.finished) {
      return;
    }
    console.error(`Video error in '${playback.clip.name}':`, frame.error);
    frameFailed(playback, frame);
  };
}


// Reads a number field, falling back to the default if it's missing or empty.
function numberSetting(value, defaultValue) {
  const number = parseFloat(value);
  return Number.isFinite(number) ? number : defaultValue;
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

  /* Settings added in later versions may be missing from a widget's saved
   * data; their defaults are used then. */
  displayMode = fieldData.displayMode ?? "random";
  allFramesChance = numberSetting(fieldData.allFramesChance, 0) / 100;
  allFramesEveryNth = numberSetting(fieldData.allFramesEveryNth, 0);
  frameLayout = fieldData.frameLayout ?? "random";
  framesAtOnce = Math.max(1, numberSetting(fieldData.framesAtOnce, 4));
  const sizeA = numberSetting(fieldData.frameSizeMin, 25);
  const sizeB = numberSetting(fieldData.frameSizeMax, 45);
  frameSizeMin = Math.min(sizeA, sizeB);
  frameSizeMax = Math.max(sizeA, sizeB);

  overlapSec = Math.max(0, numberSetting(fieldData.overlapSec, 0));

  console.log("Frame settings:", { frameLayout, displayMode, framesAtOnce,
      allFramesChance, allFramesEveryNth, frameSizeMin, frameSizeMax, overlapSec });

  if ((frameLayout === "fixed") && (frames.length === 0)) {
    console.error('No frames found. Add <video class="frame"> elements to the HTML.');
    return;
  }

  frames.forEach(setUpFrame);

  /* Unless the frames are fixed, the HTML frames are just reused for other
   * positions; missing ones are added. */
  if (frameLayout !== "fixed") {
    while (frames.length < framesAtOnce) {
      addFrame();
    }
  }

  /* Initialize clips and ignore any slot without video or phrases. Problems
   * are logged, as an ignored slot otherwise just never plays. */
  const phraseOwners = new Map();     // Normalized phrase -> slot using it.
  const loadedSlots = [];

  videoPrefixes.forEach((prefix) => {
    const url = fieldData[`${prefix}_url`];
    // Phrases are separated by '|'; empty entries are ignored.
    const phrases = (fieldData[`${prefix}_phrases`] || "")
        .split("|")
        .map((phrase) => phrase.trim())
        .filter((phrase) => phrase.length > 0);

    const hasVideo = isMediaFieldPopulated(url);

    if (!hasVideo || (phrases.length === 0)) {
      if (hasVideo || (phrases.length > 0)) {
        console.warn(`${prefix} is ignored: it has no ${hasVideo ? "phrases" : "video"}.`);
      }
      return;
    }

    const clip = new VideoClip(
        prefix,
        url,
        fieldData[`${prefix}_volume`],
        fieldData[`${prefix}_cooldown`]);

    phrases.forEach((phrase) => {
      const key = phrase.toLowerCase().split(/\s+/).join(" ");
      if (phraseOwners.has(key)) {
        console.warn(`'${phrase}' is a phrase of ${phraseOwners.get(key)} and ` +
            `${prefix}. Only ${phraseOwners.get(key)} plays for it.`);
      } else {
        phraseOwners.set(key, prefix);
      }

      phraseMatchers.push({ regex: buildPhraseRegex(phrase), clip });
    });

    loadedSlots.push(`${prefix} (${phrases.join(" | ")})`);
  });

  console.log(`Loaded videos: ${loadedSlots.join(", ") || "none"}`);

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
      const secondsLeft = Math.ceil((clip.cooldownEndEpoch - Date.now()) / 1000);
      console.log(`'${clip.name}' was triggered, but is on cooldown (${secondsLeft}s left).`);
      return;
    }
    console.log(`'${clip.name}' was triggered.`);
    clip.activateCooldown();
    enqueue(clip);
  });
}
