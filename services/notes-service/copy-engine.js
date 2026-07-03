const fs = require("fs");
const path = require("path");

const srcDir = path.join(__dirname, "src/generated/prisma");
const distDir = path.join(
  __dirname,
  "dist/services/notes-service/src/generated/prisma",
);

if (!fs.existsSync(srcDir)) {
  console.error(`Source directory not found: ${srcDir}`);
  process.exit(1);
}

fs.readdirSync(srcDir).forEach((file) => {
  if (file.endsWith(".node")) {
    fs.copyFileSync(path.join(srcDir, file), path.join(distDir, file));
    console.log(`Copied engine: ${file}`);
  }
});
