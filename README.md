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
   Videos triggered by later messages are added to the end of the same queue.  
 - Each video has its own **cooldown**. A phrase that triggers a video during its cooldown is ignored (it isn't saved for later).


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
6. Resize/position the widget in the overlay. The video is scaled to fit the widget's box.


## Configuration
Everything is configured in the widget's settings panel (left side of the overlay editor). No code editing is needed.

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

### Animation settings
In/out animation and their durations (in seconds). They play when a video starts and ends; with several queued videos, each one animates in and out.


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


## Need more than 50 videos?
Add the widget to your overlay again (repeat the [installation](#installation) steps) and configure the extra videos in the new copy. Each copy works independently, so keep in mind:
 - **Each copy has its own queue.** Videos from different copies can play at the same time. Place the copies so they don't cover each other, or accept the overlap.  
 - **Don't use the same phrase in two copies**, or both copies will play a video for it.  
 - Permissions, blocked users and animations are set per copy, so set them the same way in each.  

Tip: duplicating the existing widget in the overlay editor (instead of adding a new one) keeps its settings, so you only have to change the videos and phrases in the copy.

### Random video per slot (optional)
To have a slot pick a random video from several, open the widget editor, find that slot's `_url` field in the **FIELDS** tab (e.g. `video2_url`) and change `"multiple": false` to `"multiple": true`. You can then add several videos to that slot, and one is picked at random each time.


## Testing
1. Add a video and a phrase to **Video #1**, and set a short cooldown (e.g. `5`) while testing.  
2. Open the overlay URL in a browser tab, or add it to OBS as a Browser Source.  
3. Type the phrase in your own Twitch chat (as broadcaster, you can always trigger videos).  
4. To test the queue, send a message with two phrases from different videos, e.g. *"hi and good morning"*.


## Troubleshooting
 - **No sound when testing in a browser tab:** browsers may block autoplaying sound until you click the page. Click it once, or test in OBS.  
 - **Nothing happens:** open the browser console (F12) on the overlay page. You should see `Initialize PhraseVideos (v1).` Playback errors are logged there too.  
 - **A video never plays:** make sure its slot has both a video and at least one phrase, that the phrase doesn't overlap a longer phrase of another video, and that the video isn't still on cooldown.  
 - **A bot triggers videos:** add its username to **Blocked users**.  
 - **Changes have no effect:** save the overlay and reload the browser tab / browser source.  
 - **Settings panel looks wrong after editing FIELDS:** the JSON probably has a syntax error (often a missing or extra comma). If you reused an older widget, also try setting the DATA tab to `{}`.


## Used libraries
 - [Reboot0's Widget Tools](https://reboot0-de.github.io/se-tools/index.html)  
 - [animate.css](https://github.com/animate-css/animate.css)  


## Credits
This widget is based on AFoeee's [Video On Command](https://github.com/AFoeee/video-on-command-se-widget) StreamElements widget, which builds on the original by Benno and Suerion's variation of it. Thanks to Benno, Suerion, AFoeee, lx, thefyrewire, Reboot0, SquidCharger and ca11.

Licensed under the MIT License, see [LICENSE](LICENSE).
