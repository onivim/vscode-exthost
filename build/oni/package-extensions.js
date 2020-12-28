/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Outrun Labs, LLC. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const path = require("path");
const rimraf = require("rimraf");
const mkdirp = require("mkdirp");

const fs = require("fs-extra");

const rootDir = path.join(__dirname, "..", "..");
const publishDir = path.join(rootDir, "_package_extensions");
const extensionsDir = path.join(rootDir, "extensions");

console.log(`Removing existing publish directory: ${publishDir}..`);
rimraf.sync(publishDir);

console.log(`Creating new publish directory: ${publishDir}...`);
mkdirp.sync(publishDir);

const extensionsToInclude = [
	"bat",
	"clojure",
	"coffeescript",
	"cpp",
	"csharp",
	"css",
	"css-language-features",
	"docker",
	"fsharp",
	"git",
	"go",
	"groovy",
	"grunt",
	"gulp",
	"handlebars",
	"hlsl",
	"html",
	"html-language-features",
	"ini",
	"jake",
	"java",
	"javascript",
	"json",
	"json-language-features",
	"less",
	"log",
	"lua",
	"make",
	"markdown-basics",
	"markdown-language-features",
	"merge-conflict",
	"objective-c",
	"perl",
	"php",
	"php-language-features",
	"powershell",
	"pug",
	"python",
	"r",
	"razor",
	"ruby",
	"rust",
	"scss",
	"shaderlab",
	"shellscript",
	"sql",
	"swift",
	"theme-abyss",
	"theme-kimbie-dark",
	"theme-monokai",
	"theme-monokai-dimmed",
	"theme-quietlight",
	"theme-red",
	"theme-solarized-dark",
	"theme-solarized-light",
	"theme-tomorrow-night-blue",
	"types",
	"typescript-basics",
	"typescript-language-features",
	"xml",
	"yaml",
];

const pathsToRemove = [
	"**/*.css",
	"**/*.js.map",
	"**/node_modules",
	"css/test",
	"cpp/test",
	"typescript-basics/test",
];

const extensionWithDependencies = [
	"css-language-features",
	"css-language-features/server",
	// "emmet",
	"git",
	// "grunt",
	// "gulp,"
	"html-language-features",
	"html-language-features/server",
	"json-language-features",
	"json-language-features/server",
	"markdown-language-features",
	"merge-conflict",
	"php-language-features",
	"typescript-language-features",
];

// Copy all extensions...

extensionsToInclude.forEach(extension => {
	const extensionPath = path.join(extensionsDir, extension);
	const outPath = path.join(publishDir, extension);
	console.log(`Copying ${extensionPath} to ${outPath}...`)
	fs.copySync(extensionPath, outPath);
})

// Merge all package.json into a single one

const semver = require("semver");
const sourcePackageJson = fs.readFileSync(
	path.join(rootDir, "oni-extensions.package.json")
);

let extensionPackageJSON = JSON.parse(sourcePackageJson);
let allDependencies = extensionPackageJSON.dependencies;
extensionWithDependencies.forEach(extensionWithDependencies => {
	const packageJsonPath = path.join(extensionsDir, extensionWithDependencies, "package.json");
	console.log(`Reading dependencies for ${packageJsonPath}`);
	const packageJsonFile = fs.readFileSync(packageJsonPath);
	const newPackageJson = JSON.parse(packageJsonFile);
	const newDependencies = newPackageJson.dependencies;

	Object.keys(newDependencies).forEach((key) => {
		// Do we already have this dependency?
		if (allDependencies[key]) {
			if (allDependencies[key] != newDependencies[key]) {
				// Different version!
				const originalVersion = allDependencies[key];
				const newVersion = newDependencies[key];
				let versionToUse;
				if (semver.compare(semver.coerce(originalVersion), 
					semver.coerce(newVersion)) > 0) {
					// Using version
					versionToUse = originalVersion;
				} else {
					console.log("Case 2");
					versionToUse = newVersion;
				}
				console.log(`-- Using version ${versionToUse} for ${key}`);
				allDependencies[key] = versionToUse;
			} else {
				// No-op - same dependency
			}
		} else {
			allDependencies[key] = newDependencies[key]
		}
	})

	// Delete the node_modules from this folder

	const nodeModulesPath = path.join(extensionsDir, extensionWithDependencies, "node_modules");
	console.log("Deleting path: " + nodeModulesPath);
	rimraf.sync(nodeModulesPath);
});


const dependencies = JSON.stringify(allDependencies);
console.log(`Final dependency set: ${dependencies}`)

extensionPackageJSON.dependencies = allDependencies;
fs.writeFileSync(
	path.join(publishDir, "package.json"),
	JSON.stringify(extensionPackageJSON, null, 2)
);

// console.log(`Copying ${outDir} to ${packageOutDir}...`)
// fs.copySync(outDir, packageOutDir);

// console.log(`Copying ${srcPackageJson} to ${destPackageJson}`);
// fs.copySync(srcPackageJson, destPackageJson);

// console.log(`Copying ${srcProductJson} to ${destProductJson}`);
// fs.copySync(srcProductJson, destProductJson);

pathsToRemove.forEach((p) => {
	const pathToRemove = path.join(publishDir, p);
	console.log("Remove path: " + pathToRemove);
	rimraf.sync(pathToRemove);
});
