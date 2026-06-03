const express = require("express");
const https = require("https");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 7030;

app.use(express.static(path.join(__dirname, "public")));

const options = {
  key: fs.readFileSync(path.join(__dirname, "certs/key.pem")),
  cert: fs.readFileSync(path.join(__dirname, "certs/cert.pem")),
};

https.createServer(options, app).listen(PORT, "0.0.0.0", () => {
  console.log(`\n  FACE ARCADE online (HTTPS)`);
  console.log(`  Local:    https://localhost:${PORT}`);
  console.log(`  Tailnet:  https://kokos-mac-mini:${PORT}`);
  console.log(`  Tailnet:  https://100.102.166.19:${PORT}\n`);
});
