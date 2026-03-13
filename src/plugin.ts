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

// Start OSC bridge (non-blocking)
oscBridge.start().catch((err) => {
  streamDeck.logger.error(`Failed to start OSC bridge: ${err}`);
});

// Connect to Stream Deck
streamDeck.connect();
