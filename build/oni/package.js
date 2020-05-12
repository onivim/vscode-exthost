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

const pathsToRemove = [
	"**/*.css",
	"**/*.js.map",
	"vs/base/test",
	"vs/code/test",
	"vs/editor/contrib/suggest/test",
	"vs/editor/contrib/documentSymbols/test",
	"vs/editor/contrib/folding/test",
	"vs/editor/contrib/linesOperations/test",
	"vs/editor/contrib/comment/test",
	"vs/editor/contrib/snippet/test",
	"vs/editor/standalone/test",
	"vs/editor/test",
	"vs/platform/keybinding/test",
	"vs/platform/configuration/test",
	"vs/platform/markers/test",
	"vs/platform/instantiation/test",
	"vs/platform/workspace/test",
	"vs/platform/state/test",
	"vs/platform/workspaces/test",
	"vs/platform/storage/test",
	"vs/platform/storage/test",
	"vs/platform/contextkey/test",
	"vs/platform/extensions/test",
	"vs/platform/userDataSync/test",
	"vs/platform/actions/test",
	"vs/platform/registry/test",
	"vs/platform/files/test",
	"vs/platform/environment/test",
	"vs/platform/commands/test",
	"vs/platform/telemetry/test",
	"vs/platform/windows/test",
	"vs/platform/backup/test",
	"vs/platform/extensionManagement/test",
	"vs/workbench/contrib/debug/test",
	"vs/workbench/contrib/files/test",
	"vs/workbench/contrib/notebook/test",
	"vs/workbench/contrib/snippets/test",
	"vs/workbench/contrib/preferences/test",
	"vs/workbench/contrib/codeEditor/test",
	"vs/workbench/contrib/tasks/test",
	"vs/workbench/contrib/markers/test",
	"vs/workbench/contrib/experiments/test",
	"vs/workbench/contrib/output/test",
	"vs/workbench/contrib/terminal/test",
	"vs/workbench/services/configuration/test",
	"vs/workbench/services/keybinding/test",
	"vs/workbench/services/label/test",
	"vs/workbench/services/preferences/test",
	"vs/workbench/services/progress/test",
	"vs/workbench/services/search/test",
	"vs/workbench/services/textfile/test",
	"vs/workbench/test",
];

pathsToRemove.forEach((p) => {
	const pathToRemove = path.join(packageOutDir, p);
	console.log("Remove path: " + pathToRemove);
	rimraf.sync(pathToRemove);
});
