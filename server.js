const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 7030;

app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n  FACE ARCADE online`);
  console.log(`  Local:    http://localhost:${PORT}`);
  console.log(`  Tailnet:  http://kokos-mac-mini:${PORT}`);
  console.log(`  Tailnet:  http://100.102.166.19:${PORT}\n`);
});
