import sharp from "sharp";
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const iconsDir = resolve(root, "icons");
const imgsDir = resolve(root, "com.edvinlandvik.totalmix-ufx.sdPlugin", "imgs");

interface IconSpec {
  svg: string;
  output: string;
  sizes: number[];
}

const specs: IconSpec[] = [
  // Action icons — 20x20 + 40x40
  { svg: "gain.svg", output: "actions/gain", sizes: [20, 40] },
  { svg: "volume.svg", output: "actions/volume", sizes: [20, 40] },
  { svg: "phantom.svg", output: "actions/phantom", sizes: [20, 40] },
  { svg: "mute.svg", output: "actions/mute", sizes: [20, 40] },
  { svg: "solo.svg", output: "actions/solo", sizes: [20, 40] },
  { svg: "phase.svg", output: "actions/phase", sizes: [20, 40] },
  { svg: "talkback.svg", output: "actions/talkback", sizes: [20, 40] },
  { svg: "dim.svg", output: "actions/dim", sizes: [20, 40] },
  { svg: "mono.svg", output: "actions/mono", sizes: [20, 40] },
  { svg: "snapshot.svg", output: "actions/snapshot", sizes: [20, 40] },

  // State icons — 20x20 + 40x40
  { svg: "phantom-on.svg", output: "states/phantom-on", sizes: [20, 40] },
  { svg: "phantom-off.svg", output: "states/phantom-off", sizes: [20, 40] },
  { svg: "mute-on.svg", output: "states/mute-on", sizes: [20, 40] },
  { svg: "mute-off.svg", output: "states/mute-off", sizes: [20, 40] },
  { svg: "solo-on.svg", output: "states/solo-on", sizes: [20, 40] },
  { svg: "solo-off.svg", output: "states/solo-off", sizes: [20, 40] },
  { svg: "phase-on.svg", output: "states/phase-on", sizes: [20, 40] },
  { svg: "phase-off.svg", output: "states/phase-off", sizes: [20, 40] },
  { svg: "talkback-on.svg", output: "states/talkback-on", sizes: [20, 40] },
  { svg: "talkback-off.svg", output: "states/talkback-off", sizes: [20, 40] },
  { svg: "dim-on.svg", output: "states/dim-on", sizes: [20, 40] },
  { svg: "dim-off.svg", output: "states/dim-off", sizes: [20, 40] },
  { svg: "mono-on.svg", output: "states/mono-on", sizes: [20, 40] },
  { svg: "mono-off.svg", output: "states/mono-off", sizes: [20, 40] },

  // Category icon — 28x28 + 56x56
  { svg: "category.svg", output: "plugin/category", sizes: [28, 56] },

  // Plugin icon — 256x256 + 512x512
  { svg: "plugin.svg", output: "plugin/icon", sizes: [256, 512] },
];

async function generate(): Promise<void> {
  let count = 0;

  for (const spec of specs) {
    const svgBuffer = readFileSync(resolve(iconsDir, spec.svg));
    const baseSize = spec.sizes[0]!;
    const retinaSize = spec.sizes[1]!;

    // Standard size
    const outBase = resolve(imgsDir, `${spec.output}.png`);
    await sharp(svgBuffer).resize(baseSize, baseSize).png().toFile(outBase);
    count++;

    // @2x retina size
    const outRetina = resolve(imgsDir, `${spec.output}@2x.png`);
    await sharp(svgBuffer).resize(retinaSize, retinaSize).png().toFile(outRetina);
    count++;
  }

  console.log(`Generated ${count} icons.`);
}

generate().catch((err) => {
  console.error("Icon generation failed:", err);
  process.exit(1);
});
