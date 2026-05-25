const fs = require("fs");
const P = String.fromCodePoint.bind(String);

const animals = [
  P(0x1F42E), // cow
  P(0x1F431), // cat
  P(0x1F436), // dog
  P(0x1F430), // rabbit
  P(0x1F333), // evergreen tree
  P(0x1F33F), // herb
  P(0x1F339), // rose
  P(0x2600),  // sun
  P(0x1F319), // moon
];

const colors = [
  ["#ffd9d0", "#f3a99f"],
  ["#ffe5b8", "#f2c777"],
  ["#e2f3c7", "#bcd97f"],
  ["#d8eef0", "#9fd0d6"],
  ["#e7def7", "#c3b1ea"],
  ["#dfe7ff", "#b2c3f0"],
  ["#ffd7e8", "#f3a0c8"],
  ["#fff2d0", "#f0d880"],
  ["#dae8ff", "#a8c0f0"],
];

// Write GitBadge.vue
const badge = [
  "<script setup>",
  "const props = defineProps({ name: { type: String, default: 'github' }})",
  "const animals = " + JSON.stringify(animals) + "",
  "const colors = " + JSON.stringify(colors) + "",
  "const hash = Array.from(props.name).reduce((t,c) => t + c.charCodeAt(0), 0)",
  "const animal = animals[hash % animals.length]",
  "const bg = colors[hash % colors.length]",
  "</script>",
  "<template>",
  "  <span class=\"git-badge\" :style=\"{ background: 'linear-gradient(135deg,' + bg[0] + ',' + bg[1] + ')', color: 'white' }\">{{ animal }}</span>",
  "</template>",
  "<style scoped>",
  ".git-badge {",
  "  display: inline-flex;",
  "  align-items: center;",
  "  justify-content: center;",
  "  width: 34px;",
  "  height: 34px;",
  "  border-radius: 10px;",
  "  font-size: 18px;",
  "  color: white;",
  "  box-shadow: inset 0 1px 0 rgba(255,255,255,0.35);",
  "  user-select: none;",
  "  line-height: 1;",
  "}",
  "</style>"
].join("\n");

fs.writeFileSync("src/components/GitBadge.vue", badge);
console.log("GitBadge.vue written");

// Update App.vue
let app = fs.readFileSync("src/App.vue", "utf8");
app = app.replace(/\nconst githubBadge[\s\S]*?return variants\[hash % variants\.length\]\n\}\)/, "\n");
app = app.replace(/<span class="github-icon"[^>]*>.*?<\/span>/, "<GitBadge :name=\"git.githubInfo?.fullName || 'github'\" />");
if (!app.includes("import GitBadge")) {
  app = app.replace("import GitGuide from './components/GitGuide.vue'", "import GitBadge from './components/GitBadge.vue'\nimport GitGuide from './components/GitGuide.vue'");
}
fs.writeFileSync("src/App.vue", app);
console.log("App.vue updated");

// Clean old github-icon styles
let css = fs.readFileSync("src/styles.css", "utf8");
css = css.replace(/\.github-icon \{[\s\S]*?\.github-icon\.badge-5 \{[\s\S]*?\}/, "");
fs.writeFileSync("src/styles.css", css);
console.log("CSS cleaned");
