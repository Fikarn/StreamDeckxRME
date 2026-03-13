import streamDeck from "@elgato/streamdeck";
import { GainControl } from "./actions/gainControl.js";
import { VolumeControl } from "./actions/volumeControl.js";
import { PhantomPower } from "./actions/phantomPower.js";
import { MuteToggle } from "./actions/muteToggle.js";
import { oscBridge } from "./osc/oscBridge.js";

// Register actions
streamDeck.actions.registerAction(new GainControl());
streamDeck.actions.registerAction(new VolumeControl());
streamDeck.actions.registerAction(new PhantomPower());
streamDeck.actions.registerAction(new MuteToggle());

// Start OSC bridge with retry on failure
async function startOscWithRetry(): Promise<void> {
  const delays = [0, 2000, 4000, 8000];
  for (let attempt = 0; attempt < delays.length; attempt++) {
    if (attempt > 0) {
      streamDeck.logger.warn(`Retrying OSC bridge start (attempt ${attempt + 1}/${delays.length})...`);
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }
    try {
      await oscBridge.start();
      return;
    } catch (err) {
      streamDeck.logger.error(`Failed to start OSC bridge (attempt ${attempt + 1}): ${err}`);
    }
  }
  streamDeck.logger.error("OSC bridge failed to start after all retry attempts. Plugin will run without OSC connection.");
}

startOscWithRetry().catch((err) => {
  streamDeck.logger.error(`Unexpected error starting OSC bridge: ${err}`);
});

// Connect to Stream Deck
streamDeck.connect();
