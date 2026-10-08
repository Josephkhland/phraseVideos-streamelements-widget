# Phrase Videos
A custom widget for [StreamElements](https://streamelements.com/) overlays that plays video clips when certain phrases show up in your Twitch chat.

You pick a few videos and write down which phrases should trigger each one. Whenever a chat message contains one of those phrases (anywhere in the message, not only at the start), the matching video plays on your overlay. No `!commands` are needed: viewers just chat normally.

**Example:** with this setup
| Video | Phrases |
|---|---|
| Video #1 (a sunrise clip) | `good morning \| gm` |
| Video #2 (a waving clip) | `hi \| hello` |

the message *"Hello everyone, good morning!"* plays the waving clip first and then the sunrise clip, because *"hello"* comes before *"good morning"* in the message.

## Features
 - Each video has a list of phrases. When a chat message contains one of them, the video plays.  
 - One video can have as many phrase variations as you like (e.g. *"good morning"*, *"gm"*, *"morning all"*).  
 - Phrases are **not** case-sensitive: *"Good Morning"*, *"GOOD MORNING"* and *"good morning"* all match.  
 - Phrases only match **whole words**: *"hi"* matches *"hi chat"* but not *"this"*.  
 - If a message contains several phrases, their videos play **one after another**, in the order the phrases appear in the message.  
   Videos triggered by later messages are added to the end of the same queue. Optionally, the next video can start a few seconds before the previous one ends.  
 - Each video has its own **cooldown**. A phrase that triggers a video during its cooldown is ignored (it isn't saved for later).
 - Videos appear in **frames**. By default each video gets a **random spot and size** inside the widget. You can also pin the frames to fixed places in the HTML.
 - Each video plays in **one frame**, or in **several frames** at once (you choose how many; the sound plays only once).
 - Optional **surprise** in one-frame mode: each video has a chance to show in several frames, and/or every Nth video always does.


## Installation
1. In StreamElements, go to **Streaming tools → Overlays** and open (or create) an overlay.  
2. Click **+ (Add widget) → Static / Custom → Custom widget**.  
3. Select the new widget and click **Open editor**.  
4. Replace the content of each tab with the matching file from this repository:  

   | Editor tab | File |
   |---|---|
   | HTML | `phraseVideos.html` |
   | CSS | `phraseVideos.css` |
   | JS | `phraseVideos.js` |
   | FIELDS | `phraseVideos.json` |
   | DATA | leave as it is (if the settings look wrong, set it to `{}`) |

5. Click **Done**, then **Save** the overlay.  
6. Resize/position the widget in the overlay. Videos only appear inside the widget's box, so stretch it over the whole overlay to let them pop up anywhere (or over the part of the screen where they should appear).


## Configuration
Everything is configured in the widget's settings panel (left side of the overlay editor). No code editing is needed, except for placing [fixed frames](#fixed-frames) (optional).

### Video #1 to #50
The widget has 50 video slots. Fill in as many as you need, starting from Video #1. Empty slots are ignored.

| Setting | Description |
|---|---|
| **Phrases (separate with \|)** | The phrases that trigger this video. Separate variations with a `\|` character. Spaces around the `\|` don't matter. |
| **Video** | The video to play. Upload it or pick it from your media library. |
| **Volume** | Playback volume (0-100). |
| **Cooldown in sec for this video** | How long after triggering this video it can't be triggered again. `0` disables the cooldown. |

A video slot is ignored if it has no video **or** no phrases, so unused slots can just be left empty.

Example phrase box (three variations):
```
good morning | gm | morning all
```
Because `|` separates phrases, a phrase can contain commas (e.g. `morning, all`) but not a `|` itself.

### Global settings
| Setting | Description |
|---|---|
| **Whose messages can trigger videos?** | *Everyone* (default) or *Enforce the checkbox selection*. |
| **Moderators / VIPs / Sub Tier 1-3** | Who may trigger videos when the checkbox selection is enforced. The broadcaster can always trigger videos. |
| **Additional users** | Comma-separated usernames that may always trigger videos. |
| **Blocked users** | Comma-separated usernames that are always ignored. Defaults to `StreamElements` so the chat bot can't trigger videos. Add other bots here too. |
| **Start next video early (sec)** | When videos are queued, the next one starts this many seconds before the current one ends, so they overlap (sound included). E.g. `2` starts the next video 2 seconds early. The newer video is always drawn on top of the older one. A video shorter than this lets the next one start as soon as it begins playing. `0` (default) plays them strictly one after another. Decimals are allowed (e.g. `0.5`). |

### Animation settings
In/out animation and their durations (in seconds). They play when a video starts and ends; with several queued videos, each one animates in and out.

### Frames
A frame is a spot inside the widget where a video is shown. The **Frames** settings decide where and in how many frames each video appears.

| Setting | What it does |
|---|---|
| **Frame positions** | *Random* (default): every time a video plays, each of its frames gets a new random size and spot inside the widget. Frames may overlap, and they don't have to cover the whole widget. *Fixed (from HTML)*: the frames stay where the HTML puts them (see [Fixed frames](#fixed-frames)). |
| **Show videos in** | *One frame* (default): each video plays in a single frame. With fixed positions, that's one of the HTML frames picked at random, never the same one twice in a row. *Several frames*: every video plays in several frames at once (see **Frames at once**). |
| **Frames at once** | How many frames show a video when it plays in several. With fixed positions, that many of the free HTML frames are picked at random. If there aren't enough, all free ones are used. |
| **Several-frames chance (%)** | Only in *One frame* mode. Each video has this chance to play in several frames instead of one. Decimals are allowed (e.g. `0.5` = about 1 in 200 videos). `0` turns it off. |
| **Several frames every Nth video** | Only in *One frame* mode. E.g. `20` makes the 20th, 40th, 60th, ... video play in several frames. Counted from when the overlay was loaded. `0` turns it off. |
| **Random frame size, min / max (%)** | Only with *Random* positions. Each frame gets a size between these two, in % of the widget's width and height. The frame has the same shape as the widget, and the video is fitted inside it keeping its proportions. Set both to the same number for frames that are always the same size. |

The chance and the every-Nth setting can be used together.

**Sound:** when a video plays in several frames, only one of them plays the sound. The others are muted copies. The frame with the sound also decides when the video is over: when it ends, all frames animate out together.

Videos play **one at a time** (see the queue under [Features](#features)), no matter how many frames there are, unless **Start next video early** is set. Overlapping videos never share a frame: with random positions, new frames are added as needed. With fixed frames, the next video uses the free HTML frames, and waits if none are free. The newest video is always drawn on top.


## Fixed frames
With **Frame positions** set to *Fixed (from HTML)*, the frames are the ones listed in the **HTML** tab, one `<video>` line per frame. (With *Random* positions, these lines are reused and their positions ignored; missing frames are added automatically.)
```html
<div class="main-container">
  <video class="frame" playsinline style="left: 0%;  top: 0%;  width: 50%; height: 50%;"></video>
  <video class="frame" playsinline style="left: 50%; top: 0%;  width: 50%; height: 50%;"></video>
  <video class="frame" playsinline style="left: 0%;  top: 50%; width: 50%; height: 50%;"></video>
  <video class="frame" playsinline style="left: 50%; top: 50%; width: 50%; height: 50%;"></video>
</div>
```
By default there are four frames, one in each quarter of the widget.

 - **`left` / `top`:** position of the frame's top-left corner, in % of the widget's width/height.  
 - **`width` / `height`:** size of the frame, in % of the widget's width/height. The video is scaled to fit inside the frame, keeping its proportions.  
 - **Adding a frame:** copy a line and change its numbers. Every frame needs `class="frame"`.  
 - **Removing a frame:** delete its line. For the old single-video behavior, keep one line and set it to `left: 0%; top: 0%; width: 100%; height: 100%;`.  
 - Frames may overlap. A newer video is always drawn on top of an older one. Frames showing the same video are stacked in the order of their lines (later lines on top).

Example: with the widget stretched over a 1920×1080 overlay, `left: 75%; top: 0%; width: 25%; height: 25%;` is a 480×270 pixel frame in the top-right corner.  
You can also use pixels instead of % (e.g. `left: 1440px;`). Pixels count from the widget's top-left corner.


## How phrases are matched
 - **Case** never matters.  
 - **Whole words only:** a phrase must not be directly preceded or followed by a letter, digit or `_`.  
   *"hi"* matches *"hi!"*, *"@hi"* and *"well, hi there"*, but not *"this"* or *"hii"*.  
   If you want *"hii"* to work as well, add it as another variation (`hi | hii`).  
 - **Spaces:** any amount of spaces between words is accepted (*"good&nbsp;&nbsp;&nbsp;morning"* matches *"good morning"*).  
 - **Punctuation must match exactly:** *"let's go"* does **not** match *"lets go"*. Add both spellings if you want both.  
 - **Overlapping phrases:** if one configured phrase contains another (e.g. *"good morning"* on video 1 and *"morning"* on video 2), the longer one wins and only its video plays.  
 - **Same phrase on two videos:** the video with the lower number wins.  
 - **Emotes** are matched by their text name, like any other word.


## How cooldowns work
 - Each video's cooldown starts when the video is **queued**, not when it starts playing.  
 - A phrase that triggers a video during its cooldown is dropped.  
 - Consequently, if one message contains the same video's phrases twice (e.g. *"gm gm"*), the video plays only once (unless its cooldown is `0`).


## Changing the number of video slots
You can add or remove slots by editing the widget's code. Open the widget, click **Open editor**, make the changes below, then click **Done** and **Save** the overlay.

A slot needs two things:
 - **Its four fields in the FIELDS tab:** `videoN_phrases`, `videoN_url`, `videoN_volume` and `videoN_cooldown`, where `N` is the slot number.  
 - **Its number counted in the JS tab**, through this line near the top:
   ```js
   const videoSlotCount = 50;
   ```
   The widget uses slots `video1` up to `video<videoSlotCount>`.

Slots must be numbered **1, 2, 3, ...** without gaps, so always add or remove slots **at the end**.

### Adding slots
Example: adding Video #51.

**1. FIELDS tab:** find the four `video50_...` blocks (the last slot), right before `"widgetName"`. Paste this directly after them, still before `"widgetName"`:
```json
  "video51_phrases": {
    "type": "text", 
    "label": "Phrases (separate with |):", 
    "value": "", 
    "group": "Video #51"
  }, 
  "video51_url": {
    "type": "video-input", 
    "label": "Video:", 
    "multiple": false, 
    "group": "Video #51"
  }, 
  "video51_volume": {
    "type": "slider", 
    "label": "Volume:", 
    "min": 0, 
    "max": 100, 
    "value": 50, 
    "step": 1, 
    "group": "Video #51"
  }, 
  "video51_cooldown": {
    "type": "number", 
    "label": "Cooldown in sec for this video:", 
    "min": 0, 
    "value": 60, 
    "step": 1, 
    "group": "Video #51"
  }, 
```
For more slots, paste the block again for each one, replacing every `51` with `52`, `53`, and so on (8 places per block).

**2. JS tab:** set the count to the new highest slot number:
```js
const videoSlotCount = 51;
```

### Removing slots
Example: going from 50 slots down to 20.

**1. FIELDS tab:** delete the four blocks of every slot above 20 (`video21_phrases` through `video50_cooldown`). Everything from `"video21_phrases"` up to (but not including) `"widgetName"` goes.

**2. JS tab:** set the count to the new highest slot number:
```js
const videoSlotCount = 20;
```

Removed slots' old settings may stay in the DATA tab. That does no harm, but you can set DATA to `{}` to clean it up. That also resets all other settings to their defaults, so only do it before configuring the widget.

### If something goes wrong
 - **The settings panel is empty or doesn't update:** the FIELDS JSON has a syntax error. Most often a comma is missing between two blocks (`}` followed by `"video..."`) or there's an extra one before the closing `}` of the file. Every block ends with `},` except the very last field, `widgetVersion`.  
 - **A new slot shows up but never plays:** `videoSlotCount` is lower than its number, or its field names don't match its number (e.g. `video51_url` pasted as `video50_url`).  
 - A count higher than the number of slots in FIELDS, or a slot's fields left in FIELDS above the count, doesn't break anything. Those slots just do nothing.


## Need more than 50 videos?
Instead of [adding slots](#changing-the-number-of-video-slots), you can also add the widget to your overlay again (repeat the [installation](#installation) steps) and configure the extra videos in the new copy. Each copy works independently, so keep in mind:
 - **Each copy has its own queue.** Videos from different copies can play at the same time. If the copies are stretched over the same area (e.g. both over the whole overlay with random positions), their videos may cover each other. Give them separate areas if that bothers you.  
 - **Don't use the same phrase in two copies**, or both copies will play a video for it.  
 - Permissions, blocked users, animations, frames and **Start next video early** are set per copy, so set them the same way in each.  

Tip: duplicating the existing widget in the overlay editor (instead of adding a new one) keeps its settings, so you only have to change the videos and phrases in the copy.

### Random video per slot (optional)
To have a slot pick a random video from several, open the widget editor, find that slot's `_url` field in the **FIELDS** tab (e.g. `video2_url`) and change `"multiple": false` to `"multiple": true`. You can then add several videos to that slot, and one is picked at random each time.


## Testing
1. Add a video and a phrase to **Video #1**, and set a short cooldown (e.g. `5`) while testing.  
2. Open the overlay URL in a browser tab, or add it to OBS as a Browser Source.  
3. Type the phrase in your own Twitch chat (as broadcaster, you can always trigger videos).  
4. To test the queue, send a message with two phrases from different videos, e.g. *"hi and good morning"*.
5. To test the frames, trigger a few videos and watch them move around. To see several frames right away, set **Several frames every Nth video** to `2` (or `1` for every video).
6. To test **Start next video early**, set it to e.g. `2` and send a message with two phrases. The second video should appear 2 seconds before the first one ends.


## Troubleshooting
 - **No sound when testing in a browser tab:** browsers may block autoplaying sound until you click the page. Click it once, or test in OBS.  
 - **Nothing happens:** open the browser console (F12) on the overlay page. You should see `Initialize PhraseVideos (v2).` Playback errors are logged there too.  
 - **No video shows up after editing the fixed frames:** check that every frame line has `class="frame"` and that its left + width and top + height stay within 100%. A frame outside the widget's box is invisible, but its sound still plays. If no frame is found at all, the console shows `No frames found.`  
 - **Frames don't behave like the settings say:** the console shows a `Frame settings:` line with the values the widget actually uses. Settings missing from an older widget's saved data fall back to their defaults. Also make sure all four tabs (HTML, CSS, JS, FIELDS) were updated, not only the JS.  
 - **Random frames are too small or too big:** change **Random frame size, min / max**. The sizes are relative to the widget, so a small widget also means small frames.  
 - **Videos in different frames are slightly out of sync:** the muted copies are started together with the frame that has the sound, but a slow connection can still delay one of them a little. Shorter or smaller video files help.  
 - **A video never plays:** open the console (F12). When the widget loads, it lists the videos it loaded with their phrases (`Loaded videos: ...`), and warns about slots that are ignored because they have no video or no phrases, and about phrases used by two slots. Each time a phrase is found in chat, it logs `'videoN' was triggered.` (or that the video is on cooldown).  
   - The video isn't in the `Loaded videos` list: give its slot both a video and at least one phrase.  
   - It's listed, but typing its phrase logs nothing: check the [matching rules](#how-phrases-are-matched) (whole words, exact punctuation), and that the phrase isn't part of a longer phrase of another video. Also check that your account is allowed to trigger videos.  
   - It's triggered, but nothing shows: look for a `Video error` message. The video file may be in a format the browser can't play.  
 - **A bot triggers videos:** add its username to **Blocked users**.  
 - **Changes have no effect:** save the overlay and reload the browser tab / browser source.  
 - **Settings panel looks wrong after editing FIELDS:** the JSON probably has a syntax error (often a missing or extra comma). If you reused an older widget, also try setting the DATA tab to `{}`.


## Used libraries
 - [Reboot0's Widget Tools](https://reboot0-de.github.io/se-tools/index.html)  
 - [animate.css](https://github.com/animate-css/animate.css)  


## Credits
This widget is based on AFoeee's [Video On Command](https://github.com/AFoeee/video-on-command-se-widget) StreamElements widget, which builds on the original by Benno and Suerion's variation of it. Thanks to Benno, Suerion, AFoeee, lx, thefyrewire, Reboot0, SquidCharger and ca11.

Licensed under the MIT License, see [LICENSE](LICENSE).
