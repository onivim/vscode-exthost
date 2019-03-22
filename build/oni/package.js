const path = require("path");
const rimraf = require("rimraf");
const mkdirp = require("mkdirp");

const fs = require("fs-extra");

const rootDir = path.join(__dirname, "..", "..");
const publishDir = path.join(rootDir, "_package");
const outDir = path.join(rootDir, "out");
const packageOutDir = path.join(publishDir, "out");

const srcPackageJson = path.join(rootDir, "oni.package.json");
const destPackageJson = path.join(publishDir, "package.json");

const srcProductJson = path.join(rootDir, "product.json");
const destProductJson = path.join(publishDir, "product.json");

console.log(`Removing existing publish directory: ${publishDir}..`);
rimraf.sync(publishDir);

console.log(`Creating new publish directory: ${publishDir}...`);
mkdirp.sync(publishDir);

console.log(`Copying ${outDir} to ${packageOutDir}...`)
fs.copySync(outDir, packageOutDir);

console.log(`Copying ${srcPackageJson} to ${destPackageJson}`);
fs.copySync(srcPackageJson, destPackageJson);

console.log(`Copying ${srcProductJson} to ${destProductJson}`);
fs.copySync(srcProductJson, destProductJson);
